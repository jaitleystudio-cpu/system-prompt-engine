"""Test-only failpoints for crash injection. Disabled in normal runtime."""

from __future__ import annotations

import os
import signal
from contextlib import contextmanager
from typing import Iterator

# Process-local override (tests may also use env RING1_FAILPOINT)
_ACTIVE: str | None = None


def set_failpoint(name: str | None) -> None:
    global _ACTIVE
    _ACTIVE = name


def clear_failpoint() -> None:
    set_failpoint(None)


def active_failpoint() -> str | None:
    if _ACTIVE:
        return _ACTIVE
    return os.environ.get("RING1_FAILPOINT") or None


def check_failpoint(name: str) -> None:
    """If active failpoint matches, hard-kill this process (SIGKILL)."""
    if active_failpoint() == name:
        os.kill(os.getpid(), signal.SIGKILL)


@contextmanager
def failpoint(name: str) -> Iterator[None]:
    prev = _ACTIVE
    set_failpoint(name)
    try:
        yield
    finally:
        set_failpoint(prev)


__all__ = [
    "set_failpoint",
    "clear_failpoint",
    "active_failpoint",
    "check_failpoint",
    "failpoint",
]
