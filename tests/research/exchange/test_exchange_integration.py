"""
Integration test suite for SPE Ω Skills & Plugins Exchange.
Verifies end-to-end pipeline:
1. Merit ranking -> Evidence Passport generation.
2. Mission-fit selection from ranked catalog.
3. Programmatic SEO indexing & ad sanctuary verification.
4. Production Bridge Facades (ExchangeMeritRankerAdapter, ExchangeMissionMatcherAdapter, ExchangeSeoGovernorAdapter).
"""

import json
from pathlib import Path
import pytest

from spe_runtime.production_bridge import (
    ExchangeMeritRankerAdapter,
    ExchangeMissionMatcherAdapter,
    ExchangeSeoGovernorAdapter,
)
from spe_runtime.research.exchange.seo_governor import AdSanctuaryViolationError


def test_production_bridge_merit_ranker_facade(tmp_path):
    """Verifies ExchangeMeritRankerAdapter end-to-end with disk output."""
    candidates = [
        {
            "name": "@skill/alpha",
            "trials_n": 300,
            "successes": 290,
            "tested_environment": {"host_runtime": "Claude Code", "trials_n": 300},
            "security_audit": {"static_analysis": "PASSED_SAFE", "exfiltration_risk": "ZERO_DETECTED"},
        },
        {
            "name": "@skill/beta",
            "trials_n": 100,
            "successes": 95,
            "tested_environment": {"host_runtime": "Cursor", "trials_n": 100},
            "security_audit": {"static_analysis": "PASSED_SAFE", "exfiltration_risk": "ZERO_DETECTED"},
        },
        {
            "name": "@skill/gamma-sponsored",
            "trials_n": 100,
            "successes": 99,
            "is_sponsored": True,
            "sponsor_bid_usd": 500.0,
            "security_audit": {"static_analysis": "PASSED_SAFE", "exfiltration_risk": "ZERO_DETECTED"},
        },
        {
            "name": "@skill/delta-malicious",
            "trials_n": 50,
            "successes": 50,
            "security_audit": {"static_analysis": "FAILED_RISK", "unauthorized_network_egress": True},
        },
    ]

    out_file = tmp_path / "ranked_catalog.json"
    result = ExchangeMeritRankerAdapter.rank_catalog(candidates, output_path=str(out_file))

    assert out_file.exists()
    assert result["ranked_count"] == 2
    assert result["sponsored_count"] == 1
    assert result["disqualified_count"] == 1

    top_names = [p["target_identifier"] for p in result["top_3"]]
    assert "@skill/alpha" in top_names
    assert "@skill/beta" in top_names
    assert "@skill/gamma-sponsored" not in top_names
    assert "@skill/delta-malicious" not in top_names


def test_production_bridge_mission_matcher_facade(tmp_path):
    """Verifies ExchangeMissionMatcherAdapter end-to-end with markdown and JSON output."""
    catalog = [
        {
            "name": "@skill/drizzle-orm",
            "capabilities": ["Drizzle ORM", "Database Migrations"],
            "permissions": ["LOCAL_AST_ONLY"],
            "authority_domain": "database_migration",
            "limitation": "Requires schema input",
            "tested_environment": {"trials_n": 200},
            "performance_metrics": {"wilson_lower_bound_95": 0.942},
            "validity_window": {"status": "CURRENT"},
        },
        {
            "name": "@skill/react-components",
            "capabilities": ["React Components"],
            "permissions": ["FILESYSTEM_SCOPED_WRITE"],
            "authority_domain": "frontend",
            "limitation": "Component scope only",
            "tested_environment": {"trials_n": 100},
            "performance_metrics": {"wilson_lower_bound_95": 0.880},
            "validity_window": {"status": "CURRENT"},
        },
    ]

    out_json = tmp_path / "matched_mission.json"
    out_md = tmp_path / "matched_mission.md"

    res = ExchangeMissionMatcherAdapter.match_mission(
        mission_intent="Build database migrations using Drizzle ORM",
        catalog=catalog,
        runtime="Claude Code",
        output_path=str(out_json),
        output_markdown_path=str(out_md),
    )

    assert out_json.exists()
    assert out_md.exists()
    assert res["status"] == "QUALIFIED_MATCH"
    assert res["conflict_check_passed"] is True
    assert "@skill/drizzle-orm" in res["raw_markdown"]


def test_production_bridge_seo_governor_facade(tmp_path):
    """Verifies ExchangeSeoGovernorAdapter end-to-end classification, sanctuary, and markup."""
    # 1. Classification
    idx = ExchangeSeoGovernorAdapter.classify_indexability(
        route="/exchange/skills/sample",
        trials_n=200,
        has_evidence_passport=True,
        has_reproducible_benchmark=True,
    )
    assert idx["status"] == "INDEXABLE"

    # 2. Sanctuary
    assert ExchangeSeoGovernorAdapter.enforce_ad_sanctuary(
        route="/exchange/skills/sample",
        has_ads=True,
    ) is True

    with pytest.raises(AdSanctuaryViolationError):
        ExchangeSeoGovernorAdapter.enforce_ad_sanctuary(
            route="/workspace/private-task",
            has_ads=True,
        )

    # 3. Structured Data
    ld = ExchangeSeoGovernorAdapter.generate_structured_data(
        schema_type="SoftwareApplication",
        data={
            "name": "@skill/sample",
            "rating_value": 4.8,
            "rating_count": 200,
            "evidence_passport_id": "EVP-123",
        },
    )
    assert ld["@type"] == "SoftwareApplication"
    assert ld["identifier"] == "EVP-123"

    # 4. Page Markup
    out_html = tmp_path / "sample_page.html"
    markup = ExchangeSeoGovernorAdapter.generate_page_markup(
        route="/exchange/skills/sample",
        title="Sample Skill Evidence Audit",
        canonical_url="https://spe.run/exchange/skills/sample",
        breadcrumbs=[("Exchange", "/exchange"), ("Sample", "/exchange/skills/sample")],
        comparative_data=[{"metric": "Success", "candidate": "95%", "baseline": "80%", "delta": "+15%"}],
        methodology_text="200 trials on Claude Code",
        reproducible_command="spe bench",
        wilson_score_lower_bound=0.92,
        trials_n=200,
        output_path=str(out_html),
    )

    assert out_html.exists()
    assert "<!DOCTYPE html>" in markup
    assert "spe-header-zone" in markup
    assert "spe-core-value-zone" in markup
    assert "spe-footer-zone" in markup
