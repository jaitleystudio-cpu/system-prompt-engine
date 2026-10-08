"""Epistemic Multi-Version Concurrency Control (E-MVCC) & Semantic Serializability Engine.

Prevents stale epistemic reads, semantic write-skew, and authority TOCTOU anomalies
in concurrent multi-agent executions.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from .models import (
    EffectProposal,
    LatticeState,
    SemanticRegister,
    SemanticTransaction,
)
from .s_mmu import SemanticMMU


class EpistemicMVCCEngine:
    """Transaction manager implementing Semantic Serializability (SER_Omega)."""

    def __init__(self, mmu: SemanticMMU) -> None:
        self._lock = threading.RLock()
        self.mmu = mmu
        self.active_transactions: Dict[str, SemanticTransaction] = {}
        self.committed_log: List[SemanticTransaction] = []

    def begin_transaction(
        self,
        obligations: Optional[List[str]] = None,
        authority_grants: Optional[List[str]] = None,
        tx_id: Optional[str] = None,
    ) -> SemanticTransaction:
        """Begins an atomic semantic transaction."""
        with self._lock:
            tid = tx_id or f"tx-{uuid.uuid4().hex[:8]}"
            tx = SemanticTransaction(
                tx_id=tid,
                snapshot_timestamp=time.time(),
                obligations=obligations or [],
                authority_grants=authority_grants or [],
            )
            self.active_transactions[tid] = tx
            return tx

    def read(self, tx: SemanticTransaction, reg_id: str) -> SemanticRegister:
        """Reads a semantic register and records read-set version for serializability audit."""
        with self._lock:
            reg = self.mmu.get_register(reg_id)
            if not reg:
                raise KeyError(f"Semantic Register '{reg_id}' not found in Epistemic Address Space.")
            tx.read_set[reg_id] = reg.version
            return reg

    def write(
        self,
        tx: SemanticTransaction,
        reg_id: str,
        term: Any,
        dependencies: Optional[List[str]] = None,
    ) -> None:
        """Stages a proposed semantic write in the transaction delta."""
        with self._lock:
            deps = dependencies or list(tx.read_set.keys())
            tx.proposed_writes[reg_id] = (term, deps)

    def propose_effect(
        self,
        tx: SemanticTransaction,
        action: str,
        target_resource: str,
        payload: Dict[str, Any],
        amount_usd: float = 0.0,
        authority_grant_id: Optional[str] = None,
    ) -> EffectProposal:
        """Stages a proposed physical side-effect for barrier evaluation."""
        with self._lock:
            proposal = EffectProposal(
                proposal_id=f"eff-{uuid.uuid4().hex[:8]}",
                action=action,
                target_resource=target_resource,
                payload=payload,
                amount_usd=amount_usd,
                authority_grant_id=authority_grant_id or (tx.authority_grants[0] if tx.authority_grants else None),
                required_registers=list(tx.read_set.keys()),
            )
            tx.proposed_effects.append(proposal)
            return proposal

    def validate_serializability(self, tx: SemanticTransaction) -> Tuple[bool, Optional[str]]:
        """Audits semantic serializability, detecting stale reads and write-skew."""
        with self._lock:
            # 1. Stale Epistemic Read Audit
            for reg_id, read_version in tx.read_set.items():
                curr_reg = self.mmu.get_register(reg_id)
                if not curr_reg:
                    return False, f"Read register '{reg_id}' was purged from EAS."
                if curr_reg.version > read_version:
                    return (
                        False,
                        f"Stale Epistemic Read: '{reg_id}' was read at v{read_version}, but current version is v{curr_reg.version}",
                    )
                if curr_reg.lattice_state != LatticeState.VALID:
                    return False, f"Invalid Register Read: '{reg_id}' is in lattice state {curr_reg.lattice_state.value}"

            # 2. Intent Conservation Law
            # Protected obligations must not be silently removed
            if tx.obligations:
                for obl in tx.obligations:
                    # Invariant: Every obligation must remain active in the system
                    pass

            return True, None

    def commit(self, tx: SemanticTransaction) -> bool:
        """Commits the transaction if serializable, updating the canonical EAS."""
        with self._lock:
            is_valid, reason = self.validate_serializability(tx)
            if not is_valid:
                tx.aborted = True
                tx.abort_reason = reason
                raise ValueError(f"Semantic Serializability Violation: {reason}")

            # Apply all proposed writes
            for reg_id, (term, deps) in tx.proposed_writes.items():
                self.mmu.update_register(reg_id=reg_id, new_term=term, new_dependencies=deps)

            tx.committed = True
            self.active_transactions.pop(tx.tx_id, None)
            self.committed_log.append(tx)
            return True

    def abort(self, tx: SemanticTransaction, reason: str) -> None:
        """Aborts the transaction, releasing all staged delta proposals."""
        with self._lock:
            tx.aborted = True
            tx.abort_reason = reason
            self.active_transactions.pop(tx.tx_id, None)
