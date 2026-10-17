"""Gilden Moat Operator: Autonomous commercial and moat synthesis under strict external authority."""

from __future__ import annotations

import datetime
from typing import Any

from .models import (
    CompetitorWatchEntry,
    FailureWatchCluster,
    FounderDailyReport,
    ModelWatchSignal,
    RevenueMetric,
    SearchOpportunity,
)


class GildenMoatOperator:
    # Architectural Invariants
    GILDEN_CAN_SELF_GRANT_AUTHORITY: bool = False
    SPECULATIVE_UPLIFT_FACTOR: float = 0.0

    def __init__(self, authority_grant_id: str | None = None) -> None:
        """Initialize Gilden Moat Operator.
        
        Requires an explicit external authority grant. Gilden cannot self-grant authority.
        """
        self.authority_grant_id = authority_grant_id
        self._model_signals: list[ModelWatchSignal] = []
        self._failure_clusters: list[FailureWatchCluster] = []
        self._competitor_entries: list[CompetitorWatchEntry] = []
        self._search_opportunities: list[SearchOpportunity] = []
        self._last_reconciled_revenue: RevenueMetric | None = None
        self._commercial_state_frozen: bool = False

    def check_authority(self) -> bool:
        """Returns True only if an external founder authority grant is active."""
        if not self.authority_grant_id or self.authority_grant_id.strip() == "":
            return False
        # Reject self-issued or claimant grants
        if any(bad in self.authority_grant_id.lower() for bad in ["self", "gilden", "auto", "default"]):
            return False
        return True

    def freeze_commercial_state(self) -> dict[str, Any]:
        """Freezes commercial control state when Gilden is unavailable or grant expires.
        
        Invariant: Free SPE access continues; commercial state remains at last approved configuration.
        """
        self._commercial_state_frozen = True
        return {
            "commercial_state": "FROZEN",
            "free_spe_usage": "CONTINUES_UNINTERRUPTED",
            "last_approved_configuration_retained": True,
        }

    def ingest_model_drift(self, signals: list[ModelWatchSignal]) -> None:
        self._model_signals.extend(signals)

    def ingest_failure_clusters(self, clusters: list[FailureWatchCluster]) -> None:
        self._failure_clusters.extend(clusters)

    def ingest_competitor_diffs(self, entries: list[CompetitorWatchEntry]) -> None:
        self._competitor_entries.extend(entries)

    def ingest_search_opportunities(self, opportunities: list[SearchOpportunity]) -> None:
        self._search_opportunities.extend(opportunities)

    def reconcile_revenue(
        self,
        date_str: str,
        gross_marketplace_commission: float,
        compute_revenue_gross: float,
        compute_cost_ledger: float,
    ) -> RevenueMetric:
        """Reconciles daily commercial earnings and costs with 0% speculative uplift."""
        net = gross_marketplace_commission + (compute_revenue_gross - compute_cost_ledger)
        metric = RevenueMetric(
            date=date_str,
            gross_marketplace_commission=round(gross_marketplace_commission, 2),
            compute_revenue_gross=round(compute_revenue_gross, 2),
            compute_cost_ledger=round(compute_cost_ledger, 2),
            net_contribution=round(net, 2),
            speculative_uplift_assumed=self.SPECULATIVE_UPLIFT_FACTOR,
        )
        self._last_reconciled_revenue = metric
        return metric

    def generate_founder_daily_report(self) -> FounderDailyReport:
        """Synthesizes all signals into an executive daily briefing with proposed bounded experiments."""
        if not self.check_authority():
            raise PermissionError(
                "GILDEN_CAN_SELF_GRANT_AUTHORITY = NO. Valid external founder authority grant is required."
            )

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        report_id = f"GILDEN-FDR-{datetime.date.today().strftime('%Y%m%d')}"

        # Synthesize proposed bounded experiments
        proposed_experiments: list[dict[str, Any]] = []

        # If model drift detected, propose bounded regression canary test
        for s in self._model_signals:
            if abs(s.delta_pct) >= 5.0:
                proposed_experiments.append({
                    "experiment_type": "MODEL_DRIFT_CANARY",
                    "target_model": s.model_id,
                    "hypothesis": f"Mitigate {s.drift_metric} drop of {s.delta_pct}% using instruction firewall & prompt hardening",
                    "bounded_budget_usd": 25.0,  # Bounded budget cap
                    "requires_founder_approval": True,
                    "safe_fallback": "Pin model to previous stable snapshot",
                })

        # If high-volume search opportunities exist, propose acquisition page publish
        for opp in self._search_opportunities:
            if opp.estimated_search_volume >= 500 and opp.organic_readiness == "READY":
                proposed_experiments.append({
                    "experiment_type": "SEO_ACQUISITION_LAUNCH",
                    "target_route": opp.target_route,
                    "hypothesis": f"Capture '{opp.query_slug}' intent (vol: {opp.estimated_search_volume}/mo) with verified free tool route",
                    "bounded_budget_usd": 0.0,
                    "requires_founder_approval": True,
                    "safe_fallback": "Keep route unpublished (404/noindex)",
                })

        rev = self._last_reconciled_revenue or RevenueMetric(
            date=datetime.date.today().isoformat(),
            gross_marketplace_commission=0.0,
            compute_revenue_gross=0.0,
            compute_cost_ledger=0.0,
            net_contribution=0.0,
            speculative_uplift_assumed=0.0,
        )

        # Build executive markdown
        md = [
            f"# GILDEN Ω — Founder Daily Advisory ({report_id})",
            f"**Authority Grant ID:** `{self.authority_grant_id}` | **Generated:** {now_iso}",
            "",
            "## 1. Commercial Performance & Unit Economics",
            f"- Marketplace Commission: ${rev.gross_marketplace_commission:,.2f}",
            f"- Compute Revenue (Gross): ${rev.compute_revenue_gross:,.2f}",
            f"- Compute Cost Ledger: ${rev.compute_cost_ledger:,.2f}",
            f"- **Net Contribution:** ${rev.net_contribution:,.2f}",
            f"- Speculative Uplift Assumed: **{rev.speculative_uplift_assumed * 100.0:.1f}% (Rule H14 Enforced)**",
            "",
            "## 2. Model Watch Sentinel",
            f"- Active Signals: {len(self._model_signals)}",
        ]
        for s in self._model_signals:
            md.append(f"  - **{s.model_id}**: {s.drift_metric} Δ {s.delta_pct}% ({s.provenance_class}) → {s.action_recommendation}")

        md.extend([
            "",
            "## 3. Failure Genome Clusters",
            f"- Identified Clusters: {len(self._failure_clusters)}",
        ])
        for c in self._failure_clusters:
            md.append(f"  - **[{c.cluster_id}] {c.pattern_name}** ({c.count} occurrences): {c.recommended_countermeasure} (Ref: `{c.example_genome_id}`)")

        md.extend([
            "",
            "## 4. Competitor Moat Audit",
            f"- Tracked Entries: {len(self._competitor_entries)}",
        ])
        for comp in self._competitor_entries:
            md.append(f"  - **{comp.competitor_name}** ({comp.feature_compared}): SPE Advantage: *{comp.spe_advantage}*")

        md.extend([
            "",
            "## 5. High-Intent Search Opportunities",
            f"- Discovered Routes: {len(self._search_opportunities)}",
        ])
        for opp in self._search_opportunities:
            md.append(f"  - Route `{opp.target_route}`: {opp.query_slug} ({opp.estimated_search_volume}/mo) [{opp.organic_readiness}]")

        md.extend([
            "",
            "## 6. Proposed Bounded Experiments (Requires Founder Sign-off)",
            f"- Pending Proposals: {len(proposed_experiments)}",
        ])
        for exp in proposed_experiments:
            md.append(f"  - `[{exp['experiment_type']}]` Budget: ${exp['bounded_budget_usd']} | {exp['hypothesis']}")

        brief_text = "\n".join(md)

        return FounderDailyReport(
            report_id=report_id,
            generated_at=now_iso,
            authority_grant_id=self.authority_grant_id,
            model_watch_signals=list(self._model_signals),
            failure_clusters=list(self._failure_clusters),
            competitor_watch=list(self._competitor_entries),
            search_opportunities=list(self._search_opportunities),
            revenue_summary=rev,
            proposed_bounded_experiments=proposed_experiments,
            status="PENDING_FOUNDER_APPROVAL",
            markdown_brief=brief_text,
        )
