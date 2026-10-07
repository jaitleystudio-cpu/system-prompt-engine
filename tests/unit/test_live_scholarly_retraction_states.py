"""RED oracles: retraction check states must not collapse to false booleans.

LIVE_INDEX / LIVE_RETRACTION stay HOLD until mutants killed.
Extends spe_runtime.grounding — does not create a second research engine.
"""

from __future__ import annotations

import pytest

REQUIRED_STATES = (
    "NOT_CHECKED",
    "CHECKING",
    "NO_SIGNAL_IN_QUERIED_SOURCES",
    "RETRACTION_SIGNAL",
    "WITHDRAWAL_SIGNAL",
    "EXPRESSION_OF_CONCERN",
    "CORRECTION_SIGNAL",
    "CONFLICTING_STATUS",
    "SOURCE_UNAVAILABLE",
    "IDENTIFIER_AMBIGUOUS",
    "UNKNOWN",
)


def test_retraction_check_status_enum_exists_and_complete():
    """Grounding must expose RetractionCheckStatus with full non-boolean matrix."""
    from spe_runtime.grounding.models import RetractionCheckStatus  # type: ignore

    values = {m.value for m in RetractionCheckStatus}
    missing = set(REQUIRED_STATES) - values
    assert not missing, f"missing retraction states: {sorted(missing)}"
    # Must not include a false-clean NOT_RETRACTED collapse token
    assert "NOT_RETRACTED" not in values
    assert "PASS" not in values


def test_unknown_does_not_equal_pass_support_status():
    from spe_runtime.grounding.models import SupportStatus

    assert SupportStatus.UNVERIFIED.value != "PASS"
    assert "PASS" not in {s.value for s in SupportStatus}


def test_merge_retraction_no_match_is_not_not_retracted():
    """NO_SIGNAL / empty witness must not become a clean NOT_RETRACTED."""
    from spe_runtime.grounding.retraction import merge_retraction_checks  # type: ignore

    merged = merge_retraction_checks(())
    assert merged.status in {"UNKNOWN", "NOT_CHECKED", "NO_SIGNAL_IN_QUERIED_SOURCES"}
    assert merged.status != "NOT_RETRACTED"
    assert getattr(merged, "live_verified", False) is False


def test_cache_mode_never_labeled_live():
    from spe_runtime.grounding.retraction import classify_verification_mode  # type: ignore

    assert classify_verification_mode(from_cache=True) != "LIVE"
    assert classify_verification_mode(from_cache=True) == "CACHE"


def test_preprint_not_peer_reviewed():
    from spe_runtime.grounding.retraction import classify_peer_review  # type: ignore

    assert classify_peer_review(arxiv_only=True) == "PREPRINT"
    assert classify_peer_review(arxiv_only=True) != "PEER_REVIEWED"


def test_live_capability_hold_flags_still_hold():
    """Python mirror of HOLD — must not invent YES/PASS."""
    # Prefer importing a dedicated module once wired; until then this documents the law.
    try:
        from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION  # type: ignore
    except ImportError:
        pytest.fail(
            "spe_runtime.grounding.live_fabric not implemented "
            "(LIVE_INDEX/LIVE_RETRACTION HOLD mirror required)"
        )
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
