"""Entitlement and Subscription Lifecycle Manager with Replaceable Payment Webhooks."""

from __future__ import annotations

import hashlib
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from spe_runtime.entitlement.models import (
    DEFAULT_PLANS,
    EntitlementState,
    PlanDefinition,
    PlanTier,
    SubscriptionStatus,
    UsageQuota,
)


class DuplicateWebhookError(Exception):
    """Raised when a payment webhook event has already been processed."""


class EntitlementError(Exception):
    """Raised on invalid entitlement transitions or quota violations."""


class EntitlementManager:
    def __init__(self) -> None:
        self._customers: dict[str, EntitlementState] = {}
        self._processed_event_ids: set[str] = set()
        self._last_event_timestamps: dict[str, int] = {}
        self._lock = threading.Lock()

    def get_or_create_customer(self, customer_id: str) -> EntitlementState:
        if customer_id not in self._customers:
            now = datetime.now(timezone.utc)
            self._customers[customer_id] = EntitlementState(
                customer_id=customer_id,
                plan_tier=PlanTier.FREE,
                subscription_status=SubscriptionStatus.ACTIVE,
                valid_until=(now + timedelta(days=3650)).isoformat(),
            )
        return self._customers[customer_id]

    def get_plan(self, tier: PlanTier) -> PlanDefinition:
        return DEFAULT_PLANS[tier]

    def upgrade_plan(
        self,
        customer_id: str,
        new_tier: PlanTier,
        duration_days: int = 30,
        current_time_iso: str | None = None,
    ) -> EntitlementState:
        cust = self.get_or_create_customer(customer_id)
        now_dt = datetime.fromisoformat(current_time_iso) if current_time_iso else datetime.now(timezone.utc)
        cust.plan_tier = new_tier
        cust.subscription_status = SubscriptionStatus.ACTIVE
        cust.valid_until = (now_dt + timedelta(days=duration_days)).isoformat()
        return cust

    def cancel_subscription(self, customer_id: str) -> EntitlementState:
        cust = self.get_or_create_customer(customer_id)
        cust.subscription_status = SubscriptionStatus.CANCELED
        return cust

    def process_refund(self, customer_id: str) -> EntitlementState:
        cust = self.get_or_create_customer(customer_id)
        cust.plan_tier = PlanTier.FREE
        cust.subscription_status = SubscriptionStatus.EXPIRED
        return cust

    def can_run_evaluation(self, customer_id: str) -> bool:
        cust = self.get_or_create_customer(customer_id)
        if not cust.is_active():
            return False
        plan = self.get_plan(cust.plan_tier)
        return cust.quota.can_run_eval(plan.max_local_evals_per_month)

    def record_evaluation_run(self, customer_id: str, count: int = 1) -> None:
        cust = self.get_or_create_customer(customer_id)
        cust.quota.record_eval(count)

    def process_payment_webhook(self, event: dict[str, Any]) -> dict[str, Any]:
        """Processes generic payment provider webhooks (e.g., Stripe/Paddle/Polar)
        with idempotency deduplication, timestamp ordering, and resurrection prevention.
        """
        with self._lock:
            event_id = event.get("id")
            event_type = event.get("type")
            if not event_id:
                raise EntitlementError("Missing webhook event ID")

            # Idempotency / replay check
            if event_id in self._processed_event_ids:
                raise DuplicateWebhookError(f"Duplicate webhook event: {event_id}")

            data = event.get("data", {}).get("object", {})
            customer_id = data.get("customer") or data.get("customer_id") or "anonymous"

            # Out-of-order event check
            created = event.get("created")
            if created is not None:
                last_created = self._last_event_timestamps.get(customer_id)
                if last_created is not None and created < last_created:
                    return {
                        "status": "IGNORED_OUT_OF_ORDER",
                        "event": event_type,
                        "customer": customer_id,
                        "reason": f"Event timestamp {created} is older than last processed {last_created}",
                    }
                self._last_event_timestamps[customer_id] = created

            self._processed_event_ids.add(event_id)
            cust = self.get_or_create_customer(customer_id)

            if event_type == "checkout.session.completed":
                tier_str = data.get("metadata", {}).get("tier", "PRO").upper()
                tier = PlanTier(tier_str) if tier_str in PlanTier.__members__ else PlanTier.PRO
                self.upgrade_plan(customer_id, tier, duration_days=30)
                return {"status": "SUCCESS", "event": event_type, "customer": customer_id, "tier": tier.value}

            elif event_type == "invoice.payment_failed":
                cust.subscription_status = SubscriptionStatus.PAST_DUE
                return {"status": "PAST_DUE", "event": event_type, "customer": customer_id}

            elif event_type == "charge.refunded":
                self.process_refund(customer_id)
                return {"status": "REFUNDED", "event": event_type, "customer": customer_id}

            elif event_type == "customer.subscription.deleted":
                self.cancel_subscription(customer_id)
                return {"status": "CANCELED", "event": event_type, "customer": customer_id}

            elif event_type == "customer.subscription.updated":
                # Subscription resurrection defense: cancelled/expired subscription cannot be revived by subscription.updated
                if cust.subscription_status in (SubscriptionStatus.CANCELED, SubscriptionStatus.EXPIRED):
                    return {
                        "status": "BLOCKED_RESURRECTION",
                        "event": event_type,
                        "customer": customer_id,
                        "reason": "Canceled subscription cannot be resurrected by subscription.updated event",
                    }
                tier_str = data.get("metadata", {}).get("tier", "PRO").upper()
                tier = PlanTier(tier_str) if tier_str in PlanTier.__members__ else PlanTier.PRO
                self.upgrade_plan(customer_id, tier, duration_days=30)
                return {"status": "UPDATED", "event": event_type, "customer": customer_id, "tier": tier.value}

            return {"status": "IGNORED", "event": event_type}
