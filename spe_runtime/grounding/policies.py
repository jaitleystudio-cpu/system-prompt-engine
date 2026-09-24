"""Source policy registry — data-driven, no network."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "grounding" / "source_policies.json"
)


@dataclass(frozen=True)
class SourcePolicy:
    policy_id: str
    domain_id: str
    ranked_source_classes: tuple[str, ...]
    required_source_classes: tuple[str, ...]
    optional_source_classes: tuple[str, ...]
    disallowed_source_classes: tuple[str, ...]
    notes: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "policy_id": self.policy_id,
            "domain_id": self.domain_id,
            "ranked_source_classes": list(self.ranked_source_classes),
            "required_source_classes": list(self.required_source_classes),
            "optional_source_classes": list(self.optional_source_classes),
            "disallowed_source_classes": list(self.disallowed_source_classes),
            "notes": self.notes,
        }


def _as_tuple_str(value: Any) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(str(item) for item in value)


def _policy_from_dict(raw: dict[str, Any]) -> SourcePolicy:
    return SourcePolicy(
        policy_id=str(raw["policy_id"]),
        domain_id=str(raw["domain_id"]),
        ranked_source_classes=_as_tuple_str(raw.get("ranked_source_classes")),
        required_source_classes=_as_tuple_str(raw.get("required_source_classes")),
        optional_source_classes=_as_tuple_str(raw.get("optional_source_classes")),
        disallowed_source_classes=_as_tuple_str(raw.get("disallowed_source_classes")),
        notes=str(raw.get("notes", "")),
    )


@lru_cache(maxsize=1)
def _load_policies() -> dict[str, SourcePolicy]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    policies = payload.get("policies", payload)
    if not isinstance(policies, list):
        raise ValueError("source_policies.json must contain a policies list")
    result: dict[str, SourcePolicy] = {}
    for item in policies:
        policy = _policy_from_dict(item)
        if policy.policy_id in result:
            raise ValueError(f"duplicate policy_id: {policy.policy_id}")
        result[policy.policy_id] = policy
    return result


def get_source_policy(policy_id: str) -> SourcePolicy:
    policies = _load_policies()
    try:
        return policies[policy_id]
    except KeyError as exc:
        raise KeyError(f"unknown policy_id: {policy_id!r}") from exc


def list_source_policy_ids() -> tuple[str, ...]:
    return tuple(sorted(_load_policies().keys()))
