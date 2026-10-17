"""Unit tests verifying Canonical Capability Capsule schema and state machine transitions."""

import pytest
import jsonschema

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


def create_sample_capsule(state: AdmissionState = AdmissionState.HYPOTHESIS) -> CapabilityCapsule:
    return CapabilityCapsule(
        capsule_id="capsule_ast_diagnostic_v1",
        name="Deterministic AST Error Bisection",
        version="1.0.0",
        admission_state=state,
        procedure=ProcedurePayload(
            format=ProcedureFormat.PYTHON_SANDBOX,
            entrypoint="diagnose_ast_error",
            payload="def diagnose_ast_error(tree):\n    return {'error_line': 12}\n",
        ),
        contracts=CapabilityContracts(
            input_schema={"type": "object", "required": ["source_code"]},
            output_schema={"type": "object", "required": ["error_line"]},
            deterministic=True,
            allowed_effects=[],
        ),
        guards=CapabilityGuards(
            applicability_conditions=["syntax_error_detected", "typescript_or_rust_target"],
            invalidation_conditions=["grammar_version_shift"],
        ),
        witnesses=[
            CapabilityWitness(
                witness_id="wit_001",
                verified_at="2026-10-10T11:00:00Z",
                proof_type="DETERMINISTIC_REPLAY",
                hash="a" * 64,
            )
        ],
        interventions=CausalInterventions(
            trial_count=30,
            active_success_rate=0.98,
            baseline_success_rate=0.70,
            placebo_success_rate=0.45,
            lcb_95_delta=0.21,
            early_stopped=False,
        ),
        transfer=TransferMatrix(
            qualified_models=["claude-3-7-sonnet", "deepseek-r1"],
            rejected_models=["gpt-4o-mini-v1"],
        ),
        revocation_rules=RevocationRules(
            dependency_hashes={"spe_core_rs": "b" * 64},
            max_drift_tolerance=0.03,
        ),
    )


def test_capsule_schema_validation_success():
    capsule = create_sample_capsule()
    capsule.validate_schema()
    payload_dict = capsule.to_dict()
    assert payload_dict["capsule_id"] == "capsule_ast_diagnostic_v1"
    assert payload_dict["admission_state"] == "HYPOTHESIS"
    assert len(payload_dict["procedure"]["sha256"]) == 64


def test_capsule_state_machine_valid_transitions():
    capsule = create_sample_capsule(AdmissionState.HYPOTHESIS)
    capsule.transition_to(AdmissionState.STRUCTURALLY_VALID, "Passed JSON schema check")
    capsule.transition_to(AdmissionState.BEHAVIORALLY_QUALIFIED, "Passed unit fixtures")
    capsule.transition_to(AdmissionState.TRANSFER_QUALIFIED, "Passed cross-model test")
    capsule.transition_to(AdmissionState.DEPLOYMENT_ELIGIBLE, "Production admission granted")
    assert capsule.admission_state == AdmissionState.DEPLOYMENT_ELIGIBLE

    # Invalidate when toolchain changes
    capsule.transition_to(AdmissionState.SUSPENDED, "Rust toolchain version changed")
    assert capsule.admission_state == AdmissionState.SUSPENDED


def test_capsule_state_machine_illegal_transition_rejection():
    capsule = create_sample_capsule(AdmissionState.HYPOTHESIS)
    with pytest.raises(ValueError, match="Illegal state transition"):
        capsule.transition_to(AdmissionState.DEPLOYMENT_ELIGIBLE, "Cannot jump without qualification")


def test_capsule_rejection_terminal():
    capsule = create_sample_capsule(AdmissionState.HYPOTHESIS)
    capsule.transition_to(AdmissionState.REJECTED, "Failed placebo baseline check")
    assert capsule.admission_state == AdmissionState.REJECTED
    with pytest.raises(ValueError, match="Illegal state transition"):
        capsule.transition_to(AdmissionState.DEPLOYMENT_ELIGIBLE)
