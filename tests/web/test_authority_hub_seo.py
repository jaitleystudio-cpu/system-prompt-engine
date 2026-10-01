"""Lane A9: Authority Hub and Evidence Registry Contract & SEO Gates."""

from __future__ import annotations

import json
import re
from tests.web.paths import WEB


def test_authority_hub_files_exist():
    registry_ts = WEB / "src" / "authority" / "evidenceRegistry.ts"
    hub_tsx = WEB / "src" / "pages" / "AuthorityHub.tsx"
    guide_tsx = WEB / "src" / "pages" / "GuideArticle.tsx"
    hub_css = WEB / "src" / "authority" / "hub.css"

    assert registry_ts.is_file(), "evidenceRegistry.ts must exist"
    assert hub_tsx.is_file(), "AuthorityHub.tsx must exist"
    assert guide_tsx.is_file(), "GuideArticle.tsx must exist"
    assert hub_css.is_file(), "hub.css must exist"


def test_authority_evidence_fields_and_schema():
    registry_ts = WEB / "src" / "authority" / "evidenceRegistry.ts"
    guide_tsx = WEB / "src" / "pages" / "GuideArticle.tsx"
    hub_css = WEB / "src" / "authority" / "hub.css"

    if not registry_ts.is_file():
        return

    registry_content = registry_ts.read_text(encoding="utf-8")
    guide_content = guide_tsx.read_text(encoding="utf-8")
    css_content = hub_css.read_text(encoding="utf-8")

    # 14 Mandatory Fields
    fields = [
        "claim",
        "dataset",
        "baseline",
        "metric",
        "sampleSize",
        "providerVersion",
        "date",
        "methodology",
        "evidenceLinks",
        "rawResults",
        "reproSteps",
        "limitations",
        "status",
        "lastVerified",
    ]
    for f in fields:
        assert f in registry_content, f"Missing mandatory evidence field: {f}"

    # Schema truth: Article vs TechArticle separation, no stacking
    assert "schemaType" in guide_content, "GuideArticle must differentiate schemaType"
    assert not re.search(r'\[\s*"Article"\s*,\s*"TechArticle"\s*\]', guide_content), "Must not stack Article and TechArticle"

    # CSS accessibility & touch targets
    assert "44px" in css_content, "Missing 44px touch targets in hub.css"
    assert ":focus-visible" in css_content, "Missing :focus-visible in hub.css"
    assert "prefers-reduced-motion" in css_content, "Missing prefers-reduced-motion in hub.css"


def test_authority_hub_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    routing_ts = (WEB / "src" / "routing.ts").read_text(encoding="utf-8")

    assert "<AuthorityHub" not in app_tsx, "AuthorityHub must not be mounted into App.tsx yet"
    assert "<GuideArticle" not in app_tsx, "GuideArticle must not be mounted into App.tsx yet"
    assert "authority-hub" not in routing_ts, "AuthorityHub must not be in routing.ts yet"
