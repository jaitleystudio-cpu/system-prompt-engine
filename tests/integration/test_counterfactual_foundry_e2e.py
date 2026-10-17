"""End-to-End Integration & Amortized Economics Verification for CCF.

Verifies:
Autonomous trace synthesis -> Wald qualification -> Counterfactual mutation -> 
Transfer matrix -> Local zero-cost execution with 100% accuracy.
"""

import json
import pytest

from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    CapabilityContracts,
    CapabilityGuards,
    CapabilityWitness,
    CausalInterventions,
    ProcedureFormat,
    ProcedurePayload,
    RevocationRules,
    TransferMatrix,
)
from spe_runtime.capabilities.causal_evaluator import (
    TrialObservation,
    WaldCausalEvaluator,
)
from spe_runtime.capabilities.counterfactual_mutator import CounterfactualMutator
from spe_runtime.capabilities.sandbox import CapabilitySandbox
from spe_runtime.capabilities.transfer_matrix import CapabilityTransferEngine


def test_end_to_end_trace_synthesis_to_zero_cost_execution():
    """Verify autonomous compilation of repetitive diagnostic reasoning into an admitted capsule."""
    
    # 1. Synthesize procedure logic extracted from repetitive agent reasoning traces
    diagnostic_code = """
def diagnose(data):
    if not isinstance(data, dict):
        return {"severity": "UNKNOWN", "action": "NOOP", "zero_cost_verified": True}
    
    raw_cpu = data.get("cpu_percent")
    raw_p99 = data.get("latency_p99_ms")
    raw_err5xx = data.get("status_code_5xx_rate")
    
    try:
        cpu = float(raw_cpu) if raw_cpu is not None else 0.0
    except (ValueError, TypeError):
        cpu = 0.0
        
    try:
        p99 = float(raw_p99) if raw_p99 is not None else 0.0
    except (ValueError, TypeError):
        p99 = 0.0
        
    try:
        err5xx = float(raw_err5xx) if raw_err5xx is not None else 0.0
    except (ValueError, TypeError):
        err5xx = 0.0
        
    if cpu > 90.0 or p99 > 1000.0 or err5xx > 0.05:
        severity = "CRITICAL"
        action = "TRIGGER_CIRCUIT_BREAKER_AND_SHED_LOAD"
    elif cpu > 75.0 or p99 > 500.0 or err5xx > 0.01:
        severity = "WARNING"
        action = "SCALE_REPLICAS_HORIZONTAL"
    else:
        severity = "HEALTHY"
        action = "MONITOR_STEADY_STATE"
        
    return {
        "service": str(data.get("service") or "unknown"),
        "severity": severity,
        "action": action,
        "zero_cost_verified": True,
    }
"""

    capsule = CapabilityCapsule(
        capsule_id="ccf_synth_diagnostic_001",
        name="Server Incident Diagnostic Classifier",
        version="1.0.0",
        admission_state=AdmissionState.HYPOTHESIS,
        procedure=ProcedurePayload(
            format=ProcedureFormat.PYTHON_SANDBOX,
            entrypoint="diagnose",
            payload=diagnostic_code,
        ),
        contracts=CapabilityContracts(
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            deterministic=True,
            allowed_effects=["pure_transform"],
        ),
        guards=CapabilityGuards(
            applicability_conditions=["server_telemetry_payload"],
            invalidation_conditions=["metric_schema_drift"],
        ),
        witnesses=[
            CapabilityWitness(
                witness_id="wit_synth_001",
                verified_at="2026-10-10T12:00:00Z",
                proof_type="Wald_SPRT_LCB95",
                hash="a" * 64,
            )
        ],
        interventions=CausalInterventions(
            trial_count=0,
            active_success_rate=0.0,
            baseline_success_rate=0.0,
            placebo_success_rate=0.0,
            lcb_95_delta=0.0,
            early_stopped=False,
        ),
        transfer=TransferMatrix(
            qualified_models=[],
            rejected_models=[],
        ),
        revocation_rules=RevocationRules(
            dependency_hashes={
                "ast_runtime": "hash_ast_clean_1",
                "telemetry_schema": "hash_schema_clean_2",
            },
            max_drift_tolerance=0.05,
        ),
    )

    # Stage 1: Structural Schema Validation
    capsule.validate_schema()
    capsule.transition_to(AdmissionState.STRUCTURALLY_VALID, "Passed JSON Schema validation")
    assert capsule.admission_state == AdmissionState.STRUCTURALLY_VALID

    # Stage 2: Adversarial Counterfactual Mutation Stress Test
    base_fixture = {
        "service": "api-gateway",
        "cpu_percent": 82.5,
        "latency_p99_ms": 620.0,
        "status_code_5xx_rate": 0.018,
    }
    mutation_report = CounterfactualMutator.stress_test(capsule, base_fixture, seed=42)
    assert mutation_report.is_robust is True
    assert mutation_report.vulnerabilities_exposed == 0
    assert mutation_report.passed_count == mutation_report.total_mutations

    # Stage 3: Wald Sequential Causal Evaluator Qualification
    evaluator = WaldCausalEvaluator(min_delta=0.15, max_trials=20)
    observation_stream = [
        TrialObservation(
            task_id=f"diag_task_{i}",
            active_success=True,
            baseline_success=(i % 5 == 0),
            placebo_success=False,
        )
        for i in range(12)
    ]
    eval_report = evaluator.qualify_and_update_capsule(capsule, observation_stream)
    assert eval_report.accepted is True
    assert eval_report.early_stopped is True
    assert eval_report.lcb_95_delta >= 0.15
    assert capsule.admission_state == AdmissionState.BEHAVIORALLY_QUALIFIED

    # Stage 4: Cross-Model Transfer & Invalidation Matrix
    frontier_models = [
        "claude-3-7-sonnet",
        "openai-o3",
        "deepseek-r1",
        "gemini-2-0-flash",
    ]
    for model in frontier_models:
        transfer_res = CapabilityTransferEngine.evaluate_model_transfer(
            capsule,
            model_id=model,
            success_rate=0.98,
            threshold=0.90,
        )
        assert transfer_res.qualified is True

    assert capsule.admission_state == AdmissionState.TRANSFER_QUALIFIED
    assert set(capsule.transfer.qualified_models) == set(frontier_models)

    # Transition to DEPLOYMENT_ELIGIBLE
    capsule.transition_to(AdmissionState.DEPLOYMENT_ELIGIBLE, "Passed all frontier transfer checks")
    assert capsule.admission_state == AdmissionState.DEPLOYMENT_ELIGIBLE

    # Verify Invalidation Protection: Tampering with dependency hashes revokes to SUSPENDED
    tampered_hashes = {
        "ast_runtime": "hash_ast_CORRUPTED",
        "telemetry_schema": "hash_schema_clean_2",
    }
    invalidation_check = CapabilityTransferEngine.verify_and_enforce_revocation(
        capsule,
        active_model_id="claude-3-7-sonnet",
        current_dependency_hashes=tampered_hashes,
    )
    assert invalidation_check.valid is False
    assert capsule.admission_state == AdmissionState.SUSPENDED

    # Reinstatement when integrity restored
    restored = CapabilityTransferEngine.reinstate_if_restored(
        capsule,
        active_model_id="claude-3-7-sonnet",
        current_dependency_hashes=capsule.revocation_rules.dependency_hashes,
    )
    assert restored is True
    assert capsule.admission_state == AdmissionState.DEPLOYMENT_ELIGIBLE

    # Stage 5: Zero-Cost Local Execution Verification
    test_cases = [
        (
            {"service": "auth-svc", "cpu_percent": 96.0, "latency_p99_ms": 1200.0, "status_code_5xx_rate": 0.08},
            "CRITICAL",
            "TRIGGER_CIRCUIT_BREAKER_AND_SHED_LOAD",
        ),
        (
            {"service": "billing-worker", "cpu_percent": 79.0, "latency_p99_ms": 550.0, "status_code_5xx_rate": 0.02},
            "WARNING",
            "SCALE_REPLICAS_HORIZONTAL",
        ),
        (
            {"service": "cache-node", "cpu_percent": 25.0, "latency_p99_ms": 12.0, "status_code_5xx_rate": 0.0001},
            "HEALTHY",
            "MONITOR_STEADY_STATE",
        ),
    ]

    for input_payload, expected_severity, expected_action in test_cases:
        exec_res = CapabilitySandbox.execute_capsule(capsule, input_payload)
        assert exec_res.success is True
        assert exec_res.latency_ms < 50.0  # Fast local execution
        out = exec_res.output
        assert out["severity"] == expected_severity
        assert out["action"] == expected_action
        assert out["zero_cost_verified"] is True

        # Determinism check: Repeat execution produces identical results
        exec_res_repeat = CapabilitySandbox.execute_capsule(capsule, input_payload)
        assert exec_res_repeat.output == out


def test_ast_json_capsule_end_to_end_lifecycle():
    """Verify AST JSON format capability capsule lifecycle."""
    ast_rule = json.dumps({"target_key": "user_id"})
    capsule = CapabilityCapsule(
        capsule_id="ccf_ast_json_002",
        name="User ID Extraction Capsule",
        version="1.0.0",
        admission_state=AdmissionState.HYPOTHESIS,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="transform",
            payload=ast_rule,
        ),
        contracts=CapabilityContracts(
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            deterministic=True,
        ),
        guards=CapabilityGuards(),
        witnesses=[],
        interventions=CausalInterventions(
            trial_count=0,
            active_success_rate=0.0,
            baseline_success_rate=0.0,
            placebo_success_rate=0.0,
            lcb_95_delta=0.0,
        ),
        transfer=TransferMatrix(qualified_models=["openai-o3"], rejected_models=[]),
        revocation_rules=RevocationRules(dependency_hashes={"core": "h1"}),
    )

    capsule.validate_schema()
    capsule.transition_to(AdmissionState.STRUCTURALLY_VALID)
    capsule.transition_to(AdmissionState.BEHAVIORALLY_QUALIFIED)
    capsule.transition_to(AdmissionState.TRANSFER_QUALIFIED)
    capsule.transition_to(AdmissionState.DEPLOYMENT_ELIGIBLE)

    res = CapabilitySandbox.execute_capsule(capsule, {"user_id": "usr_9981", "token": "secret"})
    assert res.success is True
    assert res.output == {"user_id": "usr_9981", "transformed": True}
