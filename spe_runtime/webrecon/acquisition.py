"""Authorized URL boundary.

v1 never opens a socket. A caller may attach an already-captured document
only after this boundary accepts the URL. `network_performed` is forced false.
"""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from spe_runtime.webrecon.reasons import ReasonCode

_ALLOWED_SCHEMES = frozenset({"http", "https"})
_RESTRICTED_NAMES = frozenset({"localhost", "metadata.google.internal"})


def _reason_tuple(codes: list[ReasonCode]) -> tuple[str, ...]:
    seen: list[str] = []
    for code in codes:
        value = code.value
        if value not in seen:
            seen.append(value)
    return tuple(seen)


def _restricted_host(host: str) -> bool:
    name = host.lower().rstrip(".")
    if name in _RESTRICTED_NAMES:
        return True
    if name.endswith(".localhost") or name.endswith(".local"):
        return True
    try:
        address = ipaddress.ip_address(name)
    except ValueError:
        return False
    return bool(
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


@dataclass(frozen=True)
class AcquisitionAuthorization:
    """Explicit permission to attach a capture for structural observation.

    Hosts are exact matches after IDNA and lowercasing. There is no wildcard.
    `network_mode` other than NONE is stored and then refused by `decide_acquisition`.
    """

    authorization_id: str
    allowed_hosts: tuple[str, ...]
    allowed_schemes: tuple[str, ...] = ("https",)
    allow_private_hosts: bool = False
    max_capture_bytes: int = 1_000_000
    network_mode: str = "NONE"
    purpose: str = "STRUCTURAL_RECONSTRUCTION"

    def __post_init__(self) -> None:
        auth_id = str(self.authorization_id).strip()
        if not auth_id:
            raise ValueError("authorization_id must be a non-empty string")
        object.__setattr__(self, "authorization_id", auth_id)

        hosts: list[str] = []
        for host in self.allowed_hosts:
            normalized = _normalize_host(str(host))
            if not normalized:
                raise ValueError("allowed_hosts entries must be non-empty hosts")
            if normalized not in hosts:
                hosts.append(normalized)
        if not hosts:
            raise ValueError("allowed_hosts must name at least one host")
        object.__setattr__(self, "allowed_hosts", tuple(hosts))

        schemes: list[str] = []
        for scheme in self.allowed_schemes:
            lowered = str(scheme).strip().lower()
            if lowered not in _ALLOWED_SCHEMES:
                raise ValueError("allowed_schemes may only include http and https")
            if lowered not in schemes:
                schemes.append(lowered)
        if not schemes:
            raise ValueError("allowed_schemes must include http or https")
        object.__setattr__(self, "allowed_schemes", tuple(schemes))

        mode = str(self.network_mode).strip()
        if not mode:
            raise ValueError("network_mode must be a non-empty string")
        object.__setattr__(self, "network_mode", mode)

        purpose = str(self.purpose).strip()
        if purpose != "STRUCTURAL_RECONSTRUCTION":
            raise ValueError("purpose must be STRUCTURAL_RECONSTRUCTION in v1")
        object.__setattr__(self, "purpose", purpose)

        max_bytes = int(self.max_capture_bytes)
        if max_bytes < 1:
            raise ValueError("max_capture_bytes must be >= 1")
        object.__setattr__(self, "max_capture_bytes", max_bytes)
        object.__setattr__(self, "allow_private_hosts", bool(self.allow_private_hosts))

    def to_dict(self) -> dict[str, Any]:
        return {
            "authorization_id": self.authorization_id,
            "allowed_hosts": list(self.allowed_hosts),
            "allowed_schemes": list(self.allowed_schemes),
            "allow_private_hosts": self.allow_private_hosts,
            "max_capture_bytes": self.max_capture_bytes,
            "network_mode": self.network_mode,
            "purpose": self.purpose,
        }


@dataclass(frozen=True)
class ParsedUrl:
    """URL parts used by the boundary. This is not a fetch request."""

    raw: str
    scheme: str
    host: str
    url_identity: str
    fragment: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw": self.raw,
            "scheme": self.scheme,
            "host": self.host,
            "url_identity": self.url_identity,
            "fragment": self.fragment,
        }


@dataclass(frozen=True)
class AcquisitionDecision:
    """Result of the URL boundary. `network_performed` cannot be set true."""

    status: str
    url_identity: str | None
    fragment: str | None
    host: str | None
    reason_codes: tuple[str, ...]
    network_performed: bool
    authorization_id: str | None

    def __post_init__(self) -> None:
        status = str(self.status)
        if status not in {"ALLOW_CAPTURE", "REFUSE"}:
            raise ValueError("acquisition status must be ALLOW_CAPTURE or REFUSE")
        object.__setattr__(self, "status", status)
        object.__setattr__(self, "reason_codes", tuple(str(code) for code in self.reason_codes))
        object.__setattr__(self, "network_performed", False)
        if status == "ALLOW_CAPTURE" and self.reason_codes:
            raise ValueError("ALLOW_CAPTURE cannot carry reason codes")
        if status == "REFUSE" and not self.reason_codes:
            raise ValueError("REFUSE requires at least one reason code")

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "url_identity": self.url_identity,
            "fragment": self.fragment,
            "host": self.host,
            "reason_codes": list(self.reason_codes),
            "network_performed": False,
            "authorization_id": self.authorization_id,
        }


def _normalize_host(host: str) -> str:
    text = host.strip().lower().rstrip(".")
    if not text or any(ord(ch) < 32 or ord(ch) == 127 for ch in text):
        return ""
    if "\\" in text or "/" in text or " " in text:
        return ""
    try:
        return text.encode("idna").decode("ascii")
    except UnicodeError:
        return ""


def parse_http_url(url: str) -> tuple[ParsedUrl | None, list[ReasonCode]]:
    """Parse a URL for the boundary. Does not resolve DNS and does not connect."""

    raw = str(url).strip()
    if not raw or any(ord(ch) < 32 or ord(ch) == 127 for ch in raw):
        return None, [ReasonCode.URL_UNPARSEABLE]
    parts = urlsplit(raw)
    scheme = parts.scheme.lower()
    if scheme not in _ALLOWED_SCHEMES:
        return None, [ReasonCode.SCHEME_REFUSED]
    if parts.username is not None or parts.password is not None:
        return None, [ReasonCode.CREDENTIALS_IN_URL]
    try:
        port = parts.port
    except ValueError:
        return None, [ReasonCode.URL_UNPARSEABLE]
    host = parts.hostname
    if host is None:
        return None, [ReasonCode.URL_UNPARSEABLE]
    normalized_host = _normalize_host(host)
    if not normalized_host:
        return None, [ReasonCode.URL_UNPARSEABLE]

    default_port = (scheme == "https" and port in (None, 443)) or (
        scheme == "http" and port in (None, 80)
    )
    if ":" in normalized_host:
        bracketed = f"[{normalized_host}]"
    else:
        bracketed = normalized_host
    if default_port or port is None:
        netloc = bracketed
    else:
        netloc = f"{bracketed}:{port}"
    path = parts.path or ""
    query = f"?{parts.query}" if parts.query else ""
    identity = f"{scheme}://{netloc}{path}{query}"
    fragment = parts.fragment or None
    return (
        ParsedUrl(
            raw=raw,
            scheme=scheme,
            host=normalized_host,
            url_identity=identity,
            fragment=fragment,
        ),
        [],
    )


def decide_acquisition(
    url: str,
    authorization: AcquisitionAuthorization,
) -> AcquisitionDecision:
    """Accept or refuse a URL. This function does not fetch the URL."""

    reasons: list[ReasonCode] = []
    if authorization.network_mode != "NONE":
        reasons.append(ReasonCode.NETWORK_NOT_AUTHORIZED)
    parsed, parse_reasons = parse_http_url(url)
    reasons.extend(parse_reasons)
    if parsed is None or reasons:
        return AcquisitionDecision(
            status="REFUSE",
            url_identity=None,
            fragment=None,
            host=None,
            reason_codes=_reason_tuple(reasons),
            network_performed=False,
            authorization_id=authorization.authorization_id,
        )

    if parsed.scheme not in authorization.allowed_schemes:
        reasons.append(ReasonCode.SCHEME_REFUSED)
    if parsed.host not in authorization.allowed_hosts:
        reasons.append(ReasonCode.HOST_NOT_ALLOWLISTED)
    elif _restricted_host(parsed.host) and not authorization.allow_private_hosts:
        reasons.append(ReasonCode.PRIVATE_HOST_REFUSED)

    if reasons:
        return AcquisitionDecision(
            status="REFUSE",
            url_identity=None,
            fragment=None,
            host=None,
            reason_codes=_reason_tuple(reasons),
            network_performed=False,
            authorization_id=authorization.authorization_id,
        )

    return AcquisitionDecision(
        status="ALLOW_CAPTURE",
        url_identity=parsed.url_identity,
        fragment=parsed.fragment,
        host=parsed.host,
        reason_codes=(),
        network_performed=False,
        authorization_id=authorization.authorization_id,
    )
