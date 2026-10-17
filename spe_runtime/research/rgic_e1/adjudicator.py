"""
RGIC-E1 Evidence Closure Planner — Adjudicator & Conservation Law Engine
Part of SPE Ω Research Quarantine.

Formal Invariants:
1. Narrow Conservation Law: Accept(o_i) => ValidEvidence(o_i, E)
   No obligation may be accepted as PASS without valid independent evidence receipts.
2. Anti-Self-Certification:
   Receipts issued by the agent under test (or matching agent_id) are strictly invalid.
3. Rule Tamper Guard:
   Any modification to acceptance_rule_ref without valid cryptographic digest causes FAIL.
4. Justified Exclusion:
   NOT_APPLICABLE requires explicit JustifiedExclusion; cannot be used as an escape hatch.
5. MasDrift Handoff Conservation:
   Multi-agent delegation cannot strip obligations or relax authority boundaries.
"""

import hashlib
from typing import List, Optional
from spe_runtime.research.rgic_e1.types import (
    Obligation, ObligationState, ClaimScope, EvidenceClosureContract, EvidenceReceipt
)

class RuleTamperingAttemptError(Exception):
    """Raised when an obligation's acceptance rule is altered without valid digest."""
    pass

class ObligationStrippingError(Exception):
    """Raised when multi-agent delegation drops obligations or weakens boundaries (MasDrift)."""
    pass

class Adjudicator:
    """
    Independent evidence adjudicator.
    Enforces that claim scope accurately reflects verified empirical reality.
    """
    def __init__(self):
        pass

    def adjudicate(self, contract: EvidenceClosureContract) -> None:
        all_pass = True
        has_fail = False
        has_unknown = False

        for obs in contract.obligations:
            # 1. Anti-Tamper Verification
            if not self._verify_rule_integrity(obs):
                obs.state = ObligationState.FAIL
                has_fail = True
                continue

            # 2. Conservation Law & Independent Evidence Check
            if not self.verify_obligation(obs, contract.agent_id):
                # If state was claimed PASS without valid independent receipts, demote to UNKNOWN
                if obs.state == ObligationState.PASS:
                    obs.state = ObligationState.UNKNOWN

            # 3. Justified Exclusion Check for NOT_APPLICABLE
            if obs.state == ObligationState.NOT_APPLICABLE:
                if not obs.justified_exclusion or not obs.justified_exclusion.reason:
                    # Unjustified escape hatch -> Demote to UNKNOWN
                    obs.state = ObligationState.UNKNOWN

            # Evaluate states
            if obs.state == ObligationState.FAIL:
                has_fail = True
            elif obs.state == ObligationState.UNKNOWN:
                has_unknown = True
                all_pass = False
            elif obs.state != ObligationState.PASS and obs.state != ObligationState.NOT_APPLICABLE:
                all_pass = False

        # Claim Scope Determination
        if has_fail:
            contract.claim_scope = ClaimScope.LIMITED
        elif all_pass and len(contract.obligations) > 0:
            contract.claim_scope = ClaimScope.VERIFIED
        else:
            contract.claim_scope = ClaimScope.UNRESOLVED

    def verify_obligation(self, obligation: Obligation, agent_id: str = "") -> bool:
        """
        Verifies whether an obligation's state is supported by evidence.
        PASS requires at least one valid, independent receipt.
        """
        if obligation.state in (ObligationState.UNKNOWN, ObligationState.NOT_APPLICABLE, ObligationState.FAIL):
            return True

        if obligation.state == ObligationState.PASS:
            # Filter receipts: must be valid and NOT issued by the agent under test
            valid_receipts: List[EvidenceReceipt] = []
            for r in obligation.evidence_receipts:
                if not r.is_valid:
                    continue
                # Anti-Self-Certification Guard
                if agent_id and r.issuer_id == agent_id:
                    continue
                if r.issuer_id in ("self", "agent-under-test", "candidate-agent"):
                    continue
                valid_receipts.append(r)

            # Check min_receipts policy if specified
            min_required = 1
            if obligation.evidence_policy:
                min_required = max(1, obligation.evidence_policy.min_receipts)
                # Check evidence type match
                valid_receipts = [
                    r for r in valid_receipts 
                    if r.evidence_type == obligation.evidence_policy.required_evidence_type
                    or obligation.evidence_policy.required_evidence_type == "ANY"
                ]

            return len(valid_receipts) >= min_required

        return False

    def _verify_rule_integrity(self, obligation: Obligation) -> bool:
        """Verifies that acceptance_rule_ref matches rule_digest."""
        if not obligation.rule_digest:
            return True
        computed = hashlib.sha256(obligation.acceptance_rule_ref.encode('utf-8')).hexdigest()
        return computed == obligation.rule_digest

    def validate_delegation_handoff(
        self, parent_contract: EvidenceClosureContract, child_contract: EvidenceClosureContract
    ) -> bool:
        """
        MasDrift Mitigation:
        Ensures that child contract does not strip obligations or escalate authority limits.
        """
        parent_obs_map = {o.id: o for o in parent_contract.obligations}
        child_obs_map = {o.id: o for o in child_contract.obligations}

        # Invariant 1: All parent obligations must be preserved in child
        for parent_id, p_obs in parent_obs_map.items():
            if parent_id not in child_obs_map:
                return False
            c_obs = child_obs_map[parent_id]
            # Cannot unilaterally promote state
            if p_obs.state == ObligationState.UNKNOWN and c_obs.state == ObligationState.PASS:
                if not self.verify_obligation(c_obs, child_contract.agent_id):
                    return False

            # Invariant 2: Authority boundary in child cannot exceed parent
            if p_obs.authority_boundary and c_obs.authority_boundary:
                p_bound = p_obs.authority_boundary
                c_bound = c_obs.authority_boundary
                if c_bound.max_cost_nano_usd > p_bound.max_cost_nano_usd:
                    return False
                if not p_bound.network_egress_allowed and c_bound.network_egress_allowed:
                    return False
                if not p_bound.filesystem_write_allowed and c_bound.filesystem_write_allowed:
                    return False

        return True
