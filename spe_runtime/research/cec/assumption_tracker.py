"""
SPE Ω — CEC Environmental Assumption & Drift Tracker.
Implements Law 5: Evidence expires with its assumptions.
Detects runtime, git commit, tool digest, or OS drift and triggers requalification.
"""

from typing import Tuple, List, Optional
from .types import EnvironmentFingerprint, ConservedContract, Disposition, ObligationRecord


class AssumptionTracker:
    """Monitors environmental continuity and invalidates evidence upon drift."""

    @staticmethod
    def detect_environmental_drift(
        env_prior: Optional[EnvironmentFingerprint],
        env_current: Optional[EnvironmentFingerprint],
    ) -> Tuple[bool, List[str]]:
        """
        Compares two environment fingerprints.
        Returns (has_drift, list_of_drift_reasons).
        """
        if env_prior is None or env_current is None:
            # Missing baseline implies unverified assumptions
            return True, ["Missing environment baseline fingerprint"]

        reasons = []
        if env_prior.os_name != env_current.os_name:
            reasons.append(f"OS mismatch: {env_prior.os_name} -> {env_current.os_name}")
        if env_prior.git_commit != env_current.git_commit:
            reasons.append(f"Codebase git commit drift: {env_prior.git_commit} -> {env_current.git_commit}")
        if env_prior.runtime_version != env_current.runtime_version:
            reasons.append(f"Runtime version change: {env_prior.runtime_version} -> {env_current.runtime_version}")
        if env_prior.tool_digest != env_current.tool_digest:
            reasons.append(f"Toolchain / dependency digest mismatch: {env_prior.tool_digest} -> {env_current.tool_digest}")

        return len(reasons) > 0, reasons

    @staticmethod
    def apply_drift_invalidation(
        contract: ConservedContract,
        env_current: EnvironmentFingerprint,
    ) -> ConservedContract:
        """
        Demotes any VERIFIED evidence to STALE_RECHECK_REQUIRED if environmental drift is detected.
        """
        has_drift, reasons = AssumptionTracker.detect_environmental_drift(
            contract.environment_fingerprint,
            env_current,
        )
        if not has_drift:
            return contract

        updated_obligations = {}
        for oid, ob in contract.obligations.items():
            if ob.disposition == Disposition.VERIFIED:
                # Demote stale evidence
                updated_obligations[oid] = ObligationRecord(
                    obligation_id=ob.obligation_id,
                    requirement_ref=ob.requirement_ref,
                    predicate_spec=ob.predicate_spec,
                    disposition=Disposition.STALE_RECHECK_REQUIRED,
                    assigned_agent_id=ob.assigned_agent_id,
                    witness_receipt_ref=ob.witness_receipt_ref,
                    is_mandatory=ob.is_mandatory,
                )
            else:
                updated_obligations[oid] = ob

        contract.obligations = updated_obligations
        contract.environment_fingerprint = env_current
        return contract
