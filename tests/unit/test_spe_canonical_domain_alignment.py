"""R8 canonical-domain agreement across Python SEO, web router and site assets.

Static source consistency only: does NOT certify DNS, HTTP redirects,
search-engine indexing, site ownership or production deployment.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from spe_runtime.seo.routes import (
    ALL_TIER_ROUTES, BASE_CANONICAL_DOMAIN, generate_sitemap_xml, validate_seo_routes,
)
from spe_runtime.seo.international_gate import audit_canonical_domains

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://systempromptengine.com"


def test_all_authoritative_seo_origins_converge():
    runtime_routes = (ROOT / "apps/web/src/routing.ts").read_text(encoding="utf-8")
    static_generator = (ROOT / "scripts/generate-evidence-seo.mjs").read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "evidence/seo-manifest.json").read_text(encoding="utf-8"))
    site = re.search(r'const SITE = "([^"]+)";', runtime_routes)
    generator = re.search(r"const CANONICAL_DOMAIN = '([^']+)';", static_generator)
    assert site and generator
    origins = {
        "python_seo_routes": BASE_CANONICAL_DOMAIN,
        "react_router": site.group(1),
        "static_generator": generator.group(1),
        "site_manifest": manifest["canonical_domain"],
    }
    result = audit_canonical_domains(origins)
    assert result.status == "READY_FOR_OWNER_REVIEW"
    assert set(origins.values()) == {SITE}
    assert not result.sitemap_submission_authorized
    assert not result.indexnow_submission_authorized


def test_sitemap_and_robots_link_same_https_origin_and_all_paths():
    robots = (ROOT / "apps/web/public/robots.txt").read_text(encoding="utf-8")
    static_map = (ROOT / "apps/web/public/sitemap.xml").read_text(encoding="utf-8")
    python_map = generate_sitemap_xml(ALL_TIER_ROUTES)
    assert f"Sitemap: {SITE}/sitemap.xml" in robots
    assert BASE_CANONICAL_DOMAIN == SITE
    assert validate_seo_routes(ALL_TIER_ROUTES).is_valid
    for text in (static_map, python_map):
        locs = re.findall(r"<loc>([^<]+)</loc>", text)
        assert locs
        assert all(urlsplit(loc).scheme == "https" and urlsplit(loc).netloc == "systempromptengine.com" for loc in locs)
    assert all(route.canonical_url.startswith(SITE + "/") for route in ALL_TIER_ROUTES)


def test_mock_failure_pages_remain_noindex_and_absent_from_site_map():
    root = ROOT / "apps/web/public/evidence-pages"
    for path in ("failure-genome_SPE-FG-2026-000001.html",
                 "models_openai_gpt-4o.html", "compare_spe-vs-promptfoo.html"):
        body = (root / path).read_text(encoding="utf-8")
        assert 'content="noindex, nofollow, noarchive"' in body
        assert "SYNTHETIC FIXTURE" in body
    sitemap = (ROOT / "apps/web/public/sitemap.xml").read_text(encoding="utf-8")
    assert "<loc>https://systempromptengine.com/failure-genome/SPE-FG-2026-000001</loc>" not in sitemap
    assert "<loc>https://systempromptengine.com/models/openai/gpt-4o</loc>" not in sitemap
