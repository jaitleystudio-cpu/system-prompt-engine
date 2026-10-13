"""R12 external-checkpoint verifier for SPE Failure Genome durable custody.

Uses the EXISTING SPE signed-receipt owner and R11 journal. The sole source
of rollback resistance is an *independently controlled, monotonically updated*
anchor and public trust key supplied out of band. The journal cannot mint
either. A self-consistent hash chain or self-signed receipt never qualifies.

No network, secret keys, file mutation, checkpoint signing, source confirmation
or publication authority here. This is one-host monotonic custody checking,
not distributed consensus, trusted source journalism, or model proof.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Mapping

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt, verify_receipt_signature
from .durable_journal import CustodyStatus, JournalCustodyError, metadata_document_sha256
from .event_journal import JournalDecision, SourceEventJournal


CHECKPOINT_SCHEMA = "spe.failure_genome.external_head.v2"
CHECKPOINT_SCOPE = "OWNER_PINNED_METADATA_CUSTODY_ONLY"
_SHA = re.compile(r"^[0-9a-f]{64}$")


@dataclass(frozen=True)
class OwnerPinnedFloor:
    """Trusted OUT-OF-BAND high-watermark, never loaded from the watched state.

    The owner must maintain it in a separate privileged, monotonic store.
    Its existence in a Python dataclass does not establish independent trust.
    """
    minimum_sequence: int
    known_record_count: int
    known_head_sha256: str
    allowlist_sha256: str
    known_metadata_document_sha256: str | None = None


@dataclass(frozen=True)
class CheckpointAssessment:
    state: str
    reason_codes: tuple[str, ...]
    record_count: int
    head_sha256: str
    metadata_document_sha256: str
    signer_authenticated_against_owner_root: bool = False
    previous_owner_pin_ancestry_verified: bool = False
    next_floor_candidate: OwnerPinnedFloor | None = None
    trusted_source_content_verified: bool = False
    model_failure_proven: bool = False
    rollback_protection_independently_deployed: bool = False
    publication_authorized: bool = False


def _utc(value: str) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return result.astimezone(timezone.utc) if result.tzinfo and result.utcoffset() is not None else None


def checkpoint_payload(
    status: CustodyStatus,
    *,
    sequence: int,
    issued_at: str,
) -> dict[str, object]:
    """Canonical content that a separately approved owner may sign.

    This builder never signs and cannot authorize its own signing key.
    """
    return {
        "schema": CHECKPOINT_SCHEMA,
        "scope": CHECKPOINT_SCOPE,
        "sequence": sequence,
        "issued_at": issued_at,
        "count": status.records,
        "head_sha256": status.head_sha256,
        "allowlist_sha256": status.allowlist_sha256,
        "metadata_document_sha256": status.metadata_document_sha256,
    }


def verify_owner_checkpoint(
    *,
    journal: SourceEventJournal,
    expected_allowlist_sha256: str,
    signed_receipt: AuthenticatedReceipt | None,
    trusted_checkpoint_keys: Mapping[str, str] | None,
    owner_pinned_floor: OwnerPinnedFloor | None,
    now: datetime,
    max_checkpoint_age: timedelta = timedelta(days=2),
) -> CheckpointAssessment:
    """Fail-closed against unsigned current state, stale or rolled-back head.

    An external owner must validate the floor was fetched from a separate
    trust domain and persisted monotonically. The checker cannot prove this
    by inspecting a caller-provided object.
    """
    count = len(journal.entries) if isinstance(journal, SourceEventJournal) else 0
    head = journal.entries[-1].chain_digest if count else "0" * 64
    issues: set[str] = set()
    try:
        metadata_sha = metadata_document_sha256(journal, expected_allowlist_sha256)
    except (JournalCustodyError, TypeError, ValueError, AttributeError):
        metadata_sha = ""
        issues.add("DURABLE_METADATA_DOCUMENT_INVALID")
    if (
        not isinstance(journal, SourceEventJournal)
        or not journal.verify_chain()
        or len(journal.observations) != len(journal.entries)
        or not isinstance(expected_allowlist_sha256, str)
        or not _SHA.fullmatch(expected_allowlist_sha256)
    ):
        issues.add("INVALID_LOCAL_JOURNAL_OR_ALLOWLIST")
    if (
        not isinstance(owner_pinned_floor, OwnerPinnedFloor)
        or type(owner_pinned_floor.minimum_sequence) is not int
        or type(owner_pinned_floor.known_record_count) is not int
        or owner_pinned_floor.minimum_sequence < 0
        or not 0 <= owner_pinned_floor.known_record_count <= count
        or not isinstance(owner_pinned_floor.known_head_sha256, str)
        or not _SHA.fullmatch(owner_pinned_floor.known_head_sha256)
        or owner_pinned_floor.allowlist_sha256 != expected_allowlist_sha256
    ):
        issues.add("UNTRUSTED_OR_INCONSISTENT_EXTERNAL_FLOOR")
    else:
        floor = owner_pinned_floor
        ancestor_head = (
            journal.entries[floor.known_record_count - 1].chain_digest
            if floor.known_record_count else "0" * 64
        )
        if ancestor_head != floor.known_head_sha256:
            issues.add("OWNER_PINNED_ANCESTRY_BROKEN")
        # A prior head/count did NOT bind URL and model-scope metadata
        # in the R2 chain. R18 checks the *previous* external metadata
        # commitment against the exact immutable journal prefix.
        pinned_meta = floor.known_metadata_document_sha256
        genesis = floor.minimum_sequence == 0 and floor.known_record_count == 0
        if pinned_meta is None:
            if not genesis:
                issues.add("OWNER_PINNED_METADATA_FLOOR_MISSING")
        elif not isinstance(pinned_meta, str) or not _SHA.fullmatch(pinned_meta):
            issues.add("OWNER_PINNED_METADATA_FLOOR_MALFORMED")
        else:
            try:
                prefix = SourceEventJournal(
                    journal.authorities, max_events=max(1, floor.known_record_count)
                )
                for snapshot in journal.observations[:floor.known_record_count]:
                    result = prefix.ingest(snapshot)
                    if result.decision is not JournalDecision.ADDED:
                        raise JournalCustodyError("NON_REPLAYABLE_PREFIX")
                prefix_sha = metadata_document_sha256(prefix, expected_allowlist_sha256)
            except (JournalCustodyError, ValueError, TypeError, AttributeError):
                issues.add("OWNER_PINNED_METADATA_PREFIX_INVALID")
            else:
                if pinned_meta != prefix_sha:
                    issues.add("OWNER_PINNED_METADATA_ANCESTRY_BROKEN")
    if not isinstance(signed_receipt, AuthenticatedReceipt):
        issues.add("CHECKPOINT_RECEIPT_MISSING")
    if not isinstance(trusted_checkpoint_keys, Mapping) or not trusted_checkpoint_keys:
        issues.add("CHECKPOINT_OWNER_TRUST_ROOT_MISSING")
    if (
        not isinstance(now, datetime)
        or now.tzinfo is None or now.utcoffset() is None
        or not isinstance(max_checkpoint_age, timedelta)
        or not timedelta(0) < max_checkpoint_age <= timedelta(days=7)
    ):
        issues.add("CLOCK_OR_EXPIRY_POLICY_INVALID")

    signature_good = False
    verified_seq = None
    if isinstance(signed_receipt, AuthenticatedReceipt):
        payload = signed_receipt.canonical_payload
        if not isinstance(payload, dict) or set(payload) != {
            "schema", "scope", "sequence", "issued_at", "count",
            "head_sha256", "allowlist_sha256", "metadata_document_sha256",
        }:
            issues.add("CHECKPOINT_SCHEMA_INVALID")
        elif (
            payload["schema"] != CHECKPOINT_SCHEMA or
            payload["scope"] != CHECKPOINT_SCOPE or
            type(payload["sequence"]) is not int or payload["sequence"] < 1 or
            type(payload["count"]) is not int or payload["count"] != count or
            payload["head_sha256"] != head or
            payload["allowlist_sha256"] != expected_allowlist_sha256 or
            payload["metadata_document_sha256"] != metadata_sha
        ):
            issues.add("CHECKPOINT_CONTENT_OR_SEQUENCE_MISMATCH")
        else:
            verified_seq = payload["sequence"]
            stamp = _utc(payload["issued_at"])
            if stamp is None or "CLOCK_OR_EXPIRY_POLICY_INVALID" in issues:
                issues.add("CHECKPOINT_TIMESTAMP_INVALID")
            elif not timedelta(0) <= now.astimezone(timezone.utc) - stamp <= max_checkpoint_age:
                issues.add("CHECKPOINT_STALE_OR_FUTURE_DATED")
            if isinstance(owner_pinned_floor, OwnerPinnedFloor):
                if verified_seq < owner_pinned_floor.minimum_sequence:
                    issues.add("CHECKPOINT_SEQUENCE_ROLLBACK")
                if verified_seq == owner_pinned_floor.minimum_sequence and (
                    count != owner_pinned_floor.known_record_count
                    or head != owner_pinned_floor.known_head_sha256
                ):
                    issues.add("CHECKPOINT_SEQUENCE_REUSED_ON_NEW_HEAD")
                if (
                    verified_seq == owner_pinned_floor.minimum_sequence
                    and owner_pinned_floor.known_metadata_document_sha256 is not None
                    and metadata_sha != owner_pinned_floor.known_metadata_document_sha256
                ):
                    issues.add("CHECKPOINT_SEQUENCE_REUSED_ON_NEW_METADATA")
            if signed_receipt.spec_version != "0.1.0":
                issues.add("CHECKPOINT_RECEIPT_FORMAT_UNKNOWN")
            pinned = trusted_checkpoint_keys.get(signed_receipt.signer_key_id) if isinstance(trusted_checkpoint_keys, Mapping) else None
            if not isinstance(pinned, str) or not _SHA.fullmatch(pinned):
                issues.add("CHECKPOINT_SIGNER_NOT_OWNER_PINNED")
            elif not verify_receipt_signature(signed_receipt, pinned):
                issues.add("CHECKPOINT_SIGNATURE_INVALID")
            else:
                signature_good = True

    eligible = not issues
    next_floor = (
        OwnerPinnedFloor(
            minimum_sequence=verified_seq,
            known_record_count=count,
            known_head_sha256=head,
            allowlist_sha256=expected_allowlist_sha256,
            known_metadata_document_sha256=metadata_sha,
        )
        if eligible else None
    )
    return CheckpointAssessment(
        state="OWNER_CHECKPOINT_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE" if eligible else "HOLD",
        reason_codes=tuple(sorted(issues)),
        record_count=count,
        head_sha256=head,
        metadata_document_sha256=metadata_sha,
        signer_authenticated_against_owner_root=signature_good,
        previous_owner_pin_ancestry_verified=eligible,
        next_floor_candidate=next_floor,
    )
