"""K1 RequirementGraph — frozen copy-on-write requirement graph."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping

from spe_runtime.requirements.models import RequirementAtom


class EdgeType(str, Enum):
    CONFLICTS_WITH = "CONFLICTS_WITH"


@dataclass(frozen=True)
class RequirementEdge:
    edge_type: EdgeType
    left_id: str
    right_id: str
    meta: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not isinstance(self.edge_type, EdgeType):
            object.__setattr__(self, "edge_type", EdgeType(self.edge_type))
        object.__setattr__(
            self,
            "meta",
            MappingProxyType(dict(self.meta)) if self.meta else MappingProxyType({}),
        )

    @property
    def edge_id(self) -> str:
        a, b = sorted((self.left_id, self.right_id))
        return f"edge-{self.edge_type.value}-{a}-{b}"


@dataclass(frozen=True)
class RequirementGraph:
    """Canonical K1 graph writer — mutate only via with_node / with_edge."""

    nodes: Mapping[str, RequirementAtom] = field(default_factory=dict)
    edges: Mapping[str, RequirementEdge] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "nodes", MappingProxyType(dict(self.nodes)))
        object.__setattr__(self, "edges", MappingProxyType(dict(self.edges)))

    def get(self, requirement_id: str) -> RequirementAtom | None:
        return self.nodes.get(requirement_id)

    def nodes_by_key(self, semantic_key: str) -> tuple[RequirementAtom, ...]:
        found = [node for node in self.nodes.values() if node.semantic_key == semantic_key]
        found.sort(key=lambda node: node.requirement_id)
        return tuple(found)

    def with_node(self, atom: RequirementAtom) -> RequirementGraph:
        """Copy-on-write upsert by requirement_id."""
        existing = self.nodes.get(atom.requirement_id)
        if existing == atom:
            return self
        new_nodes = dict(self.nodes)
        new_nodes[atom.requirement_id] = atom
        return RequirementGraph(nodes=new_nodes, edges=dict(self.edges))

    def with_edge(
        self,
        left_id: str,
        right_id: str,
        edge_type: EdgeType | str = EdgeType.CONFLICTS_WITH,
        *,
        meta: Mapping[str, Any] | None = None,
    ) -> RequirementGraph:
        """Copy-on-write add a CONFLICTS_WITH edge. G1R-3 allows no other type."""
        et = edge_type if isinstance(edge_type, EdgeType) else EdgeType(edge_type)
        if et is not EdgeType.CONFLICTS_WITH:
            raise ValueError(f"G1R-3 only allows CONFLICTS_WITH edges, got {et}")
        edge = RequirementEdge(
            edge_type=et,
            left_id=left_id,
            right_id=right_id,
            meta=dict(meta or {}),
        )
        if edge.edge_id in self.edges:
            return self
        new_edges = dict(self.edges)
        new_edges[edge.edge_id] = edge
        return RequirementGraph(nodes=dict(self.nodes), edges=new_edges)

    def to_dict(self) -> dict[str, Any]:
        node_items = sorted(self.nodes.items(), key=lambda item: item[0])
        edge_items = sorted(self.edges.items(), key=lambda item: item[0])
        return {
            "nodes": {key: atom.to_dict() for key, atom in node_items},
            "edges": {
                key: {
                    "edge_type": edge.edge_type.value,
                    "left_id": edge.left_id,
                    "right_id": edge.right_id,
                    "meta": dict(edge.meta),
                }
                for key, edge in edge_items
            },
        }


__all__ = ["EdgeType", "RequirementEdge", "RequirementGraph"]
