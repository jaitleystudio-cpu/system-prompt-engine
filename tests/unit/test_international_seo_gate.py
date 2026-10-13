"""R5 world-market measurements: no ranking claims, PII, or self-certified translation."""
from dataclasses import replace
import pytest

from spe_runtime.seo.international_gate import (
    LocaleCandidate, MarketAggregate,
    audit_locale_candidate, assess_aggregate_market, wilson_lower_95, audit_canonical_domains,
)


def locale(**changes):
    return LocaleCandidate(**(dict(
        locale="hi-IN", country="IN", path="/hi-IN/ai-incidents",
        protected_requirement_ids=("hard:privacy", "hard:attribution"),
        source_requirement_ids=("hard:privacy", "hard:attribution"),
    ) | changes))


def metric(**changes):
    return MarketAggregate(**(dict(
        country="IN", locale="hi-IN",
        period_start="2026-09-01", period_end="2026-09-14",
        search_impressions=10000, search_clicks=420,
        opt_in_tasks=200, opt_in_successes=151,
    ) | changes))


def test_complete_locale_mapping_still_needs_human_language_review():
    r = audit_locale_candidate(locale(language_reviewer_receipt_id="self-asserted-receipt"))
    assert r.status == "READY_FOR_HUMAN_REVIEW"
    assert r.noindex
    assert not r.translation_semantics_proven
    assert not r.production_publish_authorized
    assert "INDEPENDENT_LANGUAGE_REVIEW_NOT_VERIFIED" in r.reasons


@pytest.mark.parametrize("change", [
    {"locale": "hi-IN<script>"},
    {"locale": "hi-IN", "path": "/es-ES/ai-incidents"},
    {"path": "/hi-IN/../private"},
    {"path": "/hi-IN/%2e%2e/private"},
    {"path": "https://foreign.example/hi-IN"},
    {"country": "India"},
    {"protected_requirement_ids": ("hard:privacy",)},
    {"source_requirement_ids": ()},
    {"protected_requirement_ids": ("hard:privacy", "hard:privacy")},
])
def test_country_and_hard_constraint_mapping_reject_malformed_locales(change):
    r = audit_locale_candidate(locale(**change))
    assert r.status == "HOLD"
    assert r.noindex


def test_metrics_never_claim_world_rank_or_production_authority():
    candidate = metric(period_start="2026-10-01", period_end="2026-10-14",
                       opt_in_successes=175)
    baseline = metric()
    report = assess_aggregate_market(candidate, baseline=baseline)
    assert report.outcome == "READY_FOR_INDEPENDENT_MARKET_REVIEW"
    assert report.search_ctr == 0.042
    assert report.task_success_rate == 0.875
    assert 0.80 < report.task_success_wilson95_low < 0.88
    assert not report.global_first_claim_verified
    assert not report.production_launch_authorized


def test_not_enough_opt_in_study_or_search_sample_is_hold():
    candidate = metric(period_start="2026-10-01", period_end="2026-10-14",
                       search_impressions=20, search_clicks=9,
                       opt_in_tasks=5, opt_in_successes=5)
    r = assess_aggregate_market(candidate, baseline=metric())
    assert r.outcome == "HOLD"
    assert "INSUFFICIENT_OPT_IN_SAMPLE" in r.reasons
    assert "INSUFFICIENT_SEARCH_IMPRESSIONS" in r.reasons


def test_missing_baseline_never_qualifies():
    r = assess_aggregate_market(metric())
    assert r.outcome == "HOLD"
    assert "BASELINE_NOT_SUPPLIED" in r.reasons


@pytest.mark.parametrize("change", [
    {"search_impressions": -1},
    {"search_impressions": 50, "search_clicks": 60},
    {"opt_in_tasks": 90, "opt_in_successes": 100},
    {"opt_in_tasks": True},
    {"search_clicks": 10.0},
    {"country": "I!"},
    {"locale": "en_US"},
    {"period_start": "2026-11-20", "period_end": "2026-10-01"},
    {"period_start": "2026-01-01", "period_end": "2026-10-01"},
    {"period_start": "bad"},
])
def test_malformed_aggregates_are_rejected(change):
    with pytest.raises(ValueError, match="AGGREGATE_MALFORMED"):
        assess_aggregate_market(metric(**change))


def test_noncomparable_baseline_is_rejected():
    candidate = metric(period_start="2026-10-01", period_end="2026-10-14")
    for previous in [
        metric(country="US"),
        metric(locale="en-US"),
        metric(period_end="2026-09-10"),
        metric(period_start="2026-10-02", period_end="2026-10-15"),
    ]:
        with pytest.raises(ValueError, match="BASELINE_NONCOMPARABLE_OR_OVERLAPPING"):
            assess_aggregate_market(candidate, baseline=previous)


def test_wilson_interval_behaves_conservatively():
    assert 0 < wilson_lower_95(100, 100) < 1
    assert wilson_lower_95(0, 100) == 0
    assert wilson_lower_95(50, 100) < 0.5
    with pytest.raises(ValueError):
        wilson_lower_95(1, 0)



def test_existing_seo_owners_must_agree_before_search_submissions():
    from spe_runtime.seo.routes import BASE_CANONICAL_DOMAIN
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    generator = (root / "scripts/generate-evidence-seo.mjs").read_text(encoding="utf-8")
    import re
    match = re.search(r"const CANONICAL_DOMAIN = '([^']+)';", generator)
    assert match
    result = audit_canonical_domains({
        "seo_route_owner": BASE_CANONICAL_DOMAIN,
        "static_site_owner": match.group(1),
    })
    assert result.status == ("READY_FOR_OWNER_REVIEW" if BASE_CANONICAL_DOMAIN == match.group(1) else "HOLD")
    assert result.sitemap_submission_authorized is False
    assert result.indexnow_submission_authorized is False
    if BASE_CANONICAL_DOMAIN != match.group(1):
        assert "CANONICAL_DOMAIN_CONFLICT" in result.reason_codes


def test_canonical_origins_reject_unsafe_and_foreign_urls():
    for bad in ("http://systempromptengine.com", "javascript:alert(1)",
                "https://evil.example.org/private", "https://systempromptengine.com@evil.test",
                "https://systempromptengine.com?secret=yes", "https://systempromptengine.com/path"):
        try:
            r = audit_canonical_domains({"seo": bad})
        except ValueError:
            continue
        assert r.status == "HOLD"
    assert audit_canonical_domains({
        "owner_a": "https://systempromptengine.com",
        "owner_b": "https://systempromptengine.com/",
    }).status == "READY_FOR_OWNER_REVIEW"
