"""Unit tests for Adversarial Counterfactual Mutator."""

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
from spe_runtime.capabilities.counterfactual_mutator import (
    CounterfactualMutator,
    MutationKind,
)


def make_python_capsule(code: str, entrypoint: str = "run") -> CapabilityCapsule:
    return CapabilityCapsule(
        capsule_id="capsule_mutator_test",
        name="Mutator Test Capsule",
        version="1.0.0",
        admission_state=AdmissionState.STRUCTURALLY_VALID,
        procedure=ProcedurePayload(
            format=ProcedureFormat.PYTHON_SANDBOX,
            entrypoint=entrypoint,
            payload=code,
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
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )


def test_mutator_generates_all_kinds_and_deterministic():
    base = {"query": "SELECT *", "limit": 100, "active": True}
    mutations_1 = CounterfactualMutator.mutate(base, seed=42)
    mutations_2 = CounterfactualMutator.mutate(base, seed=42)

    assert len(mutations_1) > 0
    assert len(mutations_1) == len(mutations_2)
    for m1, m2 in zip(mutations_1, mutations_2):
        assert m1.fixture_id == m2.fixture_id
        assert m1.kind == m2.kind
        assert m1.payload == m2.payload

    kinds = {m.kind for m in mutations_1}
    assert MutationKind.BOUNDARY in kinds
    assert MutationKind.STRUCTURAL in kinds
    assert MutationKind.TAINT in kinds
    assert MutationKind.NULLABILITY in kinds


def test_mutator_handles_empty_base():
    mutations = CounterfactualMutator.mutate({})
    assert len(mutations) == 1
    assert mutations[0].kind == MutationKind.BOUNDARY
    assert "__empty" in mutations[0].payload


def test_overfitted_procedure_fails_adversarial_stress():
    # Naive overfitted code: assumes exact string and non-zero amount without error checking
    overfitted_code = """
def run(data):
    # Overfitted: crashes with KeyError if 'text' missing, or AttributeError if None
    # and ZeroDivisionError if amount is 0
    return {
        "out": data["text"].strip().lower(),
        "per_unit": 100 / data["amount"]
    }
"""
    capsule = make_python_capsule(overfitted_code)
    base = {"text": "Hello World", "amount": 10}

    report = CounterfactualMutator.stress_test(capsule, base, seed=42)
    assert not report.is_robust
    assert report.vulnerabilities_exposed > 0
    # Overfitting was exposed by mutations
    overfit_results = [r for r in report.results if r.overfit_exposed]
    assert len(overfit_results) > 0
    # Confirm that errors like ZeroDivisionError, KeyError, or AttributeError were captured
    error_texts = " ".join([r.error or "" for r in overfit_results])
    assert any(err in error_texts for err in ["KeyError", "ZeroDivisionError", "AttributeError", "TypeError"])


def test_robust_procedure_passes_adversarial_stress():
    # Robust implementation with defensive checks
    robust_code = """
def run(data):
    if not isinstance(data, dict):
        return {"out": "", "per_unit": 0.0, "status": "invalid_input"}
    raw_text = data.get("text")
    text_val = str(raw_text).strip().lower() if raw_text is not None else ""
    amount_raw = data.get("amount")
    try:
        amount = float(amount_raw) if amount_raw is not None else 1.0
    except (ValueError, TypeError):
        amount = 1.0
    per_unit = 100.0 / amount if amount != 0.0 else 0.0
    return {
        "out": text_val,
        "per_unit": per_unit,
        "status": "ok"
    }
"""
    capsule = make_python_capsule(robust_code)
    base = {"text": "Hello World", "amount": 10}

    report = CounterfactualMutator.stress_test(capsule, base, seed=42)
    assert report.is_robust
    assert report.vulnerabilities_exposed == 0
    assert report.passed_count == report.total_mutations


def test_ast_json_capsule_stress_test():
    capsule = CapabilityCapsule(
        capsule_id="capsule_ast_test",
        name="AST Capsule",
        version="1.0.0",
        admission_state=AdmissionState.STRUCTURALLY_VALID,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="transform",
            payload='{"target_key": "x"}',
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
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )

    base = {"x": "test_value"}
    report = CounterfactualMutator.stress_test(capsule, base)
    assert report.is_robust
    assert report.total_mutations > 0


def test_mutator_boolean_and_container_handling():
    base = {"is_valid": True, "tags": ["a", "b"], "meta": {"k": 1}}
    muts = CounterfactualMutator.mutate(base, seed=42)
    by_id = {m.fixture_id: m for m in muts}

    # Boolean boundary must invert boolean, not treat as int
    bool_bound = by_id.get("mut_bound_bool_flip_0_is_valid")
    assert bool_bound is not None
    assert bool_bound.payload["is_valid"] is False

    # Boolean type mutation must produce 'not_a_boolean'
    bool_type = by_id.get("mut_struct_type_0_is_valid")
    assert bool_type is not None
    assert bool_type.payload["is_valid"] == "not_a_boolean"

    # Container boundary empty mutations
    list_bound = by_id.get("mut_bound_list_empty_1_tags")
    assert list_bound is not None
    assert list_bound.payload["tags"] == []

    dict_bound = by_id.get("mut_bound_dict_empty_2_meta")
    assert dict_bound is not None
    assert dict_bound.payload["meta"] == {}

