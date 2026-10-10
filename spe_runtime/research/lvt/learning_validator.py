"""
SPE Ω — Learning Validator Engine (LVT-0).
Evaluates the formal admission rule Φ_LVT, strictly enforces independent evaluation,
rejects generating model self-certification, and generates Ed25519 transaction receipts.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any, Dict, Optional, Tuple

from spe_runtime.ci_gate.receipt import (
    ed25519_sign,
    ed25519_verify,
    generate_keypair,
    rfc8785_canonicalize,
)
from spe_runtime.research.lvt.types import (
    EvaluatorType,
    GeneratingModelSelfCertificationError,
    LearningValidityRuleViolation,
    LearningValidityTransaction,
    QualificationStatus,
)


class LearningValidator:
    """Formal verifier and transaction gatekeeper for AI learning validity claims."""

    def __init__(
        self,
        default_signing_key: Optional[bytes] = None,
        default_public_key: Optional[bytes] = None,
    ) -> None:
        if default_signing_key and default_public_key:
            self._sk = default_signing_key
            self._pk = default_public_key
        else:
            self._sk, self._pk = generate_keypair()

    @property
    def public_key(self) -> bytes:
        return self._pk

    def evaluate_conjuncts(self, tx: LearningValidityTransaction) -> Dict[str, bool]:
        """Evaluates each of the six formal conjuncts of the LVT admission rule."""
        results = tx.results
        claim = tx.claim
        protocol = tx.protocol

        contract_valid = bool(
            claim.claim_id
            and claim.base_prompt_ref
            and claim.candidate_prompt_ref
            and protocol.protocol_id
        )

        if not results:
            return {
                "ContractValid": contract_valid,
                "ExperimentAuthorized": False,
                "EvidenceAuthentic": False,
                "EvaluationIndependent": False,
                "ImprovementSupported": False,
                "NoDisqualifyingRegression": False,
            }

        # Check authorization & budget limits
        budget_ok = results.total_cost_nanos <= claim.budget_nanos
        experiment_authorized = budget_ok and (results.total_cost_nanos <= protocol.max_cost_nanos)

        # Evidence authenticity
        scores = [
            results.arm_a_baseline_score,
            results.arm_b_authentic_score,
            results.arm_c_shuffled_control_score,
            results.arm_d_generalization_score,
        ]
        # LVT-0 FourArmResults stores aggregates only. Even plausible scores
        # and a true is_statistically_significant flag are not evidence of
        # paired held-out observations, data custody, or an independent oracle.
        # Fail closed until a versioned, externally attested LVT-2 admission
        # path is integrated and independently qualified.
        evidence_authentic = False

        # Independent evaluation: evaluator != generator and not self-type
        eval_independent = (
            tx.evaluator_type != EvaluatorType.GENERATING_MODEL_SELF
            and tx.evaluator_id != claim.generator_id
            and bool(tx.evaluator_id)
        )

        # Supported improvement: Arm B beats baseline and shuffled control by epsilon
        improvement_supported = (
            results.delta_improvement >= protocol.significance_threshold_epsilon
            and results.control_delta >= protocol.significance_threshold_epsilon
        )

        # No disqualifying regression: Held-out Arm D retention within tolerance and statistically significant
        no_regression = (
            results.held_out_retention >= -protocol.generalization_tolerance_delta
            and results.is_statistically_significant
        )

        return {
            "ContractValid": contract_valid,
            "ExperimentAuthorized": experiment_authorized,
            "EvidenceAuthentic": evidence_authentic,
            "EvaluationIndependent": eval_independent,
            "ImprovementSupported": improvement_supported,
            "NoDisqualifyingRegression": no_regression,
        }

    def validate_and_commit(
        self,
        tx: LearningValidityTransaction,
        signing_key: Optional[bytes] = None,
        public_key: Optional[bytes] = None,
        strict: bool = False,
    ) -> LearningValidityTransaction:
        """
        Validates learning claim against the formal conjuncts.
        If self-certification is attempted, immediately raises GeneratingModelSelfCertificationError.
        If valid, signs and commits the transaction into QUALIFIED status.
        """
        # Hard Invariant: Reject self-certification immediately
        if (
            tx.evaluator_type == EvaluatorType.GENERATING_MODEL_SELF
            or (tx.evaluator_id and tx.evaluator_id == tx.claim.generator_id)
        ):
            tx.status = QualificationStatus.REJECTED
            tx.rejection_reason = (
                f"Self-certification rejected: Generator '{tx.claim.generator_id}' "
                f"cannot evaluate its own claim (evaluator: '{tx.evaluator_id}', type: {tx.evaluator_type.value})"
            )
            raise GeneratingModelSelfCertificationError(tx.rejection_reason)

        conjuncts = self.evaluate_conjuncts(tx)
        all_passed = all(conjuncts.values())

        if not all_passed:
            failed = [k for k, v in conjuncts.items() if not v]
            reason = f"LVT admission rule violation: failed conjuncts: {', '.join(failed)}"
            tx.status = QualificationStatus.REJECTED
            tx.rejection_reason = reason
            # Never retain a stale positive receipt after re-evaluation.
            tx.artifact_hash = ""
            tx.canonical_receipt_signature = ""
            tx.committed_timestamp = None
            tx.metadata.pop("public_key", None)
            if strict:
                raise LearningValidityRuleViolation(reason)
            return tx

        # All conjuncts passed -> Commit into QUALIFIED
        tx.status = QualificationStatus.QUALIFIED
        tx.rejection_reason = None
        tx.committed_timestamp = time.time()

        # Compute deterministic RFC 8785 artifact hash
        receipt_dict = {
            "tx_id": tx.tx_id,
            "claim_id": tx.claim.claim_id,
            "domain": tx.claim.domain,
            "generator_id": tx.claim.generator_id,
            "evaluator_id": tx.evaluator_id,
            "evaluator_type": tx.evaluator_type.value,
            "status": tx.status.value,
            "results": {
                "arm_a": tx.results.arm_a_baseline_score if tx.results else 0.0,
                "arm_b": tx.results.arm_b_authentic_score if tx.results else 0.0,
                "arm_c": tx.results.arm_c_shuffled_control_score if tx.results else 0.0,
                "arm_d": tx.results.arm_d_generalization_score if tx.results else 0.0,
                "delta": tx.results.delta_improvement if tx.results else 0.0,
            },
            "timestamp": tx.committed_timestamp,
        }
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        tx.artifact_hash = hashlib.sha256(canonical_bytes).hexdigest()

        # Generate Ed25519 signature
        sk = signing_key or self._sk
        pk = public_key or self._pk
        sig_bytes = ed25519_sign(sk, pk, canonical_bytes)
        tx.canonical_receipt_signature = sig_bytes.hex()
        tx.metadata["public_key"] = pk.hex()

        return tx

    def verify_transaction_signature(
        self,
        tx: LearningValidityTransaction,
        public_key: Optional[bytes] = None,
    ) -> bool:
        """Cryptographically verifies the transaction's Ed25519 receipt signature."""
        if tx.status != QualificationStatus.QUALIFIED:
            return False
        if not tx.canonical_receipt_signature or not tx.committed_timestamp:
            return False

        pk = public_key
        if not pk and "public_key" in tx.metadata:
            pk = bytes.fromhex(tx.metadata["public_key"])
        if not pk:
            pk = self._pk

        receipt_dict = {
            "tx_id": tx.tx_id,
            "claim_id": tx.claim.claim_id,
            "domain": tx.claim.domain,
            "generator_id": tx.claim.generator_id,
            "evaluator_id": tx.evaluator_id,
            "evaluator_type": tx.evaluator_type.value,
            "status": tx.status.value,
            "results": {
                "arm_a": tx.results.arm_a_baseline_score if tx.results else 0.0,
                "arm_b": tx.results.arm_b_authentic_score if tx.results else 0.0,
                "arm_c": tx.results.arm_c_shuffled_control_score if tx.results else 0.0,
                "arm_d": tx.results.arm_d_generalization_score if tx.results else 0.0,
                "delta": tx.results.delta_improvement if tx.results else 0.0,
            },
            "timestamp": tx.committed_timestamp,
        }
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        sig_bytes = bytes.fromhex(tx.canonical_receipt_signature)
        return ed25519_verify(pk, canonical_bytes, sig_bytes)
