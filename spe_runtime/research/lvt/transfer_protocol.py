"""
SPE Ω — Learning Transfer & Revocation Protocol (LVT-0).
Evaluates cross-model generalization, synthesizes portable .spe learning artifacts,
and enforces continuous monitoring with cryptographic revocation upon drift or counterexample.
"""

from __future__ import annotations

import json
from typing import Any, Callable, Dict, List, Optional, Sequence

from spe_runtime.research.lvt.types import (
    LearningValidityTransaction,
    QualificationStatus,
    RequalificationTrigger,
    RevocationReason,
    TransactionRevokedError,
)


class LearningTransferProtocol:
    """Manages cross-model portability, .spe contract bundle synthesis, and transaction revocation."""

    @staticmethod
    def assert_not_revoked(tx: LearningValidityTransaction) -> None:
        """Verifies that a transaction is active and has not been revoked."""
        if tx.status == QualificationStatus.REVOKED:
            raise TransactionRevokedError(
                f"LVT Invariant: Transaction '{tx.tx_id}' was revoked. Reason: {tx.revocation_reason}"
            )

    @staticmethod
    def evaluate_cross_model_transfer(
        tx: LearningValidityTransaction,
        target_model_id: str,
        evaluator_fn: Callable[[str, Dict[str, Any]], float],
        test_dataset: Sequence[Dict[str, Any]],
        base_prompt: str,
        refined_prompt: str,
        regression_tolerance: float = 0.05,
        validator: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Tests whether an admitted learning refinement generalizes to a distinct foundation model.
        """
        LearningTransferProtocol.assert_not_revoked(tx)

        from spe_runtime.research.lvt.learning_validator import LearningValidator
        if validator is not None and not isinstance(validator, LearningValidator):
            raise ValueError("Missing trusted verifier: validator must be an authoritative LearningValidator instance")

        if tx.status not in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED):
            raise ValueError(f"Cannot evaluate cross-model transfer for unqualified transaction (status={tx.status})")

        if (
            not tx.canonical_receipt_signature
            or not tx.artifact_hash
            or tx.lvt2_study_result is None
            or (tx.status == QualificationStatus.QUALIFIED and (not tx.is_attested_oracle or tx.oracle_attestation is None))
        ):
            raise ValueError("Cannot evaluate cross-model transfer without verified receipt and trusted qualification evidence")

        if validator is not None and not validator.verify_transaction_signature(tx):
            raise ValueError("Invalid receipt signature blocks cross-model transfer evaluation")

        if not test_dataset:
            raise ValueError("test_dataset cannot be empty")

        scores_base = [evaluator_fn(base_prompt, item) for item in test_dataset]
        scores_refined = [evaluator_fn(refined_prompt, item) for item in test_dataset]

        avg_base = sum(scores_base) / len(scores_base)
        avg_refined = sum(scores_refined) / len(scores_refined)
        transfer_delta = avg_refined - avg_base

        transfers_successfully = transfer_delta >= -regression_tolerance

        report = {
            "tx_id": tx.tx_id,
            "source_generator": tx.claim.generator_id,
            "target_model_id": target_model_id,
            "base_score": round(avg_base, 4),
            "refined_score": round(avg_refined, 4),
            "transfer_delta": round(transfer_delta, 4),
            "transfers_successfully": transfers_successfully,
            "sample_count": len(test_dataset),
        }

        # Track transfer qualifications in metadata
        if "cross_model_transfers" not in tx.metadata:
            tx.metadata["cross_model_transfers"] = {}
        tx.metadata["cross_model_transfers"][target_model_id] = report

        return report

    evaluate_transfer = evaluate_cross_model_transfer

    @staticmethod
    def synthesize_spe_learning_artifact(
        tx: LearningValidityTransaction,
        refined_prompt_content: str,
        supported_models: Optional[Sequence[str]] = None,
        validator: Optional[Any] = None,
    ) -> str:
        """
        Synthesizes a portable, self-contained .spe bundle embedding the verified learning artifact.
        Strictly enforces:
        1. Non-revoked state
        2. QUALIFIED status
        3. Exclusion of mock/test-only qualifications
        4. Independent trusted oracle attestation custody
        5. Evidence and protocol hash integrity
        6. Valid cryptographic receipt signature
        7. Model transfer verification for verified_models
        """
        LearningTransferProtocol.assert_not_revoked(tx)

        if tx.status == QualificationStatus.REVOKED or tx.revocation_reason is not None:
            raise ValueError(f"Cannot synthesize artifact for revoked transaction: {tx.revocation_reason}")

        from spe_runtime.research.lvt.learning_validator import LearningValidator
        if validator is not None and not isinstance(validator, LearningValidator):
            raise ValueError("Missing trusted verifier: validator must be an authoritative LearningValidator instance")

        if tx.status != QualificationStatus.QUALIFIED:
            raise ValueError(f"Cannot synthesize artifact for non-qualified transaction (status={tx.status})")

        if tx.metadata.get("test_fixture_mock") or tx.protocol_version != "LVT-2" or tx.lvt2_study_result is None:
            raise ValueError("Mock-qualified transaction cannot export a production-valid .spe learning artifact")

        if not tx.is_attested_oracle or tx.oracle_attestation is None:
            raise ValueError("Missing trusted oracle attestation blocks .spe export")

        study = tx.lvt2_study_result
        if not study or not getattr(study, "evidence_hash", None):
            raise ValueError("Invalid LVT-2 study evidence")

        # 5. Protocol and evidence integrity
        if not tx.protocol or not getattr(tx.protocol, "protocol_id", None):
            raise ValueError("Missing experiment protocol blocks .spe export")

        if "committed_protocol_id" in tx.metadata and tx.protocol.protocol_id != tx.metadata["committed_protocol_id"]:
            raise ValueError("Changed protocol invalidates qualification")

        if tx.oracle_attestation.evidence_hash != study.evidence_hash:
            raise ValueError("Changed evidence hash invalidates qualification")

        if "committed_evidence_hash" in tx.metadata and study.evidence_hash != tx.metadata["committed_evidence_hash"]:
            raise ValueError("Changed evidence hash invalidates qualification")

        # 4. Independent oracle attestation verification at export boundary
        att = tx.oracle_attestation
        if not att.oracle_public_key or len(att.oracle_public_key) != 64:
            raise ValueError("Invalid oracle public key format blocks .spe export")
        if not att.signature or len(att.signature) != 128:
            raise ValueError("Invalid oracle signature format blocks .spe export")
        if att.verdict != "APPROVED":
            raise ValueError(f"Unapproved oracle verdict blocks .spe export: {att.verdict}")
        if att.oracle_id != tx.evaluator_id:
            raise ValueError(f"Oracle identity mismatch at export boundary: '{att.oracle_id}' != '{tx.evaluator_id}'")

        from spe_runtime.ci_gate.receipt import ed25519_verify, rfc8785_canonicalize
        try:
            att_pk = bytes.fromhex(att.oracle_public_key)
            att_sig = bytes.fromhex(att.signature)
        except ValueError as e:
            raise ValueError(f"Hex decoding error in oracle attestation: {e}")

        att_dict = {
            "evidence_hash": att.evidence_hash,
            "oracle_id": att.oracle_id,
            "oracle_public_key": att.oracle_public_key,
            "timestamp": att.timestamp,
            "verdict": att.verdict,
        }
        att_canonical = rfc8785_canonicalize(att_dict)
        if not ed25519_verify(att_pk, att_canonical, att_sig):
            raise ValueError("Invalid oracle attestation cryptographic signature blocks .spe export")

        # If validator is provided, strictly enforce trusted oracle registry custody
        if validator is not None:
            oracle_ok, oracle_msg = validator.verify_oracle_attestation(
                att,
                study.evidence_hash,
                expected_oracle_id=tx.evaluator_id,
            )
            if not oracle_ok:
                raise ValueError(f"Oracle attestation rejected at export boundary: {oracle_msg}")

        if not tx.canonical_receipt_signature or not tx.artifact_hash:
            raise ValueError("Missing receipt signature blocks .spe export")

        from spe_runtime.research.lvt.learning_validator import LearningValidator
        val = validator or LearningValidator()
        if not val.verify_transaction_signature(tx):
            raise ValueError("Invalid receipt signature blocks .spe export")

        # 7. Unverified model transfer cannot be labeled as verified_models
        transfers = tx.metadata.get("cross_model_transfers", {})
        verified = set()
        if tx.claim.generator_id:
            verified.add(tx.claim.generator_id)
        for model_id, report in transfers.items():
            if isinstance(report, dict) and report.get("transfers_successfully") is True:
                verified.add(model_id)

        if supported_models is not None:
            if len(supported_models) == 0:
                raise ValueError("supported_models cannot be empty")
            unverified = [
                m for m in supported_models
                if not isinstance(m, str) or not m.strip() or m not in verified
            ]
            if unverified:
                raise ValueError(f"Unverified model transfer cannot be labeled as verified_models: {unverified}")
            models_to_export = list(supported_models)
        else:
            models_to_export = sorted(list(verified))

        empirical_gain = {
            "delta_improvement": study.family_macro_delta,
            "held_out_retention": study.holdout_candidate_minus_base,
        }

        artifact_doc = {
            "spe_version": "1.0",
            "artifact_type": "LEARNING_VALIDITY_TRANSACTION",
            "tx_id": tx.tx_id,
            "domain": tx.claim.domain,
            "generator_id": tx.claim.generator_id,
            "evaluator_id": tx.evaluator_id,
            "receipt": {
                "artifact_hash": tx.artifact_hash,
                "signature": tx.canonical_receipt_signature,
                "committed_timestamp": tx.committed_timestamp,
            },
            "verified_models": models_to_export,
            "empirical_gain": empirical_gain,
            "refined_prompt": refined_prompt_content,
        }

        return json.dumps(artifact_doc, indent=2)

    @staticmethod
    def revoke_transaction(
        tx: LearningValidityTransaction,
        reason: RevocationReason,
        details: str,
    ) -> LearningValidityTransaction:
        """
        Revokes a previously admitted transaction upon counterexample discovery or drift failure.
        """
        tx.status = QualificationStatus.REVOKED
        tx.revocation_reason = reason

        if "revocation_history" not in tx.metadata:
            tx.metadata["revocation_history"] = []

        tx.metadata["revocation_history"].append({
            "reason": reason.value,
            "details": details,
            "status_before": QualificationStatus.QUALIFIED.value,
        })

        return tx

    @staticmethod
    def check_distribution_drift_and_revoke(
        tx: LearningValidityTransaction,
        monitored_scores: Sequence[float],
        drift_tolerance: float = 0.15,
    ) -> bool:
        """
        Monitors ongoing production outputs. If average performance degrades below
        held-out generalization baseline by more than drift_tolerance, automatically revokes.
        """
        if not monitored_scores:
            return False

        if tx.lvt2_study_result:
            baseline_generalization = tx.lvt2_study_result.holdout_candidate_mean
        elif tx.results:
            baseline_generalization = tx.results.arm_d_generalization_score
        else:
            return False

        current_avg = sum(monitored_scores) / len(monitored_scores)

        if current_avg < (baseline_generalization - drift_tolerance):
            LearningTransferProtocol.revoke_transaction(
                tx,
                reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
                details=f"Current score {current_avg:.4f} dropped below generalization baseline {baseline_generalization:.4f} by > {drift_tolerance}",
            )
            return True
        return False
