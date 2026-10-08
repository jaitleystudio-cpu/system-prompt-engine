"""SPE Commercial Entitlement, Plans, and Subscription Models."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


class PlanTier(str, enum.Enum):
    FREE = "FREE"
    PRO = "PRO"
    TEAM = "TEAM"
    ENTERPRISE = "ENTERPRISE"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    TRIALING = "TRIALING"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    EXPIRED = "EXPIRED"


@dataclass(frozen=True)
class PlanDefinition:
    tier: PlanTier
    name: str
    monthly_price_usd: float
    max_local_evals_per_month: int  # -1 = unlimited
    max_model_atlas_profiles: int
    private_failure_genome_capacity: int
    team_members_limit: int
    has_ci_enforcement: bool
    has_offline_license_support: bool
    has_audit_exports: bool


DEFAULT_PLANS: dict[PlanTier, PlanDefinition] = {
    PlanTier.FREE: PlanDefinition(
        tier=PlanTier.FREE,
        name="SPE Free Community",
        monthly_price_usd=0.0,
        max_local_evals_per_month=100,
        max_model_atlas_profiles=5,
        private_failure_genome_capacity=50,
        team_members_limit=1,
        has_ci_enforcement=False,
        has_offline_license_support=False,
        has_audit_exports=False,
    ),
    PlanTier.PRO: PlanDefinition(
        tier=PlanTier.PRO,
        name="SPE Pro Developer",
        monthly_price_usd=29.0,
        max_local_evals_per_month=2500,
        max_model_atlas_profiles=50,
        private_failure_genome_capacity=1000,
        team_members_limit=1,
        has_ci_enforcement=True,
        has_offline_license_support=False,
        has_audit_exports=True,
    ),
    PlanTier.TEAM: PlanDefinition(
        tier=PlanTier.TEAM,
        name="SPE Team",
        monthly_price_usd=199.0,
        max_local_evals_per_month=25000,
        max_model_atlas_profiles=250,
        private_failure_genome_capacity=10000,
        team_members_limit=15,
        has_ci_enforcement=True,
        has_offline_license_support=True,
        has_audit_exports=True,
    ),
    PlanTier.ENTERPRISE: PlanDefinition(
        tier=PlanTier.ENTERPRISE,
        name="SPE Enterprise Air-Gapped",
        monthly_price_usd=999.0,
        max_local_evals_per_month=-1,
        max_model_atlas_profiles=-1,
        private_failure_genome_capacity=-1,
        team_members_limit=-1,
        has_ci_enforcement=True,
        has_offline_license_support=True,
        has_audit_exports=True,
    ),
}


@dataclass
class UsageQuota:
    period_start: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    local_evals_used: int = 0
    model_profiles_created: int = 0
    private_failures_stored: int = 0

    def can_run_eval(self, limit: int) -> bool:
        if limit == -1:
            return True
        return self.local_evals_used < limit

    def record_eval(self, count: int = 1) -> None:
        self.local_evals_used += count


@dataclass
class EntitlementState:
    customer_id: str
    plan_tier: PlanTier
    subscription_status: SubscriptionStatus
    valid_until: str
    quota: UsageQuota = field(default_factory=UsageQuota)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    offline_license_key: str | None = None
    last_verified_at: str | None = None

    def is_active(self, current_time_iso: str | None = None) -> bool:
        if self.subscription_status not in (SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING):
            return False
        now_ts = current_time_iso or datetime.now(timezone.utc).isoformat()
        if self.last_verified_at and now_ts < self.last_verified_at:
            raise ValueError("Clock rollback detected: current time is earlier than previous verification timestamp.")
        self.last_verified_at = now_ts
        return now_ts <= self.valid_until
