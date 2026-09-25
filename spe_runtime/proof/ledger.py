"""K2 ProofLedger — append-only in-memory semantic proof ledger."""

from __future__ import annotations

from dataclasses import dataclass

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.receipt import VerificationReceipt
from spe_runtime.proof.types import content_digest


@dataclass(frozen=True)
class ProofLedger:
    """Copy-on-write proof ledger. Not a durable journal."""

    entries: tuple[VerificationReceipt, ...] = ()

    @property
    def ledger_digest(self) -> str:
        payload = [e.to_canonical_payload() | {"receipt_id": e.receipt_id} for e in self.entries]
        return content_digest(payload, prefix="led-")


def empty_ledger() -> ProofLedger:
    return ProofLedger(entries=())


def append_entry(ledger: ProofLedger, entry: VerificationReceipt) -> ProofLedger:
    """Append with copy-on-write.

    Identical re-append (same id + same content) is idempotent.
    Mutation of existing id content is rejected.
    """
    for existing in ledger.entries:
        if existing.receipt_id == entry.receipt_id:
            if existing == entry:
                return ledger  # idempotent
            raise SpeTypedError(
                ErrorCode.K2_ATOMIC_COMMIT_REJECTED,
                f"cannot mutate existing ledger entry {entry.receipt_id}",
            )
    return ProofLedger(entries=ledger.entries + (entry,))


__all__ = ["ProofLedger", "empty_ledger", "append_entry"]
