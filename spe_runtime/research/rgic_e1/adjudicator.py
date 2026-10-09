from typing import List
from spe_runtime.research.rgic_e1.types import Obligation, ObligationState, ClaimScope, EvidenceClosureContract

class Adjudicator:
    def adjudicate(self, contract: EvidenceClosureContract) -> None:
        all_pass = True
        has_fail = False

        for obs in contract.obligations:
            if not self.verify_obligation(obs):
                # Conservation law: Accept(o_i) => ValidEvidence(o_i, E)
                if obs.state == ObligationState.PASS:
                    # Invalid transition without valid evidence
                    obs.state = ObligationState.UNKNOWN
            
            if obs.state == ObligationState.FAIL:
                has_fail = True
            elif obs.state != ObligationState.PASS and obs.state != ObligationState.NOT_APPLICABLE:
                all_pass = False

        if has_fail:
            contract.claim_scope = ClaimScope.LIMITED
        elif all_pass and len(contract.obligations) > 0:
            contract.claim_scope = ClaimScope.VERIFIED
        else:
            contract.claim_scope = ClaimScope.UNRESOLVED

    def verify_obligation(self, obligation: Obligation) -> bool:
        if obligation.state == ObligationState.UNKNOWN:
            return True
        if obligation.state == ObligationState.NOT_APPLICABLE:
            return True
        if obligation.state == ObligationState.FAIL:
            return True
        
        # If PASS, it must have valid evidence
        valid_evidence = any(e.is_valid for e in obligation.evidence_receipts)
        return valid_evidence
