"""K4 privacy projection — immutable models."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.privacy.types import PrivacyClass, ProjectionAction, ProjectionScope
from spe_runtime.provenance.models import Provenance


@dataclass(frozen=True)
class PrivacyDirective:
    """Classification / action directive for one semantic field key."""

    field_key: str
    privacy_class: PrivacyClass
    action: ProjectionAction | None = None  # None → derived from class+scope
    reason: str = ""


@dataclass(frozen=True)
class PrivacyProjectionEntry:
    """One projected field — never upgrades provenance/trust."""

    field_key: str
    semantic_ref: str
    privacy_class: PrivacyClass
    action: ProjectionAction
    reason: str
    provenance: Provenance | None
    projected_value: Any  # INCLUDE value, REDACT marker, or None when OMIT


@dataclass(frozen=True)
class PrivacyProjection:
    """Immutable, content-addressed privacy projection (view, not truth).

    Not an AuthorityGrant. Not a semantic mutation of ProtectedIntentContract.
    """

    projection_id: str
    source_id: str
    scope: ProjectionScope
    entries: tuple[PrivacyProjectionEntry, ...]
    directive_digest: str
    schema_version: str = "privacy_projection.v1"

    def to_canonical_payload(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "source_id": self.source_id,
            "scope": self.scope.value,
            "directive_digest": self.directive_digest,
            "entries": [
                {
                    "field_key": e.field_key,
                    "semantic_ref": e.semantic_ref,
                    "privacy_class": e.privacy_class.value,
                    "action": e.action.value,
                    "reason": e.reason,
                    "provenance": e.provenance.value if e.provenance is not None else None,
                    "projected_value": e.projected_value,
                }
                for e in self.entries
            ],
        }

    def serialized_view(self) -> dict[str, Any]:
        """Scope-safe representation — OMIT entries absent; REDACT has no raw value."""
        out: dict[str, Any] = {
            "projection_id": self.projection_id,
            "source_id": self.source_id,
            "scope": self.scope.value,
            "fields": {},
        }
        for e in self.entries:
            if e.action is ProjectionAction.OMIT:
                continue
            if e.action is ProjectionAction.REDACT:
                out["fields"][e.field_key] = {"redacted": True, "privacy_class": e.privacy_class.value}
            else:
                out["fields"][e.field_key] = e.projected_value
        return out


__all__ = [
    "PrivacyDirective",
    "PrivacyProjectionEntry",
    "PrivacyProjection",
]
