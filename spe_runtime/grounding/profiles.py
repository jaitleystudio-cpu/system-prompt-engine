"""Domain profile registry — data-driven, no network."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "grounding" / "domain_profiles.json"
)


@dataclass(frozen=True)
class DomainProfile:
    domain_id: str
    preferred_source_classes: tuple[str, ...]
    disallowed_source_classes: tuple[str, ...]
    freshness_policy: str
    contradiction_policy: str
    citation_policy: str
    license_policy: str
    abstention_policy: str
    default_protocol_id: str
    allowed_protocol_depths: tuple[str, ...]
    evaluator_id: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain_id": self.domain_id,
            "preferred_source_classes": list(self.preferred_source_classes),
            "disallowed_source_classes": list(self.disallowed_source_classes),
            "freshness_policy": self.freshness_policy,
            "contradiction_policy": self.contradiction_policy,
            "citation_policy": self.citation_policy,
            "license_policy": self.license_policy,
            "abstention_policy": self.abstention_policy,
            "default_protocol_id": self.default_protocol_id,
            "allowed_protocol_depths": list(self.allowed_protocol_depths),
            "evaluator_id": self.evaluator_id,
        }


def _as_tuple_str(value: Any) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(str(item) for item in value)


def _profile_from_dict(raw: dict[str, Any]) -> DomainProfile:
    return DomainProfile(
        domain_id=str(raw["domain_id"]),
        preferred_source_classes=_as_tuple_str(raw.get("preferred_source_classes")),
        disallowed_source_classes=_as_tuple_str(raw.get("disallowed_source_classes")),
        freshness_policy=str(raw.get("freshness_policy", "prefer_current")),
        contradiction_policy=str(raw.get("contradiction_policy", "note_if_present")),
        citation_policy=str(raw.get("citation_policy", "optional")),
        license_policy=str(raw.get("license_policy", "respect_source_license")),
        abstention_policy=str(raw.get("abstention_policy", "warn_if_missing")),
        default_protocol_id=str(raw["default_protocol_id"]),
        allowed_protocol_depths=_as_tuple_str(raw.get("allowed_protocol_depths")),
        evaluator_id=str(raw["evaluator_id"]),
    )


@lru_cache(maxsize=1)
def _load_profiles() -> dict[str, DomainProfile]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    profiles = payload.get("profiles", payload)
    if not isinstance(profiles, list):
        raise ValueError("domain_profiles.json must contain a profiles list")
    result: dict[str, DomainProfile] = {}
    for item in profiles:
        profile = _profile_from_dict(item)
        if profile.domain_id in result:
            raise ValueError(f"duplicate domain_id: {profile.domain_id}")
        result[profile.domain_id] = profile
    return result


def list_domain_profile_ids() -> tuple[str, ...]:
    return tuple(sorted(_load_profiles().keys()))


def get_domain_profile(domain_id: str) -> DomainProfile:
    profiles = _load_profiles()
    try:
        return profiles[domain_id]
    except KeyError as exc:
        raise KeyError(f"unknown domain_id: {domain_id!r}") from exc
