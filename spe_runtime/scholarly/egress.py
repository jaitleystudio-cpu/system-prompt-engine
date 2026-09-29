"""Egress allowlist for scholarly HTTP.

Only registry-enabled HTTPS hosts may be contacted. Query text is a scholarly
search string, never a user profile, credential, or private document.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from spe_runtime.scholarly.errors import EgressDenied
from spe_runtime.scholarly.registry import SourceRegistry


def assert_allowed(url: str, registry: SourceRegistry) -> str:
    """Return the hostname when the URL is on the enabled-source allowlist."""
    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise EgressDenied("EGRESS_URL_UNPARSEABLE") from exc
    if parts.scheme != "https":
        raise EgressDenied("EGRESS_SCHEME")
    if parts.username or parts.password:
        raise EgressDenied("EGRESS_USERINFO")
    host = parts.hostname
    if host is None:
        raise EgressDenied("EGRESS_HOST_MISSING")
    host = host.lower()
    if host not in registry.allowlist():
        raise EgressDenied(f"EGRESS_HOST:{host}")
    if parts.port not in (None, 443):
        raise EgressDenied("EGRESS_PORT")
    return host
