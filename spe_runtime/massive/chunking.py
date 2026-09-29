"""Streaming chunker. Slices the original string; never rebuilds it from tokens."""

from __future__ import annotations

from spe_runtime.massive.whitespace import boundary_cuts


def next_chunk_end(
    text: str,
    *,
    target: int,
    hard: int,
    seal: bool,
    start_inside_word: bool,
) -> int | None:
    """Exclusive end index of the next chunk, or None to keep the buffer.

    A cut is either a word boundary or, when a single word is longer than
    `hard`, an exact character split. Both cuts are lossless.
    """
    n = len(text)
    if n == 0:
        return None
    if target < 1 or hard < 1 or hard < target:
        raise ValueError("chunk bounds require 1 <= target <= hard")
    if seal and n <= hard:
        return n
    if not seal and n <= target:
        return None

    cuts = boundary_cuts(text, start_inside_word)
    under_target = [c for c in cuts if 0 < c <= target]
    if under_target and (n > target or seal):
        return under_target[-1]

    under_hard = [c for c in cuts if 0 < c <= hard]
    if under_hard and (n > target or seal):
        return under_hard[-1]

    if n >= hard or (seal and n > hard):
        return min(hard, n)
    if seal:
        return n
    return None
