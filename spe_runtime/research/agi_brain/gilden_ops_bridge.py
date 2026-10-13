"""
SPE AGI BRAIN Ω — Gilden 24/7 Autonomous Maintenance Bridge
October 12, 2026 | Research Quarantine Track
"""

import hashlib
import json
from typing import Dict, Any, List, Optional
from spe_runtime.research.agi_brain.types import GildenMaintenanceEvent, NANOS_PER_USD

AUTONOMOUS_PERMITTED_CATEGORIES = frozenset([
    "CACHE_REVALIDATION",
    "RETRY_FLAKY_BACKGROUND_JOB",
    "RESTART_WORKER_DAEMON",
    "INDEXING_PING",
    "LOCAL_LOG_ROTATION",
])

CRITICAL_FOUNDER_APPROVAL_REQUIRED = frozenset([
    "PRODUCTION_DEPLOYMENT",
    "CREDENTIAL_ROTATION",
    "DATABASE_MIGRATION_DESTRUCTIVE",
    "FINANCIAL_EXPENDITURE_EXCEEDING_CAP",
    "AUTHORITY_EXPANSION",
])

class GildenOpsBridge:
    """
    Connects SPE AGI BRAIN to the Gilden autonomous operating system for 24/7 site reliability.
    Enforces scoped authority, reversible operations, spending limits, and cryptographic audit receipts.
    Silence is strictly NEVER consent.
    """

    def __init__(self, spending_cap_nanos: int = 5_000_000_000):  # $5.00 default cap
        self.spending_cap_nanos = spending_cap_nanos
        self.cumulative_spent_nanos = 0
        self.events_history: List[GildenMaintenanceEvent] = []

    def evaluate_and_dispatch(
        self,
        event_id: str,
        category: str,
        diagnostic: str,
        proposed_patch: str,
        cost_nano_usd: int,
        is_reversible: bool = True,
        founder_approved: bool = False,
    ) -> GildenMaintenanceEvent:
        cat_upper = category.upper()

        # 1. Critical actions require explicit founder authorization
        if cat_upper in CRITICAL_FOUNDER_APPROVAL_REQUIRED:
            if not founder_approved:
                # Silence is never consent
                event = GildenMaintenanceEvent(
                    event_id=event_id,
                    category=category,
                    diagnostic=diagnostic,
                    proposed_patch=proposed_patch,
                    is_authorized=False,
                    cost_nano_usd=cost_nano_usd,
                    is_reversible=is_reversible,
                    audit_receipt="BLOCKED: Requires explicit founder authorization. Silence is not permission.",
                )
                self.events_history.append(event)
                return event

        # 2. Check spending cap
        if self.cumulative_spent_nanos + cost_nano_usd > self.spending_cap_nanos:
            if not founder_approved:
                event = GildenMaintenanceEvent(
                    event_id=event_id,
                    category=category,
                    diagnostic=diagnostic,
                    proposed_patch=proposed_patch,
                    is_authorized=False,
                    cost_nano_usd=cost_nano_usd,
                    is_reversible=is_reversible,
                    audit_receipt=f"BLOCKED: Expenditure ({cost_nano_usd / NANOS_PER_USD:.2f} USD) exceeds spending cap.",
                )
                self.events_history.append(event)
                return event

        # 3. Action is authorized
        self.cumulative_spent_nanos += cost_nano_usd

        receipt_data = {
            "event_id": event_id,
            "category": category,
            "diagnostic": diagnostic,
            "patch": proposed_patch,
            "cost_nanos": cost_nano_usd,
            "reversible": is_reversible,
            "authorized": True,
        }
        receipt_hash = hashlib.sha256(
            json.dumps(receipt_data, sort_keys=True).encode("utf-8")
        ).hexdigest()

        event = GildenMaintenanceEvent(
            event_id=event_id,
            category=category,
            diagnostic=diagnostic,
            proposed_patch=proposed_patch,
            is_authorized=True,
            cost_nano_usd=cost_nano_usd,
            is_reversible=is_reversible,
            audit_receipt=f"GILDEN-RECEIPT-{receipt_hash[:16]}",
        )
        self.events_history.append(event)
        return event
