"""Versioned provider profile registry — data-driven, no network, no authority minting.

Owner for provider capability profiles. Do not confuse with domain grounding
profiles in ``spe_runtime.grounding.profiles`` / ``data/grounding/domain_profiles.json``.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.portability.canonical import canonical_dumps, canonicalize

_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "provider_profiles_v1.json"
)
_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "schemas" / "provider_profile.schema.json"
)

# Authority flags that would mint / escalate / execute — never allowed on profiles.
FORBIDDEN_AUTHORITY_FLAGS: frozenset[str] = frozenset(
    {
        "execute",
        "self_escalate",
        "escalate",
        "mint",
        "mint_authority",
        "grant",
        "grant_authority",
        "write_authority",
        "broaden",
        "consume_grant",
        "revoke",
        "admin",
    }
)

_REQUIRED_FIELDS: tuple[str, ...] = (
    "profile_id",
    "provider",
    "profile_version",
    "effective_from",
    "capabilities",
    "privacy_behavior",
    "local_or_external",
    "requires_network",
    "requires_credentials",
    "authority_capabilities",
    "known_limitations",
)


@dataclass(frozen=True)
class ProviderProfile:
    """Immutable provider capability profile (registry row)."""

    profile_id: str
    provider: str
    model_id: str | None
    profile_version: str
    effective_from: str
    verified_at: str | None
    capabilities: tuple[str, ...]
    privacy_behavior: Mapping[str, Any]
    local_or_external: str
    requires_network: bool
    requires_credentials: bool
    pricing_metadata_if_known: Mapping[str, Any] | None
    authority_capabilities: tuple[str, ...]
    known_limitations: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "provider": self.provider,
            "model_id": self.model_id,
            "profile_version": self.profile_version,
            "effective_from": self.effective_from,
            "verified_at": self.verified_at,
            "capabilities": list(self.capabilities),
            "privacy_behavior": dict(self.privacy_behavior),
            "local_or_external": self.local_or_external,
            "requires_network": self.requires_network,
            "requires_credentials": self.requires_credentials,
            "pricing_metadata_if_known": (
                None
                if self.pricing_metadata_if_known is None
                else dict(self.pricing_metadata_if_known)
            ),
            "authority_capabilities": list(self.authority_capabilities),
            "known_limitations": list(self.known_limitations),
        }


def _as_tuple_str(value: Any) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(str(item) for item in value)


def _check_authority_flags(flags: tuple[str, ...]) -> None:
    lowered = {f.lower() for f in flags}
    bad = sorted(lowered & FORBIDDEN_AUTHORITY_FLAGS)
    if bad:
        raise ValueError(
            f"authority_capabilities must not mint/escalate authority; forbidden: {bad}"
        )
    for flag in flags:
        fl = flag.lower()
        if fl in FORBIDDEN_AUTHORITY_FLAGS:
            raise ValueError(f"forbidden authority capability: {flag!r}")
        if not (fl.startswith("read_") or fl in {"inspect", "describe"}):
            raise ValueError(
                f"authority_capabilities must be empty or read-only; got {flag!r}"
            )


def validate_provider_profile(raw: Mapping[str, Any]) -> dict[str, Any]:
    """Validate required fields + authority non-escalation; return normalized dict."""
    if not isinstance(raw, Mapping):
        raise TypeError("provider profile must be a mapping")
    missing = [k for k in _REQUIRED_FIELDS if k not in raw]
    if missing:
        raise ValueError(f"provider profile missing required fields: {missing}")

    local_or_external = str(raw["local_or_external"])
    if local_or_external not in {"local", "external"}:
        raise ValueError(
            f"local_or_external must be 'local' or 'external', got {local_or_external!r}"
        )
    if not isinstance(raw["requires_network"], bool):
        raise ValueError("requires_network must be bool")
    if not isinstance(raw["requires_credentials"], bool):
        raise ValueError("requires_credentials must be bool")
    if not isinstance(raw["privacy_behavior"], Mapping):
        raise ValueError("privacy_behavior must be an object")
    if not isinstance(raw["capabilities"], (list, tuple)):
        raise ValueError("capabilities must be a list")
    if not isinstance(raw["authority_capabilities"], (list, tuple)):
        raise ValueError("authority_capabilities must be a list")
    if not isinstance(raw["known_limitations"], (list, tuple)):
        raise ValueError("known_limitations must be a list")

    authority = _as_tuple_str(raw["authority_capabilities"])
    _check_authority_flags(authority)

    pricing = raw.get("pricing_metadata_if_known", None)
    if pricing is not None and not isinstance(pricing, Mapping):
        raise ValueError("pricing_metadata_if_known must be object or null")

    model_id = raw.get("model_id", None)
    if model_id is not None:
        model_id = str(model_id)

    verified_at = raw.get("verified_at", None)
    if verified_at is not None:
        verified_at = str(verified_at)

    return {
        "profile_id": str(raw["profile_id"]),
        "provider": str(raw["provider"]),
        "model_id": model_id,
        "profile_version": str(raw["profile_version"]),
        "effective_from": str(raw["effective_from"]),
        "verified_at": verified_at,
        "capabilities": list(_as_tuple_str(raw["capabilities"])),
        "privacy_behavior": dict(raw["privacy_behavior"]),
        "local_or_external": local_or_external,
        "requires_network": bool(raw["requires_network"]),
        "requires_credentials": bool(raw["requires_credentials"]),
        "pricing_metadata_if_known": None if pricing is None else dict(pricing),
        "authority_capabilities": list(authority),
        "known_limitations": list(_as_tuple_str(raw["known_limitations"])),
    }


def _profile_from_dict(raw: Mapping[str, Any]) -> ProviderProfile:
    normalized = validate_provider_profile(raw)
    pricing = normalized["pricing_metadata_if_known"]
    return ProviderProfile(
        profile_id=normalized["profile_id"],
        provider=normalized["provider"],
        model_id=normalized["model_id"],
        profile_version=normalized["profile_version"],
        effective_from=normalized["effective_from"],
        verified_at=normalized["verified_at"],
        capabilities=tuple(normalized["capabilities"]),
        privacy_behavior=dict(normalized["privacy_behavior"]),
        local_or_external=normalized["local_or_external"],
        requires_network=normalized["requires_network"],
        requires_credentials=normalized["requires_credentials"],
        pricing_metadata_if_known=None if pricing is None else dict(pricing),
        authority_capabilities=tuple(normalized["authority_capabilities"]),
        known_limitations=tuple(normalized["known_limitations"]),
    )


def _validate_against_schema(payload: Mapping[str, Any]) -> None:
    try:
        import jsonschema
    except ImportError:
        return
    if not _SCHEMA_PATH.is_file():
        return
    with _SCHEMA_PATH.open(encoding="utf-8") as fh:
        schema = json.load(fh)
    jsonschema.validate(instance=payload, schema=schema)


@lru_cache(maxsize=1)
def _load_raw_registry() -> tuple[str, tuple[ProviderProfile, ...]]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise ValueError("provider_profiles_v1.json must be an object")
    _validate_against_schema(payload)
    registry_version = str(payload.get("registry_version", ""))
    if not registry_version:
        raise ValueError("provider_profiles_v1.json missing registry_version")
    profiles_raw = payload.get("profiles")
    if not isinstance(profiles_raw, list):
        raise ValueError("provider_profiles_v1.json must contain a profiles list")

    profiles: list[ProviderProfile] = []
    seen: set[str] = set()
    for item in profiles_raw:
        profile = _profile_from_dict(item)
        if profile.profile_id in seen:
            raise ValueError(f"duplicate profile_id: {profile.profile_id}")
        seen.add(profile.profile_id)
        profiles.append(profile)
    return registry_version, tuple(profiles)


def load_provider_profile_registry() -> dict[str, Any]:
    """Load registry metadata + profiles keyed by profile_id."""
    registry_version, profiles = _load_raw_registry()
    return {
        "registry_id": "provider_profiles",
        "registry_version": registry_version,
        "profiles": {p.profile_id: p for p in profiles},
    }


def list_provider_profile_ids() -> tuple[str, ...]:
    _, profiles = _load_raw_registry()
    return tuple(sorted(p.profile_id for p in profiles))


def list_provider_profiles() -> tuple[ProviderProfile, ...]:
    _, profiles = _load_raw_registry()
    return tuple(sorted(profiles, key=lambda p: p.profile_id))


def get_provider_profile(
    profile_id: str, version: str | None = None
) -> ProviderProfile:
    """Lookup by profile_id; optional version must match exactly when provided."""
    registry = load_provider_profile_registry()
    profiles: dict[str, ProviderProfile] = registry["profiles"]
    try:
        profile = profiles[profile_id]
    except KeyError as exc:
        raise KeyError(f"unknown provider profile: {profile_id!r}") from exc
    if version is not None and profile.profile_version != version:
        raise KeyError(
            f"provider profile {profile_id!r} version mismatch: "
            f"requested {version!r}, have {profile.profile_version!r}"
        )
    return profile


def provider_profile_digest(profile: ProviderProfile | Mapping[str, Any]) -> str:
    """Stable semantic digest of one profile (canonical JSON + sha256)."""
    if isinstance(profile, ProviderProfile):
        payload = profile.to_dict()
    else:
        payload = validate_provider_profile(profile)
    text = canonical_dumps(canonicalize(payload))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def provider_registry_digest() -> str:
    """Stable digest over registry_version + all profiles (sorted by id)."""
    registry_version, profiles = _load_raw_registry()
    body = {
        "registry_id": "provider_profiles",
        "registry_version": registry_version,
        "profiles": [p.to_dict() for p in sorted(profiles, key=lambda x: x.profile_id)],
    }
    text = canonical_dumps(canonicalize(body))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
