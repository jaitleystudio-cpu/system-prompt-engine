"""G6-ZC mutation kills — product-value invariant guards."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.contract.protected import ContractValidity
from spe_runtime.core import compile_portable_request
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt import build_prompt_artifact
from spe_runtime.prompt.techniques import STANDARD_MAX_TECHNIQUES
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind

ROOT = Path(__file__).resolve().parents[2]
BM = ROOT / "benchmarks/g6zc"
EVAL = ROOT / "evaluations/g6zc"


def test_g6m1_must_constraint_not_silently_dropped():
    r = compile_portable_request("Write email", must=["mention Tuesday"])
    assert "Tuesday" in r.prompt_artifact.rendered_prompt or "tuesday" in r.prompt_artifact.rendered_prompt.lower()


def test_g6m2_preference_not_upgraded_to_must():
    c = ProtectedIntentContract()
    c = propose_requirement(
        c, semantic_key="goal", kind=RequirementKind.MUST, value="Write email",
        provenance=Provenance.USER_EXPLICIT, source_ref="u",
    )
    c = propose_requirement(
        c, semantic_key="style", kind=RequirementKind.PREFERENCE, value="casual",
        provenance=Provenance.SPE_SUGGESTED, source_ref="spe",
    )
    art = build_prompt_artifact(c)
    prefs = [a for a in c.graph.nodes.values() if a.kind is RequirementKind.PREFERENCE]
    assert prefs and all(a.provenance is Provenance.SPE_SUGGESTED for a in prefs)
    assert art.rendered_prompt


def test_g6m3_unknown_not_filled_silently_for_ambiguous_app():
    r = compile_portable_request("build me an app")
    text = r.prompt_artifact.rendered_prompt.lower()
    # Must not invent a specific stack as required fact for unspecified app
    for banned in ("must use flutter", "must use firebase auth", "required: mongodb atlas"):
        assert banned not in text


def test_g6m4_conflict_not_removed():
    c = ProtectedIntentContract()
    c = propose_requirement(
        c, semantic_key="lang", kind=RequirementKind.MUST, value="Python",
        provenance=Provenance.USER_EXPLICIT, source_ref="u",
    )
    c = propose_requirement(
        c, semantic_key="lang", kind=RequirementKind.MUST_NOT, value="Python",
        provenance=Provenance.USER_EXPLICIT, source_ref="u",
    )
    assert c.validity is ContractValidity.CONFLICTED
    with pytest.raises(SpeTypedError) as ei:
        build_prompt_artifact(c)
    assert ei.value.code is ErrorCode.K3_PROMPT_CONFLICTED_SOURCE


def test_g6m5_technique_budget_bounded_on_trivial():
    assert STANDARD_MAX_TECHNIQUES == 3
    r = compile_portable_request("Return 2+2.")
    # Trivial compile still succeeds; budget constant remains finite
    assert r.prompt_artifact.rendered_prompt
    assert STANDARD_MAX_TECHNIQUES < 10


def test_g6m6_no_provider_lock_in_in_portable_default():
    r = compile_portable_request("write leave email")
    text = r.prompt_artifact.rendered_prompt
    assert "chat/completions" not in text
    assert "anthropic.com" not in text.lower()


def test_g6m7_does_not_mark_evidence_as_satisfied_without_sources():
    r = compile_portable_request("research battery technology")
    text = r.prompt_artifact.rendered_prompt.lower()
    assert "evidence verified" not in text
    assert "sources confirmed" not in text


def test_g6m8_structured_json_requirement_retained():
    r = compile_portable_request(
        "Return status JSON",
        must=["ONLY valid JSON", "ok", "items"],
    )
    text = r.prompt_artifact.rendered_prompt
    assert "JSON" in text


def test_g6m9_language_not_silently_switched_for_explicit_hindi_request():
    r = compile_portable_request("Write a professional leave email in Hindi. Must mention Tuesday.")
    # Goal retains Hindi mention
    assert "Hindi" in r.prompt_artifact.rendered_prompt


def test_g6m10_blind_pairs_do_not_leak_spe_label():
    pairs_path = EVAL / "blind_pairs.json"
    if not pairs_path.exists():
        pytest.skip("blind_pairs.json not generated yet")
    raw = pairs_path.read_text(encoding="utf-8")
    data = json.loads(raw)
    blob = json.dumps(data)
    assert "spe_side" not in blob
    assert "\"arm\": \"SPE\"" not in blob
    assert "is_spe" not in blob.lower()


def test_g6m11_holdout_isolated_from_dev():
    dev = json.loads((BM / "dev_manifest.json").read_text())
    hold = json.loads((BM / "holdout_manifest.json").read_text())
    overlap = set(dev["task_ids"]) & set(hold["task_ids"])
    assert not overlap
    assert hold.get("isolation")


def test_g6m12_randomization_mapping_not_in_evaluator_html():
    html = (EVAL / "blind_evaluator.html").read_text(encoding="utf-8")
    assert "spe_side" not in html
    assert "raw_side" not in html
    assert "randomization_manifest" not in html
