"""Auditable quality record — never an authority receipt."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from spe_runtime.protocols.evaluators import EvaluatorResult, EvaluatorStatus


def _as_tuple_str(value: Iterable[str] | Sequence[str] | None) -> tuple[str, ...]:
    if value is None:
        return ()
    return tuple(str(item) for item in value)


def _as_evaluator_results(
    value: Sequence[EvaluatorResult | Mapping[str, Any]] | None,
) -> tuple[EvaluatorResult, ...]:
    if value is None:
        return ()
    out: list[EvaluatorResult] = []
    for item in value:
        if isinstance(item, EvaluatorResult):
            out.append(item)
        elif isinstance(item, Mapping):
            out.append(EvaluatorResult.from_dict(item))
        else:
            raise TypeError("evaluator_results items must be EvaluatorResult or mapping")
    return tuple(out)


@dataclass(frozen=True)
class QualityRecord:
    """Compact auditable protocol quality record for Inspect / .spe storage.

    Serialized public field name in XCAT-adjacent payloads is ``quality_record``,
    never ``receipt`` (forbidden category payload key / authority collision).
    """

    protocol_id: str
    protocol_version: str
    depth: str
    required_nodes: tuple[str, ...]
    completed_nodes: tuple[str, ...]
    skipped_nodes: tuple[str, ...]
    failed_nodes: tuple[str, ...]
    unknown_nodes: tuple[str, ...]
    context_capsule_ids: tuple[str, ...]
    evaluator_results: tuple[EvaluatorResult, ...]
    unverified_claims: tuple[str, ...]
    known_limitations: tuple[str, ...]
    freshness_state: str
    adapter_id: str
    prompt_digest: str

    def __post_init__(self) -> None:
        if not self.protocol_id:
            raise ValueError("protocol_id must be non-empty")
        object.__setattr__(self, "required_nodes", _as_tuple_str(self.required_nodes))
        object.__setattr__(self, "completed_nodes", _as_tuple_str(self.completed_nodes))
        object.__setattr__(self, "skipped_nodes", _as_tuple_str(self.skipped_nodes))
        object.__setattr__(self, "failed_nodes", _as_tuple_str(self.failed_nodes))
        object.__setattr__(self, "unknown_nodes", _as_tuple_str(self.unknown_nodes))
        object.__setattr__(
            self, "context_capsule_ids", _as_tuple_str(self.context_capsule_ids)
        )
        object.__setattr__(
            self, "unverified_claims", _as_tuple_str(self.unverified_claims)
        )
        object.__setattr__(
            self, "known_limitations", _as_tuple_str(self.known_limitations)
        )
        object.__setattr__(
            self, "evaluator_results", _as_evaluator_results(self.evaluator_results)
        )
        # Ensure nested statuses are EvaluatorStatus instances
        for result in self.evaluator_results:
            if not isinstance(result.status, EvaluatorStatus):
                raise TypeError("evaluator_results.status must be EvaluatorStatus")

    def to_dict(self) -> dict[str, Any]:
        """Serialize record body. Does not use the key ``receipt``."""
        return {
            "protocol_id": self.protocol_id,
            "protocol_version": self.protocol_version,
            "depth": self.depth,
            "required_nodes": list(self.required_nodes),
            "completed_nodes": list(self.completed_nodes),
            "skipped_nodes": list(self.skipped_nodes),
            "failed_nodes": list(self.failed_nodes),
            "unknown_nodes": list(self.unknown_nodes),
            "context_capsule_ids": list(self.context_capsule_ids),
            "evaluator_results": [r.to_dict() for r in self.evaluator_results],
            "unverified_claims": list(self.unverified_claims),
            "known_limitations": list(self.known_limitations),
            "freshness_state": self.freshness_state,
            "adapter_id": self.adapter_id,
            "prompt_digest": self.prompt_digest,
        }

    def to_xcat_field(self) -> dict[str, Any]:
        """XCAT-adjacent envelope fragment: ``quality_record`` only, never receipt."""
        return {"quality_record": self.to_dict()}

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> QualityRecord:
        return cls(
            protocol_id=str(raw["protocol_id"]),
            protocol_version=str(raw.get("protocol_version", "1")),
            depth=str(raw.get("depth", "")),
            required_nodes=_as_tuple_str(raw.get("required_nodes")),
            completed_nodes=_as_tuple_str(raw.get("completed_nodes")),
            skipped_nodes=_as_tuple_str(raw.get("skipped_nodes")),
            failed_nodes=_as_tuple_str(raw.get("failed_nodes")),
            unknown_nodes=_as_tuple_str(raw.get("unknown_nodes")),
            context_capsule_ids=_as_tuple_str(raw.get("context_capsule_ids")),
            evaluator_results=_as_evaluator_results(raw.get("evaluator_results")),
            unverified_claims=_as_tuple_str(raw.get("unverified_claims")),
            known_limitations=_as_tuple_str(raw.get("known_limitations")),
            freshness_state=str(raw.get("freshness_state", "")),
            adapter_id=str(raw.get("adapter_id", "")),
            prompt_digest=str(raw.get("prompt_digest", "")),
        )
