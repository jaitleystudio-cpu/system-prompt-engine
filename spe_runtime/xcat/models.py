"""CrossCategoryEnvelope models — immutable XCAT core."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

CATEGORY_IDS: frozenset[str] = frozenset(
    {f"CAT:C{i:02d}" for i in range(1, 13)}
)


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
    facts: tuple[dict[str, Any], ...] = ()
    provenance: tuple[dict[str, Any], ...] = ()
    uncertainties: tuple[dict[str, Any], ...] = ()
    hard_constraints: tuple[dict[str, Any], ...] = ()
    user_preferences: tuple[dict[str, Any], ...] = ()
    analysis: dict[str, Any] | None = None
    recommendation: dict[str, Any] | None = None
    rendering: dict[str, Any] | None = None
    authority_state: AuthorityState = AuthorityState()
    execution_grants: tuple[dict[str, Any], ...] = ()
    failures: tuple[FailureRecord, ...] = ()
    taint_labels: tuple[str, ...] = ()
    sensitivity_labels: tuple[str, ...] = ()
    category_trace: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "envelope_id": self.envelope_id,
            "goal_identity": self.goal_identity,
            "facts": list(self.facts),
            "provenance": list(self.provenance),
            "uncertainties": list(self.uncertainties),
            "hard_constraints": list(self.hard_constraints),
            "user_preferences": list(self.user_preferences),
            "analysis": self.analysis,
            "recommendation": self.recommendation,
            "rendering": self.rendering,
            "authority_state": {
                "level": self.authority_state.level,
                "status": self.authority_state.status,
                "grants": list(self.authority_state.grants),
            },
            "execution_grants": list(self.execution_grants),
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
