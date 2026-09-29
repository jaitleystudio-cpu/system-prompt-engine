"""Lane B intake: custody, source map, explicit evidence. Not a semantic pass."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.massive.chunking import next_chunk_end
from spe_runtime.massive.constants import STATUSES, WORD_CAP
from spe_runtime.massive.errors import MassiveError
from spe_runtime.massive.evidence import scan_explicit_evidence
from spe_runtime.massive.hashing import sha256_text
from spe_runtime.massive.ir import freeze_ir, is_semantic_pass
from spe_runtime.massive.session import open_session, resume_session
from spe_runtime.massive.whitespace import count_word_starts, is_whitespace

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "schemas" / "massive_source_ir.schema.json"


def _open(tmp_path: Path, session_id: str = "sess-0001", **kwargs):
    return open_session(tmp_path, session_id, **kwargs)


def _rebuild(session) -> str:
    body = []
    for meta in session.chunk_metas:
        blob = session.custody.read_blob(session.session_id, meta["rel"])
        assert blob is not None
        body.append(blob)
    return b"".join(body).decode("utf-8")


def test_whitespace_matches_python_split() -> None:
    sample = "a\u00a0b\u2003c\n\td  e\u2028f\u3000g"
    assert is_whitespace("\u00a0")
    assert not is_whitespace("\u180e")
    assert not is_whitespace("\ufeff")
    words = [part for part in sample.split() if part]
    count, inside = count_word_starts(sample, False)
    assert count == len(words)
    assert inside == (not sample[-1].isspace())


def test_empty_seal_is_ready_and_not_a_pass(tmp_path: Path) -> None:
    session = _open(tmp_path)
    ir = session.seal()
    assert ir["status"] == "READY_FOR_F3E"
    assert ir["word_count"] == 0
    assert ir["evidence_status"] == "ABSENT"
    assert ir["semantic_judgment"] == "NOT_A_PASS"
    assert ir["semantic_engine"] == "NOT_INTEGRATED"
    assert ir["waits_for"] == "F3E_FREEZE"
    assert ir["silent_truncation"] is False
    assert ir["source_map"]["coverage"] == "COMPLETE"
    assert is_semantic_pass(ir) is False
    assert "PASS" not in STATUSES
    again = session.seal()
    assert again == ir


def test_lossless_unicode_and_source_map(tmp_path: Path) -> None:
    text = "keep\u00a0this\nline intact — preserve\tspacing"
    session = _open(tmp_path, target_chars=8, hard_chars=16, max_resident_chars=16, word_cap=20)
    ack = session.append(text)
    assert ack["silent_truncation"] is False
    assert ack["rejected_char_count"] == 0
    ir = session.seal()
    assert ir["status"] == "READY_FOR_F3E"
    assert _rebuild(session) == text
    assert ir["source_sha256"] == sha256_text(text)
    assert ir["word_count"] == len(text.split())
    spans = ir["source_map"]["spans"]
    assert spans
    assert spans[0]["char_start"] == 0
    for prev, span in zip(spans, spans[1:]):
        assert prev["char_end"] == span["char_start"]
        assert prev["byte_end"] == span["byte_start"]
    assert spans[-1]["char_end"] == len(text)
    assert ir["source_map"]["gaps"] == []
    assert ir["source_map"]["overlaps"] == []
    index = session.custody.read_json(session.session_id, "index.json")
    assert index is not None
    assert text not in json.dumps(index)
    for meta, span in zip(index["chunks"], spans):
        public = {key: meta[key] for key in span}
        assert public == span


def test_long_word_splits_on_characters(tmp_path: Path) -> None:
    word = "abcdefghij"
    end = next_chunk_end(word, target=4, hard=8, seal=True, start_inside_word=False)
    assert end == 8
    session = _open(tmp_path, target_chars=4, hard_chars=8, max_resident_chars=8, word_cap=5)
    session.append(word)
    ir = session.seal()
    assert ir["status"] == "READY_FOR_F3E"
    assert _rebuild(session) == word
    assert any(span["split_inside_word"] for span in ir["source_map"]["spans"])
    assert ir["word_count"] == 1


def test_exact_cap_ready_and_one_over_discards_body(tmp_path: Path) -> None:
    session = _open(tmp_path, target_chars=16, hard_chars=32, max_resident_chars=32, word_cap=3)
    session.append("one two three")
    ir = session.seal()
    assert ir["status"] == "READY_FOR_F3E"
    assert ir["word_count"] == 3
    assert ir["stored_body"] is True

    over = _open(tmp_path, "sess-over1", target_chars=16, hard_chars=32, max_resident_chars=32, word_cap=3)
    over.append("one two three")
    ack = over.append(" four")
    assert ack["status"] == "REFUSED_IN_PROGRESS"
    assert ack["stored_body"] is False
    assert ack["silent_truncation"] is False
    refused = over.seal()
    assert refused["status"] == "REFUSED"
    assert refused["loss_kind"] == "REFUSED_OVER_BUDGET_BODY_DISCARDED"
    assert refused["stored_body"] is False
    assert refused["word_count"] == 0
    assert refused["attempted_word_count"] == 4
    assert refused["attempted_sha256_status"] == "KNOWN"
    assert refused["attempted_sha256"] == sha256_text("one two three four")
    assert refused["source_sha256"] is None
    assert refused["evidence_status"] == "NOT_SCANNED"
    assert is_semantic_pass(refused) is False
    assert over.custody.blob_count(over.session_id) == 0


def test_resume_matches_oneshot_and_torn_tail_is_ignored(tmp_path: Path) -> None:
    text = "alpha beta gamma delta epsilon"
    first = _open(tmp_path, target_chars=8, hard_chars=12, max_resident_chars=12, word_cap=20)
    first.append(text)
    ir = first.seal()
    resumed = resume_session(tmp_path, "sess-0001")
    assert resumed.seal()["source_sha256"] == ir["source_sha256"]

    live = _open(tmp_path, "sess-live1", target_chars=8, hard_chars=12, max_resident_chars=12, word_cap=20)
    live.append("alpha beta")
    journal = live.custody.session_dir(live.session_id) / "journal.jsonl"
    with journal.open("a", encoding="utf-8") as handle:
        handle.write('{"kind":"COMMIT","torn":')
    resumed_live = resume_session(tmp_path, "sess-live1")
    assert resumed_live.status == "INCOMPLETE"
    resumed_live.append(" gamma")
    sealed = resumed_live.seal()
    assert sealed["status"] == "READY_FOR_F3E"
    assert _rebuild(resumed_live) == "alpha beta gamma"


def test_missing_or_corrupt_blob_is_mismatch(tmp_path: Path) -> None:
    session = _open(tmp_path, target_chars=4, hard_chars=8, max_resident_chars=8, word_cap=10)
    session.append("alpha beta gamma")
    chunk = next(session.custody.session_dir("sess-0001").glob("blobs/chunks/*"))
    chunk.unlink()
    broken = resume_session(tmp_path, "sess-0001")
    assert broken.status == "CUSTODY_MISMATCH"
    mismatch = broken.seal()
    assert mismatch["status"] == "CUSTODY_MISMATCH"
    assert mismatch["status"] != "READY_FOR_F3E"
    assert is_semantic_pass(mismatch) is False

    other = _open(tmp_path, "sess-flip1", target_chars=4, hard_chars=8, max_resident_chars=8, word_cap=10)
    other.append("alpha beta")
    flipped = next(other.custody.session_dir("sess-flip1").glob("blobs/chunks/*"))
    raw = bytearray(flipped.read_bytes())
    raw[0] ^= 0x01
    flipped.write_bytes(raw)
    resumed = resume_session(tmp_path, "sess-flip1")
    assert resumed.status == "CUSTODY_MISMATCH"


def test_memory_pressure_halts_without_silent_loss(tmp_path: Path) -> None:
    def pressure(resident: int) -> bool:
        return resident <= 6

    session = _open(
        tmp_path,
        target_chars=4,
        hard_chars=8,
        max_resident_chars=8,
        word_cap=10,
        pressure=pressure,
    )
    ack = session.append("hello world")
    assert ack["status"] == "MEMORY_PRESSURE_HALTED"
    assert ack["rejected_char_count"] == len("hello world")
    assert ack["silent_truncation"] is False
    more = session.append("more")
    assert more["rejected_char_count"] == 4
    assert more["status"] == "MEMORY_PRESSURE_HALTED"
    ir = session.seal()
    assert ir["status"] == "MEMORY_PRESSURE_HALTED"
    assert ir["intake_complete"] is False
    assert ir["prefix_only"] is True
    assert ir["accepted_lossless"] is True
    assert ir["loss_disclosed"] is True
    assert ir["semantic_judgment"] == "NOT_A_PASS"
    assert session.peak_pending_chars <= session.max_resident_chars


def test_persist_failure_does_not_advance_durable_end(tmp_path: Path) -> None:
    session = _open(tmp_path, target_chars=8, hard_chars=16, max_resident_chars=16, word_cap=10)
    before = session.status_view()["durable_char_end"]

    def boom(*_args, **_kwargs):
        raise OSError("disk full")

    session.custody.write_blob = boom  # type: ignore[method-assign]
    with pytest.raises(MassiveError) as caught:
        session.append("hello world")
    assert caught.value.code == "PERSIST_FAILED"
    assert session.status == "INCOMPLETE"
    assert session.status_view()["durable_char_end"] == before
    assert session.pending == ""


def test_resume_then_extra_append_marks_sha_unknown(tmp_path: Path) -> None:
    session = _open(tmp_path, target_chars=32, hard_chars=64, max_resident_chars=64, word_cap=2)
    session.append("one two")
    ack = session.append(" three")
    assert ack["status"] == "REFUSED_IN_PROGRESS"
    assert session.attempted_sha256_status == "KNOWN"
    resumed = resume_session(tmp_path, "sess-0001")
    assert resumed.status == "REFUSED_IN_PROGRESS"
    resumed.append(" four")
    again = resumed.seal()
    assert again["attempted_word_count"] == 4
    assert again["attempted_sha256_status"] == "UNKNOWN"
    assert again["attempted_sha256"] is None
    assert again["semantic_judgment"] == "NOT_A_PASS"


def test_bad_session_id_and_pass_status_rejected(tmp_path: Path) -> None:
    with pytest.raises(MassiveError) as caught:
        open_session(tmp_path, "short")
    assert caught.value.code == "INVALID_SESSION_ID"
    ir = _open(tmp_path).seal()
    ir["status"] = "PASS"
    with pytest.raises(MassiveError) as caught:
        freeze_ir(ir)
    assert caught.value.code == "PASS_FORBIDDEN"


def test_explicit_evidence_rules_and_skipped_lines() -> None:
    text = "\n".join(
        [
            "You must keep the source.",
            "You must not drop words.",
            'Please "include the original wording" here.',
            "constraint: retain every character",
            "hello",
            "a" * 80,
        ]
    )
    scanned = scan_explicit_evidence([(0, text)], line_max=64)
    rules = [item["rule"] for item in scanned["explicit_evidence"]]
    assert "EXPLICIT_MUST_NOT" in rules
    assert "EXPLICIT_MUST" in rules
    assert "QUOTED_DIRECTIVE" in rules
    assert "LABELED_CONSTRAINT" in rules
    assert scanned["evidence_scan_status"] == "PARTIAL"
    assert scanned["evidence_lines_skipped"] >= 1
    absent = scan_explicit_evidence([(0, "just a note\n")])
    assert absent["evidence_status"] == "ABSENT"
    assert absent["evidence_scan_status"] == "COMPLETE"
    unclosed = scan_explicit_evidence([(0, 'say "include this without a close\n')])
    assert all(item["rule"] != "QUOTED_DIRECTIVE" for item in unclosed["explicit_evidence"])
    skipped_only = scan_explicit_evidence([(0, "x" * 20)], line_max=8)
    assert skipped_only["evidence_status"] == "NOT_SCANNED"
    assert skipped_only["evidence_scan_status"] == "PARTIAL"


def test_lane_sources_do_not_import_forbidden_packages() -> None:
    root = ROOT / "spe_runtime" / "massive"
    banned = ("spe_runtime.xcat", "spe_runtime.k3", "spe_runtime.quality", "PromptEffectPlan")
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in text


def test_frozen_vectors_match_oracle(tmp_path: Path) -> None:
    vectors = json.loads((ROOT / "data" / "massive" / "vectors.json").read_text(encoding="utf-8"))
    assert sha256_text("abc") == vectors["sha256"]["abc"]
    for row in vectors["chunks"]:
        end = next_chunk_end(
            row["text"],
            target=row["target"],
            hard=row["hard"],
            seal=row["seal"],
            start_inside_word=row["start_inside_word"],
        )
        assert end == row["end"]
    for row in vectors["sessions"]:
        session = open_session(
            tmp_path,
            row["id"],
            word_cap=row["word_cap"],
            target_chars=row["target"],
            hard_chars=row["hard"],
            max_resident_chars=row["max"],
        )
        for part in row["parts"]:
            session.append(part)
        ir = session.seal()
        expect = row["expect"]
        assert ir["status"] == expect["status"]
        assert ir["status"] != "PASS"
        assert ir["semantic_judgment"] == "NOT_A_PASS"
        assert ir["silent_truncation"] is False
        assert ir["word_count"] == expect["word_count"]
        assert ir["source_sha256"] == expect["source_sha256"]
        assert ir["attempted_sha256"] == expect["attempted_sha256"]
        assert is_semantic_pass(ir) is False


def test_schema_accepts_ready_and_rejects_pass(tmp_path: Path) -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    ir = _open(tmp_path, word_cap=5).seal()
    jsonschema.validate(ir, schema)
    ir["status"] = "PASS"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(ir, schema)


def test_million_word_cap_boundary(tmp_path: Path) -> None:
    ready = _open(tmp_path, "sess-capok")
    hasher = hashlib.sha256()
    batch = ("w " * 20_000)
    remaining = WORD_CAP
    while remaining:
        take = min(20_000, remaining)
        piece = batch if take == 20_000 else ("w " * take)
        hasher.update(piece.encode("utf-8"))
        ack = ready.append(piece)
        assert ack["status"] == "INCOMPLETE"
        assert ack["rejected_char_count"] == 0
        assert ack["silent_truncation"] is False
        remaining -= take
    ir = ready.seal()
    assert ir["status"] == "READY_FOR_F3E"
    assert ir["word_count"] == WORD_CAP
    assert ir["source_sha256"] == hasher.hexdigest()
    assert ir["silent_truncation"] is False
    assert ir["source_map"]["coverage"] == "COMPLETE"
    assert is_semantic_pass(ir) is False
    assert ready.peak_pending_chars <= ready.max_resident_chars

    refused = _open(tmp_path, "sess-capno")
    refused.append("w " * WORD_CAP)
    ack = refused.append("extra")
    assert ack["status"] == "REFUSED_IN_PROGRESS"
    sealed = refused.seal()
    assert sealed["status"] == "REFUSED"
    assert sealed["attempted_word_count"] == WORD_CAP + 1
    assert sealed["stored_body"] is False
    assert sealed["silent_truncation"] is False
    assert refused.custody.blob_count(refused.session_id) == 0
