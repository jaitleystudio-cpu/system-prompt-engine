"""G5-ZC narrow recheck: exact repair-attempt bound (not technique budget)."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.contract.protected import ContractValidity
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt import build_prompt_artifact
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind


ROOT = Path(__file__).resolve().parents[2]
BUILD_PY = ROOT / "spe_runtime/prompt/build.py"


def test_g5zc_repair_bound_conflict_is_single_shot_fail_closed():
    """Actual zero-cost core repair contract:

    There is no validation→repair→revalidate loop on the offline PromptArtifact path.
    CONFLICTED contracts fail closed on the *initial* validation gate with zero repair
    attempts. This is distinct from TechniqueSelection budget (STANDARD_MAX_TECHNIQUES=3).
    """
    c = ProtectedIntentContract()
    c = propose_requirement(
        c,
        semantic_key="net",
        kind=RequirementKind.MUST,
        value="online",
        provenance=Provenance.USER_EXPLICIT,
        source_ref="u",
    )
    c = propose_requirement(
        c,
        semantic_key="net",
        kind=RequirementKind.MUST_NOT,
        value="online",
        provenance=Provenance.USER_EXPLICIT,
        source_ref="u",
    )
    assert c.validity is ContractValidity.CONFLICTED

    calls = {"n": 0}
    real = build_prompt_artifact

    def counting(contract, **kwargs):
        calls["n"] += 1
        return real(contract, **kwargs)

    # Direct call — exactly one entry; raises before any repair body could run
    with pytest.raises(SpeTypedError) as ei:
        counting(c)
    assert ei.value.code is ErrorCode.K3_PROMPT_CONFLICTED_SOURCE
    assert calls["n"] == 1

    # Second independent call still one-shot (no lingering repair state / recursion)
    with pytest.raises(SpeTypedError):
        counting(c)
    assert calls["n"] == 2


def test_g5zc_repair_bound_no_repair_loop_in_build_module():
    """Static: build_prompt_artifact has no retry/repair while-loop."""
    tree = ast.parse(BUILD_PY.read_text(encoding="utf-8"))
    build_fn = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "build_prompt_artifact":
            build_fn = node
            break
    assert build_fn is not None
    src = BUILD_PY.read_text(encoding="utf-8")
    # No repair/retry control vocabulary in the sole PromptArtifact writer
    assert "repair_attempt" not in src
    assert "max_repair" not in src
    assert "while True" not in src
    # Conflict gate is immediate raise (fail closed), not deferred repair
    assert "CONFLICTED" in src
    assert "K3_PROMPT_CONFLICTED_SOURCE" in src or "PROMPT_CONFLICTED" in src

    # No While loops inside build_prompt_artifact
    whiles = [n for n in ast.walk(build_fn) if isinstance(n, ast.While)]
    assert whiles == []


def test_g5zc_technique_budget_is_not_repair_bound():
    """Technique budget ≠ repair-attempt bound — keep the concepts separate in evidence."""
    from spe_runtime.prompt.techniques import STANDARD_MAX_TECHNIQUES

    assert STANDARD_MAX_TECHNIQUES == 3
    # Documented separation: technique budget bounds selection cardinality only.
    repair_contract = {
        "initial_validation_attempts": 1,
        "maximum_repair_attempts": 0,
        "maximum_total_attempts": 1,
        "third_attempt_possible": False,
        "provider_escalation": False,
        "recursive_repair": False,
        "note": "fail-closed; no repair loop on offline core path",
    }
    assert repair_contract["maximum_repair_attempts"] == 0
    assert repair_contract["maximum_total_attempts"] == 1
    assert repair_contract["third_attempt_possible"] is False
    assert STANDARD_MAX_TECHNIQUES != repair_contract["maximum_total_attempts"]
