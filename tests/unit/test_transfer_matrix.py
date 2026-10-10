"""Unit tests for Cross-Model Transfer & Invalidation Matrix."""

import pytest

from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    CapabilityContracts,
    CapabilityGuards,
    CausalInterventions,
    ProcedureFormat,
    ProcedurePayload,
    RevocationRules,
    TransferMatrix,
)
from spe_runtime.capabilities.transfer_matrix import (
    CapabilityTransferEngine,
    InvalidationCheckResult,
    TransferEvaluationResult,
)


def make_test_capsule(
    state: AdmissionState = AdmissionState.DEPLOYMENT_ELIGIBLE,
    qualified_models=None,
    dependency_hashes=None,
    max_drift: float = 0.05,
) -> CapabilityCapsule:
    return CapabilityCapsule(
        capsule_id="capsule_transfer_test",
        name="Transfer Test Capsule",
        version="1.0.0",
        admission_state=state,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="transform",
            payload='{"target_key": "data"}',
        ),
        contracts=CapabilityContracts(
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            deterministic=True,
        ),
        guards=CapabilityGuards(),
        witnesses=[],
        interventions=CausalInterventions(
            trial_count=10,
            active_success_rate=1.0,
            baseline_success_rate=0.0,
            placebo_success_rate=0.0,
            lcb_95_delta=0.85,
        ),
        transfer=TransferMatrix(
            qualified_models=qualified_models or ["claude-3-7-sonnet", "openai-o3"],
            rejected_models=[],
        ),
        revocation_rules=RevocationRules(
            dependency_hashes=dependency_hashes or {
                "ast_parser": "hash_ast_123",
                "schema_core": "hash_schema_456",
            },
            max_drift_tolerance=max_drift,
        ),
    )


def test_model_qualification_and_state_transition():
    capsule = make_test_capsule(
        state=AdmissionState.BEHAVIORALLY_QUALIFIED,
        qualified_models=[],
    )

    # Model fails threshold
    res_fail = CapabilityTransferEngine.evaluate_model_transfer(
        capsule,
        model_id="deepseek-r1",
        success_rate=0.75,
        threshold=0.90,
    )
    assert res_fail.qualified is False
    assert "deepseek-r1" in capsule.transfer.rejected_models
    assert capsule.admission_state == AdmissionState.BEHAVIORALLY_QUALIFIED

    # Model passes threshold
    res_pass = CapabilityTransferEngine.evaluate_model_transfer(
        capsule,
        model_id="deepseek-r1",
        success_rate=0.96,
        threshold=0.90,
    )
    assert res_pass.qualified is True
    assert "deepseek-r1" in capsule.transfer.qualified_models
    assert "deepseek-r1" not in capsule.transfer.rejected_models
    # State transitioned to TRANSFER_QUALIFIED
    assert capsule.admission_state == AdmissionState.TRANSFER_QUALIFIED


def test_dependency_hash_change_triggers_suspended_revocation():
    expected_hashes = {
        "ast_parser": "hash_ast_123",
        "schema_core": "hash_schema_456",
    }
    capsule = make_test_capsule(
        state=AdmissionState.DEPLOYMENT_ELIGIBLE,
        dependency_hashes=expected_hashes,
    )

    # Dependency has been modified or corrupted
    tampered_hashes = {
        "ast_parser": "hash_ast_MODIFIED",
        "schema_core": "hash_schema_456",
    }

    check = CapabilityTransferEngine.verify_and_enforce_revocation(
        capsule,
        active_model_id="claude-3-7-sonnet",
        current_dependency_hashes=tampered_hashes,
    )

    assert check.valid is False
    assert check.status == AdmissionState.SUSPENDED
    assert capsule.admission_state == AdmissionState.SUSPENDED
    assert "ast_parser" in check.changed_dependencies
    assert "mismatch for 'ast_parser'" in check.reason


def test_model_version_change_triggers_suspended_revocation():
    capsule = make_test_capsule(
        state=AdmissionState.DEPLOYMENT_ELIGIBLE,
        qualified_models=["claude-3-7-sonnet", "openai-o3"],
    )
    current_hashes = capsule.revocation_rules.dependency_hashes

    # Run on an unverified or deprecated model
    check = CapabilityTransferEngine.verify_and_enforce_revocation(
        capsule,
        active_model_id="legacy-gpt-model-v1",
        current_dependency_hashes=current_hashes,
    )

    assert check.valid is False
    assert check.status == AdmissionState.SUSPENDED
    assert capsule.admission_state == AdmissionState.SUSPENDED
    assert "not in qualified models" in check.reason


def test_drift_tolerance_triggers_suspended_revocation():
    capsule = make_test_capsule(
        state=AdmissionState.DEPLOYMENT_ELIGIBLE,
        max_drift=0.03,
    )
    current_hashes = capsule.revocation_rules.dependency_hashes

    # Drift is 0.06 > 0.03 tolerance
    check = CapabilityTransferEngine.verify_and_enforce_revocation(
        capsule,
        active_model_id="claude-3-7-sonnet",
        current_dependency_hashes=current_hashes,
        measured_drift=0.06,
    )

    assert check.valid is False
    assert capsule.admission_state == AdmissionState.SUSPENDED
    assert "exceeded tolerance" in check.reason


def test_reinstatement_from_suspended_when_restored():
    expected_hashes = {
        "ast_parser": "hash_ast_123",
        "schema_core": "hash_schema_456",
    }
    capsule = make_test_capsule(
        state=AdmissionState.SUSPENDED,
        dependency_hashes=expected_hashes,
        qualified_models=["claude-3-7-sonnet"],
    )

    # Correct dependencies and model supplied
    reinstated = CapabilityTransferEngine.reinstate_if_restored(
        capsule,
        active_model_id="claude-3-7-sonnet",
        current_dependency_hashes=expected_hashes,
        measured_drift=0.01,
    )

    assert reinstated is True
    assert capsule.admission_state == AdmissionState.DEPLOYMENT_ELIGIBLE
