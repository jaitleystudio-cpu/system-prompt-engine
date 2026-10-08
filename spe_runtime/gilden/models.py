"""Data models for Gilden moat operations and commercial advisory."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ModelWatchSignal:
    model_id: str
    timestamp: str
    drift_metric: str
    baseline_value: float
    observed_value: float
    delta_pct: float
    provenance_class: str  # OBSERVED_LOCAL, OBSERVED_REMOTE, SIMULATED, CALIBRATED_ESTIMATE
    action_recommendation: str


@dataclass
class FailureWatchCluster:
    cluster_id: str
    pattern_name: str
    count: int
    affected_models: list[str]
    poisoning_resistance_verified: bool
    example_genome_id: str  # Format: SPE-FG-YYYY-NNNNNN
    recommended_countermeasure: str


@dataclass
class CompetitorWatchEntry:
    competitor_name: str
    feature_compared: str
    spe_advantage: str
    gaps_identified: list[str]
    evidence_link: str


@dataclass
class SearchOpportunity:
    query_slug: str
    intent_category: str
    estimated_search_volume: int
    target_route: str
    monetization_tier: str
    organic_readiness: str  # READY, NEEDS_CONTENT, HOLD


@dataclass
class RevenueMetric:
    date: str
    gross_marketplace_commission: float
    compute_revenue_gross: float
    compute_cost_ledger: float
    net_contribution: float
    speculative_uplift_assumed: float = 0.0  # Invariant: Gilden assumes 0% speculative uplift
    currency: str = "USD"


@dataclass
class FounderDailyReport:
    report_id: str
    generated_at: str
    authority_grant_id: str
    model_watch_signals: list[ModelWatchSignal]
    failure_clusters: list[FailureWatchCluster]
    competitor_watch: list[CompetitorWatchEntry]
    search_opportunities: list[SearchOpportunity]
    revenue_summary: RevenueMetric
    proposed_bounded_experiments: list[dict[str, Any]]
    status: str  # PENDING_FOUNDER_APPROVAL, APPROVED, REJECTED
    markdown_brief: str
