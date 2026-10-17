"""
SPE Ω — CEC Transition Validator & Monotone Join Operator.
Enforces the 6 Conservation Laws across all contract handoffs and DAG merges:
- Law 1: Protected-obligation continuity (O_parent = O_delegated ∪ O_retained)
- Law 2: No unauthorized capability expansion (A_child ⊆ A_parent ∩ A_auth)
- Law 3: No unsupported evidence promotion (UNKNOWN/OPEN -> VERIFIED requires witness)
- Law 4: Privacy boundaries survive compression (Label(target) >= Label(source))
- Law 5: Evidence expires with its assumptions (Environment drift forces recheck)
- Law 6: Unresolved uncertainty remains visible (Tasks with UNKNOWN cannot claim COMPLETED)
"""

from typing import Tuple, List, Set, Dict, Optional
from .types import (
    ConservedContract,
    ObligationRecord,
    Disposition,
    InformationLabel,
    TransitionWitness,
)
from .assumption_tracker import AssumptionTracker


class TransitionValidator:
    """Independent deterministic validator enforcing CEC invariants."""

    @staticmethod
    def validate_transition(
        source: ConservedContract,
        target: ConservedContract,
        witness: Optional[TransitionWitness] = None,
    ) -> Tuple[bool, List[str]]:
        """
        Validates transition T(S_source, S_target).
        Returns (is_valid, list_of_violations).
        """
        violations: List[str] = []

        # ---------------------------------------------------------
        # Law 1: Protected-Obligation Continuity
        # ---------------------------------------------------------
        source_mandatory_ids = {
            oid for oid, ob in source.obligations.items() if ob.is_mandatory
        }
        target_ids = set(target.obligations.keys())

        # If target is a delegated sub-contract
        if target.parent_contract_id == source.contract_id:
            retained_ids = set()
            if witness and "retained_obligations" in witness.reconciliation_details:
                retained_ids = set(witness.reconciliation_details["retained_obligations"])

            accounted_ids = target_ids.union(retained_ids)
            missing = source_mandatory_ids - accounted_ids
            if missing:
                violations.append(
                    f"Law 1 violation: Mandatory obligations dropped during delegation: {missing}"
                )
        else:
            # Full linear handoff: target must account for ALL mandatory obligations
            missing = source_mandatory_ids - target_ids
            if missing:
                violations.append(
                    f"Law 1 violation: Mandatory obligations omitted in linear handoff: {missing}"
                )

        # ---------------------------------------------------------
        # Law 2: No Unauthorized Capability Expansion
        # ---------------------------------------------------------
        escalated_auth = target.permitted_authorities - source.permitted_authorities
        if escalated_auth:
            violations.append(
                f"Law 2 violation: Child authority escalation detected: {escalated_auth} "
                f"not in parent authority {source.permitted_authorities}"
            )

        # Max delegation depth check (prevent unbounded loops)
        if target.delegation_depth > 5:
            violations.append(
                f"Law 2 violation: Maximum delegation depth exceeded: {target.delegation_depth} > 5"
            )

        # ---------------------------------------------------------
        # Law 3: No Unsupported Evidence Promotion
        # ---------------------------------------------------------
        for oid, target_ob in target.obligations.items():
            if oid in source.obligations:
                source_ob = source.obligations[oid]
                # Check for illegal promotion to VERIFIED
                if (
                    source_ob.disposition in (Disposition.OPEN, Disposition.IN_PROGRESS, Disposition.UNKNOWN, Disposition.STALE_RECHECK_REQUIRED)
                    and target_ob.disposition == Disposition.VERIFIED
                ):
                    if not target_ob.witness_receipt_ref:
                        violations.append(
                            f"Law 3 violation: Obligation '{oid}' promoted to VERIFIED without witness receipt"
                        )

                # Check for laundering UNKNOWN into OPEN
                if source_ob.disposition == Disposition.UNKNOWN and target_ob.disposition == Disposition.OPEN:
                    violations.append(
                        f"Law 3 violation: Obligation '{oid}' laundered from UNKNOWN to OPEN"
                    )

        # ---------------------------------------------------------
        # Law 4: Privacy Boundaries Survive Compression
        # ---------------------------------------------------------
        if target.information_label.rank() < source.information_label.rank():
            violations.append(
                f"Law 4 violation: Confidentiality label demotion from '{source.information_label.value}' "
                f"to '{target.information_label.value}' without declassification grant"
            )

        # ---------------------------------------------------------
        # Law 5: Evidence Expires with its Assumptions
        # ---------------------------------------------------------
        if source.environment_fingerprint and target.environment_fingerprint:
            has_drift, drift_reasons = AssumptionTracker.detect_environmental_drift(
                source.environment_fingerprint,
                target.environment_fingerprint,
            )
            if has_drift:
                for oid, target_ob in target.obligations.items():
                    if target_ob.disposition == Disposition.VERIFIED:
                        # If target claims VERIFIED despite drift without a fresh post-drift witness
                        if oid in source.obligations and source.obligations[oid].disposition == Disposition.VERIFIED:
                            if source.obligations[oid].witness_receipt_ref == target_ob.witness_receipt_ref:
                                violations.append(
                                    f"Law 5 violation: Stale witness '{target_ob.witness_receipt_ref}' "
                                    f"retained across environmental drift: {drift_reasons}"
                                )

        # ---------------------------------------------------------
        # Law 6: Unresolved Uncertainty Remains Visible
        # ---------------------------------------------------------
        # If witness asserts overall completion, verify no mandatory obligation is unresolved
        if witness and witness.reconciliation_details.get("assert_full_completion", False):
            unresolved = [
                oid for oid, ob in target.obligations.items()
                if ob.is_mandatory and ob.disposition != Disposition.VERIFIED
            ]
            if unresolved:
                violations.append(
                    f"Law 6 violation: Task claimed FULLY_VERIFIED while mandatory obligations remain unresolved: {unresolved}"
                )

        return len(violations) == 0, violations

    @staticmethod
    def reconcile_dag_join(
        parent: ConservedContract,
        children: List[ConservedContract],
        expected_delegated_ids: Optional[Set[str]] = None,
    ) -> Tuple[ConservedContract, bool, List[str]]:
        """
        Monotone Join Lattice Operator ⨆:
        Recombines parallel child execution states into parent contract.
        """
        violations: List[str] = []

        # Check obligation coverage
        combined_child_ids = set()
        for c in children:
            combined_child_ids.update(c.obligations.keys())

        if expected_delegated_ids is not None:
            missing_delegated = expected_delegated_ids - combined_child_ids
            if missing_delegated:
                violations.append(
                    f"DAG Join violation: Expected delegated obligations missing from child results: {missing_delegated}"
                )

        # Merged obligations map
        merged_obs: Dict[str, ObligationRecord] = dict(parent.obligations)

        for c in children:
            for oid, child_ob in c.obligations.items():
                if oid not in merged_obs:
                    merged_obs[oid] = child_ob
                    continue

                parent_ob = merged_obs[oid]

                # Kleene-3 Conjunction Merging
                if child_ob.disposition == Disposition.FAILED:
                    merged_obs[oid] = child_ob
                elif child_ob.disposition == Disposition.VERIFIED and parent_ob.disposition != Disposition.FAILED:
                    if child_ob.witness_receipt_ref:
                        merged_obs[oid] = child_ob
                    else:
                        violations.append(f"DAG Join: Child claimed VERIFIED for '{oid}' without witness receipt")
                elif child_ob.disposition in (Disposition.UNKNOWN, Disposition.STALE_RECHECK_REQUIRED):
                    if merged_obs[oid].disposition != Disposition.FAILED:
                        merged_obs[oid] = child_ob

        # Retain parent authority, revoking child grants
        reconciled = ConservedContract(
            contract_id=parent.contract_id,
            protected_intent_ref=parent.protected_intent_ref,
            root_commitment=parent.root_commitment,
            obligations=merged_obs,
            permitted_authorities=parent.permitted_authorities,  # parent authority restored
            information_label=parent.information_label,
            environment_fingerprint=parent.environment_fingerprint,
            parent_contract_id=parent.parent_contract_id,
            delegation_depth=parent.delegation_depth,
            schema_version=parent.schema_version,
        )

        return reconciled, len(violations) == 0, violations
