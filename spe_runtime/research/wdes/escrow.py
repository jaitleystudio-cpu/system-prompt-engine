"""
SPE Ω — Two-Phase Commit (2PC) Cloud Escrow Manager.
Provides exact integer NanoUSD financial accounting with zero balance leakage.
"""

from dataclasses import dataclass
from typing import Dict, Tuple, Optional
import threading
from .types import NanoUSD, validate_nanos


@dataclass(frozen=True)
class EscrowReservation:
    """Pre-allocated funds locked in Phase 1 (Prepare)."""
    reservation_id: str
    task_id: str
    ceiling_nanos: NanoUSD


class TwoPhaseCommitEscrow:
    """
    Two-Phase Commit (2PC) Financial Escrow:
    1. Prepare: Lock estimated maximum ceiling nanos in escrow reservation.
    2. Commit: Settle exact consumed nanos, immediately returning unspent nanos to available pool.
    3. Abort: Fully refund reserved nanos on failure, cancellation, or disconnect.
    
    Invariant:
    available_nanos + committed_nanos + sum(reservations.values()) == initial_bank_nanos
    Balance leakage == 0 NanoUSD.
    """

    def __init__(self, initial_bank_nanos: NanoUSD):
        validate_nanos(initial_bank_nanos, "initial_bank_nanos")
        self._initial_bank_nanos: NanoUSD = initial_bank_nanos
        self._available_nanos: NanoUSD = initial_bank_nanos
        self._committed_nanos: NanoUSD = 0
        self._reservations: Dict[str, EscrowReservation] = {}
        self._lock = threading.Lock()

    @property
    def available_nanos(self) -> NanoUSD:
        with self._lock:
            return self._available_nanos

    @property
    def committed_nanos(self) -> NanoUSD:
        with self._lock:
            return self._committed_nanos

    @property
    def active_reservations_count(self) -> int:
        with self._lock:
            return len(self._reservations)

    def prepare(self, reservation_id: str, task_id: str, ceiling_nanos: NanoUSD) -> EscrowReservation:
        """Phase 1: Reserve ceiling nanos from available pool."""
        validate_nanos(ceiling_nanos, "ceiling_nanos")
        with self._lock:
            if reservation_id in self._reservations:
                raise ValueError(f"Reservation '{reservation_id}' already active")
            if ceiling_nanos > self._available_nanos:
                raise ValueError(
                    f"Insufficient funds: requested {ceiling_nanos} nanos, available {self._available_nanos} nanos"
                )
            self._available_nanos -= ceiling_nanos
            res = EscrowReservation(reservation_id=reservation_id, task_id=task_id, ceiling_nanos=ceiling_nanos)
            self._reservations[reservation_id] = res
            return res

    def commit(self, reservation_id: str, actual_spent_nanos: NanoUSD) -> Tuple[NanoUSD, NanoUSD]:
        """
        Phase 2: Commit actual spend.
        Deducts actual spend from reservation, immediately refunds (ceiling - actual) to available pool.
        Returns (actual_spent_nanos, refunded_nanos).
        """
        validate_nanos(actual_spent_nanos, "actual_spent_nanos")
        with self._lock:
            res = self._reservations.get(reservation_id)
            if res is None:
                raise KeyError(f"Reservation '{reservation_id}' not found")
            if actual_spent_nanos > res.ceiling_nanos:
                raise ValueError(
                    f"Actual spend {actual_spent_nanos} exceeds reserved ceiling {res.ceiling_nanos}"
                )
            refund = res.ceiling_nanos - actual_spent_nanos
            self._committed_nanos += actual_spent_nanos
            self._available_nanos += refund
            del self._reservations[reservation_id]
            return actual_spent_nanos, refund

    def abort(self, reservation_id: str) -> NanoUSD:
        """Abort/Cancel: 100% refund of reserved ceiling back to available pool."""
        with self._lock:
            res = self._reservations.get(reservation_id)
            if res is None:
                raise KeyError(f"Reservation '{reservation_id}' not found")
            refund = res.ceiling_nanos
            self._available_nanos += refund
            del self._reservations[reservation_id]
            return refund

    def verify_conservation(self) -> bool:
        """Audits zero-leakage invariant: available + committed + active == initial."""
        with self._lock:
            active_reserved = sum(r.ceiling_nanos for r in self._reservations.values())
            return (self._available_nanos + self._committed_nanos + active_reserved) == self._initial_bank_nanos
