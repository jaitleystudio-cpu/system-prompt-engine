"""CrossCategoryEnvelope models — immutable XCAT core."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Mapping

CATEGORY_IDS: frozenset[str] = frozenset(
    {f"CAT:C{i:02d}" for i in range(1, 13)}
)


def _freeze_mapping(value: Mapping[str, Any] | None) -> Mapping[str, Any] | None:
    if value is None:
        return None
    return MappingProxyType(dict(value))


def _freeze_mapping_tuple(
    items: tuple[Mapping[str, Any], ...] | tuple[dict[str, Any], ...]
) -> tuple[Mapping[str, Any], ...]:
    return tuple(MappingProxyType(dict(item)) for item in items)


@dataclass(frozen=True)
class AuthorityState:
    level: int = 0
    status: str = "NONE"
    grants: tuple[str, ...] = ()


@dataclass(frozen=True)
class FailureRecord:
    failure_id: str
    status: str  # FAIL | UNKNOWN | PASS
    message: str = ""


@dataclass(frozen=True)
class CrossCategoryEnvelope:
    """Immutable cross-category semantic envelope."""

    envelope_id: str
    goal_identity: str
    facts: tuple[Mapping[str, Any], ...] = ()
    provenance: tuple[Mapping[str, Any], ...] = ()
    uncertainties: tuple[Mapping[str, Any], ...] = ()
    hard_constraints: tuple[Mapping[str, Any], ...] = ()
    user_preferences: tuple[Mapping[str, Any], ...] = ()
    analysis: Mapping[str, Any] | None = None
    recommendation: Mapping[str, Any] | None = None
    rendering: Mapping[str, Any] | None = None
    authority_state: AuthorityState = field(default_factory=AuthorityState)
    execution_grants: tuple[Mapping[str, Any], ...] = ()
    failures: tuple[FailureRecord, ...] = ()
    taint_labels: tuple[str, ...] = ()
    sensitivity_labels: tuple[str, ...] = ()
    category_trace: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "facts", _freeze_mapping_tuple(self.facts))
        object.__setattr__(self, "provenance", _freeze_mapping_tuple(self.provenance))
        object.__setattr__(
            self, "uncertainties", _freeze_mapping_tuple(self.uncertainties)
        )
        object.__setattr__(
            self, "hard_constraints", _freeze_mapping_tuple(self.hard_constraints)
        )
        object.__setattr__(
            self, "user_preferences", _freeze_mapping_tuple(self.user_preferences)
        )
        object.__setattr__(self, "analysis", _freeze_mapping(self.analysis))
        object.__setattr__(
            self, "recommendation", _freeze_mapping(self.recommendation)
        )
        object.__setattr__(self, "rendering", _freeze_mapping(self.rendering))
        object.__setattr__(
            self, "execution_grants", _freeze_mapping_tuple(self.execution_grants)
        )
        object.__setattr__(self, "taint_labels", tuple(self.taint_labels))
        object.__setattr__(self, "sensitivity_labels", tuple(self.sensitivity_labels))
        object.__setattr__(self, "category_trace", tuple(self.category_trace))
        object.__setattr__(self, "failures", tuple(self.failures))

    def to_dict(self) -> dict[str, Any]:
        return {
            "envelope_id": self.envelope_id,
            "goal_identity": self.goal_identity,
            "facts": [dict(x) for x in self.facts],
            "provenance": [dict(x) for x in self.provenance],
            "uncertainties": [dict(x) for x in self.uncertainties],
            "hard_constraints": [dict(x) for x in self.hard_constraints],
            "user_preferences": [dict(x) for x in self.user_preferences],
            "analysis": dict(self.analysis) if self.analysis is not None else None,
            "recommendation": (
                dict(self.recommendation) if self.recommendation is not None else None
            ),
            "rendering": dict(self.rendering) if self.rendering is not None else None,
            "authority_state": {
                "level": self.authority_state.level,
                "status": self.authority_state.status,
                "grants": list(self.authority_state.grants),
            },
            "execution_grants": [dict(x) for x in self.execution_grants],
            "failures": [
                {
                    "failure_id": f.failure_id,
                    "status": f.status,
                    "message": f.message,
                }
                for f in self.failures
            ],
            "taint_labels": list(self.taint_labels),
            "sensitivity_labels": list(self.sensitivity_labels),
            "category_trace": list(self.category_trace),
        }
