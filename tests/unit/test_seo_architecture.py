"""Tests for SEO architecture route catalogs, metadata validation, and crawlability."""

from spe_runtime.seo.models import RouteMetadata
from spe_runtime.seo.routes import (
    ALL_TIER_ROUTES,
    BASE_CANONICAL_DOMAIN,
    TIER_A_CATEGORY_OWNERSHIP,
    TIER_B_FREE_ACQUISITION_TOOLS,
    TIER_C_EVIDENCE_PAGES,
    TIER_D_INTEGRATIONS,
    TIER_E_COMPETITOR_MIGRATIONS,
    TIER_F_GOVERNANCE_PACKS,
    generate_sitemap_xml,
    validate_seo_routes,
)


def test_all_tiers_present_and_populated():
    assert len(TIER_A_CATEGORY_OWNERSHIP) >= 5
    assert len(TIER_B_FREE_ACQUISITION_TOOLS) >= 6
    assert len(TIER_C_EVIDENCE_PAGES) >= 4
    assert len(TIER_D_INTEGRATIONS) >= 7
    assert len(TIER_E_COMPETITOR_MIGRATIONS) >= 6
    assert len(TIER_F_GOVERNANCE_PACKS) >= 4

    total_expected = (
        len(TIER_A_CATEGORY_OWNERSHIP)
        + len(TIER_B_FREE_ACQUISITION_TOOLS)
        + len(TIER_C_EVIDENCE_PAGES)
        + len(TIER_D_INTEGRATIONS)
        + len(TIER_E_COMPETITOR_MIGRATIONS)
        + len(TIER_F_GOVERNANCE_PACKS)
    )
    assert len(ALL_TIER_ROUTES) == total_expected


def test_seo_routes_validation_clean():
    report = validate_seo_routes(ALL_TIER_ROUTES)
    assert report.is_valid is True
    assert len(report.errors) == 0
    assert report.valid_routes == len(ALL_TIER_ROUTES)


def test_sitemap_generation():
    sitemap = generate_sitemap_xml(ALL_TIER_ROUTES)
    assert sitemap.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    assert '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' in sitemap
    assert f"<loc>{BASE_CANONICAL_DOMAIN}/ai-instruction-assurance</loc>" in sitemap
    assert f"<loc>{BASE_CANONICAL_DOMAIN}/tools/audio-to-text</loc>" in sitemap
    assert f"<loc>{BASE_CANONICAL_DOMAIN}/compliance/eu-ai-act</loc>" in sitemap
    assert sitemap.endswith("</urlset>")


def test_validation_catches_invalid_routes():
    bad_route = RouteMetadata(
        path="invalid-no-slash",
        tier="TIER_A",
        title="",
        meta_description="short",
        canonical_url="http://wrong-domain.com/bad",
        schema_type="InvalidSchema",
        h1="",
        target_intent="test",
        crawlable=True,
        noindex=True,  # Conflict: crawlable and noindex
    )
    report = validate_seo_routes([bad_route])
    assert report.is_valid is False
    assert len(report.errors) >= 5
