"""Literal explicit-evidence scan.

Rules match closed lexical patterns and keep the exact source slice.
They are not XCAT categories and they are not a semantic judgment.
A line that is too long to scan is skipped and disclosed. It is not trimmed
into a match. Unclosed quotes are not evidence.
"""

from __future__ import annotations

import re
from typing import Iterable

from spe_runtime.massive.constants import EVIDENCE_LINE_MAX
from spe_runtime.massive.hashing import sha256_text

_MUST_NOT = re.compile(
    r"\b(?:must not|shall not|do not|don't|never)\b",
    re.IGNORECASE,
)
_MUST = re.compile(r"\b(?:must|shall|required)\b", re.IGNORECASE)
_LABELED = re.compile(
    r"^(?:constraint|requirement|rule)\s*[:\-]\s*\S",
    re.IGNORECASE,
)
_QUOTE = re.compile(r'"([^"\n]{12,400})"')
_IMPERATIVE = re.compile(
    r"\b(?:must|shall|do not|don't|include|exclude|return|preserve|avoid|never)\b",
    re.IGNORECASE,
)

_PRIORITY = {
    "EXPLICIT_MUST_NOT": 4,
    "LABELED_CONSTRAINT": 3,
    "QUOTED_DIRECTIVE": 2,
    "EXPLICIT_MUST": 1,
}


def scan_explicit_evidence(
    chunks: Iterable[tuple[int, str]],
    *,
    line_max: int = EVIDENCE_LINE_MAX,
) -> dict[str, object]:
    """Scan chunk texts in order. `chunks` yields (chunk_index, text)."""
    items: list[dict[str, object]] = []
    skipped = 0
    abs_base = 0
    carry = ""
    carry_start = 0
    skipping = False

    def flush_line(line: str, start: int) -> None:
        nonlocal skipped
        if skipping:
            return
        if len(line) > line_max:
            skipped += 1
            return
        items.extend(_line_candidates(line, start))

    for _index, text in chunks:
        i = 0
        while i < len(text):
            nl = text.find("\n", i)
            if nl < 0:
                piece = text[i:]
                if skipping:
                    i = len(text)
                    break
                if not carry:
                    carry_start = abs_base + i
                carry += piece
                if len(carry) > line_max:
                    skipped += 1
                    carry = ""
                    skipping = True
                i = len(text)
                break
            piece = text[i:nl]
            if skipping:
                skipping = False
            else:
                if not carry:
                    carry_start = abs_base + i
                carry += piece
                flush_line(carry, carry_start)
                carry = ""
            i = nl + 1
        abs_base += len(text)

    if skipping:
        skipping = False
    elif carry:
        flush_line(carry, carry_start)

    chosen = _resolve_overlaps(items)
    for n, item in enumerate(chosen, start=1):
        item["evidence_id"] = f"E{n:04d}"
    if skipped and not chosen:
        evidence_status = "NOT_SCANNED"
        scan_status = "PARTIAL"
    elif skipped:
        evidence_status = "PRESENT"
        scan_status = "PARTIAL"
    elif chosen:
        evidence_status = "PRESENT"
        scan_status = "COMPLETE"
    else:
        evidence_status = "ABSENT"
        scan_status = "COMPLETE"
    return {
        "explicit_evidence": chosen,
        "evidence_status": evidence_status,
        "evidence_scan_status": scan_status,
        "evidence_lines_skipped": skipped,
    }


def _line_candidates(line: str, start: int) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    if _MUST_NOT.search(line):
        found.append(_span("EXPLICIT_MUST_NOT", line, start, 0, len(line)))
    elif _MUST.search(line):
        found.append(_span("EXPLICIT_MUST", line, start, 0, len(line)))
    if _LABELED.search(line):
        found.append(_span("LABELED_CONSTRAINT", line, start, 0, len(line)))
    for match in _QUOTE.finditer(line):
        inner = match.group(1)
        if _IMPERATIVE.search(inner):
            found.append(
                _span(
                    "QUOTED_DIRECTIVE",
                    line,
                    start,
                    match.start(),
                    match.end(),
                )
            )
    return found


def _span(rule: str, line: str, line_start: int, rel_start: int, rel_end: int) -> dict[str, object]:
    text = line[rel_start:rel_end]
    return {
        "rule": rule,
        "char_start": line_start + rel_start,
        "char_end": line_start + rel_end,
        "text": text,
        "text_sha256": sha256_text(text),
        "priority": _PRIORITY[rule],
    }


def _resolve_overlaps(items: list[dict[str, object]]) -> list[dict[str, object]]:
    ordered = sorted(
        items,
        key=lambda item: (
            int(item["char_start"]),
            -int(item["priority"]),
            -(int(item["char_end"]) - int(item["char_start"])),
            str(item["rule"]),
        ),
    )
    chosen: list[dict[str, object]] = []
    for item in ordered:
        start = int(item["char_start"])
        end = int(item["char_end"])
        if any(start < int(prev["char_end"]) and end > int(prev["char_start"]) for prev in chosen):
            continue
        kept = {
            "rule": item["rule"],
            "char_start": start,
            "char_end": end,
            "text": item["text"],
            "text_sha256": item["text_sha256"],
        }
        chosen.append(kept)
    chosen.sort(key=lambda item: (int(item["char_start"]), str(item["rule"])))
    return chosen


def attach_chunk_indexes(
    evidence: list[dict[str, object]],
    spans: list[dict[str, object]],
) -> None:
    for item in evidence:
        start = int(item["char_start"])
        chunk_index = None
        for span in spans:
            if int(span["char_start"]) <= start < int(span["char_end"]):
                chunk_index = int(span["index"])
                break
        if chunk_index is None and spans and start == int(spans[-1]["char_end"]):
            chunk_index = int(spans[-1]["index"])
        item["chunk_index"] = chunk_index
