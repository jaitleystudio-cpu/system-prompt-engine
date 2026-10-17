"""Tests for SPE Ω Typed Budgets & Output Length Constraints."""

from spe_runtime.requirements.budgets import (
    SourceDocument,
    detect_budget_conflicts,
    format_compiled_length_requirement,
    normalize_unicode_digits,
    parse_flexible_number,
    parse_requested_answer_budget,
)


def test_source_document_custody():
    text = "alpha beta gamma delta"
    doc = SourceDocument.from_text(text, "src-1")
    assert doc.id == "src-1"
    assert doc.raw_text == text
    assert doc.word_count == 4
    assert len(doc.sha256) == 64


def test_parse_exact_words():
    res = parse_requested_answer_budget("exactly 20,000 words")
    assert res["status"] == "SUCCESS"
    b = res["budget"]
    assert b.mode == "exact"
    assert b.target == 20000
    assert b.unit == "words"
    formatted = format_compiled_length_requirement(b)
    assert "Exactly 20,000 words" in formatted


def test_parse_range_words():
    res = parse_requested_answer_budget("between 18,000 and 20,000 words")
    assert res["status"] == "SUCCESS"
    b = res["budget"]
    assert b.mode == "range"
    assert b.min == 18000
    assert b.max == 20000
    assert b.target == 20000


def test_unicode_digits_and_delimiters():
    assert normalize_unicode_digits("१२३") == "123"
    assert parse_flexible_number("20_000") == 20000.0
    assert parse_flexible_number("2e4") == 20000.0


def test_conflict_detection():
    stmts = ["exactly 20,000 words", "under 10,000 words"]
    conflict = detect_budget_conflicts(stmts)
    assert conflict["has_conflict"] is True
    assert "CONFLICT" in conflict["message"]


def test_infeasible_or_negative():
    res = parse_requested_answer_budget("-500 words")
    assert res["status"] == "INVALID"
