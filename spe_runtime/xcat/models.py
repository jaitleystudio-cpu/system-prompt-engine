"""CrossCategoryEnvelope models — immutable XCAT core."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Mapping

CATEGORY_IDS: frozenset[str] = frozenset(
    {f"CAT:C{i:02d}" for i in range(1, 13)}
)


def _deep_freeze(value: Any) -> Any:
    """Recursively freeze mappings/lists into MappingProxyType / tuples."""
    if isinstance(value, Mapping):
        return MappingProxyType({k: _deep_freeze(v) for k, v in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_deep_freeze(v) for v in value)
    return value


def _deep_unfreeze(value: Any) -> Any:
    """Recursively convert frozen mappings/tuples back to dict/list for JSON."""
    if isinstance(value, Mapping):
        return {k: _deep_unfreeze(v) for k, v in value.items()}
    if isinstance(value, tuple):
        return [_deep_unfreeze(v) for v in value]
    if isinstance(value, list):
        return [_deep_unfreeze(v) for v in value]
    return value


def _freeze_mapping(value: Mapping[str, Any] | None) -> Mapping[str, Any] | None:
    if value is None:
        return None
    frozen = _deep_freeze(value)
    assert isinstance(frozen, Mapping)
    return frozen


def _freeze_mapping_tuple(
    items: tuple[Mapping[str, Any], ...] | tuple[dict[str, Any], ...]
) -> tuple[Mapping[str, Any], ...]:
    return tuple(_freeze_mapping(item) for item in items)  # type: ignore[misc]


@dataclass(frozen=True)
class AuthorityState:
    level: int = 0
    status: str = "NONE"
    grants: tuple[str, ...] = ()


@dataclass(frozen=True)
class FailureRecord:
    failure_id: str
    status: str | None  # FAIL | UNKNOWN | PASS | None (explicit null) | portable absent sentinel
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
            "facts": _deep_unfreeze(self.facts),
            "provenance": _deep_unfreeze(self.provenance),
            "uncertainties": _deep_unfreeze(self.uncertainties),
            "hard_constraints": _deep_unfreeze(self.hard_constraints),
            "user_preferences": _deep_unfreeze(self.user_preferences),
            "analysis": _deep_unfreeze(self.analysis),
            "recommendation": _deep_unfreeze(self.recommendation),
            "rendering": _deep_unfreeze(self.rendering),
            "authority_state": {
                "level": self.authority_state.level,
                "status": self.authority_state.status,
                "grants": list(self.authority_state.grants),
            },
            "execution_grants": _deep_unfreeze(self.execution_grants),
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
