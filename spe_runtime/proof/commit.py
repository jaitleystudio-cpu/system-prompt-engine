"""K2 atomic semantic + proof commit."""

from __future__ import annotations

from dataclasses import dataclass

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.ledger import ProofLedger, append_entry
from spe_runtime.proof.lease import SemanticProofLease, assert_not_authority_grant, consume_lease
from spe_runtime.proof.obligation import ProofObligation
from spe_runtime.proof.patch import ProofCarryingPatch, apply_semantic_delta, delta_actions
from spe_runtime.proof.receipt import VerificationReceipt
from spe_runtime.proof.snapshot import SemanticSnapshot, make_snapshot
from spe_runtime.proof.types import LeaseStatus, Verdict, proof_type_compatible


@dataclass(frozen=True)
class CommitResult:
    """Success binds previous/new snapshot, patch, lease, receipts, ledger digest.

    Failure never carries a new snapshot — raise SpeTypedError instead.
    """

    previous_snapshot_id: str
    new_snapshot: SemanticSnapshot
    patch_id: str
    lease_id: str
    receipt_ids: tuple[str, ...]
    proof_ledger: ProofLedger
    consumed_lease: SemanticProofLease

    @property
    def new_snapshot_id(self) -> str:
        return self.new_snapshot.snapshot_id

    @property
    def ledger_digest(self) -> str:
        return self.proof_ledger.ledger_digest


def _obligation_map(lease: SemanticProofLease) -> dict[str, ProofObligation]:
    return {o.obligation_id: o for o in lease.obligations}


def _find_receipt(
    receipts: tuple[VerificationReceipt, ...],
    obligation_id: str,
) -> VerificationReceipt | None:
    for r in receipts:
        if isinstance(r, VerificationReceipt) and r.obligation_id == obligation_id:
            return r
    return None


def commit_semantic_patch(
    current_snapshot: SemanticSnapshot,
    proof_ledger: ProofLedger,
    lease: SemanticProofLease,
    patch: ProofCarryingPatch,
    receipts: tuple[VerificationReceipt, ...] | list[VerificationReceipt],
) -> CommitResult:
    """Atomic in-process semantic + proof commit (copy-on-write).

    On ANY failure: raise SpeTypedError; caller snapshot/ledger objects unchanged.
    """
    assert_not_authority_grant(lease)
    receipt_tuple = tuple(receipts)

    # Reject arbitrary dicts posing as receipts early
    for r in receipt_tuple:
        if not isinstance(r, VerificationReceipt):
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "receipt must be a VerificationReceipt (arbitrary dict rejected)",
            )

    # 1. Snapshot / version binding
    if (
        patch.base_snapshot_id != current_snapshot.snapshot_id
        or patch.base_version != current_snapshot.version
    ):
        raise SpeTypedError(
            ErrorCode.K2_STALE_PATCH,
            "patch base snapshot/version does not match current snapshot",
        )

    # 2. Lease validation
    if not isinstance(lease, SemanticProofLease):
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            "lease must be a SemanticProofLease",
        )
    if lease.status is not LeaseStatus.ACTIVE:
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            f"lease status must be ACTIVE, got {lease.status}",
        )
    if lease.lease_id != patch.lease_id:
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            "patch lease_id does not match lease",
        )
    if (
        lease.base_snapshot_id != current_snapshot.snapshot_id
        or lease.base_version != current_snapshot.version
    ):
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            "lease base snapshot/version does not match current snapshot",
        )
    if (
        lease.base_snapshot_id != patch.base_snapshot_id
        or lease.base_version != patch.base_version
    ):
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            "lease base does not match patch base",
        )

    actions = delta_actions(patch.semantic_delta)
    if not actions.issubset(lease.allowed_scope):
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            "patch delta actions outside lease allowed_scope",
        )

    for oid in patch.obligation_ids:
        if oid not in lease.allowed_obligation_ids:
            raise SpeTypedError(
                ErrorCode.K2_INVALID_SEMANTIC_LEASE,
                f"patch obligation {oid} not permitted by lease",
            )

    # 3. Obligation discharge via receipts
    obl_by_id = _obligation_map(lease)
    for oid in patch.obligation_ids:
        obligation = obl_by_id.get(oid)
        if obligation is None:
            raise SpeTypedError(
                ErrorCode.K2_MISSING_PROOF_OBLIGATION,
                f"obligation {oid} not found on lease",
            )
        receipt = _find_receipt(receipt_tuple, oid)
        if receipt is None:
            raise SpeTypedError(
                ErrorCode.K2_MISSING_PROOF_OBLIGATION,
                f"missing receipt for obligation {oid}",
            )

        if receipt.snapshot_id != current_snapshot.snapshot_id:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "receipt snapshot_id does not match current snapshot",
            )
        if receipt.patch_id is not None and receipt.patch_id != patch.patch_id:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "receipt patch_id does not match patch",
            )
        if receipt.subject_id != obligation.subject and receipt.subject_id != current_snapshot.snapshot_id:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "receipt subject binding does not match obligation/snapshot",
            )
        if receipt.obligation_id != obligation.obligation_id:
            raise SpeTypedError(
                ErrorCode.K2_MISSING_PROOF_OBLIGATION,
                "receipt obligation_id mismatch",
            )

        if not proof_type_compatible(obligation.required_proof_type, receipt.proof_type):
            raise SpeTypedError(
                ErrorCode.K2_PROOF_TYPE_MISMATCH,
                (
                    f"required {obligation.required_proof_type.value} "
                    f"!= provided {receipt.proof_type.value}"
                ),
            )

        if receipt.verdict is Verdict.FAIL:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "FAIL verdict cannot discharge obligation",
            )
        if receipt.verdict is Verdict.UNKNOWN:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "UNKNOWN verdict cannot discharge obligation",
            )
        if receipt.verdict is not Verdict.PASS:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                f"unsupported verdict {receipt.verdict}",
            )

        # Unrelated evidence: evidence_digest empty / missing binding
        if not receipt.evidence_digest:
            raise SpeTypedError(
                ErrorCode.K2_VERIFICATION_FAILED,
                "receipt missing evidence digest",
            )

    # Ensure no extra wrong-obligation-only receipts are required — missing covered above.
    # Wrong obligation receipt alone (for a different id) doesn't discharge required ones.

    # 4. Apply semantic delta through K0/K1 (fail → no mutation of inputs)
    try:
        next_contract = apply_semantic_delta(
            current_snapshot.protected_intent, patch.semantic_delta
        )
    except SpeTypedError:
        raise
    except Exception as exc:  # noqa: BLE001 — map unexpected apply failures
        raise SpeTypedError(
            ErrorCode.K2_ATOMIC_COMMIT_REJECTED,
            f"semantic delta application failed: {exc}",
        ) from exc

    # 5. Next snapshot
    next_snapshot = make_snapshot(
        next_contract,
        version=current_snapshot.version + 1,
        parent=current_snapshot,
        created_from_patch_id=patch.patch_id,
    )

    # 6. Append receipts to ledger (COW)
    new_ledger = proof_ledger
    appended_ids: list[str] = []
    for oid in patch.obligation_ids:
        receipt = _find_receipt(receipt_tuple, oid)
        assert receipt is not None
        new_ledger = append_entry(new_ledger, receipt)
        appended_ids.append(receipt.receipt_id)

    # 7. Consume lease
    consumed = consume_lease(lease)

    # 8. Success result
    return CommitResult(
        previous_snapshot_id=current_snapshot.snapshot_id,
        new_snapshot=next_snapshot,
        patch_id=patch.patch_id,
        lease_id=lease.lease_id,
        receipt_ids=tuple(appended_ids),
        proof_ledger=new_ledger,
        consumed_lease=consumed,
    )


__all__ = ["CommitResult", "commit_semantic_patch"]
