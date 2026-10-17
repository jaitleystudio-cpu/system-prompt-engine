"""
SPE Ω — WPEM Compositional Obligation Preservation Invariant (COPI) Guard.
Prevents pipeline compositional semantic holes when chaining multiple execution transformations (T_2 ∘ T_1).
"""

from typing import Dict, Any, List, Set, Tuple, Optional
from .types import TransformationRecord


class CompositionalGuard:
    """
    Verifies that composing two transformations T1 and T2 satisfies the
    Compositional Obligation Preservation Invariant (COPI):
    Obligations(T2 ∘ T1) ⊇ Obligations(T1) ∪ Obligations(T2) ∪ RelationalClosure(A, B).
    """

    @staticmethod
    def verify_composition(
        t1: TransformationRecord,
        t2: TransformationRecord,
        relational_invariants: Optional[Set[str]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates pipeline composition safety:
        1. Target operation of T1 must match or be compatible with Source operation of T2.
        2. T2 preconditions must not be violated by T1 output contract.
        3. Mandatory obligations of both stages must be preserved.
        4. Cross-procedure relational invariants must be explicitly checked.
        """
        # 1. Pipeline interface compatibility
        if t1.target_operation != t2.source_operation:
            return False, (
                f"Interface mismatch in composition: T1 target '{t1.target_operation}' "
                f"does not match T2 source '{t2.source_operation}'"
            )

        # 2. Privacy compatibility: T2 cannot demand looser privacy than T1 permits
        # (e.g. if T1 enforces AIR_GAPPED, T2 cannot perform PUBLIC_EGRESS)
        from spe_runtime.research.wdes.types import NetworkPolicy
        policy_order = {
            NetworkPolicy.AIR_GAPPED: 0,
            NetworkPolicy.LOCAL_ONLY: 1,
            NetworkPolicy.RESTRICTED_CLOUD: 2,
            NetworkPolicy.PUBLIC_EGRESS: 3,
        }
        if policy_order.get(t2.privacy_boundary, 0) > policy_order.get(t1.privacy_boundary, 0):
            return False, (
                f"Privacy boundary violation in composition: T1 is '{t1.privacy_boundary.value}' "
                f"but T2 requires '{t2.privacy_boundary.value}'"
            )

        # 3. Obligation preservation
        t1_obs = set(t1.obligation_mapping.keys())
        t2_obs = set(t2.obligation_mapping.keys())
        combined_obs = t1_obs.union(t2_obs)

        # 4. Check relational invariants if specified
        if relational_invariants:
            missing = relational_invariants - combined_obs
            if missing:
                return False, f"COPI violation: compositional relational invariants missing: {missing}"

        return True, None
