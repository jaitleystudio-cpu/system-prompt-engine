"""Tests for Gilden Moat Operator and authority/economic invariants."""

import pytest
from spe_runtime.gilden.kernel import (
    BudgetExhaustionError,
    GildenKernel,
    GildenStore,
    UnauthorizedActionError,
)
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


def test_gilden_kernel_effect_receipt_generation(tmp_path):
    """Verify that external actions produce verifiable EFFECT_RECEIPT records."""
    kernel = GildenKernel(
        storage_dir=tmp_path / "gilden_run",
        max_budget_usd=50.0,
        authority_grant_id="FOUNDER-EXEC-GRANT-01",
    )

    expected = {"status_code": 200, "indexed_pages": 5}
    def mock_actor():
        return {"status_code": 200, "indexed_pages": 5}

    job = kernel.execute_job(
        job_id="job-seo-verify-01",
        idempotency_key="idem-seo-verify-01",
        action="VERIFY_INDEXED_SITEMAP",
        cost_usd=1.25,
        expected_effect=expected,
        actor_fn=mock_actor,
    )

    assert job.status == "VERIFIED"
    assert job.effect_receipt is not None
    assert job.effect_receipt.verification_status == "VERIFIED"
    assert job.effect_receipt.cost_usd == 1.25
    assert len(job.effect_receipt.payload_digest) == 64


def test_gilden_kernel_duplicate_job_idempotency(tmp_path):
    """Verify that submitting duplicate jobs returns cached result without re-executing."""
    kernel = GildenKernel(
        storage_dir=tmp_path / "gilden_idem",
        max_budget_usd=50.0,
        authority_grant_id="FOUNDER-EXEC-GRANT-01",
    )

    call_count = [0]
    def counting_actor():
        call_count[0] += 1
        return {"result": "success"}

    # First execution
    job1 = kernel.execute_job(
        job_id="job-fetch-01",
        idempotency_key="key-idempotent-42",
        action="FETCH_DRIFT_SIGNAL",
        cost_usd=2.0,
        expected_effect={"result": "success"},
        actor_fn=counting_actor,
    )
    assert call_count[0] == 1
    assert kernel.budget_guard.consumed_budget_usd == 2.0

    # Second execution with same idempotency key
    job2 = kernel.execute_job(
        job_id="job-fetch-01-retry",
        idempotency_key="key-idempotent-42",
        action="FETCH_DRIFT_SIGNAL",
        cost_usd=2.0,
        expected_effect={"result": "success"},
        actor_fn=counting_actor,
    )
    # Actor function was NOT called again; budget was NOT billed again
    assert call_count[0] == 1
    assert kernel.budget_guard.consumed_budget_usd == 2.0
    assert job2.job_id == job1.job_id


def test_gilden_kernel_budget_exhaustion_stop(tmp_path):
    """Verify that actions exceeding the hard budget ceiling are strictly blocked."""
    kernel = GildenKernel(
        storage_dir=tmp_path / "gilden_budget",
        max_budget_usd=10.0,
        authority_grant_id="FOUNDER-EXEC-GRANT-01",
    )

    def dummy_actor():
        return {"status": "ok"}

    # First job uses $8 of $10
    kernel.execute_job(
        job_id="job-b1",
        idempotency_key="idem-b1",
        action="DATA_FETCH",
        cost_usd=8.0,
        expected_effect={"status": "ok"},
        actor_fn=dummy_actor,
    )
    assert kernel.budget_guard.remaining_budget_usd == 2.0

    # Second job requests $5 -> exceeds $2 remaining
    with pytest.raises(BudgetExhaustionError, match="exceeds remaining budget"):
        kernel.execute_job(
            job_id="job-b2",
            idempotency_key="idem-b2",
            action="DATA_FETCH",
            cost_usd=5.0,
            expected_effect={"status": "ok"},
            actor_fn=dummy_actor,
        )


def test_gilden_kernel_store_restart_recovery(tmp_path):
    """Verify that append-only log safely survives crash-restarts and reloads jobs."""
    store_dir = tmp_path / "gilden_crash_store"
    kernel1 = GildenKernel(
        storage_dir=store_dir,
        max_budget_usd=100.0,
        authority_grant_id="FOUNDER-EXEC-GRANT-01",
    )

    kernel1.execute_job(
        job_id="job-crash-1",
        idempotency_key="idem-crash-1",
        action="RECORD_SIGNAL",
        cost_usd=3.5,
        expected_effect={"signal": "saved"},
        actor_fn=lambda: {"signal": "saved"},
    )

    # Simulate crash and restart: create kernel2 pointing to same store_dir
    kernel2 = GildenKernel(
        storage_dir=store_dir,
        max_budget_usd=100.0,
        authority_grant_id="FOUNDER-EXEC-GRANT-01",
    )

    recovered_job = kernel2.store.get_job("job-crash-1")
    assert recovered_job is not None
    assert recovered_job.action == "RECORD_SIGNAL"
    assert recovered_job.status == "VERIFIED"
    assert recovered_job.effect_receipt is not None
    assert recovered_job.effect_receipt.cost_usd == 3.5

    # Idempotency map is restored from disk
    same_job = kernel2.store.find_by_idempotency_key("idem-crash-1")
    assert same_job is not None
    assert same_job.job_id == "job-crash-1"
