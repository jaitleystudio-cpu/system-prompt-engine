"""
Unit and Adversarial Tests for WDIC-VCT (Verified Continuation Transactions).
Part of SPE Ω Research Quarantine.

Tests:
1. Regex / AST parsing of raw agent reports.
2. Anti-Omission Law: 126 passing tests cannot verify an untested requirement (R-17).
3. 6-Clause Next Task Contract compilation directly from the Proof Deficit.
4. Scope boundary enforcement (prohibited files trigger CONTRADICTED).
5. Regression detection (failing tests trigger repair priority).
6. Zero-subscription economics: T0 Deterministic tier, $0 cost, 4200+ tokens saved.
"""

import pytest
from spe_runtime.research.wdic_vct.types import ClaimStatus
from spe_runtime.research.wdic_vct.continuation_engine import WDICContinuationEngine


@pytest.fixture
def engine():
    return WDICContinuationEngine()


def test_parse_agent_report_text(engine):
    """
    Verifies that raw text from an agent like Gilden or Cursor is parsed as claims, not proof.
    """
    raw = (
        "TASK: Implement secure session recovery.\n"
        "RESULT: Implementation completed.\n"
        "TESTS: 126 passed. 3 skipped. 0 failed.\n"
        "FILES: session.py recovery.py test_recovery.py\n"
        "COMMIT: 4f8a9b2c\n"
    )
    report = engine.parse_report_text(raw)
    assert report.tests_passed == 126
    assert report.tests_failed == 0
    assert report.tests_skipped == 3
    assert report.files_modified == ["session.py", "recovery.py", "test_recovery.py"]
    assert report.commit_sha == "4f8a9b2c"
    assert "completed" in report.summary.lower()


def test_anti_omission_catches_untested_requirement(engine):
    """
    The exact scenario from the paper:
    Agent implements session recovery and passes 126 tests.
    Report covers R-01 (serialization), but omits R-17 (stale fencing token rejection).
    SPE must identify BOTH as UNVERIFIED: reported passing tests are not receipts.
    """
    raw_report = (
        "TASK: Implement secure session recovery.\n"
        "RESULT: Implementation completed successfully.\n"
        "TESTS: 126 passed. 0 failed. 0 skipped.\n"
        "FILES: session.py recovery.py test_recovery.py\n"
        "R-01 Session Serialization: passed with full test coverage.\n"
    )

    requirements = [
        "R-01",  # Mentioned and passed
        "R-17"   # Stale token rejection - completely omitted!
    ]

    summary = engine.review_and_continue(
        raw_report=raw_report,
        required_requirements=requirements,
        current_commit="commit-abc1234"
    )

    # 1. Untrusted report text is not an independently executed test.
    assert summary.verified_count == 0
    assert summary.unverified_count == 2
    assert summary.verdict == "DEFICIT_DETECTED"
    assert set(summary.deficit.open_requirements) == {"R-01", "R-17"}

    # 2. Next Task Contract must request evidence for the first open requirement.
    assert summary.next_contract is not None
    assert "R-01" in summary.next_contract.task_title
    assert "R-01" in summary.next_contract.objective
    assert summary.next_contract.baseline_ref == "commit-abc1234"
    assert len(summary.next_contract.execution_steps) >= 3

    # 3. Formatted markdown output must contain the 6 clauses
    md = summary.next_contract.to_markdown()
    assert "```spe-task" in md
    assert "BASELINE:" in md
    assert "OBJECTIVE:" in md
    assert "SCOPE:" in md
    assert "EXECUTION PLAN:" in md
    assert "ACCEPTANCE CRITERIA:" in md
    assert "STOP BOUNDARIES:" in md

    # 4. Economics: $0 cost, 4200 tokens saved
    assert summary.tier_used == "T0_DETERMINISTIC"
    assert summary.cost_nano_usd == 0
    assert summary.estimated_savings_tokens >= 4000
    assert summary.estimated_savings_usd > 0.0


def test_scope_violation_prohibited_files(engine):
    """
    Verifies that modifying prohibited files (e.g. .env or prod secrets)
    triggers immediate CONTRADICTED status.
    """
    raw_report = (
        "RESULT: Updated API keys.\n"
        "TESTS: 10 passed. 0 failed.\n"
        "FILES: session.py .env\n"
    )

    summary = engine.review_and_continue(
        raw_report=raw_report,
        required_requirements=["R-01"],
        prohibited_files=[".env", "secrets.json"]
    )

    assert summary.verdict == "BLOCKED_CONTRADICTION"
    assert summary.contradicted_count >= 1
    assert summary.next_contract is not None
    assert "Repair Contradiction" in summary.next_contract.task_title


def test_failing_tests_trigger_repair_priority(engine):
    """
    If tests failed in the report, the next task must be to repair the failure,
    not to build new features.
    """
    raw_report = (
        "RESULT: Partial implementation.\n"
        "TESTS: 45 passed. 2 failed.\n"
        "FILES: recovery.py\n"
    )

    summary = engine.review_and_continue(
        raw_report=raw_report,
        required_requirements=["R-01", "R-02"]
    )

    assert summary.verdict == "BLOCKED_CONTRADICTION"
    assert "TEST_REGRESSION" in summary.deficit.contradicted_requirements
    assert summary.next_contract is not None
    assert "Repair Contradiction: TEST_REGRESSION" in summary.next_contract.task_title


def test_all_requirements_claimed_passed_still_unverified_without_receipt(engine):
    """
    Even when a report says every required test passed, no execution receipt
    exists in this research reviewer; QUALIFIED must not be fabricated.
    """
    raw_report = (
        "RESULT: All requirements implemented.\n"
        "TESTS: 150 passed. 0 failed.\n"
        "FILES: session.py recovery.py\n"
        "R-01 passed and asserted.\n"
        "R-02 passed and asserted.\n"
    )

    summary = engine.review_and_continue(
        raw_report=raw_report,
        required_requirements=["R-01", "R-02"]
    )

    assert summary.verdict == "DEFICIT_DETECTED"
    assert summary.verified_count == 0
    assert summary.unverified_count == 2
    assert summary.contradicted_count == 0
    assert summary.next_contract is not None
    assert set(summary.deficit.open_requirements) == {"R-01", "R-02"}


def test_bare_r01_claim_without_execution_receipt_cannot_qualify(engine):
    # Regression for the externally observed P0: "R-01 verified" prose.
    text = "RESULT: completed\\nR-01 passed and verified\\n"
    summary = engine.review_and_continue(text, ["R-01"])
    assert summary.verdict == "DEFICIT_DETECTED"
    assert summary.verified_count == 0
    assert summary.unverified_count == 1
    assert summary.next_contract is not None


def test_claimed_exit_zero_and_many_passes_without_receipt_still_hold(engine):
    text = "TESTS: 1000 passed. 0 failed.\\nEXIT CODE: 0\\nR-01 passed and asserted\\n"
    summary = engine.review_and_continue(text, ["R-01"])
    assert summary.verdict == "DEFICIT_DETECTED"
    assert summary.verified_count == 0


def test_empty_requirements_do_not_vacuously_qualify(engine):
    summary = engine.review_and_continue("RESULT: done", [])
    assert summary.verdict == "UNQUALIFIED_NO_REQUIREMENTS"
    assert summary.verified_count == 0
