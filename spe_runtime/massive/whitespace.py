"""Whitespace and word starts. spe.massive.whitespace.v1."""

from __future__ import annotations

from spe_runtime.massive.constants import WHITESPACE_CODEPOINTS


def is_whitespace(ch: str) -> bool:
    return ord(ch) in WHITESPACE_CODEPOINTS


def count_word_starts(text: str, start_inside_word: bool) -> tuple[int, bool]:
    """Count word starts in text. A continuation of a split word is not a new word."""
    inside = start_inside_word
    count = 0
    for ch in text:
        if is_whitespace(ch):
            inside = False
        else:
            if not inside:
                count += 1
            inside = True
    return count, inside


def boundary_cuts(text: str, start_inside_word: bool) -> list[int]:
    """Indexes where a cut ends a word and does not begin the next one.

    The cut sits on the first whitespace that closes a word. That whitespace
    stays in the following slice so concatenation is exact.
    """
    inside = start_inside_word
    cuts: list[int] = []
    for i, ch in enumerate(text):
        if is_whitespace(ch):
            if inside:
                inside = False
                cuts.append(i)
        else:
            inside = True
    return cuts
