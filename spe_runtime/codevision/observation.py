"""Screenshot observation parser.

v1 accepts a structured observation of a screenshot. It does not decode
image bytes, and it refuses fidelity scores on the way in.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from spe_runtime.codevision.canonical import digest_json
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.schema_check import validate_instance
from spe_runtime.codevision.targets import (
    CANVAS_MAX_PX,
    MAX_DEPTH,
    MAX_NODES,
    MAX_TEXT_LENGTH,
    NODE_KINDS,
    OBSERVATION_SCHEMA_VERSION,
    SOURCE_KIND,
    Z_INDEX_MAX,
)

_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")
_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
_FONT_WEIGHTS = frozenset({100, 200, 300, 400, 500, 600, 700, 800, 900})

_TOP_KEYS = frozenset(
    {"schema_version", "observation_id", "source_kind", "canvas", "nodes"}
)
_CANVAS_KEYS = frozenset({"width", "height"})
_NODE_KEYS = frozenset(
    {"node_id", "parent_id", "kind", "box", "text", "style", "z_index"}
)
_BOX_KEYS = frozenset({"x", "y", "width", "height"})
_STYLE_KEYS = (
    "fill_hex",
    "border_hex",
    "radius_px",
    "font_size_px",
    "font_weight",
)
_IMAGE_KEYS = frozenset(
    {
        "image_bytes",
        "image_base64",
        "pixels",
        "perceptual_hash",
        "png",
        "jpeg",
        "webp",
    }
)
_SCORE_KEYS = frozenset(
    {
        "pixel_score",
        "fidelity_score",
        "similarity",
        "similarity_score",
        "numeric_fidelity_score",
    }
)
_CLAIM_KEYS = frozenset({"visual_fidelity_status", "visual_fidelity_proven"})
_IMAGE_SOURCE_KINDS = frozenset(
    {
        "image",
        "screenshot",
        "screenshot_png",
        "screenshot_bytes",
        "pixels",
        "png",
        "jpeg",
        "jpg",
        "webp",
        "gif",
    }
)


def normalize_observation(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Return a canonical observation or raise CodevisionContractError."""
    if not isinstance(payload, Mapping):
        raise CodevisionContractError(
            "OBSERVATION_TYPE_INVALID", "observation must be an object"
        )
    _reject_forbidden(payload)
    _require_exact_keys(
        payload, _TOP_KEYS, "OBSERVATION_FIELD_UNKNOWN", "OBSERVATION_FIELD_MISSING"
    )
    if payload["schema_version"] != OBSERVATION_SCHEMA_VERSION:
        raise CodevisionContractError(
            "SCHEMA_VERSION_UNSUPPORTED", str(payload["schema_version"])
        )
    observation_id = _require_id(payload["observation_id"], "OBSERVATION_ID_INVALID")
    source_kind = payload["source_kind"]
    if not isinstance(source_kind, str):
        raise CodevisionContractError("SOURCE_KIND_REJECTED", "source_kind must be a string")
    if source_kind in _IMAGE_SOURCE_KINDS:
        raise CodevisionContractError(
            "IMAGE_BYTES_NOT_ACCEPTED",
            "v1 accepts a screenshot observation, not image bytes",
        )
    if source_kind != SOURCE_KIND:
        raise CodevisionContractError("SOURCE_KIND_REJECTED", source_kind)

    canvas = _parse_canvas(payload["canvas"])
    nodes_raw = payload["nodes"]
    if isinstance(nodes_raw, (str, bytes)) or not isinstance(nodes_raw, Sequence):
        raise CodevisionContractError("OBSERVATION_TYPE_INVALID", "nodes must be an array")
    if len(nodes_raw) == 0:
        raise CodevisionContractError("EMPTY_OBSERVATION")
    if len(nodes_raw) > MAX_NODES:
        raise CodevisionContractError("NODE_LIMIT_EXCEEDED", str(len(nodes_raw)))

    nodes = [_parse_node(item) for item in nodes_raw]
    _link_tree(nodes, canvas)
    normalized = {
        "schema_version": OBSERVATION_SCHEMA_VERSION,
        "observation_id": observation_id,
        "source_kind": SOURCE_KIND,
        "canvas": canvas,
        "nodes": sorted(nodes, key=lambda node: str(node["node_id"])),
    }
    validate_instance(normalized, "codevision_observation.schema.json")
    return normalized


def observation_digest(normalized: Mapping[str, Any]) -> str:
    return digest_json(normalized)


def _reject_forbidden(value: Any) -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            if not isinstance(key, str):
                raise CodevisionContractError(
                    "OBSERVATION_TYPE_INVALID", "object keys must be strings"
                )
            if key in _IMAGE_KEYS:
                raise CodevisionContractError("IMAGE_BYTES_NOT_ACCEPTED", key)
            if key in _SCORE_KEYS:
                raise CodevisionContractError("NUMERIC_SCORE_FORBIDDEN", key)
            if key in _CLAIM_KEYS:
                raise CodevisionContractError("FIDELITY_CLAIM_FORBIDDEN", key)
            _reject_forbidden(child)
        return
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        for child in value:
            _reject_forbidden(child)


def _require_exact_keys(
    payload: Mapping[str, Any],
    allowed: frozenset[str],
    unknown_reason: str,
    missing_reason: str,
) -> None:
    keys = set(payload)
    extra = keys - allowed
    missing = allowed - keys
    if extra:
        names = ",".join(sorted(str(key) for key in extra))
        raise CodevisionContractError(unknown_reason, names)
    if missing:
        names = ",".join(sorted(missing))
        raise CodevisionContractError(missing_reason, names)


def _require_id(value: Any, reason: str) -> str:
    if not isinstance(value, str) or _ID_RE.fullmatch(value) is None:
        raise CodevisionContractError(reason)
    return value


def _require_int(value: Any, reason: str, detail: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise CodevisionContractError(reason, detail)
    return value


def _parse_canvas(canvas: Any) -> dict[str, int]:
    if not isinstance(canvas, Mapping):
        raise CodevisionContractError("CANVAS_TYPE_INVALID")
    _require_exact_keys(
        canvas, _CANVAS_KEYS, "CANVAS_FIELD_UNKNOWN", "CANVAS_FIELD_MISSING"
    )
    width = _require_int(canvas["width"], "CANVAS_EXTENT_INVALID", "width")
    height = _require_int(canvas["height"], "CANVAS_EXTENT_INVALID", "height")
    if width < 1 or height < 1 or width > CANVAS_MAX_PX or height > CANVAS_MAX_PX:
        raise CodevisionContractError("CANVAS_EXTENT_INVALID")
    return {"width": width, "height": height}


def _parse_node(item: Any) -> dict[str, Any]:
    if not isinstance(item, Mapping):
        raise CodevisionContractError("NODE_TYPE_INVALID")
    _require_exact_keys(item, _NODE_KEYS, "NODE_FIELD_UNKNOWN", "NODE_FIELD_MISSING")
    node_id = _require_id(item["node_id"], "NODE_ID_INVALID")
    parent_raw = item["parent_id"]
    if parent_raw is None:
        parent_id: str | None = None
    else:
        parent_id = _require_id(parent_raw, "PARENT_ID_INVALID")
    kind = item["kind"]
    if not isinstance(kind, str) or kind not in NODE_KINDS:
        raise CodevisionContractError("UNKNOWN_KIND", str(kind))
    box = _parse_box(item["box"], node_id)
    text = _parse_text(item["text"], kind, node_id)
    style = _parse_style(item["style"], node_id)
    z_index = _require_int(item["z_index"], "Z_INDEX_INVALID", node_id)
    if z_index < 0 or z_index > Z_INDEX_MAX:
        raise CodevisionContractError("Z_INDEX_INVALID", node_id)
    return {
        "node_id": node_id,
        "parent_id": parent_id,
        "kind": kind,
        "box": box,
        "text": text,
        "style": style,
        "z_index": z_index,
    }


def _parse_text(text: Any, kind: str, node_id: str) -> str | None:
    if kind == "text":
        if not isinstance(text, str) or text == "":
            raise CodevisionContractError("TEXT_MISSING", node_id)
        if len(text) > MAX_TEXT_LENGTH:
            raise CodevisionContractError("TEXT_TOO_LONG", node_id)
        return text
    if text is not None:
        raise CodevisionContractError("TEXT_ON_NON_TEXT", node_id)
    return None


def _parse_box(box: Any, node_id: str) -> dict[str, int]:
    if not isinstance(box, Mapping):
        raise CodevisionContractError("BOX_TYPE_INVALID", node_id)
    _require_exact_keys(box, _BOX_KEYS, "BOX_FIELD_UNKNOWN", "BOX_FIELD_MISSING")
    parsed = {
        key: _require_int(box[key], "BOX_TYPE_INVALID", f"{node_id}.{key}")
        for key in ("x", "y", "width", "height")
    }
    if parsed["x"] < 0 or parsed["y"] < 0:
        raise CodevisionContractError("NEGATIVE_ORIGIN", node_id)
    if parsed["width"] < 1 or parsed["height"] < 1:
        raise CodevisionContractError("BOX_EXTENT_INVALID", node_id)
    return parsed


def _parse_style(style: Any, node_id: str) -> dict[str, Any] | None:
    if style is None:
        return None
    if not isinstance(style, Mapping):
        raise CodevisionContractError("STYLE_TYPE_INVALID", node_id)
    unknown = set(style) - set(_STYLE_KEYS)
    if unknown:
        names = ",".join(sorted(str(key) for key in unknown))
        raise CodevisionContractError("STYLE_FIELD_UNKNOWN", names)
    parsed: dict[str, Any] = {key: None for key in _STYLE_KEYS}
    supplied = False
    for key in _STYLE_KEYS:
        if key not in style or style[key] is None:
            continue
        parsed[key] = _parse_style_value(key, style[key], node_id)
        supplied = True
    if not supplied:
        return None
    return parsed


def _parse_style_value(key: str, value: Any, node_id: str) -> Any:
    detail = f"{node_id}.{key}"
    if key in {"fill_hex", "border_hex"}:
        if not isinstance(value, str) or _HEX_RE.fullmatch(value) is None:
            raise CodevisionContractError("STYLE_FIELD_INVALID", detail)
        return value.upper()
    number = _require_int(value, "STYLE_FIELD_INVALID", detail)
    if key == "font_weight":
        if number not in _FONT_WEIGHTS:
            raise CodevisionContractError("STYLE_FIELD_INVALID", detail)
        return number
    if key == "radius_px":
        if number < 0:
            raise CodevisionContractError("STYLE_FIELD_INVALID", detail)
        return number
    if number < 1:
        raise CodevisionContractError("STYLE_FIELD_INVALID", detail)
    return number


def _link_tree(nodes: list[dict[str, Any]], canvas: dict[str, int]) -> None:
    by_id: dict[str, dict[str, Any]] = {}
    for node in nodes:
        node_id = str(node["node_id"])
        if node_id in by_id:
            raise CodevisionContractError("DUPLICATE_NODE_ID", node_id)
        by_id[node_id] = node

    roots = [node for node in nodes if node["parent_id"] is None]
    if len(roots) != 1:
        raise CodevisionContractError("ROOT_COUNT_INVALID", str(len(roots)))
    root = roots[0]
    if root["kind"] != "frame":
        raise CodevisionContractError("KIND_ROLE_INVALID", "root must be frame")
    root_box = root["box"]
    if (
        root_box["x"] != 0
        or root_box["y"] != 0
        or root_box["width"] != canvas["width"]
        or root_box["height"] != canvas["height"]
    ):
        raise CodevisionContractError("ROOT_CANVAS_MISMATCH")

    canvas_box = {"x": 0, "y": 0, "width": canvas["width"], "height": canvas["height"]}
    for node in nodes:
        node_id = str(node["node_id"])
        if node is not root and node["kind"] == "frame":
            raise CodevisionContractError("KIND_ROLE_INVALID", node_id)
        _require_inside(node["box"], canvas_box, "BOX_OUTSIDE_CANVAS", node_id)
        parent_id = node["parent_id"]
        if parent_id is None:
            continue
        if parent_id == node_id:
            raise CodevisionContractError("PARENT_CYCLE", node_id)
        parent = by_id.get(str(parent_id))
        if parent is None:
            raise CodevisionContractError("MISSING_PARENT", f"{node_id}->{parent_id}")
        _require_inside(node["box"], parent["box"], "BOX_OUTSIDE_PARENT", node_id)
        _walk_parents(node_id, by_id)


def _require_inside(
    inner: Mapping[str, int],
    outer: Mapping[str, int],
    reason: str,
    node_id: str,
) -> None:
    if (
        inner["x"] < outer["x"]
        or inner["y"] < outer["y"]
        or inner["x"] + inner["width"] > outer["x"] + outer["width"]
        or inner["y"] + inner["height"] > outer["y"] + outer["height"]
    ):
        raise CodevisionContractError(reason, node_id)


def _walk_parents(node_id: str, by_id: dict[str, dict[str, Any]]) -> None:
    seen: set[str] = set()
    current = node_id
    while True:
        parent_id = by_id[current]["parent_id"]
        if parent_id is None:
            return
        parent_key = str(parent_id)
        if parent_key in seen or parent_key == current:
            raise CodevisionContractError("PARENT_CYCLE", node_id)
        if parent_key not in by_id:
            raise CodevisionContractError("MISSING_PARENT", parent_key)
        seen.add(parent_key)
        if len(seen) > MAX_DEPTH:
            raise CodevisionContractError("DEPTH_LIMIT_EXCEEDED", node_id)
        current = parent_key
