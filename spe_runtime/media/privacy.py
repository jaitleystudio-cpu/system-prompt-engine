"""Privacy defaults for speech and video custody.

Raw audio is never retained. Raw video is retained only when a caller sets
the explicit-need flag and the retention value together. Network authority
stays NONE. This module does not mint semantic authority.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class RawRetention(str, Enum):
    OFF = "OFF"
    ON = "ON"


class NetworkAuthority(str, Enum):
    """Egress authority. This foundation recognizes NONE only."""

    NONE = "NONE"


def _as_retention(value: RawRetention | str) -> RawRetention:
    if isinstance(value, RawRetention):
        return value
    return RawRetention(str(value))


def _as_network_authority(value: NetworkAuthority | str) -> NetworkAuthority:
    if isinstance(value, NetworkAuthority):
        return value
    return NetworkAuthority(str(value))


@dataclass(frozen=True)
class RawAudioRetentionPolicy:
    """Raw audio retention is OFF. No other value is representable."""

    retention: RawRetention = RawRetention.OFF

    def __post_init__(self) -> None:
        retention = _as_retention(self.retention)
        if retention is not RawRetention.OFF:
            raise ValueError("raw audio retention is OFF")
        object.__setattr__(self, "retention", retention)

    def to_dict(self) -> str:
        return self.retention.value


@dataclass(frozen=True)
class RawVideoRetentionPolicy:
    """Raw video retention is OFF unless explicitly_needed is true."""

    retention: RawRetention = RawRetention.OFF
    explicitly_needed: bool = False

    def __post_init__(self) -> None:
        retention = _as_retention(self.retention)
        explicitly_needed = bool(self.explicitly_needed)
        if retention is RawRetention.ON and not explicitly_needed:
            raise ValueError("raw video retention is OFF unless explicitly needed")
        object.__setattr__(self, "retention", retention)
        object.__setattr__(self, "explicitly_needed", explicitly_needed)

    def to_dict(self) -> dict[str, object]:
        return {
            "retention": self.retention.value,
            "explicitly_needed": self.explicitly_needed,
        }


@dataclass(frozen=True)
class NetworkAuthorityPolicy:
    """Network authority is NONE. This foundation grants no egress."""

    authority: NetworkAuthority = NetworkAuthority.NONE

    def __post_init__(self) -> None:
        authority = _as_network_authority(self.authority)
        if authority is not NetworkAuthority.NONE:
            raise ValueError("network authority is NONE")
        object.__setattr__(self, "authority", authority)

    def to_dict(self) -> str:
        return self.authority.value


def coerce_audio_retention(
    value: RawAudioRetentionPolicy | RawRetention | str,
) -> RawAudioRetentionPolicy:
    if isinstance(value, RawAudioRetentionPolicy):
        return value
    return RawAudioRetentionPolicy(retention=_as_retention(value))


def coerce_video_retention(
    value: RawVideoRetentionPolicy | RawRetention | str,
    *,
    explicitly_needed: bool | None = None,
) -> RawVideoRetentionPolicy:
    if isinstance(value, RawVideoRetentionPolicy):
        if explicitly_needed is not None and bool(explicitly_needed) != value.explicitly_needed:
            return RawVideoRetentionPolicy(
                retention=value.retention,
                explicitly_needed=explicitly_needed,
            )
        return value
    return RawVideoRetentionPolicy(
        retention=_as_retention(value),
        explicitly_needed=bool(explicitly_needed),
    )


def coerce_network_authority(
    value: NetworkAuthorityPolicy | NetworkAuthority | str,
) -> NetworkAuthorityPolicy:
    if isinstance(value, NetworkAuthorityPolicy):
        return value
    return NetworkAuthorityPolicy(authority=_as_network_authority(value))


__all__ = [
    "NetworkAuthority",
    "NetworkAuthorityPolicy",
    "RawAudioRetentionPolicy",
    "RawRetention",
    "RawVideoRetentionPolicy",
    "coerce_audio_retention",
    "coerce_network_authority",
    "coerce_video_retention",
]
