"""
Unit & Adversarial Tests for Intelligence II: Executable Scientific World Models
"""

import pytest
from spe_runtime.research.agi_brain.types import DomainType
from spe_runtime.research.agi_brain.scientific_world_models import ScientificWorldModelEngine

def test_prediction_vs_observation_isolation():
    engine = ScientificWorldModelEngine()
    model = engine.create_model(
        model_id="wm-physics-01",
        domain=DomainType.PHYSICS,
        executable_representation="def simulate(t): return 9.8 * t**2 / 2",
    )

    # Record simulation prediction
    engine.record_simulated_prediction(model, "displacement_at_2s", 19.6)
    assert "displacement_at_2s" in model.simulated_predictions
    assert "displacement_at_2s" not in model.independent_observations

    # Record physical observation
    engine.record_independent_observation(model, "displacement_at_2s", 19.58)
    assert model.simulated_predictions["displacement_at_2s"] != model.independent_observations["displacement_at_2s"]

def test_falsification_detection():
    engine = ScientificWorldModelEngine()
    model = engine.create_model(
        model_id="wm-cs-01",
        domain=DomainType.COMPUTER_SCIENCE,
        executable_representation="def latency(n): return 0.05 * n",
    )

    engine.record_simulated_prediction(model, "p99_latency_ms", 25.0)
    engine.record_independent_observation(model, "p99_latency_ms", 120.0)

    # Observation (120ms) contradicts prediction (25ms) beyond tolerance
    is_falsified = engine.check_falsification(model, tolerance=5.0)
    assert is_falsified is True
    assert model.is_falsified is True
