"""
Adversarial tests for CWC-1 Experiment Selector & Cryptographic Precommitment.
"""

import hashlib
import json
import pytest
from spe_runtime.research.cwc.experiment_selector import ExperimentSelector
from spe_runtime.research.cwc.mechanism_compiler import MechanismCompiler
from spe_runtime.research.cwc.types import InterventionalAction


def test_jensen_shannon_disagreement_calculation():
    compiler = MechanismCompiler()
    selector = ExperimentSelector()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order")

    # At baseline (x=1), predictions are identical -> JSD should be ~0.0
    jsd_baseline = selector.compute_jensen_shannon_divergence(mechs, "x_baseline")
    assert jsd_baseline < 0.05

    # At intervention (x=2), predictions diverge (4.0 vs 6.0) -> JSD should be positive
    jsd_intervene = selector.compute_jensen_shannon_divergence(mechs, "x_intervene_2")
    assert jsd_intervene > 0.05


def test_exact_integer_nanousd_acquisition_and_unauthorized_rejection():
    selector = ExperimentSelector(lambda_evsi=0.5, mu_fr=1.0)

    auth_action = InterventionalAction(
        action_id="ACT-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe x=2",
        is_authorized=True,
        cost_nanos=100_000_000,  # $0.10
        risk_nanos=5_000_000,    # $0.005
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.8,
    )
    score_auth = selector.score_intervention_acquisition(auth_action, jsd_disagreement=0.2)
    assert isinstance(score_auth, int)
    assert score_auth > 0

    unauth_action = InterventionalAction(
        action_id="ACT-UNAUTH",
        target_variable="x",
        intervention_value=999.0,
        description="Dangerous probe",
        is_authorized=False,
        cost_nanos=100_000,
        risk_nanos=100_000,
        expected_information_gain=2.0,
        expected_value_sample_info=2.0,
        falsification_potential=1.0,
    )
    score_unauth = selector.score_intervention_acquisition(unauth_action, jsd_disagreement=0.5)
    assert score_unauth == -1_000_000_000_000_000


def test_cryptographic_precommitment_digest_anti_harking():
    compiler = MechanismCompiler()
    selector = ExperimentSelector()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic reaction order")

    action = InterventionalAction(
        action_id="ACT-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe x=2",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.8,
    )

    digest = selector.seal_precommitment_lock(mechs, action, timestamp_utc="2026-10-14T00:00:00Z")
    assert len(digest.digest_sha256) == 64
    assert digest.action_id == "ACT-01"

    # Verify digest reproducibility
    predictions_map = {m.mechanism_id: m.predictions.get("x_intervene_2", 0.0) for m in mechs}
    canonical_json = json.dumps(predictions_map, sort_keys=True, separators=(",", ":"))
    expected_pred_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    assert digest.sealed_predictions_hash == expected_pred_hash
