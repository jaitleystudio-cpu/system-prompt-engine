"""Data models for High-Concurrency Multi-Agent Stress Testing."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class StressTestConfig:
    """Configuration parameters for concurrent multi-agent stress simulation."""
    concurrency_threads: int = 16
    total_transactions: int = 1000
    initial_wallet_balance_usd: float = 1000.0
    failure_injection_rate: float = 0.05
    lease_expiry_rate: float = 0.05


@dataclass
class StressTestReceipt:
    """Cryptographically verifiable execution receipt from a concurrency stress run."""
    total_transactions: int
    successful_commits: int
    rejected_unauthorized: int
    rejected_insufficient_budget: int
    race_conditions_prevented: int
    deadlocks_detected: int
    final_wallet_balance_usd: float
    duration_seconds: float
    throughput_tps: float
    ledger_integrity_verified: bool
