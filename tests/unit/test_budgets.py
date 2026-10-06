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
    # Forward and reverse orders
    assert detect_budget_conflicts(["exactly 20,000 words", "under 10,000 words"])["has_conflict"] is True
    assert detect_budget_conflicts(["under 10,000 words", "exactly 20,000 words"])["has_conflict"] is True
    assert detect_budget_conflicts(["at least 20,000 words", "no more than 10,000 words"])["has_conflict"] is True
    assert detect_budget_conflicts(["no more than 10,000 words", "at least 20,000 words"])["has_conflict"] is True

    # Disjoint ranges
    assert detect_budget_conflicts(["between 1,000 and 2,000 words", "between 3,000 and 4,000 words"])["has_conflict"] is True
    assert detect_budget_conflicts(["between 3,000 and 4,000 words", "between 1,000 and 2,000 words"])["has_conflict"] is True

    # Range vs min/max
    assert detect_budget_conflicts(["under 2,000 words", "between 5,000 and 10,000 words"])["has_conflict"] is True
    assert detect_budget_conflicts(["between 5,000 and 10,000 words", "under 2,000 words"])["has_conflict"] is True


def test_infeasible_or_negative():
    assert parse_requested_answer_budget("-500 words")["status"] == "INVALID"
    assert parse_requested_answer_budget("between 30,000 and 20,000 words")["status"] == "CONFLICT"
    assert parse_requested_answer_budget("20,000 florbos")["status"] == "INVALID"
    assert parse_requested_answer_budget("1500 unknown_unit")["status"] == "INVALID"


def test_decimal_and_zero_words():
    k_res = parse_requested_answer_budget("1.5k words")
    assert k_res["status"] == "SUCCESS"
    assert k_res["budget"].target == 1500

    dec_res = parse_requested_answer_budget("1500.5 words")
    assert dec_res["status"] == "SUCCESS"
    assert dec_res["budget"].target == 1501

    zero_res = parse_requested_answer_budget("0 words")
    assert zero_res["status"] == "SUCCESS"
    assert zero_res["budget"].target == 0
