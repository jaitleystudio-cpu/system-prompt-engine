"""Deterministic digests for WebRecon observations.

Uses the existing SPE canonical JSON helper. The digest names bytes.
It does not grade them.
"""

from __future__ import annotations

import hashlib
from typing import Any

from spe_runtime.portability.canonical import canonical_dumps


def digest_json(value: Any) -> str:
    payload = canonical_dumps(value).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def digest_text(value: str) -> str:
    payload = value.encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()
