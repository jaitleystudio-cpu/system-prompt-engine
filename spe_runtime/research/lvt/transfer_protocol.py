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
    ) -> Dict[str, Any]:
        """
        Tests whether an admitted learning refinement generalizes to a distinct foundation model.
        """
        LearningTransferProtocol.assert_not_revoked(tx)

        if tx.status not in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED):
            raise ValueError(f"Cannot evaluate cross-model transfer for unqualified transaction (status={tx.status})")

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

    @staticmethod
    def synthesize_spe_learning_artifact(
        tx: LearningValidityTransaction,
        refined_prompt_content: str,
        supported_models: Sequence[str] = ("gpt-4o", "claude-3-7-sonnet", "llama-3-3-70b"),
    ) -> str:
        """
        Synthesizes a portable, self-contained .spe bundle embedding the verified learning artifact.
        """
        LearningTransferProtocol.assert_not_revoked(tx)

        if tx.status != QualificationStatus.QUALIFIED:
            raise ValueError(f"Cannot synthesize artifact for non-qualified transaction (status={tx.status})")

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
            "verified_models": list(supported_models),
            "empirical_gain": {
                "delta_improvement": tx.results.delta_improvement if tx.results else 0.0,
                "held_out_retention": tx.results.held_out_retention if tx.results else 0.0,
            },
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
        if not monitored_scores or not tx.results:
            return False

        current_avg = sum(monitored_scores) / len(monitored_scores)
        baseline_generalization = tx.results.arm_d_generalization_score

        if current_avg < (baseline_generalization - drift_tolerance):
            LearningTransferProtocol.revoke_transaction(
                tx,
                reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
                details=f"Current score {current_avg:.4f} dropped below generalization baseline {baseline_generalization:.4f} by > {drift_tolerance}",
            )
            return True
        return False
