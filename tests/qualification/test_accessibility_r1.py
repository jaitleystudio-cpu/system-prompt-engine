"""Accessibility R1 qualification. Kills A11Y1-01 through A11Y1-20.

The donor harness is executed by tests/web/test_accessibility_compliance.py.
This suite does not treat that harness log as a WCAG certificate.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from tests.qualification.a11y_r1_oracle import (
    DONOR_SHA,
    MUTANT_IDS,
    Claim,
    honest_claim,
    hold_gaps,
    ledger,
    observe,
    qualify,
)
from tests.qualification.a11y_r1_oracle import MUTANTS

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "tests" / "fixtures" / "accessibility_r1" / "a11y1_mutants.json"
PROOF = ROOT / "proofs" / "accessibility_r1_20260930" / "oracle_result.json"


@pytest.fixture(scope="module")
def observation():
    return observe(ROOT)


@pytest.fixture(scope="module")
def claim(observation):
    return honest_claim(observation)


def test_donor_sha_is_ancestor():
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", DONOR_SHA, "HEAD"],
        cwd=ROOT,
        check=False,
    )
    assert result.returncode == 0


def test_donor_has_no_hold_gap(observation):
    assert hold_gaps(observation) == ()


def test_honest_claim_is_fail_closed(observation, claim):
    assert qualify(observation, claim) == set()
    assert claim.human_screen_reader == "NOT_PERFORMED"
    assert claim.keyboard_trap == "UNKNOWN"
    assert claim.reduced_motion_effect == "UNKNOWN"
    assert claim.reflow_zoom == "NOT_EVIDENCED"
    assert claim.contrast == "UNMEASURED"
    assert claim.heading_order == "UNKNOWN"
    assert claim.error_announced == "UNKNOWN"
    assert claim.focus_skip_target == "NOT_VISIBLE"
    assert claim.focus_retained == "NOT_CLAIMED"
    assert claim.semantic_authority == "NONE"
    assert claim.wcag_certificate == "NOT_A_CERTIFICATE"
    assert claim.wcag_level == "NOT_CERTIFIED"
    assert claim.audit_complete is False
    assert "PASS" not in _claim_values(claim)


def test_static_boundaries_match_the_donor(observation, claim):
    assert observation.skip_link_present and observation.skip_link_tested
    assert observation.escape_closes_menu and observation.escape_tested is False
    assert observation.focus_visible_dark and observation.focus_visible_light
    assert observation.skip_target_outline_none
    assert observation.reduced_motion_css_present
    assert observation.reduced_motion_css_tested
    assert observation.reduced_motion_effect_tested is False
    assert observation.zoom_reflow_measured is False
    assert observation.harness_claims_zoom and observation.harness_claims_wcag_complete
    assert observation.zoom_locked is False
    assert observation.language_present
    assert observation.menu_control == "button"
    assert observation.autoplay_gate_present
    assert observation.live_region_present
    assert observation.aria_hidden_focusable is False
    assert observation.keyboard_trap_session is False
    assert observation.human_sr_performed is False
    assert observation.heading_order_audited is False
    assert observation.contrast_measured is False
    assert claim.skip_link == "STATIC_ASSERTED"
    assert claim.keyboard_escape == "SOURCE_PRESENT"
    assert claim.focus_rings == "STATIC_ASSERTED"
    assert claim.reduced_motion_css == "STATIC_ASSERTED"
    assert claim.live_region == "STATIC_ASSERTED"
    assert claim.language == "SOURCE_PRESENT"
    assert claim.menu_control == "NATIVE_BUTTON"
    assert claim.autoplay == "GATED_IN_SOURCE_UNTESTED"
    assert claim.control_name == "NOT_EXHAUSTIVE"


def test_harness_log_is_not_a_certificate(claim):
    harness = (ROOT / "apps" / "web" / "scripts" / "test-accessibility-harness.mjs").read_text(
        encoding="utf-8"
    )
    assert "ALL WCAG 2.1 AA ACCESSIBILITY AUDIT CHECKS PASSED" in harness
    assert "200% zoom and small-screen reflow rules verified." in harness
    assert claim.wcag_certificate == "NOT_A_CERTIFICATE"
    assert claim.reflow_zoom == "NOT_EVIDENCED"
    assert claim.harness_log_is_certificate is False


@pytest.mark.parametrize("mutant_id", MUTANT_IDS)
def test_mutant_is_killed(observation, claim, mutant_id):
    mutant_obs, mutant_claim = MUTANTS[mutant_id](observation, claim)
    codes = qualify(mutant_obs, mutant_claim)
    assert mutant_id in codes
    assert qualify(observation, claim) == set()


def test_all_twenty_mutants_are_killed(observation, claim):
    rows = ledger(ROOT)
    assert [row["id"] for row in rows] == list(MUTANT_IDS)
    assert all(row["killed"] for row in rows)
    assert len(rows) == 20
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["mutant_ids"] == list(MUTANT_IDS)
    assert fixture["donor_sha"] == DONOR_SHA
    assert qualify(observation, claim) == set()


def test_proof_records_fail_closed_result():
    proof = json.loads(PROOF.read_text(encoding="utf-8"))
    assert proof["donor_sha"] == DONOR_SHA
    assert proof["human_qualification"] == "NOT_PERFORMED"
    assert proof["pr_number"] is None
    assert proof["final"] == "ACCESSIBILITY_R1_QUALIFICATION_PASS"
    assert proof["killed"] == 20
    assert proof["survived"] == 0
    assert proof["semantic_authority"] == "NONE"
    assert proof["wcag_certificate"] == "NOT_A_CERTIFICATE"
    assert proof["reduced_motion_effect"] == "UNKNOWN"
    assert proof["reflow_zoom"] == "NOT_EVIDENCED"
    assert proof["contrast"] == "UNMEASURED"
    assert proof["keyboard_trap"] == "UNKNOWN"
    assert proof["human_screen_reader"] == "NOT_PERFORMED"
    assert proof["mutant_ids"] == list(MUTANT_IDS)


def _claim_values(claim: Claim) -> set[str]:
    values: set[str] = set()
    for name in claim.__dataclass_fields__:
        value = getattr(claim, name)
        if isinstance(value, str):
            values.add(value)
    return values
