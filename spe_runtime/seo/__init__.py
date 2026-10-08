"""SPE SEO Architecture, Route Catalogs, and Crawlability Verification."""

from .models import RouteMetadata, SeoValidationReport
from .routes import (
    ALL_TIER_ROUTES,
    TIER_A_CATEGORY_OWNERSHIP,
    TIER_B_FREE_ACQUISITION_TOOLS,
    TIER_C_EVIDENCE_PAGES,
    TIER_D_INTEGRATIONS,
    TIER_E_COMPETITOR_MIGRATIONS,
    TIER_F_GOVERNANCE_PACKS,
    generate_sitemap_xml,
    validate_seo_routes,
)

__all__ = [
    "ALL_TIER_ROUTES",
    "RouteMetadata",
    "SeoValidationReport",
    "TIER_A_CATEGORY_OWNERSHIP",
    "TIER_B_FREE_ACQUISITION_TOOLS",
    "TIER_C_EVIDENCE_PAGES",
    "TIER_D_INTEGRATIONS",
    "TIER_E_COMPETITOR_MIGRATIONS",
    "TIER_F_GOVERNANCE_PACKS",
    "generate_sitemap_xml",
    "validate_seo_routes",
]
