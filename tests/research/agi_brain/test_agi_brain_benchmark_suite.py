"""
End-to-End Scientific Benchmark Suite & Multi-Arm Comparative Evaluation
October 12, 2026 | Research Quarantine Track
"""

import pytest
from spe_runtime.research.agi_brain.types import (
    ScientificObjective,
    DomainType,
    InventionStrategy,
    VerificationStatus,
)
from spe_runtime.research.agi_brain.engine import SpeAgiBrain

def test_spe_agi_brain_end_to_end_discovery_session():
    brain = SpeAgiBrain(spending_cap_nanos=5_000_000_000)

    objective = ScientificObjective(
        objective_id="obj-bench-01",
        description="Discover optimal error-correcting surface code threshold",
        domain=DomainType.PHYSICS,
        frozen_intent="Optimize surface code physical error threshold p_th under biased noise",
        hard_constraints=["threshold >= 1.0%", "syndrome_extraction_rounds <= 5"],
    )

    raw_claims = [
        {
            "statement": "Standard square surface code has 1.0% threshold under depolarizing noise.",
            "direct_measurement": True,
            "citation_hops": 0,
        },
        {
            "theory_id": "Theory_Standard",
            "condition": "Biased Pauli-Z noise eta=100",
            "predicted_outcome": "Threshold 2.5%",
        },
        {
            "theory_id": "Theory_CliffordDeformed",
            "condition": "Biased Pauli-Z noise eta=100",
            "predicted_outcome": "Threshold 5.0%",
        },
    ]

    # Run session with Lean proof and passing property tests
    session = brain.run_discovery_session(
        objective=objective,
        raw_claims=raw_claims,
        strategy=InventionStrategy.CONTRADICTION_DRIVEN,
        lean_proof="theorem surface_code_bound (p : Float) : p <= 0.05 := by omega",
        property_tests=[True, True, True, True],
        empirical_p_value=0.001,
    )

    assert session["objective"].objective_id == "obj-bench-01"
    assert len(session["knowledge_state"].divergent_predictions) == 1
    assert session["candidate"].strategy == InventionStrategy.CONTRADICTION_DRIVEN
    assert session["verification"].status == VerificationStatus.VERIFIED
    assert session["verification"].formal_proof_verified is True
    assert session["contract"].verification_status == VerificationStatus.VERIFIED
    assert "## 1. Original Objective" in session["contract_markdown"]

def test_five_arm_comparative_benchmark_trial():
    """
    Simulates the 5 competing configurations from Section 10 of the spec:
    Arm A: Frontier model alone
    Arm B: Frontier model with standard tools
    Arm C: Existing SPE workflow
    Arm D: SPE with adaptive world models
    Arm E: Full SPE AGI candidate
    """
    brain = SpeAgiBrain()

    arms_results = {}

    # Arm A: Generates text with no verification
    arms_results["Arm_A"] = {"delta_k": 2.0, "false_accepts": 3, "cost_nanos": 200_000_000}

    # Arm B: Basic tools with unguided retries
    arms_results["Arm_B"] = {"delta_k": 4.5, "false_accepts": 2, "cost_nanos": 500_000_000}

    # Arm C: SPE baseline
    arms_results["Arm_C"] = {"delta_k": 6.0, "false_accepts": 0, "cost_nanos": 150_000_000}

    # Arm D: Adaptive world models
    arms_results["Arm_D"] = {"delta_k": 8.0, "false_accepts": 0, "cost_nanos": 180_000_000}

    # Arm E: Full SPE AGI candidate
    arms_results["Arm_E"] = {"delta_k": 12.0, "false_accepts": 0, "cost_nanos": 220_000_000}

    utilities = {}
    for arm, data in arms_results.items():
        util = brain.objective_calculator.compute_utility(
            delta_k_verified=data["delta_k"],
            delta_t_transfer=data["delta_k"] * 0.8,
            compute_cost_nanos=data["cost_nanos"],
            measurement_cost_nanos=0,
            has_false_acceptance=(data["false_accepts"] > 0),
        )
        utilities[arm] = util["utility_score"]

    # Arm E must achieve the highest discovery utility due to zero false acceptance and high verified knowledge gain
    assert utilities["Arm_E"] > utilities["Arm_D"]
    assert utilities["Arm_E"] > utilities["Arm_C"]
    assert utilities["Arm_E"] > utilities["Arm_B"]
    assert utilities["Arm_E"] > utilities["Arm_A"]
