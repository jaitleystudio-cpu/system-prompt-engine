"""Donor qualification for the CODEVISION six-target structural IR.

These tests read the donor compiler. They do not decode images, run OCR, infer
a model, or treat visual fidelity as proven.
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.codevision.canonical import digest_json
from spe_runtime.codevision.compiler import compile_structure
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.observation import normalize_observation, observation_digest
from spe_runtime.codevision.proof import (
    assert_proof_binds,
    build_visual_fidelity_proof,
)
from spe_runtime.codevision.targets import (
    SIX_TARGETS,
    VISUAL_FIDELITY_STATUS,
)
from tests.mutation.cvr1_harness import (
    MALICIOUS_TEXT,
    MUTANT_IDS,
    EVIDENCE_CLASSES,
    build_donor_snapshot,
    evidence_index,
    rich_observation,
    target_uncertainty_flags,
    verdict,
)

_ROOT = Path(__file__).resolve().parents[2]
_PACKAGE = _ROOT / "spe_runtime" / "codevision"
_PROOF_FILE = _ROOT / "tests" / "proofs" / "codevision_r1q_proof.json"
_FRAMEWORK_NAMES = frozenset(
    {"react", "vue", "angular", "svelte", "swiftui", "uikit", "html", "css", "flutter"}
)
_DECODER_MODULES = (
    "PIL",
    "cv2",
    "pytesseract",
    "easyocr",
    "paddleocr",
    "torch",
    "tensorflow",
)
_FORBIDDEN_CALLS = frozenset({"eval", "exec"})
_FORBIDDEN_SOURCE_TOKENS = (
    "desktop",
    "breakpoint",
    "font_family",
    "viewport",
    "VERIFIED",
    "PROVEN",
    "tesseract",
    "ocr",
)


@pytest.fixture(scope="module")
def donor():
    return build_donor_snapshot()


def test_six_targets_are_the_observed_structural_names():
    proof = json.loads(_PROOF_FILE.read_text(encoding="utf-8"))
    assert SIX_TARGETS == tuple(proof["targets"])
    assert len(SIX_TARGETS) == 6
    assert set(SIX_TARGETS).isdisjoint(_FRAMEWORK_NAMES)
    assert proof["donor_sha"] == "f85649fe31d0ac7404ef1b30906b6b9d222f1a6e"
    assert proof["image_decoder"] == "NO"
    assert proof["ocr_engine"] == "NO"
    assert proof["render_compare"] == "NO"
    assert proof["semantic_authority"] == "NONE"
    assert proof["visual_fidelity"] == "UNPROVEN"
    assert proof["unknown_is_pass"] is False
    assert proof["unknown_verdict"] == "UNKNOWN"
    assert proof["mutant_ids"] == list(MUTANT_IDS)
    assert proof["mutant_count"] == 20
    assert proof["observed_without_pixel_evidence"] == "FORBIDDEN"


def test_evidence_classes_never_mark_unknown_as_pass_or_observed(donor):
    records = evidence_index(donor)
    assert set(records.values()) <= EVIDENCE_CLASSES
    assert "OBSERVED" not in records.values()
    assert records["claim.ocr_text"] == "UNKNOWN"
    assert records["claim.asset"] == "UNKNOWN"
    assert records["claim.font_family"] == "UNKNOWN"
    assert records["claim.viewport"] == "UNKNOWN"
    assert records["claim.breakpoint"] == "UNKNOWN"
    assert records["claim.component"] == "UNKNOWN"
    assert records["claim.pixel_evidence"] == "UNKNOWN"
    assert records["claim.visual_fidelity"] == "UNKNOWN"
    assert records["claim.semantic_authority"] == "UNKNOWN"
    for evidence_class in records.values():
        assert verdict(evidence_class) != "PASS"
    assert verdict("UNKNOWN") == "UNKNOWN"
    assert records["targets.element_inventory.nodes.unknown_1.kind"] == "USER_SUPPLIED"
    assert records["targets.element_inventory.nodes.icon_1.kind"] == "USER_SUPPLIED"
    assert records["targets.element_inventory.nodes.image_1.kind"] == "USER_SUPPLIED"
    assert records["targets.text_runs.runs.label.text"] == "USER_SUPPLIED"
    assert records["targets.text_runs.runs.label.reading_index"] == "DERIVED"
    assert records["targets.region_tree.nodes.covered.depth"] == "DERIVED"
    assert records["targets.region_tree.nodes.panel.child_ids"] == "DERIVED"
    assert (
        records["targets.style_observations.observations.panel.fill_hex"] == "DERIVED"
    )
    assert (
        records["targets.style_observations.observations.fonty.font_size_px"]
        == "USER_SUPPLIED"
    )
    assert records["targets.spatial_relations.relations"] == "DERIVED"
    assert records["targets.repeat_groups.groups"] == "DERIVED"
    assert records["proof.visual_fidelity_status"] == "DERIVED"


def test_donor_preserves_supplied_facts_and_does_not_invent(donor):
    document = donor.document
    proof = donor.proof
    supplied = {node["node_id"]: node for node in donor.observation["nodes"]}
    assert tuple(document["target_order"]) == SIX_TARGETS
    assert tuple(document["targets"]) == SIX_TARGETS

    inventory = {
        node["node_id"]: node
        for node in document["targets"]["element_inventory"]["nodes"]
    }
    tree = {
        node["node_id"]: node for node in document["targets"]["region_tree"]["nodes"]
    }
    assert set(inventory) == set(supplied) == set(tree)
    for node_id, source in supplied.items():
        assert inventory[node_id]["kind"] == source["kind"]
        assert inventory[node_id]["box"] == source["box"]
        assert tree[node_id]["box"] == source["box"]
        assert inventory[node_id]["z_index"] == source["z_index"]
    assert tree["panel"]["child_ids"] == ["covered", "label"]
    assert "covered" in tree

    runs = document["targets"]["text_runs"]["runs"]
    assert [(run["node_id"], run["text"]) for run in runs] == [
        ("label", MALICIOUS_TEXT),
        ("fonty", "Hello"),
    ]
    assert runs[0]["reading_index"] == 0
    assert runs[1]["reading_index"] == 1

    styles = document["targets"]["style_observations"]["observations"]
    assert styles == [
        {"node_id": "fonty", "font_size_px": 14},
        {"node_id": "panel", "fill_hex": "#AB12CD"},
    ]
    assert document["targets"]["element_inventory"]["kind_counts"]["unknown"] == 1
    assert document["targets"]["element_inventory"]["kind_counts"]["icon"] == 1
    assert document["targets"]["element_inventory"]["kind_counts"]["image"] == 1
    assert document["targets"]["repeat_groups"]["groups"] == []
    spatial = document["targets"]["spatial_relations"]
    assert spatial["omitted_in_v1"] == ["overlap", "cross_parent_alignment"]
    assert all(relation["kind"] != "overlap" for relation in spatial["relations"])

    flags = [
        target_uncertainty_flags(document["targets"][name]) for name in SIX_TARGETS
    ]
    assert flags == [flags[0]] * 6
    assert flags[0] == {
        "viewport": False,
        "breakpoint": False,
        "font_family": False,
        "component": False,
        "ocr": False,
        "asset": False,
        "fidelity_claim": False,
    }

    encoded = json.dumps(document)
    for token in ("desktop", "mobile", "breakpoint", "viewport", "font_family", "ocr"):
        assert token not in encoded
    assert proof["visual_fidelity_status"] == VISUAL_FIDELITY_STATUS == "UNPROVEN"
    assert proof["visual_fidelity_proven"] is False
    assert proof["pixel_comparison"] is None
    assert proof["numeric_fidelity_score"] is None
    assert proof["measured"] == []
    assert "success" not in json.dumps(proof)
    assert "PASS" not in json.dumps(proof)
    assert "VERIFIED" not in json.dumps(proof)


def test_cross_target_boxes_and_provenance_agree(donor):
    document = donor.document
    tree_boxes = {
        node["node_id"]: node["box"]
        for node in document["targets"]["region_tree"]["nodes"]
    }
    for node in document["targets"]["element_inventory"]["nodes"]:
        assert tree_boxes[node["node_id"]] == node["box"]
    for run in document["targets"]["text_runs"]["runs"]:
        assert tree_boxes[run["node_id"]] == run["box"]
    inventory_ids = {
        node["node_id"] for node in document["targets"]["element_inventory"]["nodes"]
    }
    for item in document["targets"]["style_observations"]["observations"]:
        assert item["node_id"] in inventory_ids
    for relation in document["targets"]["spatial_relations"]["relations"]:
        assert relation["source_id"] in inventory_ids
        assert relation["target_id"] in inventory_ids
    expected_observation = observation_digest(normalize_observation(donor.observation))
    assert document["observation_digest"] == expected_observation
    body = {
        key: value for key, value in document.items() if key != "structure_digest"
    }
    assert document["structure_digest"] == digest_json(body)
    proof = build_visual_fidelity_proof(
        compile_structure(donor.observation), "proof-r1-rich"
    )
    assert_proof_binds(proof, compile_structure(donor.observation))


def test_missing_dimension_is_refused_and_zero_is_refused():
    missing = rich_observation()
    covered = next(node for node in missing["nodes"] if node["node_id"] == "covered")
    del covered["box"]["width"]
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(missing)
    assert caught.value.reason == "BOX_FIELD_MISSING"

    zeroed = rich_observation()
    covered = next(node for node in zeroed["nodes"] if node["node_id"] == "covered")
    covered["box"]["width"] = 0
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(zeroed)
    assert caught.value.reason == "BOX_EXTENT_INVALID"


def test_unsupported_source_is_refused_not_rewritten():
    observation = rich_observation()
    observation["source_kind"] = "not_a_target"
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(observation)
    assert caught.value.reason == "SOURCE_KIND_REJECTED"


def test_compile_does_not_execute_metadata_or_leave_the_schema_dir(monkeypatch):
    opened: list[str] = []
    writes: list[str] = []
    real_read_text = Path.read_text
    real_open = open

    def spy_read_text(self: Path, *args, **kwargs):
        opened.append(str(self))
        return real_read_text(self, *args, **kwargs)

    def spy_open(file, mode="r", *args, **kwargs):
        if any(flag in mode for flag in ("w", "a", "x", "+")):
            writes.append(str(file))
        return real_open(file, mode, *args, **kwargs)

    def forbidden(*_args, **_kwargs):
        raise AssertionError("metadata executed")

    monkeypatch.setattr(Path, "read_text", spy_read_text)
    monkeypatch.setattr("builtins.open", spy_open)
    monkeypatch.setattr("builtins.eval", forbidden)
    monkeypatch.setattr("builtins.exec", forbidden)
    monkeypatch.setattr("os.system", forbidden)

    document = compile_structure(rich_observation())
    proof = build_visual_fidelity_proof(document, "proof-r1-guard")
    assert proof.visual_fidelity_status == "UNPROVEN"
    assert writes == []
    schema_dir = (_ROOT / "schemas").resolve()
    assert opened
    for raw in opened:
        path = Path(raw).resolve()
        assert path.parent == schema_dir
        assert path.name.startswith("codevision_")
        assert ".." not in path.parts


def test_runtime_has_no_decoder_ocr_or_fidelity_claim():
    for path in sorted(_PACKAGE.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        for token in _FORBIDDEN_SOURCE_TOKENS:
            assert re.search(rf"\b{re.escape(token)}\b", source, re.IGNORECASE) is None
        assert re.search(r"\bPASS\b", source) is None
        tree = ast.parse(source)
        imported: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imported.append(node.module)
            elif isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Name):
                    assert func.id not in _FORBIDDEN_CALLS
                elif isinstance(func, ast.Attribute):
                    assert func.attr not in {"system", "popen", "run", "call"}
        for name in imported:
            for banned in _DECODER_MODULES:
                assert name != banned and not name.startswith(banned + ".")
            assert not name.startswith("subprocess")
