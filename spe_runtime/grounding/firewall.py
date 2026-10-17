"""Source firewall — external retrieved text is untrusted DATA only."""

from __future__ import annotations

import re
from typing import Any, Mapping

from spe_runtime.categories._common import FORBIDDEN_PAYLOAD_KEYS

# Citation / authority forgery keys that must never survive retrieval ingest.
_CITATION_FORGERY_KEYS = frozenset(
    {
        "verified_citation",
        "citation_authority",
        "authority_label",
        "mint_authority",
        "peer_review_badge",
        "is_authoritative",
    }
)

GROUNDING_FORBIDDEN_KEYS = FORBIDDEN_PAYLOAD_KEYS | _CITATION_FORGERY_KEYS

# Unicode controls (Cc) except common whitespace; also strip zero-width (Cf) junk.
_CONTROL_RE = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]"
)
_SCRIPT_RE = re.compile(r"<script\b[^>]*>[\s\S]*?</script\s*>", re.IGNORECASE)
_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")


def _walk_forbidden(obj: object, *, path: str = "") -> None:
    if isinstance(obj, Mapping):
        bad = GROUNDING_FORBIDDEN_KEYS & set(obj.keys())
        if bad:
            loc = f" at {path}" if path else ""
            raise ValueError(
                f"external payload contains forbidden keys{loc}: {sorted(bad)}"
            )
        for key, value in obj.items():
            child = f"{path}.{key}" if path else str(key)
            _walk_forbidden(value, path=child)
    elif isinstance(obj, (list, tuple)):
        for idx, item in enumerate(obj):
            _walk_forbidden(item, path=f"{path}[{idx}]")


def _sanitize_text(value: str) -> str:
    cleaned = _SCRIPT_RE.sub(" ", value)
    cleaned = _TAG_RE.sub(" ", cleaned)
    cleaned = _CONTROL_RE.sub("", cleaned)
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned.strip()


def _sanitize_value(value: object) -> object:
    if isinstance(value, str):
        return _sanitize_text(value)
    if isinstance(value, Mapping):
        return {str(k): _sanitize_value(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_value(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_sanitize_value(v) for v in value)
    return value


def sanitize_external_payload(payload: Mapping[str, object]) -> Mapping[str, object]:
    """Validate and sanitize an external retrieval payload.

    Forbidden structural keys (authority, PROMOTE, VERIFIED_SUCCESS, grants,
    receipts, fake citation/authority labels, …) are rejected. HTML/script and
    unicode controls are stripped from text. Surviving content is marked
    UNTRUSTED_SOURCE — DATA only; it must never mutate ProtectedIntent, K3,
    authority, or proof state.
    """
    if not isinstance(payload, Mapping):
        raise TypeError("payload must be a mapping")

    _walk_forbidden(payload)

    out: dict[str, Any] = {
        str(k): _sanitize_value(v) for k, v in payload.items()
    }

    existing = out.get("taint_labels", ())
    if isinstance(existing, str):
        labels = [existing]
    elif isinstance(existing, (list, tuple)):
        labels = [str(x) for x in existing]
    else:
        labels = []
    if "UNTRUSTED_SOURCE" not in labels:
        labels.append("UNTRUSTED_SOURCE")
    out["taint_labels"] = tuple(labels)

    return out
