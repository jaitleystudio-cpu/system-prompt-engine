"""Gilden Kernel: Commercial orchestration, moat operations, and founder advisory."""

from .models import (
    CompetitorWatchEntry,
    FailureWatchCluster,
    FounderDailyReport,
    ModelWatchSignal,
    RevenueMetric,
    SearchOpportunity,
)
from .operator import GildenMoatOperator

__all__ = [
    "CompetitorWatchEntry",
    "FailureWatchCluster",
    "FounderDailyReport",
    "GildenMoatOperator",
    "ModelWatchSignal",
    "RevenueMetric",
    "SearchOpportunity",
]
