"""Data models for SEO route catalog and metadata validation."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RouteMetadata:
    path: str
    tier: str  # TIER_A, TIER_B, TIER_C, TIER_D, TIER_E, TIER_F
    title: str
    meta_description: str
    canonical_url: str
    schema_type: str  # TechArticle, WebApplication, SoftwareApplication, Dataset, etc.
    h1: str
    target_intent: str
    crawlable: bool = True
    noindex: bool = False
    breadcrumbs: list[dict[str, str]] = field(default_factory=list)


@dataclass
class SeoValidationReport:
    total_routes_checked: int
    valid_routes: int
    errors: list[str]
    warnings: list[str]
    is_valid: bool
