"""Cross-Model Transfer & Invalidation Matrix for Capability Capsules."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    TransferMatrix,
)


@dataclass(frozen=True)
class TransferEvaluationResult:
    model_id: str
    qualified: bool
    score: float
    reason: str


@dataclass(frozen=True)
class InvalidationCheckResult:
    valid: bool
    status: AdmissionState
    reason: str
    drift_detected: float
    changed_dependencies: List[str] = field(default_factory=list)


class CapabilityTransferEngine:
    """Manages cross-model qualification and automated invalidation/revocation."""

    @staticmethod
    def evaluate_model_transfer(
        capsule: CapabilityCapsule,
        model_id: str,
        success_rate: float,
        threshold: float = 0.90,
    ) -> TransferEvaluationResult:
        """Evaluate a target model against transfer threshold and update capsule."""
        qualified_models: Set[str] = set(capsule.transfer.qualified_models)
        rejected_models: Set[str] = set(capsule.transfer.rejected_models)

        if success_rate >= threshold:
            qualified = True
            qualified_models.add(model_id)
            rejected_models.discard(model_id)
            reason = f"Model {model_id} qualified with success rate {success_rate:.2f} >= {threshold:.2f}"
        else:
            qualified = False
            rejected_models.add(model_id)
            qualified_models.discard(model_id)
            reason = f"Model {model_id} rejected with success rate {success_rate:.2f} < {threshold:.2f}"

        # Update capsule transfer state
        capsule.transfer = TransferMatrix(
            qualified_models=sorted(list(qualified_models)),
            rejected_models=sorted(list(rejected_models)),
        )

        # Transition lifecycle state if applicable
        if qualified:
            if capsule.admission_state == AdmissionState.BEHAVIORALLY_QUALIFIED:
                capsule.transition_to(
                    AdmissionState.TRANSFER_QUALIFIED,
                    reason=f"Transfer qualified for {model_id}",
                )
        return TransferEvaluationResult(
            model_id=model_id,
            qualified=qualified,
            score=success_rate,
            reason=reason,
        )

    @classmethod
    def verify_and_enforce_revocation(
        cls,
        capsule: CapabilityCapsule,
        active_model_id: str,
        current_dependency_hashes: Dict[str, str],
        measured_drift: float = 0.0,
    ) -> InvalidationCheckResult:
        """Verify model version and dependency hashes.
        
        If mismatch or drift is detected, automatically triggers SUSPENDED revocation.
        """
        changed_deps: List[str] = []
        invalidation_reasons: List[str] = []

        # 1. Check Model Qualification
        if active_model_id not in capsule.transfer.qualified_models:
            invalidation_reasons.append(
                f"Active model '{active_model_id}' is not in qualified models {capsule.transfer.qualified_models}"
            )

        # 2. Check Dependency Hashes
        expected_hashes = capsule.revocation_rules.dependency_hashes
        for dep_name, expected_hash in expected_hashes.items():
            curr_hash = current_dependency_hashes.get(dep_name)
            if curr_hash is None:
                changed_deps.append(dep_name)
                invalidation_reasons.append(f"Missing dependency hash for '{dep_name}'")
            elif curr_hash != expected_hash:
                changed_deps.append(dep_name)
                invalidation_reasons.append(
                    f"Dependency hash mismatch for '{dep_name}': expected {expected_hash}, got {curr_hash}"
                )

        # 3. Check Drift Tolerance
        max_drift = capsule.revocation_rules.max_drift_tolerance
        if measured_drift > max_drift:
            invalidation_reasons.append(
                f"Measured drift {measured_drift:.4f} exceeded tolerance {max_drift:.4f}"
            )

        if invalidation_reasons:
            full_reason = "; ".join(invalidation_reasons)
            # If in an active admitted state, transition to SUSPENDED
            if capsule.admission_state in {
                AdmissionState.DEPLOYMENT_ELIGIBLE,
                AdmissionState.TRANSFER_QUALIFIED,
            }:
                capsule.transition_to(AdmissionState.SUSPENDED, reason=full_reason)

            return InvalidationCheckResult(
                valid=False,
                status=capsule.admission_state,
                reason=full_reason,
                drift_detected=measured_drift,
                changed_dependencies=changed_deps,
            )

        return InvalidationCheckResult(
            valid=True,
            status=capsule.admission_state,
            reason="Integrity verified",
            drift_detected=measured_drift,
            changed_dependencies=[],
        )

    @classmethod
    def reinstate_if_restored(
        cls,
        capsule: CapabilityCapsule,
        active_model_id: str,
        current_dependency_hashes: Dict[str, str],
        measured_drift: float = 0.0,
    ) -> bool:
        """Reinstate a SUSPENDED capsule to DEPLOYMENT_ELIGIBLE if all requirements pass."""
        if capsule.admission_state != AdmissionState.SUSPENDED:
            return False

        check = cls.verify_and_enforce_revocation(
            capsule,
            active_model_id=active_model_id,
            current_dependency_hashes=current_dependency_hashes,
            measured_drift=measured_drift,
        )

        if check.valid:
            capsule.transition_to(
                AdmissionState.DEPLOYMENT_ELIGIBLE,
                reason="Dependencies and model verified, reinstating from SUSPENDED",
            )
            return True
        return False
