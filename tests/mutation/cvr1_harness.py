"""CODEVISION R1 qualification oracle and CVR1 mutants.

The donor runtime is not modified here. Mutants are forged snapshots. A mutant
is killed when the oracle names its defect. UNKNOWN is never a pass, and no
field is classified OBSERVED: this foundation has no pixel evidence.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Callable

from spe_runtime.codevision.canonical import digest_json
from spe_runtime.codevision.compiler import compile_structure
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.observation import normalize_observation, observation_digest
from spe_runtime.codevision.proof import build_visual_fidelity_proof
from spe_runtime.codevision.targets import REPEAT_NOTE, SIX_TARGETS, SOURCE_KIND

MUTANT_IDS: tuple[str, ...] = tuple(f"CVR1-{index:02d}" for index in range(1, 21))

EVIDENCE_CLASSES = frozenset({"OBSERVED", "USER_SUPPLIED", "DERIVED", "UNKNOWN"})

ASSET_KEYS = frozenset(
    {"src", "asset", "asset_id", "asset_path", "href", "url", "image_url"}
)
FONT_KEYS = frozenset({"font_family", "font_name", "font"})

MALICIOUS_TEXT = "<?php system($_GET['x']); ?> ../../etc/passwd"
INVENTED_OCR_TEXT = "Sign in"
INVENTED_COMPONENT_KIND = "control"
TRAVERSAL_PATH = "../../etc/passwd"
SEMANTIC_NOTE = "These regions are Card components with semantic authority."

STRUCTURE_SCHEMA_INVALID = frozenset(
    {"CVR1-02", "CVR1-04", "CVR1-05", "CVR1-06", "CVR1-13", "CVR1-16"}
)
PROOF_SCHEMA_INVALID = frozenset({"CVR1-11", "CVR1-17", "CVR1-18"})


@dataclass
class Snapshot:
    """One observation, the structure IR, the fidelity proof, and side effects."""

    observation: dict[str, Any]
    document: dict[str, Any]
    proof: dict[str, Any]
    eval_calls: list[str] = field(default_factory=list)


def rich_observation() -> dict[str, Any]:
    """Supplied observation with overlap, an unknown, and no pixel evidence."""
    return {
        "schema_version": "spe.codevision.observation.v1",
        "observation_id": "obs-r1-rich",
        "source_kind": "screenshot_observation",
        "canvas": {"width": 200, "height": 200},
        "nodes": [
            _node("root", None, "frame", 0, 0, 200, 200, z_index=0),
            _node(
                "panel",
                "root",
                "region",
                10,
                10,
                100,
                120,
                z_index=1,
                style={"fill_hex": "#ab12cd"},
            ),
            _node("covered", "panel", "region", 12, 12, 20, 20, z_index=2),
            _node(
                "label",
                "panel",
                "text",
                20,
                40,
                70,
                20,
                z_index=3,
                text=MALICIOUS_TEXT,
            ),
            _node("overlap_a", "root", "region", 10, 140, 50, 50, z_index=1),
            _node("overlap_b", "root", "region", 30, 160, 50, 40, z_index=1),
            _node("image_1", "root", "image", 120, 10, 40, 40, z_index=1),
            _node("icon_1", "root", "icon", 120, 60, 16, 16, z_index=1),
            _node("unknown_1", "root", "unknown", 120, 100, 16, 16, z_index=1),
            _node("plain", "root", "region", 120, 140, 40, 30, z_index=1),
            _node(
                "fonty",
                "root",
                "text",
                120,
                180,
                60,
                16,
                z_index=1,
                text="Hello",
                style={"font_size_px": 14},
            ),
        ],
    }


def build_donor_snapshot() -> Snapshot:
    observation = rich_observation()
    original = deepcopy(observation)
    document = compile_structure(observation)
    proof = build_visual_fidelity_proof(document, "proof-r1-rich")
    return Snapshot(
        observation=original,
        document=document.to_dict(),
        proof=proof.to_dict(),
    )


def verdict(evidence_class: str) -> str:
    """Map an evidence class to a qualification verdict. UNKNOWN is not PASS."""
    if evidence_class == "UNKNOWN":
        return "UNKNOWN"
    if evidence_class == "OBSERVED":
        raise AssertionError("OBSERVED without pixel evidence")
    if evidence_class not in EVIDENCE_CLASSES:
        raise AssertionError(evidence_class)
    return evidence_class


def evidence_index(snapshot: Snapshot) -> dict[str, str]:
    """Classify emitted fields. This map has no OBSERVED entries."""
    supplied = _supplied(snapshot.observation)
    document = snapshot.document
    records: dict[str, str] = {
        "claim.ocr_text": "UNKNOWN",
        "claim.asset": "UNKNOWN",
        "claim.font_family": "UNKNOWN",
        "claim.viewport": "UNKNOWN",
        "claim.breakpoint": "UNKNOWN",
        "claim.component": "UNKNOWN",
        "claim.pixel_evidence": "UNKNOWN",
        "claim.visual_fidelity": "UNKNOWN",
        "claim.semantic_authority": "UNKNOWN",
    }
    records["document.observation_digest"] = "DERIVED"
    records["document.structure_digest"] = "DERIVED"
    records["targets.region_tree.child_order"] = "DERIVED"
    records["targets.element_inventory.kind_counts"] = "DERIVED"
    records["targets.spatial_relations.relations"] = "DERIVED"
    records["targets.spatial_relations.omitted_in_v1"] = "DERIVED"
    records["targets.repeat_groups.groups"] = "DERIVED"
    records["targets.repeat_groups.note"] = "DERIVED"
    records["proof.visual_fidelity_status"] = "DERIVED"
    for node in document["targets"]["element_inventory"]["nodes"]:
        base = f"targets.element_inventory.nodes.{node['node_id']}"
        records[f"{base}.kind"] = "USER_SUPPLIED"
        records[f"{base}.parent_id"] = "USER_SUPPLIED"
        records[f"{base}.box"] = "USER_SUPPLIED"
        records[f"{base}.z_index"] = "USER_SUPPLIED"
    for node in document["targets"]["region_tree"]["nodes"]:
        base = f"targets.region_tree.nodes.{node['node_id']}"
        records[f"{base}.parent_id"] = "USER_SUPPLIED"
        records[f"{base}.box"] = "USER_SUPPLIED"
        records[f"{base}.depth"] = "DERIVED"
        records[f"{base}.child_ids"] = "DERIVED"
    for run in document["targets"]["text_runs"]["runs"]:
        base = f"targets.text_runs.runs.{run['node_id']}"
        records[f"{base}.text"] = "USER_SUPPLIED"
        records[f"{base}.box"] = "USER_SUPPLIED"
        records[f"{base}.reading_index"] = "DERIVED"
    for item in document["targets"]["style_observations"]["observations"]:
        source_style = supplied[item["node_id"]]["style"] or {}
        for key, value in item.items():
            if key == "node_id":
                continue
            source_value = source_style[key]
            if (
                isinstance(value, str)
                and value != source_value
                and value.upper() == str(source_value).upper()
            ):
                klass = "DERIVED"
            else:
                klass = "USER_SUPPLIED"
            records[
                f"targets.style_observations.observations.{item['node_id']}.{key}"
            ] = klass
    return records


def target_uncertainty_flags(target: Any) -> dict[str, bool]:
    keys = _keys(target)
    return {
        "viewport": "viewport" in keys,
        "breakpoint": "breakpoint" in keys or "breakpoints" in keys,
        "font_family": bool(keys & FONT_KEYS),
        "component": "component" in keys or "component_name" in keys,
        "ocr": "ocr" in keys or "ocr_text" in keys,
        "asset": bool(keys & ASSET_KEYS),
        "fidelity_claim": "visual_fidelity_status" in keys,
    }


def qualify(snapshot: Snapshot) -> set[str]:
    """Return defect ids present in a snapshot. Empty means the donor holds."""
    codes: set[str] = set()
    if snapshot.eval_calls:
        codes.add("CVR1-14")
    _walk_flags(snapshot.document, codes)
    _walk_flags(snapshot.proof, codes)
    _proof_status(snapshot.proof, codes)
    if snapshot.observation.get("source_kind") != SOURCE_KIND:
        codes.add("CVR1-16")
    targets = snapshot.document.get("targets")
    order = snapshot.document.get("target_order")
    if not isinstance(targets, dict) or tuple(order or ()) != SIX_TARGETS:
        codes.add("CVR1-16")
        _provenance(snapshot, codes)
        return codes
    if set(targets) != set(SIX_TARGETS):
        codes.add("CVR1-16")
    _nodes(snapshot, codes)
    _texts(snapshot, codes)
    _styles(snapshot, codes)
    _spatial(snapshot, codes)
    _note(snapshot, codes)
    _traversal(snapshot, codes)
    _provenance(snapshot, codes)
    return codes


def apply_mutant(snapshot: Snapshot, mutant_id: str) -> Snapshot:
    if mutant_id not in _MUTATORS:
        raise KeyError(mutant_id)
    cloned = Snapshot(
        observation=deepcopy(snapshot.observation),
        document=deepcopy(snapshot.document),
        proof=deepcopy(snapshot.proof),
        eval_calls=list(snapshot.eval_calls),
    )
    return _MUTATORS[mutant_id](cloned)


def added_hard_constraint_compile(observation: dict[str, Any]) -> Any:
    """Mutant compiler that rejects a valid observation for an invented rule."""
    if "viewport" not in observation:
        raise CodevisionContractError("DESKTOP_VIEWPORT_REQUIRED")
    return compile_structure(observation)


def substituted_source_compile(observation: dict[str, Any]) -> Any:
    """Mutant compiler that rewrites an unsupported source into the donor source."""
    cloned = deepcopy(observation)
    cloned["source_kind"] = SOURCE_KIND
    return compile_structure(cloned)


def _node(
    node_id: str,
    parent_id: str | None,
    kind: str,
    x: int,
    y: int,
    width: int,
    height: int,
    *,
    z_index: int,
    text: str | None = None,
    style: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "node_id": node_id,
        "parent_id": parent_id,
        "kind": kind,
        "box": {"x": x, "y": y, "width": width, "height": height},
        "text": text,
        "style": style,
        "z_index": z_index,
    }


def _supplied(observation: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(node["node_id"]): node for node in observation["nodes"]}


def _keys(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            found.add(str(key))
            found.update(_keys(child))
    elif isinstance(value, list):
        for child in value:
            found.update(_keys(child))
    return found


def _seal(snapshot: Snapshot) -> Snapshot:
    body = {
        key: value
        for key, value in snapshot.document.items()
        if key != "structure_digest"
    }
    snapshot.document["structure_digest"] = digest_json(body)
    snapshot.proof["observation_digest"] = snapshot.document["observation_digest"]
    snapshot.proof["structure_digest"] = snapshot.document["structure_digest"]
    return snapshot


def _inventory(snapshot: Snapshot, node_id: str) -> dict[str, Any]:
    for node in snapshot.document["targets"]["element_inventory"]["nodes"]:
        if node["node_id"] == node_id:
            return node
    raise KeyError(node_id)


def _tree(snapshot: Snapshot, node_id: str) -> dict[str, Any]:
    for node in snapshot.document["targets"]["region_tree"]["nodes"]:
        if node["node_id"] == node_id:
            return node
    raise KeyError(node_id)


def _retarget_kind(snapshot: Snapshot, node_id: str, new_kind: str) -> None:
    node = _inventory(snapshot, node_id)
    counts = snapshot.document["targets"]["element_inventory"]["kind_counts"]
    counts[node["kind"]] -= 1
    counts[new_kind] += 1
    node["kind"] = new_kind


def _set_box_x(snapshot: Snapshot, node_id: str, x: int) -> None:
    for finder in (_inventory, _tree):
        box = finder(snapshot, node_id)["box"]
        box["x"] = x


def _has_traversal(value: str) -> bool:
    parts = value.replace("\\", "/").split("/")
    return ".." in parts or value.startswith("/") or value.startswith("\\\\")


def _walk_flags(value: Any, codes: set[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            name = str(key)
            if name in ASSET_KEYS:
                codes.add("CVR1-02")
            if name in {"component", "component_name", "framework"}:
                codes.add("CVR1-03")
            if name in FONT_KEYS:
                codes.add("CVR1-07")
            if name == "viewport":
                codes.add("CVR1-05")
            if name in {"breakpoint", "breakpoints"}:
                codes.add("CVR1-06")
            if name in {"hard_constraints", "hard_constraint"}:
                codes.add("CVR1-13")
            if name in {"semantic_authority", "semantic_role"}:
                codes.add("CVR1-19")
            if name in {"screenshot_absence_result", "screenshot_absence"}:
                codes.add("CVR1-18")
            if name in {"metadata_executed", "executed"}:
                codes.add("CVR1-14")
            _walk_flags(child, codes)
        return
    if isinstance(value, list):
        for child in value:
            _walk_flags(child, codes)
        return
    if value == "desktop":
        codes.add("CVR1-05")
    elif value == "mobile":
        codes.add("CVR1-06")
    elif value == "PASS":
        codes.add("CVR1-11")
    elif value in {"VERIFIED", "PROVEN"}:
        codes.add("CVR1-17")
    elif value in {"success", "SUCCESS"}:
        codes.add("CVR1-18")


def _proof_status(proof: dict[str, Any], codes: set[str]) -> None:
    status = proof.get("visual_fidelity_status")
    if status == "PASS":
        codes.add("CVR1-11")
    elif status != "UNPROVEN":
        codes.add("CVR1-17")
    if proof.get("visual_fidelity_proven") is not False:
        codes.add("CVR1-17")
    if proof.get("pixel_comparison") is not None:
        codes.add("CVR1-17")
    if proof.get("numeric_fidelity_score") is not None:
        codes.add("CVR1-17")
    if proof.get("measured"):
        codes.add("CVR1-17")


def _nodes(snapshot: Snapshot, codes: set[str]) -> None:
    targets = snapshot.document["targets"]
    if "element_inventory" not in targets or "region_tree" not in targets:
        codes.add("CVR1-16")
        return
    supplied = _supplied(snapshot.observation)
    inventory = targets["element_inventory"]["nodes"]
    tree = targets["region_tree"]["nodes"]
    inventory_ids = {node["node_id"] for node in inventory}
    tree_ids = {node["node_id"] for node in tree}
    if set(supplied) - inventory_ids or set(supplied) - tree_ids:
        codes.add("CVR1-09")
    for node in inventory:
        source = supplied.get(node["node_id"])
        if source is None:
            codes.add("CVR1-03")
            continue
        if node["kind"] != source["kind"]:
            if node["kind"] == "icon":
                codes.add("CVR1-08")
            elif source["kind"] == "unknown":
                codes.add("CVR1-12")
            else:
                codes.add("CVR1-03")
        _box_code(node["box"], source["box"], codes)
    for node in tree:
        source = supplied.get(node["node_id"])
        if source is None:
            continue
        _box_code(node["box"], source["box"], codes)


def _box_code(
    actual: dict[str, Any], expected: dict[str, Any], codes: set[str]
) -> None:
    if actual == expected:
        return
    width = actual.get("width", 0)
    height = actual.get("height", 0)
    if not isinstance(width, int) or not isinstance(height, int) or width < 1 or height < 1:
        codes.add("CVR1-04")
    else:
        codes.add("CVR1-10")


def _texts(snapshot: Snapshot, codes: set[str]) -> None:
    targets = snapshot.document["targets"]
    if "text_runs" not in targets:
        codes.add("CVR1-16")
        return
    supplied = _supplied(snapshot.observation)
    expected_ids = sorted(
        node_id for node_id, node in supplied.items() if node["kind"] == "text"
    )
    seen: list[str] = []
    for run in targets["text_runs"]["runs"]:
        source = supplied.get(run["node_id"])
        if source is None or source["kind"] != "text" or run["text"] != source["text"]:
            codes.add("CVR1-01")
            continue
        seen.append(str(run["node_id"]))
    if sorted(seen) != expected_ids:
        codes.add("CVR1-01")


def _styles(snapshot: Snapshot, codes: set[str]) -> None:
    targets = snapshot.document["targets"]
    if "style_observations" not in targets:
        codes.add("CVR1-16")
        return
    supplied = _supplied(snapshot.observation)
    for item in targets["style_observations"]["observations"]:
        source = supplied.get(item["node_id"])
        source_style = None if source is None else source["style"]
        if source is None or source_style is None:
            codes.add("CVR1-07")
            continue
        for key, value in item.items():
            if key == "node_id":
                continue
            if key in FONT_KEYS or key not in source_style or source_style[key] is None:
                codes.add("CVR1-07")
                continue
            expected = source_style[key]
            if str(key).endswith("_hex"):
                if str(value).upper() != str(expected).upper():
                    codes.add("CVR1-07")
            elif value != expected:
                codes.add("CVR1-07")


def _spatial(snapshot: Snapshot, codes: set[str]) -> None:
    spatial = snapshot.document["targets"].get("spatial_relations")
    if not isinstance(spatial, dict):
        codes.add("CVR1-16")
        return
    if spatial.get("omitted_in_v1") != ["overlap", "cross_parent_alignment"]:
        codes.add("CVR1-12")
    for relation in spatial.get("relations", []):
        if relation.get("kind") == "overlap":
            codes.add("CVR1-10")


def _note(snapshot: Snapshot, codes: set[str]) -> None:
    repeat = snapshot.document["targets"].get("repeat_groups")
    if not isinstance(repeat, dict):
        codes.add("CVR1-16")
        return
    note = repeat.get("note")
    if note == REPEAT_NOTE:
        return
    if isinstance(note, str) and _has_traversal(note):
        codes.add("CVR1-15")
    else:
        codes.add("CVR1-19")


def _traversal(snapshot: Snapshot, codes: set[str]) -> None:
    supplied = _supplied(snapshot.observation)
    text_runs = snapshot.document["targets"].get("text_runs")
    runs = [] if not isinstance(text_runs, dict) else text_runs.get("runs", [])
    allowed: set[tuple[str, str]] = set()
    if isinstance(runs, list):
        for run in runs:
            source = supplied.get(run.get("node_id"))
            if source is not None and source.get("text") == run.get("text"):
                allowed.add((str(run["node_id"]), str(run["text"])))
    _scan_strings(snapshot.document, snapshot.document, allowed, codes)
    _scan_strings(snapshot.proof, snapshot.document, set(), codes)


def _scan_strings(
    value: Any,
    document: dict[str, Any],
    allowed_runs: set[tuple[str, str]],
    codes: set[str],
) -> None:
    def walk(current: Any, trail: tuple[str, ...]) -> None:
        if isinstance(current, dict):
            for key, child in current.items():
                walk(child, trail + (str(key),))
            return
        if isinstance(current, list):
            for index, child in enumerate(current):
                walk(child, trail + (str(index),))
            return
        if not isinstance(current, str) or not _has_traversal(current):
            return
        if (
            len(trail) >= 5
            and trail[0] == "targets"
            and trail[1] == "text_runs"
            and trail[2] == "runs"
            and trail[4] == "text"
        ):
            run = document["targets"]["text_runs"]["runs"][int(trail[3])]
            if (str(run["node_id"]), current) in allowed_runs:
                return
        codes.add("CVR1-15")

    walk(value, ())


def _provenance(snapshot: Snapshot, codes: set[str]) -> None:
    document = snapshot.document
    if snapshot.observation.get("source_kind") != SOURCE_KIND:
        return
    try:
        expected = observation_digest(normalize_observation(snapshot.observation))
    except CodevisionContractError:
        codes.add("CVR1-16")
        return
    if document.get("observation_digest") != expected:
        codes.add("CVR1-20")
    body = {
        key: value for key, value in document.items() if key != "structure_digest"
    }
    if document.get("structure_digest") != digest_json(body):
        codes.add("CVR1-20")


def _mutate_ocr(snapshot: Snapshot) -> Snapshot:
    snapshot.document["targets"]["text_runs"]["runs"].append(
        {
            "reading_index": 99,
            "node_id": "ocr_invented",
            "text": INVENTED_OCR_TEXT,
            "box": {"x": 1, "y": 1, "width": 10, "height": 10},
        }
    )
    return _seal(snapshot)


def _mutate_asset(snapshot: Snapshot) -> Snapshot:
    _inventory(snapshot, "image_1")["src"] = "https://assets.example/invented.png"
    return _seal(snapshot)


def _mutate_component(snapshot: Snapshot) -> Snapshot:
    _retarget_kind(snapshot, "panel", INVENTED_COMPONENT_KIND)
    return _seal(snapshot)


def _mutate_zero_dimension(snapshot: Snapshot) -> Snapshot:
    for finder in (_inventory, _tree):
        finder(snapshot, "covered")["box"]["width"] = 0
    return _seal(snapshot)


def _mutate_desktop_viewport(snapshot: Snapshot) -> Snapshot:
    snapshot.document["viewport"] = "desktop"
    return _seal(snapshot)


def _mutate_mobile_breakpoint(snapshot: Snapshot) -> Snapshot:
    snapshot.document["breakpoints"] = [{"name": "mobile", "max_width": 767}]
    return _seal(snapshot)


def _mutate_font(snapshot: Snapshot) -> Snapshot:
    snapshot.document["targets"]["style_observations"]["observations"].append(
        {"node_id": "plain", "font_size_px": 16}
    )
    return _seal(snapshot)


def _mutate_icon(snapshot: Snapshot) -> Snapshot:
    _retarget_kind(snapshot, "plain", "icon")
    return _seal(snapshot)


def _mutate_hide(snapshot: Snapshot) -> Snapshot:
    tree_nodes = snapshot.document["targets"]["region_tree"]["nodes"]
    inventory_nodes = snapshot.document["targets"]["element_inventory"]["nodes"]
    snapshot.document["targets"]["region_tree"]["nodes"] = [
        node for node in tree_nodes if node["node_id"] != "covered"
    ]
    snapshot.document["targets"]["element_inventory"]["nodes"] = [
        node for node in inventory_nodes if node["node_id"] != "covered"
    ]
    counts = snapshot.document["targets"]["element_inventory"]["kind_counts"]
    counts["region"] -= 1
    return _seal(snapshot)


def _mutate_repair_overlap(snapshot: Snapshot) -> Snapshot:
    _set_box_x(snapshot, "overlap_b", 80)
    return _seal(snapshot)


def _mutate_unknown_pass(snapshot: Snapshot) -> Snapshot:
    snapshot.proof["visual_fidelity_status"] = "PASS"
    return snapshot


def _mutate_drop_uncertainty(snapshot: Snapshot) -> Snapshot:
    _retarget_kind(snapshot, "unknown_1", "region")
    return _seal(snapshot)


def _mutate_hard_constraint(snapshot: Snapshot) -> Snapshot:
    snapshot.document["hard_constraints"] = [
        "font_family_required",
        "desktop_viewport_required",
    ]
    return _seal(snapshot)


def _mutate_execute(snapshot: Snapshot) -> Snapshot:
    for run in snapshot.document["targets"]["text_runs"]["runs"]:
        snapshot.eval_calls.append(str(run["text"]))
    return snapshot


def _mutate_traversal(snapshot: Snapshot) -> Snapshot:
    snapshot.document["targets"]["repeat_groups"]["note"] = TRAVERSAL_PATH
    return _seal(snapshot)


def _mutate_substitute_target(snapshot: Snapshot) -> Snapshot:
    targets = snapshot.document["targets"]
    targets["unspecified_target"] = targets.pop("repeat_groups")
    snapshot.document["target_order"] = [
        "region_tree",
        "element_inventory",
        "text_runs",
        "style_observations",
        "spatial_relations",
        "unspecified_target",
    ]
    return _seal(snapshot)


def _mutate_verified(snapshot: Snapshot) -> Snapshot:
    snapshot.proof["visual_fidelity_status"] = "VERIFIED"
    snapshot.proof["visual_fidelity_proven"] = True
    return snapshot


def _mutate_absence_success(snapshot: Snapshot) -> Snapshot:
    snapshot.proof["screenshot_absence_result"] = "success"
    return snapshot


def _mutate_semantic_authority(snapshot: Snapshot) -> Snapshot:
    snapshot.document["targets"]["repeat_groups"]["note"] = SEMANTIC_NOTE
    return _seal(snapshot)


def _mutate_drop_provenance(snapshot: Snapshot) -> Snapshot:
    snapshot.document["observation_digest"] = digest_json({"dropped": True})
    return _seal(snapshot)


_MUTATORS: dict[str, Callable[[Snapshot], Snapshot]] = {
    "CVR1-01": _mutate_ocr,
    "CVR1-02": _mutate_asset,
    "CVR1-03": _mutate_component,
    "CVR1-04": _mutate_zero_dimension,
    "CVR1-05": _mutate_desktop_viewport,
    "CVR1-06": _mutate_mobile_breakpoint,
    "CVR1-07": _mutate_font,
    "CVR1-08": _mutate_icon,
    "CVR1-09": _mutate_hide,
    "CVR1-10": _mutate_repair_overlap,
    "CVR1-11": _mutate_unknown_pass,
    "CVR1-12": _mutate_drop_uncertainty,
    "CVR1-13": _mutate_hard_constraint,
    "CVR1-14": _mutate_execute,
    "CVR1-15": _mutate_traversal,
    "CVR1-16": _mutate_substitute_target,
    "CVR1-17": _mutate_verified,
    "CVR1-18": _mutate_absence_success,
    "CVR1-19": _mutate_semantic_authority,
    "CVR1-20": _mutate_drop_provenance,
}
