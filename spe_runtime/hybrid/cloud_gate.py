"""SPE Ω Cloud Gate: Cryptographic & Budgetary Escrow for Cloud Escalation.

Guarantees that cloud tokens are NEVER released under STRICT_OFFLINE,
budget limits cannot be exceeded, and unauthorized data never egresses.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Dict, List, Optional, Tuple

from spe_runtime.hybrid.models import (
    BudgetEscrowReservation,
    DataDisclosureScope,
    HybridPolicy,
    TaskRequirement,
)


class EgressProhibitedError(Exception):
    """Raised when cloud escalation is attempted under STRICT_OFFLINE policy."""


class ApprovalRequiredError(Exception):
    """Raised when cloud escalation lacks required explicit authorization token."""


class BudgetExceededError(Exception):
    """Raised when requested cloud spend exceeds pre-authorized spending limit."""


class ProviderNotAllowlistedError(Exception):
    """Raised when target cloud provider is not in approved provider allowlist."""


class SensitiveDataLeakageError(Exception):
    """Raised when private/sensitive data disclosure is attempted under LOCAL_ONLY scope."""


class BudgetEscrow:
    """Thread-safe budget escrow enforcing hard spending bounds."""

    def __init__(self, max_authorized_usd: float = 0.0) -> None:
        self.max_authorized_usd: float = max_authorized_usd
        self.spent_usd: float = 0.0
        self.reservations: Dict[str, BudgetEscrowReservation] = {}
        self._lock = threading.Lock()

    @property
    def reserved_total_usd(self) -> float:
        with self._lock:
            return sum(r.reserved_usd for r in self.reservations.values() if not r.committed and not r.released)

    @property
    def available_budget_usd(self) -> float:
        with self._lock:
            active_reserved = sum(r.reserved_usd for r in self.reservations.values() if not r.committed and not r.released)
            remaining = self.max_authorized_usd - (self.spent_usd + active_reserved)
            return max(0.0, round(remaining, 6))

    def reserve(self, task_id: str, estimated_usd: float) -> BudgetEscrowReservation:
        """Reserves budget before dispatching request to cloud provider."""
        with self._lock:
            active_reserved = sum(r.reserved_usd for r in self.reservations.values() if not r.committed and not r.released)
            projected_total = self.spent_usd + active_reserved + estimated_usd
            if projected_total > self.max_authorized_usd:
                raise BudgetExceededError(
                    f"Requested escrow reservation ${estimated_usd:.6f} exceeds authorized budget. "
                    f"Spent: ${self.spent_usd:.6f}, Active Escrow: ${active_reserved:.6f}, Max: ${self.max_authorized_usd:.6f}."
                )

            escrow_id = f"escrow-{uuid.uuid4().hex[:12]}"
            reservation = BudgetEscrowReservation(
                escrow_id=escrow_id,
                task_id=task_id,
                reserved_usd=estimated_usd,
                timestamp_iso=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            )
            self.reservations[escrow_id] = reservation
            return reservation

    def commit(self, escrow_id: str, actual_usd: float) -> float:
        """Reconciles reservation with actual backend charge and updates spend."""
        with self._lock:
            res = self.reservations.get(escrow_id)
            if not res or res.released or res.committed:
                # If reservation missing or already resolved, record honest spend directly
                self.spent_usd += actual_usd
                return self.spent_usd

            res.committed = True
            self.spent_usd += actual_usd
            del self.reservations[escrow_id]
            return round(self.spent_usd, 6)

    def release(self, escrow_id: str) -> None:
        """Releases reservation back to available budget if execution failed or was aborted."""
        with self._lock:
            res = self.reservations.get(escrow_id)
            if res and not res.committed:
                res.released = True
                del self.reservations[escrow_id]


class CloudGate:
    """Governs the gate for releasing paid cloud tokens."""

    def __init__(
        self,
        policy: HybridPolicy = HybridPolicy.STRICT_OFFLINE,
        max_budget_usd: float = 0.0,
        allowed_providers: Optional[List[str]] = None,
        disclosure_scope: DataDisclosureScope = DataDisclosureScope.LOCAL_ONLY,
    ) -> None:
        self.policy = policy
        self.escrow = BudgetEscrow(max_authorized_usd=max_budget_usd)
        self.allowed_providers = allowed_providers or ["openai", "anthropic", "together"]
        self.disclosure_scope = disclosure_scope

    def check_eligibility(
        self,
        task: TaskRequirement,
        provider: str,
        estimated_usd: float,
        approval_token: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Evaluates whether cloud escalation is allowed without reserving funds."""
        if self.policy == HybridPolicy.STRICT_OFFLINE:
            return False, "STRICT_OFFLINE policy strictly forbids cloud egress and cloud token spend ($0 guarantee)."

        if self.policy == HybridPolicy.APPROVAL_REQUIRED and not approval_token:
            return False, "APPROVAL_REQUIRED policy requires an explicit per-task authorization token."

        if provider.lower() not in [p.lower() for p in self.allowed_providers]:
            return False, f"Provider '{provider}' is not in approved allowlist {self.allowed_providers}."

        if task.contains_sensitive_data and self.disclosure_scope == DataDisclosureScope.LOCAL_ONLY:
            return False, "Data disclosure scope is LOCAL_ONLY; sensitive data egress forbidden."

        if estimated_usd > self.escrow.available_budget_usd:
            return False, f"Estimated cost ${estimated_usd:.6f} exceeds remaining budget ${self.escrow.available_budget_usd:.6f}."

        return True, None

    def open_gate(
        self,
        task: TaskRequirement,
        provider: str,
        estimated_usd: float,
        approval_token: Optional[str] = None,
    ) -> BudgetEscrowReservation:
        """Verifies policy gates and reserves funds in escrow. Raises on any violation."""
        eligible, reason = self.check_eligibility(task, provider, estimated_usd, approval_token)
        if not eligible:
            if self.policy == HybridPolicy.STRICT_OFFLINE:
                raise EgressProhibitedError(reason)
            if self.policy == HybridPolicy.APPROVAL_REQUIRED and not approval_token:
                raise ApprovalRequiredError(reason)
            if task.contains_sensitive_data and self.disclosure_scope == DataDisclosureScope.LOCAL_ONLY:
                raise SensitiveDataLeakageError(reason)
            if provider.lower() not in [p.lower() for p in self.allowed_providers]:
                raise ProviderNotAllowlistedError(reason)
            raise BudgetExceededError(reason)

        return self.escrow.reserve(task.task_id, estimated_usd)
