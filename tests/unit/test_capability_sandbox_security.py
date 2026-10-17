"""Unit tests verifying isolation, capability constraints, and exploit prevention in CapabilitySandbox."""

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
from spe_runtime.capabilities.sandbox import CapabilitySandbox


def make_sandbox_capsule(code: str, entrypoint: str = "run") -> CapabilityCapsule:
    return CapabilityCapsule(
        capsule_id="capsule_sec_test",
        name="Security Test Capsule",
        version="1.0.0",
        admission_state=AdmissionState.HYPOTHESIS,
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


def test_sandbox_executes_benign_procedure():
    code = """
def run(data):
    val = data.get("count", 0)
    return {"doubled": val * 2}
"""
    capsule = make_sandbox_capsule(code)
    result = CapabilitySandbox.execute_capsule(capsule, {"count": 21})
    assert result.success is True
    assert result.output == {"doubled": 42}
    assert result.latency_ms >= 0.0


def test_sandbox_blocks_os_import():
    code = """
import os
def run(data):
    return {"files": os.listdir(".")}
"""
    capsule = make_sandbox_capsule(code)
    result = CapabilitySandbox.execute_capsule(capsule, {})
    assert result.success is False
    assert "Forbidden import: os" in (result.error or "")


def test_sandbox_blocks_subprocess_import():
    code = """
from subprocess import Popen
def run(data):
    return {}
"""
    capsule = make_sandbox_capsule(code)
    result = CapabilitySandbox.execute_capsule(capsule, {})
    assert result.success is False
    assert "Forbidden import from: subprocess" in (result.error or "")


def test_sandbox_blocks_eval_exec_call():
    code = """
def run(data):
    eval("1 + 1")
    return {}
"""
    capsule = make_sandbox_capsule(code)
    result = CapabilitySandbox.execute_capsule(capsule, {})
    assert result.success is False
    assert "Forbidden builtin call: eval" in (result.error or "")


def test_sandbox_blocks_dunder_traversal():
    code = """
def run(data):
    c = "".__class__.__bases__[0]
    return {"class": str(c)}
"""
    capsule = make_sandbox_capsule(code)
    result = CapabilitySandbox.execute_capsule(capsule, {})
    assert result.success is False
    assert "Forbidden dunder attribute access" in (result.error or "")


def test_sandbox_ast_json_operations():
    import json
    
    # 1. Test pick operation
    pick_capsule = CapabilityCapsule(
        capsule_id="ast_pick",
        name="Pick Capsule",
        version="1.0.0",
        admission_state=AdmissionState.DEPLOYMENT_ELIGIBLE,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="pick",
            payload=json.dumps({"op": "pick", "fields": ["a", "c"]}),
        ),
        contracts=CapabilityContracts(input_schema={}, output_schema={}),
        guards=CapabilityGuards(),
        witnesses=[],
        interventions=CausalInterventions(0, 0.0, 0.0, 0.0, 0.0),
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )
    res_pick = CapabilitySandbox.execute_capsule(pick_capsule, {"a": 10, "b": 20, "c": 30})
    assert res_pick.success is True
    assert res_pick.output == {"a": 10, "c": 30}

    # 2. Test merge operation
    merge_capsule = CapabilityCapsule(
        capsule_id="ast_merge",
        name="Merge Capsule",
        version="1.0.0",
        admission_state=AdmissionState.DEPLOYMENT_ELIGIBLE,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="merge",
            payload=json.dumps({"op": "merge", "static": {"env": "prod"}}),
        ),
        contracts=CapabilityContracts(input_schema={}, output_schema={}),
        guards=CapabilityGuards(),
        witnesses=[],
        interventions=CausalInterventions(0, 0.0, 0.0, 0.0, 0.0),
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )
    res_merge = CapabilitySandbox.execute_capsule(merge_capsule, {"user": "alice"})
    assert res_merge.success is True
    assert res_merge.output == {"user": "alice", "env": "prod", "merged": True}

    # 3. Test non-dict input handling
    res_invalid = CapabilitySandbox.execute_capsule(pick_capsule, "not_a_dict")  # type: ignore
    assert res_invalid.success is False
    assert "Expected dict input" in (res_invalid.error or "")

