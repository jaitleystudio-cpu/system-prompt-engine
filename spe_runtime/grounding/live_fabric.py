"""Live scholarly fabric capability mirrors for grounding.

LIVE_INDEX / LIVE_RETRACTION stay HOLD until live mutants are killed with evidence.
Adapters may exist without promoting these gates.
"""

from __future__ import annotations

from typing import Final

LIVE_INDEX: Final[str] = "HOLD"
LIVE_RETRACTION: Final[str] = "HOLD"
FULL_SCHOLARLY_INDEX: Final[str] = "NO"
LIVE_RETRACTION_VERIFICATION: Final[str] = "NO"

ADAPTERS_IMPLEMENTED: Final[tuple[str, ...]] = (
    "OPENALEX",
    "CROSSREF",
    "PUBMED",
    "PMC",
    "ARXIV",
)


def may_promote_live_index() -> bool:
    return False


def may_promote_live_retraction() -> bool:
    return False
