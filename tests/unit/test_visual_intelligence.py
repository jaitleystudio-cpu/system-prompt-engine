"""Lane E visual input IR. Measurements may PASS; judgments stay UNKNOWN."""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.visual import (
    ClaimVerdict,
    EpistemicStatus,
    Raster,
    SuppliedOcr,
    UnknownLaunderError,
    VisualAsset,
    VisualAuthorityError,
    VisualInputError,
    assert_unknown_is_not_pass,
    combine_verdicts,
    compile_visual_intent,
    compile_visual_intent_from_mapping,
    create_envelope,
    raster_with_rects,
    solid_raster,
)

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "schemas" / "visual_intent_contract.schema.json").read_text())


def _asset(asset_id: str, raster: Raster) -> VisualAsset:
    return VisualAsset(asset_id, raster, raster.width, raster.height)


def _compile(envelope_id: str, assets: tuple[VisualAsset, ...], mode: str, **kwargs):
    envelope = create_envelope(
        envelope_id=envelope_id,
        assets=assets,
        mode=mode,
        **kwargs,
    )
    return compile_visual_intent(envelope)


def _stripe(width: int = 64, height: int = 64) -> Raster:
    buffer = bytearray([255, 255, 255, 255]) * (width * height)
    for y in range(20, 28):
        for x in range(4, 60):
            value = 0 if x % 2 == 0 else 255
            index = (y * width + x) * 4
            buffer[index : index + 4] = bytes((value, value, value, 255))
    return Raster(width, height, bytes(buffer))


def test_envelope_and_contract_are_frozen():
    contract = _compile("e", (_asset("a", solid_raster(8, 8, 0, 0, 0)),), "describe")
    with pytest.raises(FrozenInstanceError):
        contract.authority_delta = 4  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        contract.observations[0].style.kind_verdict = ClaimVerdict.PASS  # type: ignore[misc]


def test_verdict_algebra_does_not_treat_unknown_as_pass():
    assert combine_verdicts(()) is ClaimVerdict.UNKNOWN
    assert combine_verdicts((ClaimVerdict.PASS, ClaimVerdict.UNKNOWN)) is ClaimVerdict.UNKNOWN
    assert combine_verdicts((ClaimVerdict.FAIL, ClaimVerdict.UNKNOWN)) is ClaimVerdict.FAIL
    with pytest.raises(UnknownLaunderError):
        assert_unknown_is_not_pass(ClaimVerdict.PASS, EpistemicStatus.MODEL_JUDGMENT)
    with pytest.raises(UnknownLaunderError):
        assert_unknown_is_not_pass(ClaimVerdict.FAIL, EpistemicStatus.ABSENT)


def test_create_envelope_rejects_nonzero_authority_before_analysis():
    with pytest.raises(VisualAuthorityError):
        create_envelope(
            envelope_id="e",
            assets=(),
            mode="describe",
            authority_delta=5,
        )


def test_compile_rejects_authority_override_without_honoring_it():
    contract = compile_visual_intent(
        create_envelope(
            envelope_id="e",
            assets=(_asset("a", solid_raster(8, 8, 1, 2, 3)),),
            mode="describe",
        ),
        authority_delta=5,
    )
    assert contract.verdict is ClaimVerdict.FAIL
    assert contract.authority_delta == 0
    assert contract.disposition == "ABSTAIN"
    assert "AUTHORITY_OVERRIDE_REJECTED" in contract.verdict_reason_codes
    assert contract.ownership["authority_delta"] == 0


def test_solid_red_compiles_measurement_pass_and_style_unknown():
    contract = _compile("red", (_asset("a", solid_raster(32, 32, 255, 0, 0)),), "image_to_prompt")
    jsonschema.validate(contract.to_dict(), SCHEMA)
    observation = contract.observations[0]
    assert contract.verdict is ClaimVerdict.PASS
    assert contract.disposition == "READY_FOR_LANE_A"
    assert contract.verdict_reason_codes == ("INPUT_COMPILED",)
    assert observation.colors[0].hex == "#ff0000"
    assert observation.colors[0].verdict is ClaimVerdict.PASS
    assert observation.style.kind_verdict is ClaimVerdict.UNKNOWN
    assert observation.style.lighting_verdict is ClaimVerdict.UNKNOWN
    assert observation.style.palette_mood_verdict is ClaimVerdict.UNKNOWN
    assert observation.typography.density_verdict is ClaimVerdict.UNKNOWN
    assert "UNTRUSTED_SOURCE" in contract.prompt_block
    assert contract.ownership["unknown_is_pass"] is False
    assert contract.ownership["output_boundary"] == "VisualIntentContract"
    assert "ProtectedIntent" in contract.ownership["does_not_own"]


def test_contrast_regions_stay_unclassified_and_relate_geometrically():
    raster = raster_with_rects(
        64,
        64,
        (255, 255, 255, 255),
        (
            (4, 4, 16, 16, (0, 0, 0, 255)),
            (40, 40, 16, 16, (0, 0, 0, 255)),
        ),
    )
    contract = _compile("panels", (_asset("p", raster),), "image_to_prompt")
    jsonschema.validate(contract.to_dict(), SCHEMA)
    observation = contract.observations[0]
    assert contract.verdict is ClaimVerdict.PASS
    assert len(observation.objects) == 2
    assert {item.class_label for item in observation.objects} == {"UNKNOWN"}
    assert {item.class_verdict for item in observation.objects} == {ClaimVerdict.UNKNOWN}
    assert {item.bounds_verdict for item in observation.objects} == {ClaimVerdict.PASS}
    assert observation.relationships
    assert observation.relationships[0].verdict is ClaimVerdict.PASS
    assert observation.relationships[0].predicate in {"left-of", "right-of", "above", "below"}
    assert observation.layout.semantic_columns_verdict is ClaimVerdict.UNKNOWN
    assert observation.layout.projection_columns_verdict is ClaimVerdict.PASS
    assert {item.role_label for item in observation.hierarchy} == {"UNKNOWN"}
    assert {item.role_verdict for item in observation.hierarchy} == {ClaimVerdict.UNKNOWN}
    assert {item.order_verdict for item in observation.hierarchy} == {ClaimVerdict.PASS}


def test_textlike_band_geometry_passes_without_claiming_ocr_truth():
    contract = _compile("stripe", (_asset("s", _stripe()),), "describe")
    jsonschema.validate(contract.to_dict(), SCHEMA)
    blocks = contract.observations[0].ocr_blocks
    assert blocks
    assert blocks[0].geometry_verdict is ClaimVerdict.PASS
    assert blocks[0].text_verdict is ClaimVerdict.UNKNOWN
    assert blocks[0].decoded is False
    assert blocks[0].provenance == "UNTRUSTED_SOURCE"
    assert contract.observations[0].typography.band_count_verdict is ClaimVerdict.PASS
    assert contract.observations[0].typography.density_verdict is ClaimVerdict.UNKNOWN


def test_comparison_records_byte_identity_and_refuses_semantic_equivalence():
    left = solid_raster(16, 16, 10, 20, 30)
    same = _compile(
        "same",
        (_asset("a", left), _asset("b", solid_raster(16, 16, 10, 20, 30))),
        "compare",
    )
    different = _compile(
        "diff",
        (_asset("a", left), _asset("b", solid_raster(16, 16, 200, 10, 10))),
        "compare",
    )
    jsonschema.validate(same.to_dict(), SCHEMA)
    jsonschema.validate(different.to_dict(), SCHEMA)
    assert same.verdict is ClaimVerdict.PASS
    assert same.comparisons[0].byte_identical is True
    assert same.comparisons[0].byte_identity_verdict is ClaimVerdict.PASS
    assert same.comparisons[0].semantic_equivalence_verdict is ClaimVerdict.UNKNOWN
    assert different.comparisons[0].byte_identical is False
    assert different.comparisons[0].byte_identity_verdict is ClaimVerdict.PASS
    assert different.comparisons[0].semantic_equivalence_verdict is ClaimVerdict.UNKNOWN
    scene = [
        node
        for node in same.evidence_graph.nodes
        if node.claim == "semantic_equivalence"
    ]
    assert scene and scene[0].verdict is ClaimVerdict.UNKNOWN
    assert scene[0].gates_contract is False


def test_missing_media_and_compare_arity_abstain():
    empty = _compile("empty", (), "describe")
    one = _compile("one", (_asset("a", solid_raster(8, 8, 1, 1, 1)),), "compare")
    assert empty.verdict is ClaimVerdict.UNKNOWN
    assert empty.disposition == "ABSTAIN"
    assert "NO_MEDIA" in empty.verdict_reason_codes
    assert one.verdict is ClaimVerdict.UNKNOWN
    assert "COMPARE_REQUIRES_TWO_ASSETS" in one.verdict_reason_codes
    jsonschema.validate(empty.to_dict(), SCHEMA)
    jsonschema.validate(one.to_dict(), SCHEMA)


def test_fully_transparent_raster_blocks_pass():
    raster = Raster(8, 8, bytes([0, 0, 0, 0]) * 64)
    contract = _compile("clear", (_asset("t", raster),), "describe")
    assert contract.verdict is ClaimVerdict.UNKNOWN
    assert "NO_OPAQUE_PIXELS" in contract.verdict_reason_codes
    assert contract.observations[0].style.brightness_verdict is ClaimVerdict.UNKNOWN


def test_one_pixel_still_compiles_when_opaque():
    contract = _compile("dot", (_asset("z", solid_raster(1, 1, 255, 255, 255)),), "describe")
    assert contract.verdict is ClaimVerdict.PASS
    assert contract.observations[0].style.kind_verdict is ClaimVerdict.UNKNOWN
    jsonschema.validate(contract.to_dict(), SCHEMA)


def test_compile_is_deterministic():
    raster = raster_with_rects(
        32,
        32,
        (240, 240, 240, 255),
        ((2, 2, 8, 8, (10, 10, 10, 255)),),
    )
    first = _compile("stable", (_asset("a", raster),), "image_to_prompt", user_goal="describe the frame")
    second = _compile("stable", (_asset("a", raster),), "image_to_prompt", user_goal="describe the frame")
    assert first.contract_id == second.contract_id
    assert first.to_dict() == second.to_dict()


def test_schema_rejects_authority_and_unknown_laundering():
    contract = _compile("red", (_asset("a", solid_raster(4, 4, 255, 0, 0)),), "describe")
    payload = contract.to_dict()
    payload["authority_delta"] = 1
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(payload, SCHEMA)
    payload = contract.to_dict()
    payload["ownership"]["unknown_is_pass"] = True
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(payload, SCHEMA)
    payload = contract.to_dict()
    payload["protected_intent"] = {"goal": "override"}
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(payload, SCHEMA)


def test_user_goal_over_budget_raises_on_typed_ingress():
    with pytest.raises(VisualInputError):
        create_envelope(
            envelope_id="long",
            assets=(),
            mode="describe",
            user_goal="x" * 2001,
        )


def test_pass_nodes_are_observations_and_judgments_do_not_gate():
    contract = _compile("red", (_asset("a", solid_raster(16, 16, 9, 9, 9)),), "describe")
    node_ids = {node.node_id for node in contract.evidence_graph.nodes}
    for edge in contract.evidence_graph.edges:
        assert edge.source_id in node_ids
        assert edge.target_id in node_ids
    interpretive = {
        "style_kind",
        "lighting",
        "palette_mood",
        "object_class",
        "hierarchy_role",
        "semantic_columns",
        "semantic_rows",
        "ocr_text",
        "semantic_equivalence",
        "typography_density",
    }
    for node in contract.evidence_graph.nodes:
        if node.verdict is ClaimVerdict.PASS:
            assert node.epistemic_status is EpistemicStatus.OBSERVATION
        if node.claim in interpretive:
            assert node.verdict is not ClaimVerdict.PASS
            assert node.gates_contract is False
