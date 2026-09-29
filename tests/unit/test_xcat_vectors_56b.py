"""Load Task 56B CATEGORY_VECTORS corpus and assert coverage + offline determinism."""

from __future__ import annotations

import json
from pathlib import Path

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope
from spe_runtime.xcat.router import route_mission_stage

REPO = Path(__file__).resolve().parents[2]
VECTOR_PATH = REPO / "proofs" / "xcat_v1_closure_20260929" / "CATEGORY_VECTORS.json"

MIN_PAYLOAD = {
    "CAT:C01": {"options": ["a"], "criteria": ["cost"]},
    "CAT:C02": {"questions": ["q1"], "sources": ["s1"]},
    "CAT:C03": {"audience": "ops", "draft": "hello"},
    "CAT:C04": {"source_language": "en", "target_language": "es"},
    "CAT:C05": {"learner_state": {"status": "LEARNING"}, "mastery_evidence": {"id": "e1"}},
    "CAT:C06": {"subjects": ["x"], "dimensions": ["y"]},
    "CAT:C07": {"work_items": ["w1"], "checkpoints": ["c1"]},
    "CAT:C08": {"customer": "c", "offer": "o"},
    "CAT:C09": {"repository": "r", "tests": []},
    "CAT:C10": {"medium": "image", "source_assets": []},
    "CAT:C11": {"profile": "p", "target_role": "r"},
    "CAT:C12": {"canon": {"k": 1}, "plot": "p"},
}


def _env(taxonomy_version: str = "2") -> CrossCategoryEnvelope:
    return CrossCategoryEnvelope(
        envelope_id="vec-env",
        goal_identity="vec-goal",
        facts=(),
        provenance=(),
        uncertainties=(),
        hard_constraints=(),
        user_preferences=(),
        authority_state=AuthorityState(),
        taxonomy_version=taxonomy_version,
    )


def _load() -> dict:
    assert VECTOR_PATH.is_file()
    return json.loads(VECTOR_PATH.read_text(encoding="utf-8"))


def test_corpus_counts_and_per_category_floor() -> None:
    payload = _load()
    assert payload["taxonomy"] == "DOMAIN"
    assert payload["taxonomy_version"] == "2"
    assert payload["normal_count"] >= 60
    assert payload["adversarial_count"] >= 48
    vectors = payload["vectors"]
    assert len(vectors) == payload["normal_count"] + payload["adversarial_count"]
    for i in range(1, 13):
        cat = f"CAT:C{i:02d}"
        normals = [v for v in vectors if v["class"] == "normal" and v["category"] == cat]
        adversarials = [
            v for v in vectors if v["class"] == "adversarial" and v["category"] == cat
        ]
        assert len(normals) >= 5, cat
        assert len(adversarials) >= 4, cat


def test_vector_shape() -> None:
    for row in _load()["vectors"]:
        assert "id" in row and "class" in row and "category" in row
        assert "input" in row and "expected" in row
        assert "summary" in row["input"]
        assert "disposition" in row["expected"]


def test_sample_normal_vectors_apply() -> None:
    for row in _load()["vectors"]:
        if row["class"] != "normal":
            continue
        if row.get("kind") not in {"payload_apply", "payload_fields", "active_set"}:
            continue
        cat = row["category"]
        after = apply_category_payload(_env(), cat, MIN_PAYLOAD[cat])
        assert after.active_category == cat
        assert row["expected"]["disposition"] == "ACCEPT"


def test_sample_adversarial_vectors_fail_closed() -> None:
    for row in _load()["vectors"]:
        if row["class"] != "adversarial":
            continue
        kind = row.get("kind")
        cat = row["category"]
        if kind == "forbidden_key":
            try:
                apply_category_payload(_env(), cat, {**MIN_PAYLOAD[cat], "authority": 1})
                raised = False
            except ValueError:
                raised = True
            assert raised
        elif kind == "unknown_field":
            try:
                apply_category_payload(_env(), cat, {**MIN_PAYLOAD[cat], "not_an_ir_field": 1})
                raised = False
            except ValueError:
                raised = True
            assert raised
        elif kind == "legacy_plan" or kind == "legacy_privacy":
            try:
                apply_category_payload(
                    _env(taxonomy_version="1"), cat, MIN_PAYLOAD[cat]
                )
                raised = False
            except ValueError as exc:
                raised = "LEGACY_TAXONOMY_UNMIGRATED" in str(exc)
            assert raised
        elif kind == "mastery_no_evidence":
            try:
                apply_category_payload(
                    _env(), cat, {"learner_state": {"status": "MASTERED"}}
                )
                raised = False
            except ValueError:
                raised = True
            assert raised
        elif kind == "build_pass":
            try:
                apply_category_payload(
                    _env(), cat, {"repository": "x", "BUILD_PASS": True}
                )
                raised = False
            except ValueError:
                raised = True
            assert raised


def test_routing_vectors_deterministic_offline() -> None:
    a = route_mission_stage({"primary_category": "CAT:C04"})
    b = route_mission_stage({"primary_category": "CAT:C04"})
    assert a == b
    assert a["disposition"] == "ROUTED"
    empty = route_mission_stage({"note": "no category"})
    assert empty["disposition"] == "NEEDS_DISAMBIGUATION"
