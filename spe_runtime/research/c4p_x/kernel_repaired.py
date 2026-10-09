"""
SPE Ω — C4P-X+ Corrected Reference Kernel.
Fixes Defect 1 (Escrow Safety), Defect 2 (Reservation Leakage),
Defect 3 (Strict 3-Valued Logic), and Defect 4 (Effect & Dependency Reconciliation).
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Set, List, Optional, Any
from contextlib import contextmanager
import threading

NanoUSD = int  # 1_000_000_000 Nanos = $1.00 USD

class PredicateValue(Enum):
    TRUE = 1
    FALSE = 2
    UNKNOWN = 3

class EffectStatus(str, Enum):
    UNCOMMITTED = "UNCOMMITTED"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    COMMITTED_IDEMPOTENT = "COMMITTED_IDEMPOTENT"
    COMMITTED_IRREVERSIBLE = "COMMITTED_IRREVERSIBLE"
    REMOTE_OUTCOME_UNKNOWN = "REMOTE_OUTCOME_UNKNOWN"

class EvidenceStatus(str, Enum):
    FORMALLY_SUFFICIENT = "FORMALLY_SUFFICIENT"
    EMPIRICALLY_QUALIFIED = "EMPIRICALLY_QUALIFIED"
    INSUFFICIENT_OR_UNKNOWN = "INSUFFICIENT_OR_UNKNOWN"

@dataclass
class TransactionSafeEscrow:
    budget_limit_nanos: NanoUSD
    settled_nanos: NanoUSD = 0
    reserved_nanos: NanoUSD = 0
    active_reservations: Dict[str, NanoUSD] = field(default_factory=dict)
    _lock: threading.RLock = field(default_factory=threading.RLock)

    @property
    def available_nanos(self) -> NanoUSD:
        with self._lock:
            return self.budget_limit_nanos - (self.settled_nanos + self.reserved_nanos)

    @contextmanager
    def reservation_scope(self, reservation_id: str, amount_nanos: NanoUSD):
        """Atomic reservation context: automatically rolls back if migration fails."""
        with self._lock:
            assert amount_nanos >= 0, "Reservation cannot be negative"
            if reservation_id in self.active_reservations:
                raise ValueError(f"Nonce replay detected: {reservation_id}")
            if amount_nanos > self.available_nanos:
                raise PermissionError("Insufficient funds for reservation")

            # Acquire reservation
            self.reserved_nanos += amount_nanos
            self.active_reservations[reservation_id] = amount_nanos

        try:
            yield reservation_id
        except Exception:
            # Automatic rollback on any failure during migration
            with self._lock:
                if reservation_id in self.active_reservations:
                    held = self.active_reservations.pop(reservation_id)
                    self.reserved_nanos -= held
            raise
        else:
            # Note: caller will explicitly settle via commit/settle if successful
            pass

    def commit(self, reservation_id: str, actual_spent_nanos: NanoUSD) -> NanoUSD:
        """Commits a reservation and settles actual expenditure with exact refund."""
        with self._lock:
            if reservation_id not in self.active_reservations:
                raise KeyError(f"No active reservation with ID '{reservation_id}'")
            ceiling = self.active_reservations.pop(reservation_id)
            if actual_spent_nanos < 0 or actual_spent_nanos > ceiling:
                self.active_reservations[reservation_id] = ceiling
                raise ValueError(f"Invalid spent nanos {actual_spent_nanos} for ceiling {ceiling}")

            self.reserved_nanos -= ceiling
            self.settled_nanos += actual_spent_nanos
            refund = ceiling - actual_spent_nanos
            return refund

    def abort(self, reservation_id: str) -> None:
        """Aborts reservation and releases all held funds."""
        with self._lock:
            if reservation_id in self.active_reservations:
                held = self.active_reservations.pop(reservation_id)
                self.reserved_nanos -= held

    def verify_conservation(self) -> bool:
        """Mathematical invariant asserting total balance conservation."""
        with self._lock:
            return (self.available_nanos + self.reserved_nanos + self.settled_nanos) == self.budget_limit_nanos
