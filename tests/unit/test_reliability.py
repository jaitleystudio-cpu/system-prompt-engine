"""Tests for AI Reliability Platform (M13)."""

from spe_runtime.model_atlas.models import ExecutionClass, ModelPassport
from spe_runtime.reliability.models import DriftType, ReliabilitySLO
from spe_runtime.reliability.platform import (
    detect_drift,
    evaluate_slos,
    recommend_model_migration,
    reconstruct_incident_rca,
    run_shadow_evaluation,
)


def test_slo_evaluation():
    slo = ReliabilitySLO(task_success_min=0.95, max_security_failure_rate=0.0)

    # Compliant
    res_pass = evaluate_slos({"task_success": 0.98, "security_failure_rate": 0.0}, slo)
    assert res_pass.compliant is True
    assert res_pass.violations == []

    # Non-compliant
    res_fail = evaluate_slos({"task_success": 0.90, "security_failure_rate": 0.02}, slo)
    assert res_fail.compliant is False
    assert len(res_fail.violations) == 2


def test_shadow_evaluation_execution():
    record = run_shadow_evaluation(
        prod_version_id="inst-v1",
        candidate_version_id="inst-v2-candidate",
        request_id="req-123",
        prompt_input="Summarize quarterly earnings",
        prod_runner=lambda p: "Q3 earnings were up 12%.",
        candidate_runner=lambda p: "Q3 revenue grew by 12% YoY with $50M profit.",
        oracle_evaluator=lambda o: 1.0 if "12%" in o else 0.0,
    )
    assert record.candidate_score == 1.0
    assert "Q3 revenue" in record.shadow_output


def test_drift_sentinel_attribution():
    # Model drift (no prompt, tool, or distribution changes)
    drift = detect_drift(baseline_accuracy=0.95, current_accuracy=0.88)
    assert drift == DriftType.MODEL_DRIFT

    # Prompt change
    drift_prompt = detect_drift(baseline_accuracy=0.95, current_accuracy=0.88, prompt_changed=True)
    assert drift_prompt == DriftType.PROMPT_CHANGE


def test_model_migration_policy_gate():
    p_curr = ModelPassport(
        model_id="gpt-4-turbo",
        provider="openai",
        passport_version="0.1.0",
        execution_class=ExecutionClass.OBSERVED_REMOTE,
        structured_output_success=0.92,
        constraint_retention=0.90,
        tool_argument_validity=0.92,
        long_context_recall=0.85,
        latency_p50_ms=800.0,
        latency_p95_ms=1500.0,
        cost_per_million_input=10.0,
        cost_per_million_output=30.0,
    )
    p_cand = ModelPassport(
        model_id="gpt-4o",
        provider="openai",
        passport_version="0.1.0",
        execution_class=ExecutionClass.OBSERVED_REMOTE,
        structured_output_success=0.96,
        constraint_retention=0.94,
        tool_argument_validity=0.95,
        long_context_recall=0.92,
        latency_p50_ms=400.0,
        latency_p95_ms=800.0,
        cost_per_million_input=5.0,
        cost_per_million_output=15.0,
    )

    # Without policy authorization: requires human authorization
    rec1 = recommend_model_migration(p_curr, p_cand, private_test_success_rate=0.98, policy_authorized=False)
    assert rec1["action"] == "HUMAN_POLICY_AUTHORIZATION_REQUIRED"

    # With policy authorization: ready for canary
    rec2 = recommend_model_migration(p_curr, p_cand, private_test_success_rate=0.98, policy_authorized=True)
    assert rec2["action"] == "READY_FOR_CANARY_ROLLOUT"
