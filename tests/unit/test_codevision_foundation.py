"""Contract tests for the CODEVISION structure foundation.

These tests lock the six targets and the visual-fidelity proof format.
They do not measure pixels and they do not treat UNPROVEN as a pass on fidelity.
"""

from __future__ import annotations

import ast
import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.codevision.canonical import digest_json
from spe_runtime.codevision.compiler import compile_structure, relation_delta_fields
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.proof import (
    assert_proof_binds,
    build_visual_fidelity_proof,
    load_visual_fidelity_proof,
)
from spe_runtime.codevision.targets import (
    CLAIM_BOUNDARY,
    NODE_KINDS,
    RELATION_KINDS,
    SIX_TARGETS,
    UNMEASURED_CLAIMS,
    VISUAL_FIDELITY_STATUS,
)

_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE = _ROOT / "data" / "codevision" / "observation_two_cards.json"
_SCHEMAS = _ROOT / "schemas"
_FORBIDDEN_SCORE_KEYS = frozenset(
    {
        "pixel_score",
        "fidelity_score",
        "similarity",
        "similarity_score",
        "numeric_fidelity_score",
    }
)


def _fixture() -> dict:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def _node(payload: dict, node_id: str) -> dict:
    for node in payload["nodes"]:
        if node["node_id"] == node_id:
            return node
    raise KeyError(node_id)


def _blank_node(
    node_id: str,
    parent_id: str | None,
    kind: str,
    box: dict,
    text: str | None = None,
    style: dict | None = None,
    z_index: int = 0,
) -> dict:
    return {
        "node_id": node_id,
        "parent_id": parent_id,
        "kind": kind,
        "box": box,
        "text": text,
        "style": style,
        "z_index": z_index,
    }


def _canvas_observation(nodes: list[dict], width: int = 100, height: int = 100) -> dict:
    return {
        "schema_version": "spe.codevision.observation.v1",
        "observation_id": "obs-case",
        "source_kind": "screenshot_observation",
        "canvas": {"width": width, "height": height},
        "nodes": nodes,
    }


def _root(width: int = 100, height: int = 100) -> dict:
    return _blank_node(
        "root",
        None,
        "frame",
        {"x": 0, "y": 0, "width": width, "height": height},
    )


def _walk(value: object, *, allow_null_score_field: bool = False) -> None:
    if isinstance(value, float):
        raise AssertionError("output contains a float")
    if isinstance(value, dict):
        for key, child in value.items():
            if key in _FORBIDDEN_SCORE_KEYS:
                if not (
                    allow_null_score_field
                    and key == "numeric_fidelity_score"
                    and child is None
                ):
                    raise AssertionError(key)
            _walk(child, allow_null_score_field=allow_null_score_field)
        return
    if isinstance(value, list):
        for child in value:
            _walk(child, allow_null_score_field=allow_null_score_field)


def _relations(document: dict) -> list[dict]:
    return document["targets"]["spatial_relations"]["relations"]


def _has_relation(relations: list[dict], kind: str, source_id: str, target_id: str) -> bool:
    return any(
        item["kind"] == kind
        and item["source_id"] == source_id
        and item["target_id"] == target_id
        for item in relations
    )


def test_six_targets_are_the_closed_contract():
    assert SIX_TARGETS == (
        "region_tree",
        "element_inventory",
        "text_runs",
        "style_observations",
        "spatial_relations",
        "repeat_groups",
    )
    assert len(SIX_TARGETS) == 6
    assert len(set(SIX_TARGETS)) == 6
    assert NODE_KINDS == (
        "frame",
        "region",
        "text",
        "image",
        "control",
        "icon",
        "unknown",
    )
    assert RELATION_KINDS == (
        "contains",
        "stacked_above",
        "beside",
        "aligned_x_start",
        "aligned_x_center",
        "aligned_y_start",
        "aligned_y_center",
    )


def test_fixture_compiles_all_six_targets_without_a_fidelity_score():
    document = compile_structure(_fixture())
    payload = document.to_dict()
    assert payload["target_order"] == list(SIX_TARGETS)
    assert tuple(payload["targets"]) == SIX_TARGETS
    assert digest_json(document.hashed_body()) == document.structure_digest
    _walk(payload)

    tree = payload["targets"]["region_tree"]
    assert tree["root_id"] == "root"
    root = next(node for node in tree["nodes"] if node["node_id"] == "root")
    assert root["child_ids"] == ["header", "card_a", "card_b", "card_c"]
    assert root["depth"] == 0
    title = next(node for node in tree["nodes"] if node["node_id"] == "title")
    assert title["depth"] == 2
    assert title["parent_id"] == "header"

    inventory = payload["targets"]["element_inventory"]
    assert inventory["counts_are"] == "supplied_node_census"
    assert inventory["kind_counts"] == {
        "frame": 1,
        "region": 4,
        "text": 1,
        "image": 0,
        "control": 0,
        "icon": 0,
        "unknown": 0,
    }

    runs = payload["targets"]["text_runs"]["runs"]
    assert runs == [
        {
            "reading_index": 0,
            "node_id": "title",
            "text": "Inbox",
            "box": {"x": 16, "y": 8, "width": 200, "height": 24},
        }
    ]

    styles = payload["targets"]["style_observations"]["observations"]
    assert styles == [
        {"node_id": "card_a", "fill_hex": "#AABBCC", "radius_px": 8},
        {"node_id": "title", "font_size_px": 16, "font_weight": 600},
    ]

    relations = _relations(payload)
    assert len(relations) == 14
    assert _has_relation(relations, "contains", "root", "header")
    assert _has_relation(relations, "contains", "header", "title")
    assert _has_relation(relations, "stacked_above", "header", "card_a")
    assert _has_relation(relations, "stacked_above", "card_a", "card_c")
    assert _has_relation(relations, "beside", "card_a", "card_b")
    assert _has_relation(relations, "aligned_y_start", "card_a", "card_b")
    assert _has_relation(relations, "aligned_x_start", "card_a", "card_c")
    assert not _has_relation(relations, "beside", "card_b", "card_c")
    assert not _has_relation(relations, "stacked_above", "card_b", "card_c")
    for relation in relations:
        delta_field = relation_delta_fields(relation["kind"])
        if delta_field is None:
            assert "rule_delta_px" not in relation
            assert "rule_delta_half_px" not in relation
        else:
            assert delta_field in relation
            other = "rule_delta_px" if delta_field == "rule_delta_half_px" else "rule_delta_half_px"
            assert other not in relation

    groups = payload["targets"]["repeat_groups"]["groups"]
    assert groups == [
        {
            "group_id": "repeat:root:region:160x80",
            "parent_id": "root",
            "kind": "region",
            "width": 160,
            "height": 80,
            "member_ids": ["card_a", "card_b", "card_c"],
        }
    ]
    assert "not a similarity score" in payload["targets"]["repeat_groups"]["note"]

    proof = build_visual_fidelity_proof(document, "proof-two-cards")
    proof_payload = proof.to_dict()
    assert proof.visual_fidelity_status == VISUAL_FIDELITY_STATUS
    assert proof.visual_fidelity_proven is False
    assert proof_payload["pixel_comparison"] is None
    assert proof_payload["numeric_fidelity_score"] is None
    assert proof_payload["measured"] == []
    assert proof_payload["unmeasured"] == list(UNMEASURED_CLAIMS)
    assert proof_payload["claim_boundary"] == CLAIM_BOUNDARY
    assert proof_payload["target_counts"] == {
        "region_tree": 6,
        "element_inventory": 6,
        "text_runs": 1,
        "style_observations": 2,
        "spatial_relations": 14,
        "repeat_groups": 1,
    }
    assert_proof_binds(proof, document)
    _walk(proof_payload, allow_null_score_field=True)
    schema = json.loads(
        (_SCHEMAS / "codevision_visual_fidelity_proof.schema.json").read_text(
            encoding="utf-8"
        )
    )
    jsonschema.validate(proof_payload, schema)
    structure_schema = json.loads(
        (_SCHEMAS / "codevision_structure.schema.json").read_text(encoding="utf-8")
    )
    jsonschema.validate(payload, structure_schema)


def test_node_order_does_not_change_digests():
    first = compile_structure(_fixture())
    shuffled = _fixture()
    shuffled["nodes"] = list(reversed(shuffled["nodes"]))
    second = compile_structure(shuffled)
    assert first.observation_digest == second.observation_digest
    assert first.structure_digest == second.structure_digest
    assert first.to_dict()["targets"] == second.to_dict()["targets"]


def test_one_pixel_box_change_is_not_a_repeat_and_is_still_unproven():
    payload = _fixture()
    card_c = _node(payload, "card_c")
    card_c["box"]["width"] = 161
    document = compile_structure(payload)
    groups = document.to_dict()["targets"]["repeat_groups"]["groups"]
    assert groups[0]["member_ids"] == ["card_a", "card_b"]
    assert "card_c" not in groups[0]["member_ids"]
    proof = build_visual_fidelity_proof(document, "proof-one-pixel")
    assert proof.visual_fidelity_proven is False
    assert proof.visual_fidelity_status == "UNPROVEN"
    assert proof.numeric_fidelity_score is None
    assert document.structure_digest != compile_structure(_fixture()).structure_digest


def test_alignment_tolerance_is_a_rule_not_a_score():
    inside = _canvas_observation(
        [
            _root(80, 40),
            _blank_node("a", "root", "region", {"x": 10, "y": 0, "width": 20, "height": 20}),
            _blank_node("b", "root", "region", {"x": 12, "y": 0, "width": 20, "height": 20}),
        ],
        80,
        40,
    )
    matched = _relations(compile_structure(inside).to_dict())
    assert _has_relation(matched, "aligned_x_start", "a", "b")
    start = next(item for item in matched if item["kind"] == "aligned_x_start")
    assert start["rule_delta_px"] == 2

    outside = _canvas_observation(
        [
            _root(80, 40),
            _blank_node("a", "root", "region", {"x": 10, "y": 0, "width": 20, "height": 20}),
            _blank_node("b", "root", "region", {"x": 13, "y": 0, "width": 20, "height": 20}),
        ],
        80,
        40,
    )
    missed = _relations(compile_structure(outside).to_dict())
    assert not _has_relation(missed, "aligned_x_start", "a", "b")

    centered = _canvas_observation(
        [
            _root(80, 40),
            _blank_node("a", "root", "region", {"x": 0, "y": 0, "width": 10, "height": 10}),
            _blank_node("b", "root", "region", {"x": 2, "y": 0, "width": 10, "height": 10}),
        ],
        80,
        40,
    )
    center_hit = _relations(compile_structure(centered).to_dict())
    assert _has_relation(center_hit, "aligned_x_center", "a", "b")

    off_center = _canvas_observation(
        [
            _root(80, 40),
            _blank_node("a", "root", "region", {"x": 0, "y": 0, "width": 10, "height": 10}),
            _blank_node("b", "root", "region", {"x": 3, "y": 0, "width": 10, "height": 10}),
        ],
        80,
        40,
    )
    center_miss = _relations(compile_structure(off_center).to_dict())
    assert not _has_relation(center_miss, "aligned_x_center", "a", "b")


def test_unknown_kind_is_preserved_and_text_is_exact():
    payload = _canvas_observation(
        [
            _root(),
            _blank_node("mark", "root", "unknown", {"x": 1, "y": 1, "width": 8, "height": 8}),
            _blank_node(
                "label",
                "root",
                "text",
                {"x": 1, "y": 20, "width": 40, "height": 16},
                text="Café",
            ),
        ]
    )
    document = compile_structure(payload)
    kinds = {
        node["node_id"]: node["kind"]
        for node in document.to_dict()["targets"]["element_inventory"]["nodes"]
    }
    assert kinds["mark"] == "unknown"
    runs = document.to_dict()["targets"]["text_runs"]["runs"]
    assert [run["text"] for run in runs] == ["Café"]
    assert runs[0]["reading_index"] == 0


def test_structure_document_is_immutable():
    document = compile_structure(_fixture())
    with pytest.raises(FrozenInstanceError):
        document.observation_id = "other"  # type: ignore[misc]
    with pytest.raises(TypeError):
        document.targets["region_tree"] = {}  # type: ignore[index]


@pytest.mark.parametrize(
    ("mutate", "reason"),
    [
        (lambda payload: payload.update({"pixel_score": 99}), "NUMERIC_SCORE_FORBIDDEN"),
        (lambda payload: payload.update({"image_base64": "aaaa"}), "IMAGE_BYTES_NOT_ACCEPTED"),
        (lambda payload: payload.__setitem__("source_kind", "png"), "IMAGE_BYTES_NOT_ACCEPTED"),
        (lambda payload: payload.__setitem__("source_kind", "vision_model"), "SOURCE_KIND_REJECTED"),
        (lambda payload: payload.__setitem__("schema_version", "spe.codevision.observation.v0"), "SCHEMA_VERSION_UNSUPPORTED"),
        (lambda payload: payload.__setitem__("nodes", []), "EMPTY_OBSERVATION"),
        (lambda payload: payload.update({"extra": 1}), "OBSERVATION_FIELD_UNKNOWN"),
        (lambda payload: _node(payload, "card_a").__setitem__("kind", "button"), "UNKNOWN_KIND"),
        (lambda payload: _node(payload, "card_a").__setitem__("text", "nope"), "TEXT_ON_NON_TEXT"),
        (lambda payload: _node(payload, "title").__setitem__("text", ""), "TEXT_MISSING"),
        (lambda payload: _node(payload, "card_a")["box"].__setitem__("width", True), "BOX_TYPE_INVALID"),
        (lambda payload: _node(payload, "root").__setitem__("kind", "region"), "KIND_ROLE_INVALID"),
        (lambda payload: _node(payload, "root")["box"].__setitem__("x", 1), "ROOT_CANVAS_MISMATCH"),
        (lambda payload: _node(payload, "title")["box"].__setitem__("height", 40), "BOX_OUTSIDE_PARENT"),
        (lambda payload: payload["nodes"].append(dict(_node(payload, "card_a"))), "DUPLICATE_NODE_ID"),
    ],
)
def test_observation_refusals(mutate, reason):
    payload = _fixture()
    mutate(payload)
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(payload)
    assert caught.value.reason == reason


def test_missing_parent_cycle_and_second_root_are_refused():
    missing = _canvas_observation(
        [
            _root(),
            _blank_node("a", "missing", "region", {"x": 0, "y": 0, "width": 10, "height": 10}),
        ]
    )
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(missing)
    assert caught.value.reason == "MISSING_PARENT"

    cycle = _canvas_observation(
        [
            _root(),
            _blank_node("a", "b", "region", {"x": 0, "y": 0, "width": 10, "height": 10}),
            _blank_node("b", "a", "region", {"x": 0, "y": 0, "width": 10, "height": 10}),
        ]
    )
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(cycle)
    assert caught.value.reason == "PARENT_CYCLE"

    two_roots = _canvas_observation(
        [
            _root(),
            _blank_node("other", None, "frame", {"x": 0, "y": 0, "width": 100, "height": 100}),
        ]
    )
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(two_roots)
    assert caught.value.reason == "ROOT_COUNT_INVALID"


def test_depth_and_node_limits():
    deep_nodes = [_root()]
    parent = "root"
    for index in range(1, 34):
        node_id = f"n{index}"
        deep_nodes.append(
            _blank_node(
                node_id,
                parent,
                "region",
                {"x": 0, "y": 0, "width": 100, "height": 100},
            )
        )
        parent = node_id
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(_canvas_observation(deep_nodes))
    assert caught.value.reason == "DEPTH_LIMIT_EXCEEDED"

    too_many = _fixture()
    too_many["nodes"] = [{"node_id": f"n{index}"} for index in range(501)]
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(too_many)
    assert caught.value.reason == "NODE_LIMIT_EXCEEDED"


def test_proof_format_rejects_fidelity_claims_and_scores():
    proof = build_visual_fidelity_proof(compile_structure(_fixture()), "proof-two-cards")
    schema = json.loads(
        (_SCHEMAS / "codevision_visual_fidelity_proof.schema.json").read_text(
            encoding="utf-8"
        )
    )
    claimed = proof.to_dict()
    claimed["visual_fidelity_status"] = "PROVEN"
    claimed["visual_fidelity_proven"] = True
    claimed["numeric_fidelity_score"] = 100
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(claimed, schema)
    with pytest.raises(CodevisionContractError) as caught:
        load_visual_fidelity_proof(claimed)
    assert caught.value.reason == "FIDELITY_CLAIM_FORBIDDEN"

    scored = proof.to_dict()
    scored["numeric_fidelity_score"] = 0
    with pytest.raises(CodevisionContractError) as caught:
        load_visual_fidelity_proof(scored)
    assert caught.value.reason == "NUMERIC_SCORE_FORBIDDEN"

    compared = proof.to_dict()
    compared["pixel_comparison"] = {"diff": 0}
    with pytest.raises(CodevisionContractError) as caught:
        load_visual_fidelity_proof(compared)
    assert caught.value.reason == "PIXEL_COMPARISON_FORBIDDEN"

    measured = proof.to_dict()
    measured["measured"] = ["pixel_perfect"]
    with pytest.raises(CodevisionContractError) as caught:
        load_visual_fidelity_proof(measured)
    assert caught.value.reason == "MEASURED_CLAIM_FORBIDDEN"

    hidden = proof.to_dict()
    hidden["unmeasured"] = ["pixel_perfect"]
    with pytest.raises(CodevisionContractError) as caught:
        load_visual_fidelity_proof(hidden)
    assert caught.value.reason == "UNMEASURED_SET_MISMATCH"

    softened = proof.to_dict()
    softened["claim_boundary"] = "Visual fidelity is proven."
    with pytest.raises(CodevisionContractError) as caught:
        load_visual_fidelity_proof(softened)
    assert caught.value.reason == "CLAIM_BOUNDARY_MISMATCH"

    other_payload = _canvas_observation(
        [
            _root(),
            _blank_node("only", "root", "region", {"x": 2, "y": 2, "width": 4, "height": 4}),
        ]
    )
    other_payload["observation_id"] = "obs-two-cards"
    other = compile_structure(other_payload)
    with pytest.raises(CodevisionContractError) as caught:
        assert_proof_binds(proof, other)
    assert caught.value.reason == "DIGEST_MISMATCH"


def test_codevision_does_not_import_other_lanes():
    package = _ROOT / "spe_runtime" / "codevision"
    forbidden = (
        "spe_runtime.k3",
        "spe_runtime.xcat",
        "spe_runtime.quality",
        "spe_runtime.categories",
        "spe_runtime.providers",
        "spe_runtime.grounding",
        "spe_runtime.protocols",
        "portable",
        "PIL",
        "cv2",
    )
    for path in sorted(package.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        imported: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.append(node.module)
        for name in imported:
            for prefix in forbidden:
                assert name != prefix and not name.startswith(prefix + ".")
            if name.startswith("spe_runtime") and not name.startswith("spe_runtime.codevision"):
                raise AssertionError(f"{path.name} imports {name}")
