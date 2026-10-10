"""Data models for SPE Ω Quantum Cost Supercompiler (QCS) and Economic Optimization."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class CostTier(str, Enum):
    """Model operational cost tier."""
    FRONTIER = "FRONTIER"          # e.g. Claude 6.2 Sonnet / GPT-6.1 (~$3-$15 / M tokens)
    COMPACT = "COMPACT"            # e.g. Claude 6.2 Haiku / GPT-6.1-mini (~$0.15-$0.60 / M tokens)
    LOCAL_ZERO = "LOCAL_ZERO"      # Local / Air-Gapped / In-Memory ($0.00 / M tokens)
    DETERMINISTIC = "DETERMINISTIC"# WASM / Python Code ($0.00 / 0 tokens)


@dataclass(frozen=True)
class KVPrefixLayout:
    """Canonical KV-Cache block-aligned prompt layout for maximum cache hit ratios."""
    canonical_prefix: str
    dynamic_suffix: str
    prefix_tokens: int
    suffix_tokens: int
    alignment_block_size: int
    padding_tokens_added: int
    predicted_cache_hit_rate: float
    canonical_prefix_hash: str


@dataclass
class DeterministicOffloadResult:
    """Outcome of offloading semantic operations from LLM to deterministic code."""
    offloaded_tasks: List[str]
    saved_tokens: int
    saved_cost_usd: float
    execution_latency_ms: float
    deterministic_success: bool


@dataclass
class SpeculativeCascadeResult:
    """Outcome of epistemic speculative execution with behavioral deoptimization."""
    attempted_tier: CostTier
    committed_tier: CostTier
    deoptimized: bool
    deopt_reason: Optional[str]
    tokens_consumed: int
    cost_usd: float
    invariants_satisfied: bool


@dataclass
class TotalSavingsReport:
    """Comprehensive multi-pillar economic audit demonstrating quantified cost reduction."""
    baseline_naive_cost_usd: float
    spe_optimized_cost_usd: float
    net_cost_reduction_percent: float
    kv_cache_savings_usd: float
    deterministic_offload_savings_usd: float
    speculative_cascade_savings_usd: float
    essa_salvaged_compute_savings_usd: float
    tokens_saved_total: int
    projected_annual_savings_100k_tasks_usd: float

    def to_summary(self) -> str:
        lines = [
            "=== SPE Ω Quantum Cost Supercompiler (QCS) Economic Audit ===",
            f"Baseline Unoptimized Cost:   ${self.baseline_naive_cost_usd:.4f}",
            f"SPE Ω Optimized Cost:         ${self.spe_optimized_cost_usd:.4f}",
            f"NET COST REDUCTION:          {self.net_cost_reduction_percent:.1f}% SAVINGS",
            f"  - KV Prefix Cache Savings:  ${self.kv_cache_savings_usd:.4f}",
            f"  - Deterministic Offloading: ${self.deterministic_offload_savings_usd:.4f}",
            f"  - Speculative Cascades:     ${self.speculative_cascade_savings_usd:.4f}",
            f"  - ESSA Compute Salvaging:   ${self.essa_salvaged_compute_savings_usd:.4f}",
            f"Tokens Saved:                 {self.tokens_saved_total:,} tokens",
            f"Projected Annual ROI (100k):  ${self.projected_annual_savings_100k_tasks_usd:,.2f} saved",
            "=============================================================",
        ]
        return "\n".join(lines)
