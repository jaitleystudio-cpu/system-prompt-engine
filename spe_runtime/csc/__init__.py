"""
SPE Ω — Active Counterfactual Specification Closure (CSC) Package
"Challenge This Result" Anti-Lucky-Pass Verification Module
"""

from spe_runtime.csc.kernel import (
    ActiveCscReport,
    CandidateClaim,
    CounterfactualScenario,
    MinimalCutRepair,
    PerturbationOperator,
    ReleaseVerdict,
    ScenarioExecutionResult,
    challenge_candidate_claim,
    generate_minimal_cut_repairs,
    simulate_scenario_execution,
    synthesize_counterfactual_scenarios,
)

__all__ = [
    "ActiveCscReport",
    "CandidateClaim",
    "CounterfactualScenario",
    "MinimalCutRepair",
    "PerturbationOperator",
    "ReleaseVerdict",
    "ScenarioExecutionResult",
    "challenge_candidate_claim",
    "generate_minimal_cut_repairs",
    "simulate_scenario_execution",
    "synthesize_counterfactual_scenarios",
]
