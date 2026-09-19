"""K1 RequirementAtom — deterministic content-addressed requirement identity."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from enum import Enum
from typing import Any

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.provenance.models import Provenance
from spe_runtime.provenance.rules import coerce_provenance


class RequirementKind(str, Enum):
    MUST = "MUST"
    MUST_NOT = "MUST_NOT"
    SHOULD = "SHOULD"
    PREFERENCE = "PREFERENCE"


def coerce_kind(value: RequirementKind | str) -> RequirementKind:
    if isinstance(value, RequirementKind):
        return value
    return RequirementKind(value)


def requirement_identity(
    *,
    semantic_key: str,
    kind: RequirementKind | str,
    value: Any,
    source_ref: str | None = None,
) -> str:
    """Deterministic requirement_id from canonical content (no provenance)."""
    payload = {
        "semantic_key": semantic_key,
        "kind": coerce_kind(kind).value,
        "value": value,
        "source_ref": source_ref,
    }
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()
    return f"req-{digest[:32]}"


@dataclass(frozen=True)
class RequirementAtom:
    """Typed requirement / intent atom with categorical provenance."""

    requirement_id: str
    semantic_key: str
    kind: RequirementKind
    value: Any
    provenance: Provenance
    source_ref: str | None = None
    statement: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "kind", coerce_kind(self.kind))
        object.__setattr__(self, "provenance", coerce_provenance(self.provenance))

    @classmethod
    def create(
        cls,
        *,
        semantic_key: str,
        kind: RequirementKind | str,
        value: Any,
        provenance: Provenance | str,
        source_ref: str | None = None,
        statement: str | None = None,
    ) -> RequirementAtom:
        rid = requirement_identity(
            semantic_key=semantic_key,
            kind=kind,
            value=value,
            source_ref=source_ref,
        )
        return cls(
            requirement_id=rid,
            semantic_key=semantic_key,
            kind=coerce_kind(kind),
            value=value,
            provenance=coerce_provenance(provenance),
            source_ref=source_ref,
            statement=statement,
        )

    def with_provenance(self, provenance: Provenance | str) -> RequirementAtom:
        return RequirementAtom(
            requirement_id=self.requirement_id,
            semantic_key=self.semantic_key,
            kind=self.kind,
            value=self.value,
            provenance=coerce_provenance(provenance),
            source_ref=self.source_ref,
            statement=self.statement,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "requirement_id": self.requirement_id,
            "semantic_key": self.semantic_key,
            "kind": self.kind.value,
            "value": self.value,
            "provenance": self.provenance.value,
            "source_ref": self.source_ref,
            "statement": self.statement,
        }


__all__ = [
    "RequirementKind",
    "RequirementAtom",
    "coerce_kind",
    "requirement_identity",
]
