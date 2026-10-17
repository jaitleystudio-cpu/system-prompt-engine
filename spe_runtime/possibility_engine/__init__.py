"""SPE Possibility Engine (The Living Outcome Contract) Python Runtime Kernel.

Implements:
1. Ante-hoc Counterfactual Topology Forking
2. Expected Value of Information (EVOI) Single High-Value Decision Evaluator
3. ProtectedIntent & Propositional Invariant Compilation
4. XCAT Metamorphic Acceptance Obligations (C01–C12)
5. Causal Minimal-Cut Failure Attribution (Pearl do-calculus bisection)
6. Counterexample Immunization into .spe Regression Packs
"""

from spe_runtime.possibility_engine.kernel import (
    OutcomeTopology,
    EvoiDecision,
    LivingOutcomeContract,
    CausalBisectResult,
    synthesize_topologies,
    compute_evoi_decision,
    compile_living_outcome_contract,
    perform_causal_bisection,
)

__all__ = [
    "OutcomeTopology",
    "EvoiDecision",
    "LivingOutcomeContract",
    "CausalBisectResult",
    "synthesize_topologies",
    "compute_evoi_decision",
    "compile_living_outcome_contract",
    "perform_causal_bisection",
]
