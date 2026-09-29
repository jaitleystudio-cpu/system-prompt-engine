"""Compile a screenshot observation into the six structure targets."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any

from spe_runtime.codevision.canonical import digest_json, thaw
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.observation import normalize_observation, observation_digest
from spe_runtime.codevision.schema_check import validate_instance
from spe_runtime.codevision.targets import (
    ALIGNMENT_TOLERANCE_HALF_PX,
    ALIGNMENT_TOLERANCE_PX,
    NODE_KINDS,
    RELATION_KINDS,
    REPEAT_MATCH,
    REPEAT_NOTE,
    SIX_TARGETS,
    STRUCTURE_SCHEMA_VERSION,
)

_DIRECTED_RELATIONS = frozenset({"contains", "stacked_above", "beside"})
_CENTER_RELATIONS = frozenset({"aligned_x_center", "aligned_y_center"})


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    return value


@dataclass(frozen=True)
class StructureDocument:
    """Immutable six-target structure. Digests bind it to one observation."""

    schema_version: str
    observation_id: str
    observation_digest: str
    structure_digest: str
    alignment_tolerance_px: int
    repeat_match: str
    target_order: tuple[str, ...]
    targets: Mapping[str, Any]

    def hashed_body(self) -> dict[str, Any]:
        body = self.to_dict()
        del body["structure_digest"]
        return body

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "observation_id": self.observation_id,
            "observation_digest": self.observation_digest,
            "structure_digest": self.structure_digest,
            "alignment_tolerance_px": self.alignment_tolerance_px,
            "repeat_match": self.repeat_match,
            "target_order": list(self.target_order),
            "targets": thaw(self.targets),
        }


def compile_structure(observation: Mapping[str, Any]) -> StructureDocument:
    """Compile supplied screenshot geometry into the six structure targets."""
    normalized = normalize_observation(observation)
    nodes = list(normalized["nodes"])
    by_id = {str(node["node_id"]): node for node in nodes}
    targets = {
        "region_tree": _region_tree(nodes, by_id),
        "element_inventory": _element_inventory(nodes),
        "text_runs": _text_runs(nodes),
        "style_observations": _style_observations(nodes),
        "spatial_relations": _spatial_relations(nodes),
        "repeat_groups": _repeat_groups(nodes),
    }
    if tuple(targets) != SIX_TARGETS:
        raise CodevisionContractError("TARGET_SET_MISMATCH")
    body = {
        "schema_version": STRUCTURE_SCHEMA_VERSION,
        "observation_id": normalized["observation_id"],
        "observation_digest": observation_digest(normalized),
        "alignment_tolerance_px": ALIGNMENT_TOLERANCE_PX,
        "repeat_match": REPEAT_MATCH,
        "target_order": list(SIX_TARGETS),
        "targets": targets,
    }
    structure_digest = digest_json(body)
    document_dict = {**body, "structure_digest": structure_digest}
    validate_instance(document_dict, "codevision_structure.schema.json")
    return StructureDocument(
        schema_version=STRUCTURE_SCHEMA_VERSION,
        observation_id=str(normalized["observation_id"]),
        observation_digest=str(body["observation_digest"]),
        structure_digest=structure_digest,
        alignment_tolerance_px=ALIGNMENT_TOLERANCE_PX,
        repeat_match=REPEAT_MATCH,
        target_order=SIX_TARGETS,
        targets=_freeze(targets),
    )


def _child_sort_key(node: Mapping[str, Any]) -> tuple[int, int, int, str]:
    box = node["box"]
    return (int(box["y"]), int(box["x"]), int(node["z_index"]), str(node["node_id"]))


def _depth(node: Mapping[str, Any], by_id: Mapping[str, Mapping[str, Any]]) -> int:
    depth = 0
    current = node
    while current["parent_id"] is not None:
        depth += 1
        current = by_id[str(current["parent_id"])]
    return depth


def _region_tree(
    nodes: list[dict[str, Any]], by_id: Mapping[str, dict[str, Any]]
) -> dict[str, Any]:
    children: dict[str, list[dict[str, Any]]] = defaultdict(list)
    root_id = ""
    for node in nodes:
        parent_id = node["parent_id"]
        if parent_id is None:
            root_id = str(node["node_id"])
            continue
        children[str(parent_id)].append(node)
    tree_nodes = []
    for node in sorted(nodes, key=lambda item: str(item["node_id"])):
        node_id = str(node["node_id"])
        child_ids = [
            str(child["node_id"])
            for child in sorted(children.get(node_id, []), key=_child_sort_key)
        ]
        tree_nodes.append(
            {
                "node_id": node_id,
                "parent_id": node["parent_id"],
                "child_ids": child_ids,
                "box": dict(node["box"]),
                "depth": _depth(node, by_id),
            }
        )
    return {
        "root_id": root_id,
        "child_order": "y_then_x_then_z_index_then_node_id",
        "nodes": tree_nodes,
    }


def _element_inventory(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {kind: 0 for kind in NODE_KINDS}
    inventory = []
    for node in sorted(nodes, key=lambda item: str(item["node_id"])):
        kind = str(node["kind"])
        counts[kind] = counts[kind] + 1
        inventory.append(
            {
                "node_id": node["node_id"],
                "kind": kind,
                "parent_id": node["parent_id"],
                "box": dict(node["box"]),
                "z_index": node["z_index"],
            }
        )
    return {
        "counts_are": "supplied_node_census",
        "kind_vocabulary": list(NODE_KINDS),
        "kind_counts": counts,
        "nodes": inventory,
    }


def _text_runs(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    texts = [node for node in nodes if node["kind"] == "text"]
    runs = []
    for index, node in enumerate(sorted(texts, key=_child_sort_key)):
        runs.append(
            {
                "reading_index": index,
                "node_id": node["node_id"],
                "text": node["text"],
                "box": dict(node["box"]),
            }
        )
    return {"order": "y_then_x_then_z_index_then_node_id", "runs": runs}


def _style_observations(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    observations = []
    for node in sorted(nodes, key=lambda item: str(item["node_id"])):
        style = node["style"]
        if style is None:
            continue
        supplied = {
            key: style[key]
            for key in (
                "fill_hex",
                "border_hex",
                "radius_px",
                "font_size_px",
                "font_weight",
            )
            if style[key] is not None
        }
        observations.append({"node_id": node["node_id"], **supplied})
    return {"pass_through": "supplied_fields_only", "observations": observations}


def _overlap_x(left: Mapping[str, int], right: Mapping[str, int]) -> bool:
    return (
        min(left["x"] + left["width"], right["x"] + right["width"])
        - max(left["x"], right["x"])
        > 0
    )


def _overlap_y(left: Mapping[str, int], right: Mapping[str, int]) -> bool:
    return (
        min(left["y"] + left["height"], right["y"] + right["height"])
        - max(left["y"], right["y"])
        > 0
    )


def _append_pair(relations: list[dict[str, Any]], first: Mapping[str, Any], second: Mapping[str, Any]) -> None:
    upper, lower = (
        (first, second)
        if _child_sort_key(first) <= _child_sort_key(second)
        else (second, first)
    )
    upper_box = upper["box"]
    lower_box = lower["box"]
    if (
        upper_box["y"] + upper_box["height"] <= lower_box["y"]
        and _overlap_x(upper_box, lower_box)
    ):
        relations.append(
            {
                "kind": "stacked_above",
                "source_id": upper["node_id"],
                "target_id": lower["node_id"],
            }
        )

    left, right = (
        (first, second)
        if (
            int(first["box"]["x"]),
            int(first["box"]["y"]),
            str(first["node_id"]),
        )
        <= (
            int(second["box"]["x"]),
            int(second["box"]["y"]),
            str(second["node_id"]),
        )
        else (second, first)
    )
    left_box = left["box"]
    right_box = right["box"]
    if left_box["x"] + left_box["width"] <= right_box["x"] and _overlap_y(left_box, right_box):
        relations.append(
            {
                "kind": "beside",
                "source_id": left["node_id"],
                "target_id": right["node_id"],
            }
        )
    _append_alignment(relations, first, second)


def _append_alignment(
    relations: list[dict[str, Any]], first: Mapping[str, Any], second: Mapping[str, Any]
) -> None:
    source, target = (
        (first, second)
        if str(first["node_id"]) <= str(second["node_id"])
        else (second, first)
    )
    a = first["box"]
    b = second["box"]
    checks = (
        ("aligned_x_start", abs(int(a["x"]) - int(b["x"])), "rule_delta_px", ALIGNMENT_TOLERANCE_PX),
        ("aligned_y_start", abs(int(a["y"]) - int(b["y"])), "rule_delta_px", ALIGNMENT_TOLERANCE_PX),
        (
            "aligned_x_center",
            abs((2 * int(a["x"]) + int(a["width"])) - (2 * int(b["x"]) + int(b["width"]))),
            "rule_delta_half_px",
            ALIGNMENT_TOLERANCE_HALF_PX,
        ),
        (
            "aligned_y_center",
            abs((2 * int(a["y"]) + int(a["height"])) - (2 * int(b["y"]) + int(b["height"]))),
            "rule_delta_half_px",
            ALIGNMENT_TOLERANCE_HALF_PX,
        ),
    )
    for kind, delta, field, limit in checks:
        if delta <= limit:
            relations.append(
                {
                    "kind": kind,
                    "source_id": source["node_id"],
                    "target_id": target["node_id"],
                    field: delta,
                }
            )


def _spatial_relations(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    children: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for node in nodes:
        parent_id = node["parent_id"]
        if parent_id is None:
            continue
        children[str(parent_id)].append(node)
    relations: list[dict[str, Any]] = []
    for parent_id, kids in children.items():
        for child in kids:
            relations.append(
                {
                    "kind": "contains",
                    "source_id": parent_id,
                    "target_id": child["node_id"],
                }
            )
        ordered = sorted(kids, key=_child_sort_key)
        for index, left in enumerate(ordered):
            for right in ordered[index + 1 :]:
                _append_pair(relations, left, right)
    relations.sort(
        key=lambda item: (
            RELATION_KINDS.index(str(item["kind"])),
            str(item["source_id"]),
            str(item["target_id"]),
        )
    )
    return {
        "alignment_tolerance_px": ALIGNMENT_TOLERANCE_PX,
        "center_compare": "half_pixel_integers",
        "sibling_scope": "direct_siblings_only",
        "omitted_in_v1": ["overlap", "cross_parent_alignment"],
        "relations": relations,
    }


def _repeat_groups(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    children: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for node in nodes:
        parent_id = node["parent_id"]
        if parent_id is None:
            continue
        children[str(parent_id)].append(node)
    groups = []
    for parent_id, kids in children.items():
        buckets: dict[tuple[str, int, int], list[dict[str, Any]]] = defaultdict(list)
        for kid in kids:
            key = (str(kid["kind"]), int(kid["box"]["width"]), int(kid["box"]["height"]))
            buckets[key].append(kid)
        for (kind, width, height), members in buckets.items():
            if len(members) < 2:
                continue
            member_ids = [
                str(member["node_id"]) for member in sorted(members, key=_child_sort_key)
            ]
            groups.append(
                {
                    "group_id": f"repeat:{parent_id}:{kind}:{width}x{height}",
                    "parent_id": parent_id,
                    "kind": kind,
                    "width": width,
                    "height": height,
                    "member_ids": member_ids,
                }
            )
    groups.sort(key=lambda group: str(group["group_id"]))
    return {"match": REPEAT_MATCH, "note": REPEAT_NOTE, "groups": groups}


def relation_delta_fields(kind: str) -> str | None:
    """Return the rule-delta field for a relation kind, or None when directed."""
    if kind in _DIRECTED_RELATIONS:
        return None
    if kind in _CENTER_RELATIONS:
        return "rule_delta_half_px"
    if kind in RELATION_KINDS:
        return "rule_delta_px"
    raise CodevisionContractError("UNKNOWN_RELATION", kind)
