"""Data-driven category protocol registry."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from spe_runtime.protocols.models import (
    ProtocolDepth,
    ProtocolGraph,
    ProtocolNode,
    depth_rank,
)

_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "protocols" / "protocol_registry.json"
)


@lru_cache(maxsize=1)
def _load_registry() -> dict[str, dict[str, Any]]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    families = payload.get("families")
    if not isinstance(families, list):
        raise ValueError("protocol_registry.json must contain a families list")
    result: dict[str, dict[str, Any]] = {}
    for item in families:
        domain_id = str(item["domain_id"])
        if domain_id in result:
            raise ValueError(f"duplicate domain_id: {domain_id}")
        result[domain_id] = item
    return result


def list_protocol_domains() -> tuple[str, ...]:
    return tuple(sorted(_load_registry().keys()))


def load_protocol(domain_id: str, depth: ProtocolDepth | str) -> ProtocolGraph:
    """Load the depth projection for a domain family.

    Nodes whose ``required_at_depth`` rank is <= the requested depth are included,
    preserving registry order. Protocols compile structure only; they never mutate
    ProtectedIntent.
    """
    if isinstance(depth, str):
        depth = ProtocolDepth(depth)
    registry = _load_registry()
    if domain_id not in registry:
        raise KeyError(f"unknown protocol domain: {domain_id}")
    family = registry[domain_id]
    target_rank = depth_rank(depth)
    selected: list[ProtocolNode] = []
    for raw_node in family.get("nodes") or []:
        node = ProtocolNode.from_dict(raw_node)
        if depth_rank(node.required_at_depth) <= target_rank:
            selected.append(node)
    if not selected:
        raise ValueError(
            f"no nodes for domain={domain_id!r} at depth={depth.value!r}"
        )
    protocol_id = str(
        family.get("protocol_id") or f"protocol.{domain_id}.{depth.value.lower()}"
    )
    # Depth-specific id when projecting
    if not protocol_id.endswith(f".{depth.value.lower()}"):
        # Strip any existing depth suffix then append
        base = protocol_id
        for d in ProtocolDepth:
            suffix = f".{d.value.lower()}"
            if base.endswith(suffix):
                base = base[: -len(suffix)]
                break
        protocol_id = f"{base}.{depth.value.lower()}"
    return ProtocolGraph(
        protocol_id=protocol_id,
        domain_id=domain_id,
        depth=depth,
        version=str(family.get("version", "1")),
        nodes=tuple(selected),
    )
