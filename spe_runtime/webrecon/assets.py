"""Asset inventory. References are recorded. Bytes are not fetched."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit

from spe_runtime.webrecon.acquisition import collapse_path


@dataclass(frozen=True)
class Asset:
    asset_id: str
    kind: str
    declared_ref: str
    resolved_ref: str | None
    host: str | None
    same_document: bool
    fetch_status: str
    execution: str
    integrity: str | None
    digest: str | None

    def __post_init__(self) -> None:
        if self.execution not in {"FORBIDDEN", "NOT_APPLICABLE"}:
            raise ValueError("execution must be FORBIDDEN or NOT_APPLICABLE")
        if self.fetch_status not in {"NOT_FETCHED", "INLINE", "QUARANTINED"}:
            raise ValueError("fetch_status is not a v1 value")
        if self.kind == "SCRIPT":
            object.__setattr__(self, "execution", "FORBIDDEN")

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "kind": self.kind,
            "declared_ref": self.declared_ref,
            "resolved_ref": self.resolved_ref,
            "host": self.host,
            "same_document": self.same_document,
            "fetch_status": self.fetch_status,
            "execution": self.execution,
            "integrity": self.integrity,
            "digest": self.digest,
        }


def resolve_reference(page_url: str, declared_ref: str) -> tuple[str | None, str | None, bool]:
    """Resolve a reference against the page URL without requesting it."""

    ref = declared_ref.strip()
    if not ref or ref.lower().startswith("data:") or ref.lower().startswith("javascript:"):
        return None, None, False
    absolute = urljoin(page_url, ref)
    parts = urlsplit(absolute)
    if parts.scheme not in {"http", "https"} or parts.hostname is None:
        return None, None, False
    if parts.username is not None or parts.password is not None:
        return None, None, False
    host = parts.hostname.lower()
    port = parts.port
    default = (parts.scheme == "https" and port in (None, 443)) or (
        parts.scheme == "http" and port in (None, 80)
    )
    bracketed = f"[{host}]" if ":" in host else host
    netloc = bracketed if default or port is None else f"{bracketed}:{port}"
    path = collapse_path(parts.path or "")
    query = f"?{parts.query}" if parts.query else ""
    identity = f"{parts.scheme}://{netloc}{path}{query}"
    page_host = urlsplit(page_url).hostname
    same = page_host is not None and page_host.lower() == host
    return identity, host, same
