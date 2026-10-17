"""
Unit tests for SPE Ω — Global Hero Intelligence (Python Parity)
"""

import pytest
from spe_runtime.governance.hero_intelligence import (
    SHIPPED_CAPABILITIES,
    BANNED_BUZZWORDS,
    FORBIDDEN_PROMISES,
    verify_copy_against_promise_contract,
    validate_comprehension,
    AlwaysValidInference,
    HeroExperimentEngine,
    HeroCopyPackage,
)


def test_shipped_capabilities_registry():
    assert "BROWSER_WASM_COMPILATION" in SHIPPED_CAPABILITIES
    assert "AIR_GAP_ZERO_EGRESS" in SHIPPED_CAPABILITIES
    assert "INVARIANT_GUARDRAILS" in SHIPPED_CAPABILITIES
    assert "CONFLICT_DETECTION" in SHIPPED_CAPABILITIES
    assert "MULTI_AGENT_PORTABILITY" in SHIPPED_CAPABILITIES


def test_promise_contract_rejects_unshipped_claims():
    res = verify_copy_against_promise_contract(
        headline="Run Claude Sonnet 5.5 and OpenAI GPT-6.1 inside your browser without API keys",
        support="Our neural network weights are loaded locally in WebAssembly.",
    )
    assert not res.valid
    assert any(v.code == "ERR_UNSHIPPED_CAPABILITY" for v in res.violations)
    assert res.grounding_score == 0.0


def test_promise_contract_rejects_banned_buzzwords():
    res = verify_copy_against_promise_contract(
        headline="Supercharge your workflow with revolutionary magic prompts",
        support="Unleash limitless AI possibilities with our game-changing engine.",
    )
    assert not res.valid
    assert any(v.code == "ERR_FORBIDDEN_BUZZWORD" for v in res.violations)


def test_promise_contract_accepts_grounded_promises():
    res = verify_copy_against_promise_contract(
        headline="Turn rough ideas into structured prompts for any AI.",
        support="100% on-device WebAssembly compiler. Zero prompt bytes leave your machine.",
        cta="Make my prompt",
    )
    assert res.valid
    assert len(res.violations) == 0
    assert res.grounding_score == 1.0
    assert len(res.verified_claims) >= 2


def test_comprehension_validator_plain_english():
    good = validate_comprehension(
        title="Your idea.",
        accent="A clear prompt.",
        support="Turn rough notes into clear instructions for AI. Everything runs on your device.",
    )
    assert good.passed
    assert good.flesch_grade <= 8.5
    assert good.reading_ease >= 60.0


def test_comprehension_validator_flags_idioms():
    idiom_res = validate_comprehension(
        title="Hit the ground running.",
        accent="There is no silver bullet.",
        support="Touch base under the hood with a ballpark figure.",
    )
    assert not idiom_res.passed
    assert len(idiom_res.idioms_detected) >= 2


def test_always_valid_inference_neutral_and_lift():
    avi = AlwaysValidInference(critical_e_value_hurdle=20.0)

    # Neutral
    e_val_neutral, _, qual_neutral = avi.calculate_e_value(500, 50, 500, 51)
    assert e_val_neutral < 20.0
    assert not qual_neutral

    # Strong lift: 5% vs 9.5%
    e_val_lift, _, qual_lift = avi.calculate_e_value(1000, 50, 1000, 95)
    assert e_val_lift >= 20.0
    assert qual_lift


def test_srm_detection():
    avi = AlwaysValidInference()
    has_srm, _, p_val = avi.check_sample_ratio_mismatch(800, 200, 0.5)
    assert has_srm
    assert p_val < 0.001

    has_srm_balanced, _, _ = avi.check_sample_ratio_mismatch(505, 495, 0.5)
    assert not has_srm_balanced


def test_forced_nightly_publication_is_forbidden():
    baseline = HeroCopyPackage(
        title="Your idea.",
        accent="A clear prompt.",
        support="Turn rough notes into clear instructions for AI.",
        cta="Make my prompt",
    )
    engine = HeroExperimentEngine(baseline=baseline, min_sample_size=200, min_duration_hours=72)
    candidate = HeroCopyPackage(
        title="Clear prompts.",
        accent="No guesswork.",
        support="Turn rough notes into structured prompts. 100% on-device.",
        cta="Build my prompt",
    )
    engine.enqueue_candidate(candidate)

    # Low sample size
    engine.record_observation("control", True)
    engine.record_observation("candidate", True)

    outcome = engine.adjudicate_evidence(duration_hours=24)
    assert outcome.action == "RETAIN_EXISTING"
    assert not outcome.copy_published
    assert engine.get_active_headline().title == "Your idea."


def test_candidate_promoted_only_with_proven_evidence():
    baseline = HeroCopyPackage(
        title="Your idea.",
        accent="A clear prompt.",
        support="Turn rough notes into clear instructions for AI.",
        cta="Make my prompt",
    )
    engine = HeroExperimentEngine(baseline=baseline, min_sample_size=200, min_duration_hours=72)
    candidate = HeroCopyPackage(
        title="Stop AI agents",
        accent="from guessing.",
        support="Lock your boundaries before your agent drifts. Free and local.",
        cta="Protect my prompt",
    )
    engine.enqueue_candidate(candidate)

    for i in range(1000):
        engine.record_observation("control", i < 50)
        engine.record_observation("candidate", i < 95)

    outcome = engine.adjudicate_evidence(duration_hours=96)
    assert outcome.action == "PROMOTE_CANDIDATE"
    assert outcome.copy_published
    assert engine.get_active_headline().title == "Stop AI agents"
