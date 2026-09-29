"""Canonical JSON and content digests for CODEVISION documents."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from spe_runtime.codevision.errors import CodevisionContractError


def canonical_json(value: Any) -> str:
    """UTF-8 canonical JSON: sorted keys, no insignificant whitespace."""
    try:
        return json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise CodevisionContractError("CANONICAL_REJECTED", str(exc)) from exc


def digest_json(value: Any) -> str:
    payload = canonical_json(value).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def thaw(value: Any) -> Any:
    """Copy frozen mappings and tuples into JSON-ready containers."""
    if isinstance(value, Mapping):
        return {str(key): thaw(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [thaw(item) for item in value]
    return value
