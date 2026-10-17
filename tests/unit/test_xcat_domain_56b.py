"""Task 56B — DOMAIN category engines, migration, routing."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.categories.c04_translate import translate
from spe_runtime.categories.c05_learn import learn
from spe_runtime.categories.c08_business import business
from spe_runtime.categories.c09_code import code
from spe_runtime.categories.c10_multimedia import multimedia
from spe_runtime.categories.c11_career import career
from spe_runtime.categories.c12_creative import creative
from spe_runtime.k3.registry import IMPLEMENTED_XCAT, UNIMPLEMENTED_XCAT
from spe_runtime.xcat.migration import (
    CURRENT_TAXONOMY_VERSION,
    LEGACY_TAXONOMY_VERSION,
    reject_legacy_payload_reinterpretation,
    validate_taxonomy_version,
)
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope
from spe_runtime.xcat.router import route_mission_stage

REPO = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO / "data" / "category_registry_v1.json"

DOMAIN_NAMES = {
    "CAT:C01": "Advise / Plan / Decide",
    "CAT:C02": "Research",
    "CAT:C03": "Write / Rewrite / Communicate",
    "CAT:C04": "Translate / Localize / Language Transform",
    "CAT:C05": "Learn",
    "CAT:C06": "Analyze / Compare / Extract",
    "CAT:C07": "Work / Execute",
    "CAT:C08": "Business",
    "CAT:C09": "Code",
    "CAT:C10": "Multimedia",
    "CAT:C11": "Career",
    "CAT:C12": "Creative / Story / Roleplay",
}

POSITIVE_PAYLOADS = {
    "CAT:C04": {"source_language": "en", "target_language": "es", "protected_terms": ["SPE"]},
    "CAT:C05": {
        "learner_state": {"status": "LEARNING"},
        "concept_graph": {"nodes": ["A"]},
        "mastery_evidence": {"quiz_id": "q1", "score": 0.9},
    },
    "CAT:C08": {"customer": "smb", "market": "b2b", "offer": "plan"},
    "CAT:C09": {"repository": "spe", "architecture": "modular", "tests": ["unit"]},
    "CAT:C10": {"medium": "image", "source_assets": ["a.png"], "storyboard": ["beat1"]},
    "CAT:C11": {"profile": "eng", "target_role": "staff", "gaps": ["systems"]},
    "CAT:C12": {"canon": {"world": "alpha"}, "characters": ["A"], "plot": "rise"},
}

ENGINES = {
    "CAT:C04": translate,
    "CAT:C05": learn,
    "CAT:C08": business,
    "CAT:C09": code,
    "CAT:C10": multimedia,
    "CAT:C11": career,
    "CAT:C12": creative,
}


def _env(**overrides) -> CrossCategoryEnvelope:
    base = dict(
        envelope_id="env-56b",
        goal_identity="goal-56b",
        facts=({"fact_id": "f1", "statement": "note", "provenance_ids": ["p1"]},),
        provenance=({"provenance_id": "p1", "source": "user"},),
        uncertainties=({"uncertainty_id": "u1", "description": "maybe"},),
        hard_constraints=(
            {"constraint_id": "c1", "statement": "no invent", "strength": "HARD"},
        ),
        user_preferences=({"preference_id": "pref1", "statement": "concise"},),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(),
        taint_labels=(),
        sensitivity_labels=(),
        category_trace=(),
        taxonomy_version="2",
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


def test_registry_domain_names() -> None:
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    assert data["version"] == "2"
    assert data["taxonomy"] == "DOMAIN"
    assert data["supersedes_version"] == "1"
    assert data["legacy_taxonomy"]["status"] == "MIGRATION_METADATA_ONLY"
    by_id = {c["id"]: c["name"] for c in data["categories"]}
    assert by_id == DOMAIN_NAMES
    assert IMPLEMENTED_XCAT == frozenset(DOMAIN_NAMES)
    assert UNIMPLEMENTED_XCAT == frozenset()


@pytest.mark.parametrize("category_id", sorted(POSITIVE_PAYLOADS))
def test_positive_payload_apply(category_id: str) -> None:
    before = _env()
    payload = POSITIVE_PAYLOADS[category_id]
    after = ENGINES[category_id](before, payload=payload)
    assert after.active_category == category_id
    assert after.to_dict()["category_payload"] == payload
    assert category_id in after.category_trace
    assert after.facts == before.facts
    assert after.authority_state == before.authority_state
    assert after.goal_identity == before.goal_identity


def test_forbidden_authority_write_rejected() -> None:
    before = _env()
    with pytest.raises(ValueError, match="forbidden"):
        apply_category_payload(
            before, "CAT:C09", {"repository": "x", "authority": "GRANTED"}
        )


def test_facts_unchanged_by_category_apply() -> None:
    before = _env()
    after = translate(before, payload={"source_language": "en", "target_language": "fr"})
    assert after.facts == before.facts
    assert after.provenance == before.provenance
    assert after.uncertainties == before.uncertainties
    assert after.hard_constraints == before.hard_constraints
    assert after.execution_grants == before.execution_grants


def test_legacy_c04_plan_rejected() -> None:
    before = _env(taxonomy_version=LEGACY_TAXONOMY_VERSION)
    with pytest.raises(ValueError, match="LEGACY_TAXONOMY_UNMIGRATED"):
        translate(before, payload={"source_language": "en", "target_language": "de"})


def test_legacy_c09_privacy_rejected() -> None:
    with pytest.raises(ValueError, match="LEGACY_TAXONOMY_UNMIGRATED"):
        reject_legacy_payload_reinterpretation(
            LEGACY_TAXONOMY_VERSION, "CAT:C09", {"repository": "x"}
        )


def test_unknown_taxonomy_version() -> None:
    result = validate_taxonomy_version("9")
    assert result["status"] == "error"
    assert result["code"] == "UNKNOWN_TAXONOMY_VERSION"
    before = _env(taxonomy_version="9")
    with pytest.raises(ValueError, match="UNKNOWN_TAXONOMY_VERSION"):
        apply_category_payload(before, "CAT:C04", {"source_language": "en"})


def test_mastery_without_evidence_rejected() -> None:
    before = _env()
    with pytest.raises(ValueError, match="mastery_evidence"):
        learn(before, payload={"learner_state": {"status": "MASTERED"}})


def test_code_generated_not_build_pass() -> None:
    before = _env()
    with pytest.raises(ValueError, match="BUILD_PASS|TEST_PASS|VERIFIED"):
        code(before, payload={"repository": "x", "BUILD_PASS": True})


def test_routing_needs_disambiguation_without_evidence() -> None:
    result = route_mission_stage({"mission": "do something"})
    assert result["disposition"] == "NEEDS_DISAMBIGUATION"
    assert result["primary_category"] is None


def test_routing_with_explicit_stage_evidence() -> None:
    result = route_mission_stage(
        {"stage": {"category_ref": "CAT:C09"}, "category_evidence": [{"key": "stage"}]}
    )
    assert result["disposition"] == "ROUTED"
    assert result["primary_category"] == "CAT:C09"


def test_routing_never_defaults_to_c01() -> None:
    result = route_mission_stage({})
    assert result["disposition"] == "NEEDS_DISAMBIGUATION"
    assert result["primary_category"] is None


def test_routing_rejects_self_selected_without_evidence() -> None:
    result = route_mission_stage({"self_selected_category": "CAT:C01"})
    assert result["disposition"] == "UNKNOWN"
    assert result["primary_category"] is None


def test_determinism_same_input_same_output() -> None:
    evidence = {"primary_category": "CAT:C05", "secondary_categories": ["CAT:C02"]}
    first = route_mission_stage(evidence)
    second = route_mission_stage(evidence)
    assert first == second
    before = _env()
    payload = POSITIVE_PAYLOADS["CAT:C08"]
    assert business(before, payload=payload).to_dict() == business(
        before, payload=payload
    ).to_dict()


def test_no_network_imports_in_router_and_apply() -> None:
    import spe_runtime.categories.apply as apply_mod
    import spe_runtime.xcat.router as router_mod

    for mod in (apply_mod, router_mod):
        src = Path(mod.__file__).read_text(encoding="utf-8")
        assert "requests" not in src
        assert "urllib" not in src
        assert "socket" not in src
        assert "http.client" not in src


def test_current_taxonomy_ok() -> None:
    assert validate_taxonomy_version(CURRENT_TAXONOMY_VERSION)["status"] == "ok"
