"""ExecutionIntent + OutcomeState — immutable execution planning (not success)."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping


def _deep_freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({k: _deep_freeze(v) for k, v in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_deep_freeze(v) for v in value)
    return value


def canonical_arguments_digest(arguments: Mapping[str, Any]) -> str:
    payload = json.dumps(arguments, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def stable_operation_id(
    *,
    action_type: str,
    canonical_target: str,
    arguments_digest: str,
    recommendation_ref: str | None,
    decision_ref: str | None,
    authority_grant_ref: str | None,
) -> str:
    material = "|".join(
        [
            action_type,
            canonical_target,
            arguments_digest,
            recommendation_ref or "",
            decision_ref or "",
            authority_grant_ref or "",
        ]
    )
    return "op-" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:24]


class OutcomeState(str, Enum):
    NOT_EXECUTED = "NOT_EXECUTED"
    DISPATCHING = "DISPATCHING"
    OUTCOME_UNKNOWN = "OUTCOME_UNKNOWN"
    PARTIAL = "PARTIAL"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RECONCILIATION_REQUIRED = "RECONCILIATION_REQUIRED"


@dataclass(frozen=True)
class ExecutionIntent:
    """Canonical execution plan. Forming an intent is not execution success."""

    operation_id: str
    action_type: str
    canonical_target: str
    canonical_arguments: Mapping[str, Any]
    arguments_digest: str
    expected_effect: str
    reversibility_class: str
    recommendation_ref: str | None
    decision_ref: str | None
    authority_grant_ref: str | None

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "canonical_arguments", _deep_freeze(dict(self.canonical_arguments))
        )
