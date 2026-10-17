"""Level 5 End-to-End Integration Test: Autonomous Open-Ended Discovery Engine."""

import pytest

from spe_runtime.capabilities.capsule import AdmissionState
from spe_runtime.discovery.models import HypothesisStatus
from spe_runtime.discovery.open_ended_engine import OpenEndedDiscoveryEngine


def test_open_ended_discovery_epoch_e2e():
    engine = OpenEndedDiscoveryEngine()

    assert engine.generation_count == 0
    assert len(engine.graduated_axioms) == 0
    assert len(engine.compiled_capsules) == 0

    # Run Epoch 1
    summary1 = engine.run_discovery_epoch(iterations=4)
    assert summary1.generation == 1
    assert summary1.hypotheses_proposed >= 1
    assert summary1.counter_worlds_fuzzed >= 1
    assert summary1.survived_hypotheses >= 1
    assert summary1.axioms_graduated >= 1
    assert summary1.total_elites >= 1
    assert len(summary1.promoted_capsules) >= 1
    assert summary1.archive_coverage_pct > 0.0

    # Check compiled capsules are valid Level 3 capsules
    assert len(engine.compiled_capsules) >= 1
    cap = engine.compiled_capsules[0]
    assert cap.admission_state == AdmissionState.DEPLOYMENT_ELIGIBLE
    assert cap.interventions.lcb_95_delta > 0.0
    assert "claude-3-7-sonnet" in cap.transfer.qualified_models
    assert "openai-o3" in cap.transfer.qualified_models

    # Run Epoch 2 (Continues open-ended curriculum)
    summary2 = engine.run_discovery_epoch(iterations=2)
    assert summary2.generation == 2
    assert engine.generation_count == 2
    assert len(engine.graduated_axioms) >= summary1.axioms_graduated
