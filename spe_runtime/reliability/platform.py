"""SLO evaluation, shadow runtime, drift sentinel, and incident RCA."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from spe_runtime.model_atlas.models import ModelPassport

from .models import DriftType, IncidentRCA, ReliabilitySLO, ShadowExecutionRecord, SLOEvaluation


def evaluate_slos(metrics: dict[str, float], slo: ReliabilitySLO) -> SLOEvaluation:
    violations: list[str] = []

    success = metrics.get("task_success", 1.0)
    if success < slo.task_success_min:
        violations.append(f"task_success {success:.3f} < min {slo.task_success_min}")

    retention = metrics.get("constraint_retention", 1.0)
    if retention < slo.constraint_retention_min:
        violations.append(f"constraint_retention {retention:.3f} < min {slo.constraint_retention_min}")

    schema = metrics.get("schema_validity", 1.0)
    if schema < slo.schema_validity_min:
        violations.append(f"schema_validity {schema:.3f} < min {slo.schema_validity_min}")

    sec_fail = metrics.get("security_failure_rate", 0.0)
    if sec_fail > slo.max_security_failure_rate:
        violations.append(f"security_failure_rate {sec_fail:.3f} > max {slo.max_security_failure_rate}")

    latency = metrics.get("latency_p95_ms", 0.0)
    if latency > slo.max_latency_p95_ms:
        violations.append(f"latency_p95_ms {latency:.1f} > max {slo.max_latency_p95_ms}")

    cost = metrics.get("cost_usd", 0.0)
    if cost > slo.max_cost_per_query_usd:
        violations.append(f"cost_usd {cost:.4f} > max {slo.max_cost_per_query_usd}")

    return SLOEvaluation(
        compliant=len(violations) == 0,
        violations=violations,
        metrics_evaluated=metrics,
    )


def run_shadow_evaluation(
    prod_version_id: str,
    candidate_version_id: str,
    request_id: str,
    prompt_input: str,
    prod_runner: Callable[[str], str],
    candidate_runner: Callable[[str], str],
    oracle_evaluator: Callable[[str], float],
) -> ShadowExecutionRecord:
    # 1. Execute production runner (actual response for user)
    prod_resp = prod_runner(prompt_input)

    # 2. Shadow candidate execution (no user-visible effect)
    candidate_resp = candidate_runner(prompt_input)

    # 3. Evaluate candidate score & divergence
    score = oracle_evaluator(candidate_resp)
    # Simple character-level divergence ratio
    divergence = abs(len(candidate_resp) - len(prod_resp)) / max(len(prod_resp), 1)

    return ShadowExecutionRecord(
        production_version_id=prod_version_id,
        candidate_version_id=candidate_version_id,
        request_id=request_id,
        production_output=prod_resp,
        shadow_output=candidate_resp,
        candidate_score=score,
        divergence_metric=round(divergence, 3),
    )


def detect_drift(
    baseline_accuracy: float,
    current_accuracy: float,
    prompt_changed: bool = False,
    tool_changed: bool = False,
    input_distribution_changed: bool = False,
    oracle_changed: bool = False,
) -> DriftType:
    delta = current_accuracy - baseline_accuracy
    if abs(delta) < 0.02:
        return DriftType.STABLE

    # Attribution order
    if prompt_changed:
        return DriftType.PROMPT_CHANGE
    if tool_changed:
        return DriftType.TOOL_CHANGE
    if oracle_changed:
        return DriftType.ORACLE_CHANGE
    if input_distribution_changed:
        return DriftType.INPUT_MIX_DRIFT

    # If accuracy degraded without internal code changes, it is external model drift
    return DriftType.MODEL_DRIFT


def recommend_model_migration(
    current_passport: ModelPassport,
    candidate_passport: ModelPassport,
    private_test_success_rate: float,
    policy_authorized: bool = False,
) -> dict[str, Any]:
    """Generates model migration analysis. NEVER migrates automatically without explicit policy authorization."""
    is_better_accuracy = candidate_passport.structured_output_success >= current_passport.structured_output_success
    is_lower_latency = candidate_passport.latency_p50_ms <= current_passport.latency_p50_ms
    is_qualified_in_private_eval = private_test_success_rate >= 0.95

    qualifies = is_better_accuracy and is_qualified_in_private_eval

    status = "QUALIFIED_FOR_MIGRATION" if qualifies else "NOT_RECOMMENDED"
    if qualifies and not policy_authorized:
        action = "HUMAN_POLICY_AUTHORIZATION_REQUIRED"
    elif qualifies and policy_authorized:
        action = "READY_FOR_CANARY_ROLLOUT"
    else:
        action = "DO_NOT_PROMOTE"

    return {
        "current_model": current_passport.model_id,
        "candidate_model": candidate_passport.model_id,
        "qualification_status": status,
        "action": action,
        "policy_authorized": policy_authorized,
        "private_test_success_rate": private_test_success_rate,
        "cost_ratio": round(candidate_passport.cost_per_million_input / current_passport.cost_per_million_input, 2) if current_passport.cost_per_million_input else 1.0,
        "latency_improvement_ms": round(current_passport.latency_p50_ms - candidate_passport.latency_p50_ms, 1),
    }


def reconstruct_incident_rca(
    incident_id: str,
    request_id: str,
    instruction_version: str,
    model: str,
    tools_invoked: list[str],
    capabilities_active: list[str],
    failure_class: str,
    root_cause_explanation: str,
    evidence_items: list[str],
) -> IncidentRCA:
    return IncidentRCA(
        incident_id=incident_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        request_id=request_id,
        instruction_version=instruction_version,
        model=model,
        tools_invoked=tools_invoked,
        capabilities_active=capabilities_active,
        failure_class=failure_class,
        root_cause_reconstruction=root_cause_explanation,
        evidence_chain=evidence_items,
    )
