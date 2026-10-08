"""Tests for Gilden Moat Operator and authority/economic invariants."""

import pytest
from spe_runtime.gilden.models import (
    CompetitorWatchEntry,
    FailureWatchCluster,
    ModelWatchSignal,
    SearchOpportunity,
)
from spe_runtime.gilden.operator import GildenMoatOperator


def test_gilden_authority_invariants():
    # Invariant: GILDEN cannot self-grant authority
    assert GildenMoatOperator.GILDEN_CAN_SELF_GRANT_AUTHORITY is False
    assert GildenMoatOperator.SPECULATIVE_UPLIFT_FACTOR == 0.0

    # Without authority grant, report generation is rejected
    unauthorized_operator = GildenMoatOperator(authority_grant_id=None)
    assert unauthorized_operator.check_authority() is False
    with pytest.raises(PermissionError, match="GILDEN_CAN_SELF_GRANT_AUTHORITY = NO"):
        unauthorized_operator.generate_founder_daily_report()

    # Self-issued grant is rejected
    self_operator = GildenMoatOperator(authority_grant_id="GILDEN_SELF_GRANT_001")
    assert self_operator.check_authority() is False
    with pytest.raises(PermissionError):
        self_operator.generate_founder_daily_report()

    # Valid founder grant is accepted
    valid_operator = GildenMoatOperator(authority_grant_id="FOUNDER-GRANT-2026-10-ALPHA")
    assert valid_operator.check_authority() is True


def test_gilden_freeze_commercial_state():
    operator = GildenMoatOperator(authority_grant_id="FOUNDER-GRANT-2026-10-ALPHA")
    result = operator.freeze_commercial_state()
    assert result["commercial_state"] == "FROZEN"
    assert result["free_spe_usage"] == "CONTINUES_UNINTERRUPTED"
    assert result["last_approved_configuration_retained"] is True


def test_gilden_reconciliation_zero_speculative_uplift():
    operator = GildenMoatOperator(authority_grant_id="FOUNDER-GRANT-2026-10-ALPHA")
    rev = operator.reconcile_revenue(
        date_str="2026-10-08",
        gross_marketplace_commission=1250.0,
        compute_revenue_gross=3400.0,
        compute_cost_ledger=2100.0,
    )
    assert rev.gross_marketplace_commission == 1250.0
    assert rev.compute_revenue_gross == 3400.0
    assert rev.compute_cost_ledger == 2100.0
    assert rev.net_contribution == 2550.0
    # Strict invariant: exactly 0% speculative uplift assumed
    assert rev.speculative_uplift_assumed == 0.0


def test_gilden_founder_daily_report_generation():
    operator = GildenMoatOperator(authority_grant_id="FOUNDER-GRANT-2026-10-ALPHA")

    operator.ingest_model_drift([
        ModelWatchSignal(
            model_id="gpt-4o-2026-08",
            timestamp="2026-10-08T00:00:00Z",
            drift_metric="instruction_following_drop",
            baseline_value=0.94,
            observed_value=0.88,
            delta_pct=-6.38,
            provenance_class="OBSERVED_LOCAL",
            action_recommendation="Apply prompt firewall & constraint hardening",
        )
    ])

    operator.ingest_failure_clusters([
        FailureWatchCluster(
            cluster_id="FC-2026-001",
            pattern_name="JSON schema hallucination on tool call",
            count=18,
            affected_models=["claude-3-5-sonnet", "gpt-4o"],
            poisoning_resistance_verified=True,
            example_genome_id="SPE-FG-2026-000042",
            recommended_countermeasure="Enforce PagedAttention structural JSON grammar",
        )
    ])

    operator.ingest_competitor_diffs([
        CompetitorWatchEntry(
            competitor_name="promptfoo",
            feature_compared="Invariant verification",
            spe_advantage="Air-gapped bounded rule consistency and RFC 8785 Ed25519 signatures",
            gaps_identified=["Lacks cryptographic receipt chain"],
            evidence_link="/compare/promptfoo",
        )
    ])

    operator.ingest_search_opportunities([
        SearchOpportunity(
            query_slug="ai-instruction-assurance",
            intent_category="category_ownership",
            estimated_search_volume=1800,
            target_route="/ai-instruction-assurance",
            monetization_tier="TIER_A",
            organic_readiness="READY",
        )
    ])

    operator.reconcile_revenue(
        date_str="2026-10-08",
        gross_marketplace_commission=500.0,
        compute_revenue_gross=1200.0,
        compute_cost_ledger=800.0,
    )

    report = operator.generate_founder_daily_report()
    assert report.report_id.startswith("GILDEN-FDR-")
    assert report.status == "PENDING_FOUNDER_APPROVAL"
    assert len(report.model_watch_signals) == 1
    assert len(report.failure_clusters) == 1
    assert len(report.competitor_watch) == 1
    assert len(report.search_opportunities) == 1
    assert report.revenue_summary.net_contribution == 900.0

    # Check bounded experiments synthesized
    assert len(report.proposed_bounded_experiments) == 2
    for exp in report.proposed_bounded_experiments:
        assert exp["requires_founder_approval"] is True
        assert exp["bounded_budget_usd"] <= 50.0

    # Check markdown brief content
    assert "Rule H14 Enforced" in report.markdown_brief
    assert "GILDEN-FDR-" in report.markdown_brief
    assert "SPE-FG-2026-000042" in report.markdown_brief
