"""Deterministic portable JSON canonicalization.

UTF-8 text, stable key order, stable enums, tuples→lists (no Python leaks).
"""

from __future__ import annotations

import json
from enum import Enum
from typing import Any


def canonicalize(value: Any) -> Any:
    """Return a JSON-portable structure (dict/list/scalars only)."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): canonicalize(value[k]) for k in sorted(value.keys(), key=str)}
    if isinstance(value, (list, tuple)):
        return [canonicalize(v) for v in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    # Refuse silent leakage of arbitrary objects
    raise TypeError(f"non-portable type for canonicalization: {type(value)!r}")


def canonical_dumps(value: Any) -> str:
    """Deterministic JSON string (UTF-8 code points, sorted keys, compact)."""
    return json.dumps(
        canonicalize(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def canonical_loads(text: str) -> Any:
    return json.loads(text)
