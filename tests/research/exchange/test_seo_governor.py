"""
Test suite for SPE Ω Programmatic SEO & Ad-Monetization Governor Kernel (Master Prompt 3).
Verifies:
1. Google Scaled Content Defense (indexable vs non-indexable classifications).
2. Privacy & Ad-Free Workspace Sanctuary (AdSanctuaryViolationError on private routes or PII leaks).
3. Structured Data JSON-LD generation (SoftwareApplication, TechArticle, ItemList).
4. 4-Zone semantic HTML page markup emission.
"""

import pytest

from spe_runtime.research.exchange.seo_governor import (
    AdSanctuaryViolationError,
    IndexabilityResult,
    ItemListSchema,
    ScaledContentAbuseError,
    SeoGovernor,
    SoftwareApplicationSchema,
    TechArticleSchema,
)


def test_google_scaled_content_abuse_defense_classification():
    """
    Constitutional Publication Gate 1: THE SCALED CONTENT DEFENSE.
    Thin, duplicate, or unverified content must be noindexed.
    Only substantive empirical measurements with Evidence Passports are indexable.
    """
    # 1. Qualified page with 150 trials, passport, benchmark
    res_qual = SeoGovernor.classify_indexability(
        route="/exchange/skills/drizzle-orm",
        trials_n=150,
        has_evidence_passport=True,
        has_reproducible_benchmark=True,
    )
    assert res_qual.status == "INDEXABLE"
    assert res_qual.robots_directive == "index, follow"
    assert "Substantive original empirical" in res_qual.reason

    # 2. Thin page: insufficient trials (< 10)
    res_thin = SeoGovernor.classify_indexability(
        route="/exchange/skills/untested-stub",
        trials_n=5,
        has_evidence_passport=True,
    )
    assert res_thin.status == "NON_INDEXABLE"
    assert res_thin.robots_directive == "noindex, follow"
    assert "Insufficient empirical test volume" in res_thin.reason

    # 3. Missing Evidence Passport
    res_nopass = SeoGovernor.classify_indexability(
        route="/exchange/skills/unverified",
        trials_n=100,
        has_evidence_passport=False,
    )
    assert res_nopass.status == "NON_INDEXABLE"
    assert res_nopass.robots_directive == "noindex, follow"

    # 4. Raw imported metadata
    res_raw = SeoGovernor.classify_indexability(
        route="/exchange/imports/raw",
        trials_n=100,
        has_evidence_passport=True,
        is_raw_unverified_import=True,
    )
    assert res_raw.status == "NON_INDEXABLE"
    assert res_raw.robots_directive == "noindex, follow"

    # 5. Internal faceted search filter
    res_search = SeoGovernor.classify_indexability(
        route="/exchange/search?tag=orm&sort=stars",
        trials_n=100,
        has_evidence_passport=True,
        is_user_search_query=True,
    )
    assert res_search.status == "NON_INDEXABLE"
    assert res_search.robots_directive == "noindex, follow"
    assert "faceted search" in res_search.reason


def test_ad_free_sanctuary_enforcement_and_pii_guard():
    """
    Constitutional Publication Gate 2: THE PRIVACY & AD-FREE SANCTUARY.
    Monetization strictly limited to public discovery.
    Private workspaces are 100% AD-FREE and ZERO-TRACKING.
    """
    # 1. Public route with ads: allowed
    assert SeoGovernor.validate_ad_sanctuary(
        route="/exchange/skills/drizzle-orm",
        has_ads=True,
        ad_payload={"format": "728x90"},
    ) is True

    # 2. Private workspace route with ads: MUST RAISE AdSanctuaryViolationError
    with pytest.raises(AdSanctuaryViolationError):
        SeoGovernor.validate_ad_sanctuary(
            route="/workspace/mission-001",
            has_ads=True,
            ad_payload={"format": "banner"},
        )

    with pytest.raises(AdSanctuaryViolationError):
        SeoGovernor.validate_ad_sanctuary(
            route="/execution-logs/session-42",
            has_ads=True,
        )

    with pytest.raises(AdSanctuaryViolationError):
        SeoGovernor.validate_ad_sanctuary(
            route="/continuation/next-task",
            has_ads=True,
        )

    # 3. Leakage Guard: private prompt text or user code in ad payload
    with pytest.raises(AdSanctuaryViolationError):
        SeoGovernor.validate_ad_sanctuary(
            route="/exchange/skills",
            has_ads=True,
            context_contains_private_prompt=True,
        )

    with pytest.raises(AdSanctuaryViolationError):
        SeoGovernor.validate_ad_sanctuary(
            route="/exchange/skills",
            has_ads=True,
            context_contains_user_code=True,
        )


def test_structured_data_json_ld_generation():
    """
    Constitutional Publication Gate 3: ACCURATE STRUCTURED DATA.
    Emits SoftwareApplication, TechArticle, ItemList.
    Disallows manufactured 5-star user review aggregates on lab results.
    """
    # SoftwareApplication
    app_schema = SoftwareApplicationSchema(
        name="@skill/drizzle-orm",
        software_version="sha256:d84f9b201a",
        rating_value=4.62,  # Grounded in Wilson score 92.4%
        rating_count=200,
        evidence_passport_id="EVP-3010cdfe9f530793",
    )
    ld = app_schema.to_json_ld()
    assert ld["@type"] == "SoftwareApplication"
    assert ld["aggregateRating"]["ratingValue"] == 4.62
    assert ld["aggregateRating"]["ratingCount"] == 200
    assert ld["identifier"] == "EVP-3010cdfe9f530793"

    # TechArticle
    article_schema = TechArticleSchema(
        headline="Empirical Audit: Drizzle ORM Skill",
        dependencies=["LOCAL_AST_ONLY"],
        version="sha256:d84f9b201a",
        test_methodology="200 trials on Claude Code",
    )
    art_ld = article_schema.to_json_ld()
    assert art_ld["@type"] == "TechArticle"
    assert "LOCAL_AST_ONLY" in art_ld["dependencies"]

    # ItemList
    list_schema = ItemListSchema(
        name="Top-3 Verified Skills",
        items=[
            {"name": "@skill/drizzle-orm", "url": "https://spe.run/exchange/drizzle-orm"},
            {"name": "@skill/nextjs-router", "url": "https://spe.run/exchange/nextjs-router"},
        ],
    )
    list_ld = list_schema.to_json_ld()
    assert list_ld["@type"] == "ItemList"
    assert len(list_ld["itemListElement"]) == 2
    assert list_ld["itemListElement"][0]["position"] == 1


def test_four_zone_semantic_page_markup_generation():
    """Verifies 4-zone HTML structure generation and ad containment."""
    markup = SeoGovernor.generate_page_markup(
        route="/exchange/skills/drizzle-orm",
        title="Drizzle ORM Evidence Audit",
        canonical_url="https://spe.run/exchange/skills/drizzle-orm",
        breadcrumbs=[("Exchange", "/exchange"), ("Skills", "/skills"), ("Drizzle ORM", "/exchange/skills/drizzle-orm")],
        comparative_data=[
            {"metric": "Success Rate", "candidate": "96.0%", "baseline": "80.0%", "delta": "+16.0%"},
        ],
        methodology_text="Standardized test battery executed across 200 reproducible trials.",
        reproducible_command="spe bench --suite exchange-drizzle",
        wilson_score_lower_bound=0.924,
        trials_n=200,
        target_identifier="@skill/drizzle-orm",
        version_digest="sha256:d84f9b201a",
        passport_id="EVP-3010cdfe9f530793",
        has_ads=True,
    )

    # Zone 1: Header Zone
    assert '<header class="spe-header-zone">' in markup
    assert '<aside class="spe-ad-zone spe-ad-header"' in markup
    assert '<meta name="robots" content="index, follow">' in markup

    # Zone 2: Core Value Zone
    assert '<main class="spe-core-value-zone">' in markup
    assert 'Wilson Score 95% Lower Bound:' in markup
    assert '92.4%' in markup
    assert 'spe bench --suite exchange-drizzle' in markup

    # Zone 3: In-Content Zone
    assert '<aside class="spe-ad-zone spe-ad-incontent"' in markup

    # Zone 4: Footer Zone
    assert '<footer class="spe-footer-zone">' in markup
    assert 'Cookie &amp; Privacy Preferences (GDPR/EEA Certified)' in markup
    assert 'Disqualification Appeal Mechanism' in markup


def test_four_zone_private_workspace_page_is_completely_ad_free():
    """Verifies that private workspace page omits all ad zones and displays sanctuary badge."""
    markup = SeoGovernor.generate_page_markup(
        route="/workspace/session-001",
        title="Active Workspace",
        canonical_url="https://spe.run/workspace/session-001",
        breadcrumbs=[("Home", "/"), ("Workspace", "/workspace")],
        comparative_data=[],
        methodology_text="Internal session",
        reproducible_command="",
        wilson_score_lower_bound=1.0,
        trials_n=1,
        has_ads=False,
    )

    assert "spe-ad-header" not in markup
    assert "spe-ad-incontent" not in markup
    assert "spe-private-sanctuary-badge" in markup
    assert "100% Ad-Free Private Workspace Sanctuary" in markup
    assert '<meta name="robots" content="noindex, nofollow">' in markup
