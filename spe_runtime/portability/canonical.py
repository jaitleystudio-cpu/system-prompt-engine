"""Deterministic portable JSON canonicalization.

UTF-8 text (NFC), stable key order, stable enums, tuples→lists (no Python leaks),
ISO-8601 times normalized to UTC Z. Number types distinguished via strict_equal.
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from enum import Enum
from typing import Any


_ISO_OFFSET = re.compile(
    r"^(?P<body>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)"
    r"(?P<off>Z|[+-]\d{2}:\d{2})$"
)


def _normalize_str(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    m = _ISO_OFFSET.match(s)
    if not m:
        return s
    body, off = m.group("body"), m.group("off")
    try:
        if off == "Z":
            dt = datetime.fromisoformat(body).replace(tzinfo=timezone.utc)
        else:
            dt = datetime.fromisoformat(body + off).astimezone(timezone.utc)
        micro = dt.microsecond
        if micro:
            frac = f".{micro:06d}".rstrip("0")
        else:
            frac = ""
        return f"{dt.strftime('%Y-%m-%dT%H:%M:%S')}{frac}Z"
    except ValueError:
        return s


def canonicalize(value: Any) -> Any:
    """Return a JSON-portable structure (dict/list/scalars only)."""
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): canonicalize(value[k]) for k in sorted(value.keys(), key=str)}
    if isinstance(value, (list, tuple)):
        return [canonicalize(v) for v in value]
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError("non-finite float not portable")
        return value
    if isinstance(value, str):
        return _normalize_str(value)
    if value is None:
        return None
    raise TypeError(f"non-portable type for canonicalization: {type(value)!r}")


def canonical_dumps(value: Any) -> str:
    """Deterministic JSON string (UTF-8 NFC, sorted keys, compact)."""
    return json.dumps(
        canonicalize(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def canonical_loads(text: str) -> Any:
    return json.loads(text)


def strict_equal(a: Any, b: Any) -> bool:
    """Equality that does not collapse int↔float or bool↔int."""
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(strict_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(strict_equal(x, y) for x, y in zip(a, b))
    if type(a) is not type(b):
        return False
    return a == b
