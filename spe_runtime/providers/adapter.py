"""Thin Capability ABI adapter — local-first provider profile selection.

Wired to Turn 2 ``provider_profiles_v1`` registry. Selection is observational
routing only:

* does **not** mint AuthorityGrant / credentials / network enablement
* does **not** mutate ProtectedIntent
* does **not** compile prompts
* never silently falls back from local/private to remote

``EXTERNAL_OPTIONAL`` requires explicit ``allow_external=true`` (or equivalent).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from spe_runtime.providers.profiles import (
    ProviderProfile,
    get_provider_profile,
    list_provider_profiles,
)

# Deterministic local-first preference (never reorder casually).
_LOCAL_FIRST_ORDER: tuple[str, ...] = (
    "DETERMINISTIC",
    "LOCAL_WASM",
    "EXTERNAL_OPTIONAL",
)

STATUS_SELECTED = "SELECTED"
STATUS_BLOCKED = "BLOCKED"
STATUS_UNAVAILABLE = "UNAVAILABLE"


@dataclass(frozen=True)
class RoutingPolicy:
    """Explicit policy — external/network never implied by silence."""

    allow_external: bool = False
    allow_network: bool = False
    credentials_available: bool = False

    @classmethod
    def from_mapping(cls, raw: Mapping[str, Any] | None) -> "RoutingPolicy":
        if raw is None:
            return cls()
        if not isinstance(raw, Mapping):
            raise TypeError("policy must be a mapping")
        allow_external = bool(
            raw.get("allow_external", False)
            or raw.get("explicit_allow_external", False)
        )
        allow_network = bool(
            raw.get("allow_network", False)
            or raw.get("explicit_allow_network", False)
        )
        credentials_available = bool(
            raw.get("credentials_available", False)
            or raw.get("credentials_present", False)
        )
        return cls(
            allow_external=allow_external,
            allow_network=allow_network,
            credentials_available=credentials_available,
        )

    def external_permitted(self) -> bool:
        """EXTERNAL_OPTIONAL path requires explicit allow_external."""
        return bool(self.allow_external)

    def network_permitted(self) -> bool:
        """Network use requires allow_network or allow_external (never silent)."""
        return bool(self.allow_network or self.allow_external)


@dataclass(frozen=True)
class CapabilityNeed:
    """Caller need — required capability tags and optional hard pin."""

    capabilities: frozenset[str] = frozenset()
    network_required: bool = False
    prefer_deterministic: bool = False
    profile_id: str | None = None

    @classmethod
    def from_need(
        cls,
        need: "CapabilityNeed | Mapping[str, Any] | Sequence[str] | str | None",
    ) -> "CapabilityNeed":
        if need is None:
            return cls()
        if isinstance(need, CapabilityNeed):
            return need
        if isinstance(need, str):
            return cls(capabilities=frozenset({need}))
        if isinstance(need, Sequence) and not isinstance(need, (str, bytes)):
            return cls(capabilities=frozenset(str(x) for x in need))
        if isinstance(need, Mapping):
            caps_raw = need.get("capabilities", need.get("required_capabilities", ()))
            if isinstance(caps_raw, str):
                caps: frozenset[str] = frozenset({caps_raw})
            elif isinstance(caps_raw, Sequence):
                caps = frozenset(str(x) for x in caps_raw)
            else:
                raise ValueError("capabilities must be a string or sequence")
            profile_id = need.get("profile_id")
            if profile_id is not None:
                profile_id = str(profile_id)
            return cls(
                capabilities=caps,
                network_required=bool(
                    need.get("network_required", False)
                    or need.get("requires_network", False)
                ),
                prefer_deterministic=bool(need.get("prefer_deterministic", False)),
                profile_id=profile_id,
            )
        raise TypeError(
            "need must be CapabilityNeed, mapping, sequence of capability ids, str, or None"
        )


@dataclass(frozen=True)
class ProfileSelection:
    """Result of ``select_profile`` — selection ≠ authority grant."""

    profile_id: str | None
    status: str
    reason: str
    profile: ProviderProfile | None = None
    authority_granted: bool = False
    network_enabled: bool = False
    credentials_released: bool = False

    def __post_init__(self) -> None:
        # Hard invariants — selection never escalates by construction.
        # Coerce any attempted grant/enable/release flags back to False.
        object.__setattr__(self, "authority_granted", False)
        object.__setattr__(self, "network_enabled", False)
        object.__setattr__(self, "credentials_released", False)
        if not str(self.reason).strip():
            raise ValueError("reason string must be present")

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "status": self.status,
            "reason": self.reason,
            "authority_granted": False,
            "network_enabled": False,
            "credentials_released": False,
            "profile": None if self.profile is None else self.profile.to_dict(),
        }


def _covers(profile: ProviderProfile, required: frozenset[str]) -> bool:
    if not required:
        return True
    return required.issubset(set(profile.capabilities))


def _policy_allows(profile: ProviderProfile, policy: RoutingPolicy) -> tuple[bool, str | None]:
    """Return (allowed, block_reason). Never silently permit external/network."""
    if profile.local_or_external == "external" or profile.profile_id == "EXTERNAL_OPTIONAL":
        if not policy.external_permitted():
            return False, (
                "EXTERNAL_OPTIONAL blocked: allow_external is false "
                "(no silent remote fallback)"
            )
    if profile.requires_network and not policy.network_permitted():
        return False, (
            "network-required profile blocked: allow_network/allow_external not set"
        )
    return True, None


def _ordered_profiles() -> list[ProviderProfile]:
    by_id = {p.profile_id: p for p in list_provider_profiles()}
    ordered: list[ProviderProfile] = []
    for pid in _LOCAL_FIRST_ORDER:
        if pid in by_id:
            ordered.append(by_id.pop(pid))
    # Any unexpected registry rows sort after known local-first ids (stable).
    for pid in sorted(by_id):
        ordered.append(by_id[pid])
    return ordered


def select_profile(
    need: CapabilityNeed | Mapping[str, Any] | Sequence[str] | str | None = None,
    policy: RoutingPolicy | Mapping[str, Any] | None = None,
) -> ProfileSelection:
    """Select a provider ``profile_id`` under local-first policy.

    Preference (deterministic): DETERMINISTIC → LOCAL_WASM → EXTERNAL_OPTIONAL
    (only when ``allow_external``) → else BLOCKED / UNAVAILABLE with a human reason.

    Returns selection metadata only — never an AuthorityGrant, never enables
    network, never releases credentials, never compiles a prompt.
    """
    need_n = CapabilityNeed.from_need(need)
    policy_n = (
        policy
        if isinstance(policy, RoutingPolicy)
        else RoutingPolicy.from_mapping(policy)
    )

    # --- Hard pin to a specific profile_id ---
    if need_n.profile_id is not None:
        try:
            pinned = get_provider_profile(need_n.profile_id)
        except KeyError:
            return ProfileSelection(
                profile_id=None,
                status=STATUS_UNAVAILABLE,
                reason=(
                    f"unknown provider profile rejected: {need_n.profile_id!r}"
                ),
            )
        allowed, block_reason = _policy_allows(pinned, policy_n)
        if not allowed:
            return ProfileSelection(
                profile_id=None,
                status=STATUS_BLOCKED,
                reason=block_reason or "profile blocked by policy",
            )
        if not _covers(pinned, need_n.capabilities):
            return ProfileSelection(
                profile_id=None,
                status=STATUS_UNAVAILABLE,
                reason=(
                    f"pinned profile {pinned.profile_id!r} does not cover "
                    f"required capabilities {sorted(need_n.capabilities)}"
                ),
            )
        return ProfileSelection(
            profile_id=pinned.profile_id,
            status=STATUS_SELECTED,
            reason=(
                f"selected pinned profile {pinned.profile_id} "
                f"(local_or_external={pinned.local_or_external}); "
                "selection is not an authority grant"
            ),
            profile=pinned,
        )

    # --- Network-required need without explicit allow ---
    if need_n.network_required and not policy_n.network_permitted():
        return ProfileSelection(
            profile_id=None,
            status=STATUS_BLOCKED,
            reason=(
                "network-required need rejected: allow_network/allow_external "
                "not set (no silent remote fallback)"
            ),
        )

    candidates = _ordered_profiles()

    # If prefer_deterministic, try DETERMINISTIC first when it covers.
    if need_n.prefer_deterministic:
        for profile in candidates:
            if profile.profile_id != "DETERMINISTIC":
                continue
            allowed, _ = _policy_allows(profile, policy_n)
            if allowed and _covers(profile, need_n.capabilities):
                return ProfileSelection(
                    profile_id=profile.profile_id,
                    status=STATUS_SELECTED,
                    reason=(
                        "selected DETERMINISTIC (prefer_deterministic + local-first); "
                        "selection is not an authority grant"
                    ),
                    profile=profile,
                )

    local_match: ProviderProfile | None = None
    external_match: ProviderProfile | None = None
    external_blocked_reason: str | None = None

    for profile in candidates:
        if not _covers(profile, need_n.capabilities):
            continue
        allowed, block_reason = _policy_allows(profile, policy_n)
        is_external = (
            profile.local_or_external == "external"
            or profile.profile_id == "EXTERNAL_OPTIONAL"
        )
        if is_external:
            if allowed:
                if external_match is None:
                    external_match = profile
            else:
                external_blocked_reason = block_reason
            continue
        # Local path — prefer first in local-first order.
        if allowed and local_match is None:
            local_match = profile

    if local_match is not None:
        return ProfileSelection(
            profile_id=local_match.profile_id,
            status=STATUS_SELECTED,
            reason=(
                f"selected {local_match.profile_id} via local-first routing "
                f"(preferred over external); selection is not an authority grant"
            ),
            profile=local_match,
        )

    if external_match is not None:
        # Only reachable when allow_external was explicit.
        cred_note = (
            "credentials remain gated (not released by selection)"
            if external_match.requires_credentials
            else "no credentials required by profile"
        )
        return ProfileSelection(
            profile_id=external_match.profile_id,
            status=STATUS_SELECTED,
            reason=(
                f"selected {external_match.profile_id} after local profiles "
                f"could not cover need; allow_external=true; {cred_note}; "
                "selection is not an authority grant; network not auto-enabled"
            ),
            profile=external_match,
        )

    if external_blocked_reason is not None:
        return ProfileSelection(
            profile_id=None,
            status=STATUS_BLOCKED,
            reason=external_blocked_reason,
        )

    if need_n.capabilities:
        return ProfileSelection(
            profile_id=None,
            status=STATUS_UNAVAILABLE,
            reason=(
                "no provider profile covers required capabilities "
                f"{sorted(need_n.capabilities)} under current policy"
            ),
        )

    return ProfileSelection(
        profile_id=None,
        status=STATUS_UNAVAILABLE,
        reason="no selectable provider profile under current policy",
    )
