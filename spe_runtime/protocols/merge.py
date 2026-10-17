"""Merge ProtocolGraphs by merge_key — dedupe shared spine, fail closed on conflict."""

from __future__ import annotations

from spe_runtime.protocols.models import (
    ProtocolDepth,
    ProtocolGraph,
    ProtocolNode,
    depth_rank,
)


class ProtocolMergeConflict(ValueError):
    """Raised when colliding nodes have contradictory instructions."""


def _normalize_instruction(text: str) -> str:
    return " ".join(text.split()).strip().lower()


def _merge_nodes(existing: ProtocolNode, incoming: ProtocolNode) -> ProtocolNode:
    """Merge two nodes that share a merge_key.

    - Union non-conflicting prerequisites.
    - Stricter (earlier) required_at_depth wins.
    - Contradictory instructions fail closed.
    """
    if _normalize_instruction(existing.instruction) != _normalize_instruction(
        incoming.instruction
    ):
        raise ProtocolMergeConflict(
            f"contradictory instructions for merge_key={existing.merge_key!r}: "
            f"{existing.node_id!r} vs {incoming.node_id!r}"
        )

    prereqs = tuple(
        dict.fromkeys((*existing.prerequisites, *incoming.prerequisites))
    )

    if depth_rank(incoming.required_at_depth) < depth_rank(existing.required_at_depth):
        required = incoming.required_at_depth
    else:
        required = existing.required_at_depth

    evidence_required = existing.evidence_required or incoming.evidence_required

    # Prefer existing identity; keep shared semantic fields that agree.
    return ProtocolNode(
        node_id=existing.node_id,
        stage=existing.stage,
        title=existing.title,
        instruction=existing.instruction,
        required_at_depth=required,
        prerequisites=prereqs,
        evidence_required=evidence_required,
        tool_class=existing.tool_class or incoming.tool_class,
        exit_condition=existing.exit_condition or incoming.exit_condition,
        failure_behavior=existing.failure_behavior or incoming.failure_behavior,
        merge_key=existing.merge_key,
    )


def merge_protocol_graphs(graphs: tuple[ProtocolGraph, ...]) -> ProtocolGraph:
    """Combine protocol DAGs by ``merge_key``.

    Shared universal nodes (e.g. ``verify.evidence``, ``capability.auto_route``)
    are deduplicated. Domain-specific nodes are preserved. Contradictory
    required instructions raise rather than silently choosing one.
    """
    if not graphs:
        raise ValueError("merge_protocol_graphs requires at least one graph")

    by_key: dict[str, ProtocolNode] = {}
    order: list[str] = []

    for graph in graphs:
        if not isinstance(graph, ProtocolGraph):
            raise TypeError("graphs must be ProtocolGraph instances")
        for node in graph.nodes:
            key = node.merge_key
            if key not in by_key:
                by_key[key] = node
                order.append(key)
            else:
                by_key[key] = _merge_nodes(by_key[key], node)

    # Merged graph metadata: multi-domain composite id; deepest depth wins for label.
    domain_ids = tuple(dict.fromkeys(g.domain_id for g in graphs))
    deepest = max(graphs, key=lambda g: depth_rank(g.depth)).depth
    if len(domain_ids) == 1:
        protocol_id = f"protocol.{domain_ids[0]}.{deepest.value.lower()}"
        domain_id = domain_ids[0]
    else:
        joined = "+".join(domain_ids)
        protocol_id = f"protocol.merged.{joined}.{deepest.value.lower()}"
        domain_id = joined

    versions = tuple(dict.fromkeys(g.version for g in graphs))
    version = versions[0] if len(versions) == 1 else "merged"

    return ProtocolGraph(
        protocol_id=protocol_id,
        domain_id=domain_id,
        depth=deepest if isinstance(deepest, ProtocolDepth) else ProtocolDepth(deepest),
        version=version,
        nodes=tuple(by_key[k] for k in order),
    )
