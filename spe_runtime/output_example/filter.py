"""Remove instance details that rode along inside an example.

Names, amounts, dates, addresses, and JSON values are not the pattern.
"""

from __future__ import annotations

import re
from dataclasses import replace

from spe_runtime.output_example.models import ExtractedCue, FilteredPatterns

_MONEY = re.compile(r"(?:\$\s?\d|₹\s?\d)")
_DATE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
_URL = re.compile(r"\bhttps?://\S+", re.I)
_PERCENT = re.compile(r"\b\d+(?:\.\d+)?%")
_PROPER = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b")


def value_is_accidental(value: str) -> bool:
    return any(
        pattern.search(value)
        for pattern in (_MONEY, _DATE, _EMAIL, _URL, _PERCENT, _PROPER)
    )


def filter_accidental_details(cues: tuple[ExtractedCue, ...]) -> FilteredPatterns:
    """Split extraction cues into pattern clauses and dropped instance details."""
    kept: list[ExtractedCue] = []
    dropped: list[ExtractedCue] = []
    for cue in cues:
        if cue.accidental or cue.dimension == "accidental_detail" or value_is_accidental(cue.value):
            dropped.append(replace(cue, accidental=True))
            continue
        kept.append(cue)
    return FilteredPatterns(kept=tuple(kept), dropped=tuple(dropped))
