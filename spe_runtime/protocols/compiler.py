"""Compile domain protocols + capability routing into an ExecutionContract."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from spe_runtime.protocols.capability_routing import (
    AUTO_ROUTE_MERGE_KEY,
    CapabilityProfile,
    build_auto_route_node,
)
from spe_runtime.protocols.merge import merge_protocol_graphs
from spe_runtime.protocols.models import ProtocolDepth, ProtocolGraph
from spe_runtime.protocols.registry import load_protocol


def _as_depth(depth: ProtocolDepth | str) -> ProtocolDepth:
    if isinstance(depth, ProtocolDepth):
        return depth
    return ProtocolDepth(str(depth))


def _as_domain_ids(domain_ids: Sequence[str] | str) -> tuple[str, ...]:
    if isinstance(domain_ids, str):
        return (domain_ids,)
    ids = tuple(str(d) for d in domain_ids)
    if not ids:
        raise ValueError("domain_ids must be non-empty")
    return ids


def _as_capability_profile(
    capability_profile: CapabilityProfile | Mapping[str, Any] | None,
) -> CapabilityProfile | None:
    if capability_profile is None:
        return None
    if isinstance(capability_profile, CapabilityProfile):
        return capability_profile
    if isinstance(capability_profile, Mapping):
        return CapabilityProfile.from_descriptor(capability_profile)
    raise TypeError("capability_profile must be CapabilityProfile, mapping, or None")


def _task_benefits_from_tools(
    depth: ProtocolDepth,
    profile: CapabilityProfile | None,
) -> bool:
    """QUICK is prose-first; auto-route only if known tools exist. STANDARD+ benefits."""
    if depth == ProtocolDepth.QUICK:
        return bool(profile is not None and profile.available)
    return True


@dataclass(frozen=True)
class ExecutionContract:
    """Portable compiled protocol ready for model-adapter rendering.

    Structure-only: never mutates ProtectedIntent or mints authority.
    """

    domain_ids: tuple[str, ...]
    depth: ProtocolDepth
    graph: ProtocolGraph
    capability_profile: CapabilityProfile | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "domain_ids", tuple(str(d) for d in self.domain_ids))
        if not self.domain_ids:
            raise ValueError("domain_ids must be non-empty")
        object.__setattr__(self, "depth", _as_depth(self.depth))
        if not isinstance(self.graph, ProtocolGraph):
            raise TypeError("graph must be a ProtocolGraph")
        if self.capability_profile is not None and not isinstance(
            self.capability_profile, CapabilityProfile
        ):
            raise TypeError("capability_profile must be CapabilityProfile or None")

    @property
    def protocol_id(self) -> str:
        return self.graph.protocol_id

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain_ids": list(self.domain_ids),
            "depth": self.depth.to_dict(),
            "protocol_id": self.protocol_id,
            "graph": self.graph.to_dict(),
            "capability_profile": (
                {"available": list(self.capability_profile.available)}
                if self.capability_profile is not None
                else None
            ),
        }


def compile_execution_contract(
    domain_ids: Sequence[str] | str,
    depth: ProtocolDepth | str,
    capability_profile: CapabilityProfile | Mapping[str, Any] | None = None,
) -> ExecutionContract:
    """Load, merge, and attach safe capability auto-routing into one contract.

    Wires Task 5/6 APIs: ``load_protocol``, ``merge_protocol_graphs``,
    ``build_auto_route_node``. Protocols remain structure-only.
    """
    ids = _as_domain_ids(domain_ids)
    resolved_depth = _as_depth(depth)
    profile = _as_capability_profile(capability_profile)

    graphs = tuple(load_protocol(domain_id, resolved_depth) for domain_id in ids)
    merged = merge_protocol_graphs(graphs) if len(graphs) > 1 else graphs[0]

    auto_node = build_auto_route_node(
        profile,
        task_benefits_from_tools=_task_benefits_from_tools(resolved_depth, profile),
    )
    if auto_node is not None:
        # Avoid duplicate auto-route if a domain family already ships one.
        existing_keys = {n.merge_key for n in merged.nodes}
        if AUTO_ROUTE_MERGE_KEY in existing_keys:
            merged = merge_protocol_graphs(
                (
                    merged,
                    ProtocolGraph(
                        protocol_id=f"{merged.protocol_id}.auto_route",
                        domain_id=merged.domain_id,
                        depth=merged.depth,
                        version=merged.version,
                        nodes=(auto_node,),
                    ),
                )
            )
        else:
            merged = ProtocolGraph(
                protocol_id=merged.protocol_id,
                domain_id=merged.domain_id,
                depth=merged.depth,
                version=merged.version,
                nodes=(*merged.nodes, auto_node),
            )

    return ExecutionContract(
        domain_ids=ids,
        depth=resolved_depth,
        graph=merged,
        capability_profile=profile,
    )
