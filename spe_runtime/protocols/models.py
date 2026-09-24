"""Immutable protocol models: ProtocolDepth, ProtocolNode, ProtocolGraph."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Iterable, Sequence


class ProtocolDepth(str, Enum):
    QUICK = "QUICK"
    STANDARD = "STANDARD"
    DEEP = "DEEP"
    CRITICAL = "CRITICAL"

    def to_dict(self) -> str:
        return self.value


_STAGE_VALUES = frozenset(
    {
        "MISSION",
        "UNDERSTAND",
        "GROUND",
        "EXECUTE",
        "VERIFY",
        "CHALLENGE",
        "DELIVER",
    }
)

_DEPTH_RANK = {
    ProtocolDepth.QUICK: 0,
    ProtocolDepth.STANDARD: 1,
    ProtocolDepth.DEEP: 2,
    ProtocolDepth.CRITICAL: 3,
}


def depth_rank(depth: ProtocolDepth | str) -> int:
    if isinstance(depth, str):
        depth = ProtocolDepth(depth)
    return _DEPTH_RANK[depth]


def _as_depth(value: str | ProtocolDepth) -> ProtocolDepth:
    if isinstance(value, ProtocolDepth):
        return value
    return ProtocolDepth(str(value))


def _as_tuple_str(value: Iterable[str] | Sequence[str] | None) -> tuple[str, ...]:
    if value is None:
        return ()
    return tuple(str(item) for item in value)


@dataclass(frozen=True)
class ProtocolNode:
    """One DAG node in a category protocol graph."""

    node_id: str
    stage: str
    title: str
    instruction: str
    required_at_depth: ProtocolDepth
    prerequisites: tuple[str, ...]
    evidence_required: bool
    tool_class: str | None
    exit_condition: str
    failure_behavior: str
    merge_key: str

    def __post_init__(self) -> None:
        if not self.node_id:
            raise ValueError("node_id must be non-empty")
        if self.stage not in _STAGE_VALUES:
            raise ValueError(f"invalid stage: {self.stage}")
        if not self.title:
            raise ValueError("title must be non-empty")
        if not self.merge_key:
            raise ValueError("merge_key must be non-empty")
        object.__setattr__(self, "required_at_depth", _as_depth(self.required_at_depth))
        object.__setattr__(self, "prerequisites", _as_tuple_str(self.prerequisites))
        if self.tool_class is not None:
            object.__setattr__(self, "tool_class", str(self.tool_class))

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "stage": self.stage,
            "title": self.title,
            "instruction": self.instruction,
            "required_at_depth": self.required_at_depth.to_dict(),
            "prerequisites": list(self.prerequisites),
            "evidence_required": self.evidence_required,
            "tool_class": self.tool_class,
            "exit_condition": self.exit_condition,
            "failure_behavior": self.failure_behavior,
            "merge_key": self.merge_key,
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> ProtocolNode:
        return cls(
            node_id=str(raw["node_id"]),
            stage=str(raw["stage"]),
            title=str(raw["title"]),
            instruction=str(raw.get("instruction", "")),
            required_at_depth=_as_depth(raw["required_at_depth"]),
            prerequisites=_as_tuple_str(raw.get("prerequisites")),
            evidence_required=bool(raw.get("evidence_required", False)),
            tool_class=raw.get("tool_class"),
            exit_condition=str(raw.get("exit_condition", "")),
            failure_behavior=str(raw.get("failure_behavior", "ABSTAIN")),
            merge_key=str(raw["merge_key"]),
        )


@dataclass(frozen=True)
class ProtocolGraph:
    """Immutable DAG of protocol nodes for one domain x depth projection."""

    protocol_id: str
    domain_id: str
    depth: ProtocolDepth
    version: str
    nodes: tuple[ProtocolNode, ...]

    def __post_init__(self) -> None:
        if not self.protocol_id:
            raise ValueError("protocol_id must be non-empty")
        if not self.domain_id:
            raise ValueError("domain_id must be non-empty")
        object.__setattr__(self, "depth", _as_depth(self.depth))
        nodes = tuple(self.nodes)
        object.__setattr__(self, "nodes", nodes)
        seen: set[str] = set()
        for node in nodes:
            if not isinstance(node, ProtocolNode):
                raise TypeError("nodes must be ProtocolNode instances")
            if node.node_id in seen:
                raise ValueError(f"duplicate node_id: {node.node_id}")
            seen.add(node.node_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "protocol_id": self.protocol_id,
            "domain_id": self.domain_id,
            "depth": self.depth.to_dict(),
            "version": self.version,
            "nodes": [n.to_dict() for n in self.nodes],
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> ProtocolGraph:
        nodes_raw = raw.get("nodes") or []
        return cls(
            protocol_id=str(raw["protocol_id"]),
            domain_id=str(raw["domain_id"]),
            depth=_as_depth(raw["depth"]),
            version=str(raw.get("version", "1")),
            nodes=tuple(ProtocolNode.from_dict(item) for item in nodes_raw),
        )
