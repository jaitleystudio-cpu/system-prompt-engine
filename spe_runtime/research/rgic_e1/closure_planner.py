from typing import List, Optional
from spe_runtime.research.rgic_e1.types import VerificationAction, Obligation

class ClosurePlanner:
    def __init__(self):
        pass

    def evaluate_action_utility(self, action: VerificationAction, obligation: Obligation) -> int:
        if not action.is_authorized:
            return -999999999
        
        # Mock expected improvement for now
        expected_improvement = 1000000 
        utility = expected_improvement - action.cost_nano_usd - action.risk_score
        return utility

    def select_minimal_probe(self, candidate_actions: List[VerificationAction], obligation: Obligation) -> Optional[VerificationAction]:
        best_action = None
        best_utility = float('-inf')

        for action in candidate_actions:
            if not action.is_authorized:
                continue
            
            utility = self.evaluate_action_utility(action, obligation)
            if utility > best_utility:
                best_utility = utility
                best_action = action

        return best_action
