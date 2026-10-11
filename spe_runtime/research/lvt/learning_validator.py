"""
SPE Ω — Learning Validator Engine (LVT-0).
Evaluates the formal admission rule Φ_LVT, strictly enforces independent evaluation,
rejects generating model self-certification, and generates Ed25519 transaction receipts.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any, Dict, Optional, Set, Tuple

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
    OracleAttestation,
    QualificationStatus,
)


class LearningValidator:
    """Formal verifier and transaction gatekeeper for AI learning validity claims."""

    def __init__(
        self,
        default_signing_key: Optional[bytes] = None,
        default_public_key: Optional[bytes] = None,
        trusted_oracle_keys: Optional[Any] = None,
        trusted_oracles: Optional[Dict[str, str] | Set[str]] = None,
    ) -> None:
        if default_signing_key and default_public_key:
            self._sk = default_signing_key
            self._pk = default_public_key
        else:
            self._sk, self._pk = generate_keypair()

        # Trusted oracle registry: binds oracle_id -> public_key_hex (64 hex lowercase)
        # Default behavior MUST FAIL CLOSED. No self-reported trust roots.
        self._trusted_oracles: Dict[str, str] = {}
        self._trusted_oracle_keys: Set[str] = set()

        sources = []
        if trusted_oracles is not None:
            sources.append(trusted_oracles)
        if trusted_oracle_keys is not None:
            sources.append(trusted_oracle_keys)

        for src in sources:
            if isinstance(src, dict):
                for oid, pkey in src.items():
                    oid_str = str(oid).strip()
                    pkey_str = str(pkey).strip().lower()
                    self._trusted_oracles[oid_str] = pkey_str
                    self._trusted_oracle_keys.add(pkey_str)
            elif isinstance(src, (set, list, tuple)):
                for item in src:
                    if isinstance(item, tuple) and len(item) == 2:
                        oid_str = str(item[0]).strip()
                        pkey_str = str(item[1]).strip().lower()
                        self._trusted_oracles[oid_str] = pkey_str
                        self._trusted_oracle_keys.add(pkey_str)
                    elif isinstance(item, str):
                        item_str = item.strip()
                        if ":" in item_str:
                            oid_str, pkey_str = item_str.split(":", 1)
                            oid_str = oid_str.strip()
                            pkey_str = pkey_str.strip().lower()
                            self._trusted_oracles[oid_str] = pkey_str
                            self._trusted_oracle_keys.add(pkey_str)
                        else:
                            self._trusted_oracle_keys.add(item_str.lower())

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

        if not results and not tx.lvt2_study_result:
            return {
                "ContractValid": contract_valid,
                "ExperimentAuthorized": False,
                "EvidenceAuthentic": False,
                "EvaluationIndependent": False,
                "ImprovementSupported": False,
                "NoDisqualifyingRegression": False,
            }

        # Independent evaluation: evaluator != generator and not self-type
        eval_independent = (
            tx.evaluator_type != EvaluatorType.GENERATING_MODEL_SELF
            and tx.evaluator_id != claim.generator_id
            and bool(tx.evaluator_id)
        )

        if tx.lvt2_study_result:
            study = tx.lvt2_study_result
            improvement_supported = (
                study.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
                and study.train_candidate_minus_base > 0.0
                and study.train_candidate_minus_shuffled > 0.0
                and study.family_macro_delta >= 0.0
                and study.p_value <= study.alpha_adjusted
                and "EFFECT_FLOOR_UNMET" not in study.reasons
                and "PAIRED_DIRECTIONAL_TEST_INCONCLUSIVE" not in study.reasons
                and "INSUFFICIENT_INDEPENDENT_FAMILIES" not in study.reasons
            )
            no_regression = (
                study.family_macro_delta >= 0.0
                and study.status not in ("REJECTED", "INCONCLUSIVE")
                and "HELDOUT_REGRESSION" not in study.reasons
            )
            return {
                "ContractValid": contract_valid,
                "ExperimentAuthorized": True,
                "EvidenceAuthentic": 0.0 <= study.holdout_base_mean <= 1.0 and 0.0 <= study.holdout_candidate_mean <= 1.0,
                "EvaluationIndependent": eval_independent,
                "ImprovementSupported": improvement_supported,
                "NoDisqualifyingRegression": no_regression,
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
        evidence_authentic = all(0.0 <= s <= 1.0 for s in scores)

        # Supported improvement: Arm B beats baseline and shuffled control by epsilon
        improvement_supported = (
            results.delta_improvement >= protocol.significance_threshold_epsilon
            and results.control_delta >= protocol.significance_threshold_epsilon
        )

        # No disqualifying regression: Held-out Arm D retention within tolerance and statistically significant
        # Ensure held-out delta is strictly paired with arm_d_baseline_score, NOT arm_a_baseline_score!
        unpaired_mismatch = False
        if results.arm_d_baseline_score > 0.0 and abs(results.arm_d_baseline_score - results.arm_a_baseline_score) > 1e-4:
            if (
                abs(results.held_out_retention - (results.arm_d_generalization_score - results.arm_a_baseline_score)) < 1e-4
                and abs(results.held_out_retention - (results.arm_d_generalization_score - results.arm_d_baseline_score)) > 1e-4
            ):
                unpaired_mismatch = True

        paired_retention = (
            (results.arm_d_generalization_score - results.arm_d_baseline_score)
            if results.arm_d_baseline_score > 0.0
            else results.held_out_retention
        )

        no_regression = (
            not unpaired_mismatch
            and results.held_out_retention >= -protocol.generalization_tolerance_delta
            and paired_retention >= -protocol.generalization_tolerance_delta
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
        allow_mock_qualification: bool = False,
    ) -> LearningValidityTransaction:
        """
        Validates learning claim against the formal conjuncts.
        If self-certification is attempted, immediately raises GeneratingModelSelfCertificationError.
        If valid, signs and commits the transaction into QUALIFIED or RESEARCH_SUPPORTED status.
        If legacy V1 aggregate-only results are supplied without explicit allow_mock_qualification:
            Fails closed to RESEARCH_UNQUALIFIED (production QUALIFIED cannot be minted).
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
            if tx.lvt2_study_result is not None:
                study = tx.lvt2_study_result
                if study.status == "INCONCLUSIVE":
                    tx.status = QualificationStatus.INCONCLUSIVE
                    tx.rejection_reason = f"LVT-2 study inconclusive: {', '.join(study.reasons)}"
                else:
                    tx.status = QualificationStatus.REJECTED
                    tx.rejection_reason = f"LVT-2 study rejected: {', '.join(study.reasons)}" if study.reasons else reason
            else:
                tx.status = QualificationStatus.REJECTED
                tx.rejection_reason = reason
            if strict:
                raise LearningValidityRuleViolation(tx.rejection_reason)
            return tx

        # LVT-2 & Custody Gate:
        # Prevent legacy V1 aggregate-only results from minting production qualification
        if tx.lvt2_study_result is not None:
            study = tx.lvt2_study_result
            tx.protocol_version = "LVT-2"
            if study.status == "REJECTED":
                tx.status = QualificationStatus.REJECTED
                tx.rejection_reason = f"LVT-2 study rejected: {', '.join(study.reasons)}"
                return tx
            elif study.status == "INCONCLUSIVE":
                tx.status = QualificationStatus.INCONCLUSIVE
                tx.rejection_reason = f"LVT-2 study inconclusive: {', '.join(study.reasons)}"
                return tx
            elif study.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED":
                oracle_ok, oracle_msg = self.verify_oracle_attestation(
                    tx.oracle_attestation,
                    study.evidence_hash,
                    expected_oracle_id=tx.evaluator_id,
                )
                if oracle_ok:
                    tx.status = QualificationStatus.QUALIFIED
                    tx.is_attested_oracle = True
                    tx.rejection_reason = None
                else:
                    tx.is_attested_oracle = False
                    # Distinguish rejection (tampered evidence, unapproved verdict, identity mismatch)
                    if tx.oracle_attestation is not None and any(
                        kw in oracle_msg for kw in ("mismatch", "unapproved", "invalid", "untrusted")
                    ):
                        tx.status = QualificationStatus.REJECTED
                        tx.rejection_reason = f"Oracle attestation rejected: {oracle_msg}"
                        if strict:
                            raise LearningValidityRuleViolation(tx.rejection_reason)
                        return tx
                    else:
                        tx.status = QualificationStatus.RESEARCH_SUPPORTED
                        tx.rejection_reason = (
                            "Research supported by family-level exact sign test; "
                            f"external oracle attestation required for production qualification ({oracle_msg})."
                        )
            else:
                tx.status = QualificationStatus.REJECTED
                tx.rejection_reason = f"Unknown LVT-2 study status: {study.status}"
                return tx
        else:
            # Legacy V1 aggregate-only: FAIL CLOSED. Production bypass is strictly forbidden.
            tx.status = QualificationStatus.RESEARCH_UNQUALIFIED
            tx.canonical_receipt_signature = ""
            tx.artifact_hash = ""
            tx.rejection_reason = (
                "V1 aggregate-only results cannot mint production QUALIFIED receipt. "
                "LVT-2 family-level evaluation and independent oracle attestation required."
            )
            return tx

        if tx.status in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED):
            tx.committed_timestamp = time.time()
            receipt_dict = self._build_receipt_dict(tx)
            canonical_bytes = rfc8785_canonicalize(receipt_dict)
            tx.artifact_hash = hashlib.sha256(canonical_bytes).hexdigest()

            sk = signing_key or self._sk
            pk = public_key or self._pk
            sig_bytes = ed25519_sign(sk, pk, canonical_bytes)
            tx.canonical_receipt_signature = sig_bytes.hex()
            tx.metadata["public_key"] = pk.hex()
        else:
            tx.canonical_receipt_signature = ""
            tx.artifact_hash = ""

        return tx

    @classmethod
    def mint_test_fixture_receipt(
        cls,
        tx: LearningValidityTransaction,
        signing_key: Optional[bytes] = None,
        public_key: Optional[bytes] = None,
    ) -> LearningValidityTransaction:
        """
        Separately scoped test-only mechanism for test fixture mock receipt serialization.
        Explicitly flagged as test-only; CANNOT enter production qualification.
        """
        tx.metadata["test_fixture_mock"] = True
        tx.status = QualificationStatus.RESEARCH_UNQUALIFIED
        tx.committed_timestamp = time.time()
        receipt_dict = cls._build_receipt_dict(tx)
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        tx.artifact_hash = hashlib.sha256(canonical_bytes).hexdigest()
        sk, pk = (signing_key, public_key) if (signing_key and public_key) else generate_keypair()
        sig_bytes = ed25519_sign(sk, pk, canonical_bytes)
        tx.canonical_receipt_signature = sig_bytes.hex()
        tx.metadata["public_key"] = pk.hex()
        return tx

    @staticmethod
    def _build_receipt_dict(tx: LearningValidityTransaction) -> Dict[str, Any]:
        study = tx.lvt2_study_result
        if study:
            arm_a = study.holdout_base_mean
            arm_b = study.holdout_candidate_mean
            arm_c = study.train_candidate_minus_shuffled
            arm_d = study.holdout_candidate_mean
            delta = study.family_macro_delta
        elif tx.results:
            arm_a = tx.results.arm_a_baseline_score
            arm_b = tx.results.arm_b_authentic_score
            arm_c = tx.results.arm_c_shuffled_control_score
            arm_d = tx.results.arm_d_generalization_score
            delta = tx.results.delta_improvement
        else:
            arm_a = arm_b = arm_c = arm_d = delta = 0.0

        receipt: Dict[str, Any] = {
            "tx_id": tx.tx_id,
            "claim_id": tx.claim.claim_id,
            "domain": tx.claim.domain,
            "generator_id": tx.claim.generator_id,
            "evaluator_id": tx.evaluator_id,
            "evaluator_type": tx.evaluator_type.value,
            "status": tx.status.value,
            "results": {
                "arm_a": arm_a,
                "arm_b": arm_b,
                "arm_c": arm_c,
                "arm_d": arm_d,
                "delta": delta,
            },
            "timestamp": tx.committed_timestamp,
        }
        if study:
            receipt["evidence_hash"] = study.evidence_hash
            receipt["protocol_version"] = "LVT-2"
        return receipt

    def verify_transaction_signature(
        self,
        tx: LearningValidityTransaction,
        public_key: Optional[bytes] = None,
    ) -> bool:
        """Cryptographically verifies the transaction's Ed25519 receipt signature."""
        if not tx.canonical_receipt_signature or not tx.committed_timestamp:
            return False

        pk = public_key
        if not pk and "public_key" in tx.metadata:
            pk = bytes.fromhex(tx.metadata["public_key"])
        if not pk:
            pk = self._pk

        receipt_dict = self._build_receipt_dict(tx)
        canonical_bytes = rfc8785_canonicalize(receipt_dict)
        sig_bytes = bytes.fromhex(tx.canonical_receipt_signature)
        return ed25519_verify(pk, canonical_bytes, sig_bytes)

    def verify_oracle_attestation(
        self,
        attestation: Optional[OracleAttestation],
        expected_evidence_hash: str,
        expected_oracle_id: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Cryptographically verifies an independent oracle attestation.
        Requires fail-closed verification against an authoritative trusted oracle registry,
        strict oracle identity binding, matching evidence hash, valid format, and valid signature.
        """
        if attestation is None:
            return False, "missing attestation"

        if attestation.verdict != "APPROVED":
            return False, f"unapproved verdict: {attestation.verdict}"

        if not attestation.evidence_hash or attestation.evidence_hash != expected_evidence_hash:
            return False, f"evidence hash mismatch ({attestation.evidence_hash} != {expected_evidence_hash})"

        if not attestation.oracle_public_key or len(attestation.oracle_public_key) != 64:
            return False, "invalid oracle public key format"

        if not attestation.signature or len(attestation.signature) != 128:
            return False, "invalid signature format"

        # FAIL CLOSED: Require configured trusted oracle registry
        if not self._trusted_oracles and not self._trusted_oracle_keys:
            return False, "no trusted oracle registry configured (fail closed)"

        # Binding check against expected evaluator/oracle identity (Task 2 F & Mutant M05)
        if expected_oracle_id and attestation.oracle_id != expected_oracle_id:
            return False, f"oracle identity mismatch: attestation oracle_id '{attestation.oracle_id}' != expected '{expected_oracle_id}'"

        oracle_pk = attestation.oracle_public_key.lower()

        # Check against trusted oracle registry bindings
        if self._trusted_oracles:
            if attestation.oracle_id not in self._trusted_oracles:
                return False, f"untrusted oracle identity: {attestation.oracle_id}"
            if self._trusted_oracles[attestation.oracle_id] != oracle_pk:
                return False, f"trusted key mismatch for oracle identity: {attestation.oracle_id}"

        if self._trusted_oracle_keys:
            if oracle_pk not in self._trusted_oracle_keys:
                return False, f"untrusted oracle public key: {attestation.oracle_public_key}"

        try:
            pk_bytes = bytes.fromhex(attestation.oracle_public_key)
            sig_bytes = bytes.fromhex(attestation.signature)
        except ValueError as e:
            return False, f"hex decoding error: {e}"

        attestation_dict = {
            "evidence_hash": attestation.evidence_hash,
            "oracle_id": attestation.oracle_id,
            "oracle_public_key": attestation.oracle_public_key,
            "timestamp": attestation.timestamp,
            "verdict": attestation.verdict,
        }
        canonical_bytes = rfc8785_canonicalize(attestation_dict)
        if not ed25519_verify(pk_bytes, canonical_bytes, sig_bytes):
            return False, "invalid cryptographic signature"

        return True, "verified"


def create_oracle_attestation(
    signing_key: bytes,
    public_key: bytes,
    oracle_id: str,
    evidence_hash: str,
    verdict: str = "APPROVED",
    timestamp: Optional[float] = None,
) -> OracleAttestation:
    """Helper to generate a cryptographically valid OracleAttestation for testing/production."""
    ts = timestamp if timestamp is not None else time.time()
    pk_hex = public_key.hex()
    attestation_dict = {
        "evidence_hash": evidence_hash,
        "oracle_id": oracle_id,
        "oracle_public_key": pk_hex,
        "timestamp": ts,
        "verdict": verdict,
    }
    canonical_bytes = rfc8785_canonicalize(attestation_dict)
    sig_bytes = ed25519_sign(signing_key, public_key, canonical_bytes)
    return OracleAttestation(
        oracle_id=oracle_id,
        oracle_public_key=pk_hex,
        evidence_hash=evidence_hash,
        timestamp=ts,
        verdict=verdict,
        signature=sig_bytes.hex(),
    )

