"""Egress allowlist for scholarly HTTP.

Only registry-enabled HTTPS hosts may be contacted. Query text is a scholarly
search string, never a user profile, credential, or private document.
"""

from __future__ import annotations

import ipaddress
from urllib.parse import urlsplit

from spe_runtime.scholarly.errors import EgressDenied
from spe_runtime.scholarly.registry import SourceRegistry

_BLOCKED_SCHEMES = frozenset({"http", "javascript", "data", "file", "ftp"})


def _reject_host(host: str) -> None:
    if host == "localhost" or host.endswith(".localhost"):
        raise EgressDenied("EGRESS_LOCALHOST")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return
    if (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    ):
        raise EgressDenied("EGRESS_PRIVATE_HOST")
    raise EgressDenied("EGRESS_IP_LITERAL")


def assert_allowed(url: str, registry: SourceRegistry) -> str:
    """Return the hostname when the URL is on the enabled-source allowlist."""
    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise EgressDenied("EGRESS_URL_UNPARSEABLE") from exc
    scheme = parts.scheme.lower()
    if scheme in _BLOCKED_SCHEMES or scheme != "https":
        raise EgressDenied("EGRESS_SCHEME")
    if parts.username or parts.password:
        raise EgressDenied("EGRESS_USERINFO")
    host = parts.hostname
    if host is None:
        raise EgressDenied("EGRESS_HOST_MISSING")
    host = host.lower().rstrip(".")
    _reject_host(host)
    if parts.port not in (None, 443):
        raise EgressDenied("EGRESS_PORT")
    if host not in registry.allowlist():
        raise EgressDenied(f"EGRESS_HOST:{host}")
    return host
