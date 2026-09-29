"""MassiveSourceIR + SourceMap. Custody complete is not a semantic pass."""

from __future__ import annotations

from typing import Any

from spe_runtime.massive.constants import IR_VERSION, SOURCE_MAP_VERSION, STATUSES
from spe_runtime.massive.errors import MassiveError
from spe_runtime.massive.hashing import chain_update


def is_semantic_pass(_ir: dict[str, Any] | None = None) -> bool:
    """Intake never reports semantic pass. F3E owns that judgment."""
    return False


def build_source_map(
    spans: list[dict[str, Any]],
    *,
    char_length: int,
    byte_length: int,
    word_count: int,
    source_sha256: str | None,
    coverage_override: str | None = None,
) -> dict[str, Any]:
    gaps: list[list[int]] = []
    overlaps: list[list[int]] = []
    cursor = 0
    byte_cursor = 0
    word_cursor = 0
    coordinate_mismatch = False
    chain: str | None = None
    for span in spans:
        start = int(span["char_start"])
        end = int(span["char_end"])
        b0 = int(span["byte_start"])
        b1 = int(span["byte_end"])
        w0 = int(span["word_start"])
        w1 = int(span["word_end"])
        if start > cursor:
            gaps.append([cursor, start])
        elif start < cursor:
            overlaps.append([start, cursor])
        if b0 != byte_cursor or w0 != word_cursor:
            coordinate_mismatch = True
        cursor = end
        byte_cursor = b1
        word_cursor = w1
        chain = chain_update(chain, str(span["sha256"]))
    if cursor < char_length:
        gaps.append([cursor, char_length])
    if cursor > char_length or byte_cursor != byte_length or word_cursor != word_count:
        coordinate_mismatch = True
    if coverage_override:
        coverage = coverage_override
    elif not spans and char_length == 0:
        coverage = "COMPLETE"
    elif not gaps and not overlaps and not coordinate_mismatch and cursor == char_length:
        coverage = "COMPLETE"
    else:
        coverage = "PARTIAL"
    return {
        "version": SOURCE_MAP_VERSION,
        "coverage": coverage,
        "source_sha256": source_sha256,
        "char_length": char_length,
        "byte_length": byte_length,
        "word_count": word_count,
        "chain_sha256": chain,
        "coordinate_mismatch": coordinate_mismatch,
        "spans": spans,
        "gaps": gaps,
        "overlaps": overlaps,
    }


def memory_block(
    *,
    max_resident_chars: int,
    peak_pending_chars: int,
    pressure_events: list[dict[str, Any]],
    spilled_chunks: int,
) -> dict[str, Any]:
    return {
        "max_resident_chars": max_resident_chars,
        "peak_pending_chars": peak_pending_chars,
        "pressure_events": pressure_events,
        "spilled_chunks": spilled_chunks,
    }


def freeze_ir(ir: dict[str, Any]) -> dict[str, Any]:
    status = ir.get("status")
    if status == "PASS" or ir.get("semantic_judgment") == "PASS":
        raise MassiveError("PASS_FORBIDDEN", "intake must not report PASS")
    if status not in STATUSES:
        raise MassiveError("BAD_STATUS", "status is outside the intake vocabulary")
    if ir.get("semantic_judgment") != "NOT_A_PASS":
        raise MassiveError("PASS_FORBIDDEN", "semantic judgment must stay NOT_A_PASS")
    if ir.get("semantic_engine") != "NOT_INTEGRATED":
        raise MassiveError("INTEGRATION_FORBIDDEN", "semantic engine is not integrated")
    if ir.get("waits_for") != "F3E_FREEZE":
        raise MassiveError("INTEGRATION_FORBIDDEN", "integration waits for F3E freeze")
    if ir.get("silent_truncation") is not False:
        raise MassiveError("SILENT_TRUNCATION", "silent truncation is forbidden")
    if ir.get("ir_version") != IR_VERSION:
        raise MassiveError("BAD_VERSION", "unexpected IR version")
    if status == "READY_FOR_F3E":
        source_map = ir["source_map"]
        if source_map.get("coverage") != "COMPLETE":
            raise MassiveError("MAP_INCOMPLETE", "READY_FOR_F3E requires a complete source map")
        if ir.get("intake_complete") is not True or ir.get("accepted_lossless") is not True:
            raise MassiveError("NOT_LOSSLESS", "READY_FOR_F3E requires lossless accepted text")
        if ir.get("stored_body") is not True:
            raise MassiveError("NOT_LOSSLESS", "READY_FOR_F3E requires a stored body")
        if ir.get("truncation_applied") is not False:
            raise MassiveError("SILENT_TRUNCATION", "READY_FOR_F3E cannot apply truncation")
        if int(ir["word_count"]) > int(ir["word_cap"]):
            raise MassiveError("WORD_BUDGET_EXCEEDED", "ready IR exceeds the word cap")
    return ir


def base_ir(
    *,
    session_id: str,
    status: str,
    word_cap: int,
    attempted_word_count: int,
    attempted_char_count: int,
    attempted_sha256: str,
    memory: dict[str, Any],
) -> dict[str, Any]:
    return {
        "ir_version": IR_VERSION,
        "session_id": session_id,
        "status": status,
        "semantic_engine": "NOT_INTEGRATED",
        "semantic_judgment": "NOT_A_PASS",
        "waits_for": "F3E_FREEZE",
        "silent_truncation": False,
        "truncation_applied": False,
        "word_cap": word_cap,
        "attempted_word_count": attempted_word_count,
        "attempted_char_count": attempted_char_count,
        "attempted_sha256": attempted_sha256,
        "memory": memory,
    }
