"""Rebuild K0/K1 objects from embedded SpeArtifact protected-intent payload."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.provenance.models import Provenance
from spe_runtime.requirements.conflicts import (
    ConflictRecord,
    ConflictSeverity,
    ConflictType,
    ResolutionState,
)
from spe_runtime.requirements.graph import EdgeType, RequirementEdge, RequirementGraph
from spe_runtime.requirements.models import RequirementAtom, RequirementKind


def _atom_from_mapping(nd: Mapping[str, Any], *, fallback_id: str | None = None) -> RequirementAtom:
    if not isinstance(nd, Mapping):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "requirement node must be object",
        )
    rid = str(nd.get("requirement_id") or fallback_id or "")
    if not rid:
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "requirement_id missing",
        )
    return RequirementAtom(
        requirement_id=rid,
        semantic_key=str(nd["semantic_key"]),
        kind=RequirementKind(nd["kind"]),
        value=nd["value"],
        provenance=Provenance(nd["provenance"]),
        source_ref=nd.get("source_ref"),
        statement=nd.get("statement"),
    )


def contract_from_embedded_payload(payload: Mapping[str, Any]) -> ProtectedIntentContract:
    """Reconstruct ProtectedIntentContract from embedded canonical payload.

    Node insertion order follows payload['requirements'] so that
    protected_intent_digest(recon) matches the bound pid- (list-order sensitive).
    """
    if not isinstance(payload, Mapping):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload must be object",
        )
    graph_raw = payload.get("graph")
    if not isinstance(graph_raw, Mapping):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload.graph must be object",
        )
    nodes_raw = graph_raw.get("nodes")
    edges_raw = graph_raw.get("edges")
    if not isinstance(nodes_raw, Mapping) or not isinstance(edges_raw, Mapping):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload.graph.nodes/edges must be objects",
        )

    requirements = payload.get("requirements") or []
    if not isinstance(requirements, list):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload.requirements must be list",
        )

    nodes: dict[str, RequirementAtom] = {}
    # Preserve requirements list order for pid- digest stability.
    for rd in requirements:
        atom = _atom_from_mapping(rd if isinstance(rd, Mapping) else {})
        nodes[atom.requirement_id] = atom
        # Cross-check against graph.nodes when present
        gnode = nodes_raw.get(atom.requirement_id)
        if gnode is not None:
            gatom = _atom_from_mapping(gnode, fallback_id=atom.requirement_id)
            if (
                gatom.semantic_key != atom.semantic_key
                or gatom.kind != atom.kind
                or gatom.value != atom.value
                or gatom.provenance != atom.provenance
            ):
                raise SpeTypedError(
                    ErrorCode.K6_INVALID_ARTIFACT,
                    "requirements list disagrees with graph.nodes",
                )

    for rid, nd in nodes_raw.items():
        if rid not in nodes:
            nodes[str(rid)] = _atom_from_mapping(nd, fallback_id=str(rid))

    edges: dict[str, RequirementEdge] = {}
    for _eid, ed in edges_raw.items():
        if not isinstance(ed, Mapping):
            raise SpeTypedError(
                ErrorCode.K6_INVALID_ARTIFACT,
                "requirement edge must be object",
            )
        edge = RequirementEdge(
            edge_type=EdgeType(ed["edge_type"]),
            left_id=str(ed["left_id"]),
            right_id=str(ed["right_id"]),
            meta=dict(ed.get("meta") or {}),
        )
        edges[edge.edge_id] = edge

    graph = RequirementGraph(nodes=nodes, edges=edges)

    conflicts_raw = payload.get("conflicts") or []
    if not isinstance(conflicts_raw, list):
        raise SpeTypedError(
            ErrorCode.K6_INVALID_ARTIFACT,
            "protected_intent_payload.conflicts must be list",
        )
    conflicts: list[ConflictRecord] = []
    for cd in conflicts_raw:
        if not isinstance(cd, Mapping):
            raise SpeTypedError(
                ErrorCode.K6_INVALID_ARTIFACT,
                "conflict record must be object",
            )
        conflicts.append(
            ConflictRecord(
                conflict_id=str(cd["conflict_id"]),
                left_requirement_id=str(cd["left_requirement_id"]),
                right_requirement_id=str(cd["right_requirement_id"]),
                conflict_type=ConflictType(cd["conflict_type"]),
                severity=ConflictSeverity(cd["severity"]),
                resolution_state=ResolutionState(cd.get("resolution_state", "UNRESOLVED")),
                summary=str(cd.get("summary") or ""),
            )
        )

    return ProtectedIntentContract(graph=graph, conflicts=tuple(conflicts))


__all__ = ["contract_from_embedded_payload"]
