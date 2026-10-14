"""SPE North Star R21 — read-only source host/checkpoint preflight.

Uses existing R11 durable journal, R18 external checkpoint verifier and
R19 approved source configuration. Reports precise missing capabilities;
NEVER enables network, signs a receipt, trusts a self-enrollment flag,
publishes a headline, or authorizes a production deployment.

A correctly verified cryptographic receipt proves only that the supplied
owner-enrolled public key signed the supplied metadata. The caller must
independently establish the key/root and monotonic floor were fetched from
a distinct, trusted owner domain. This module cannot certify that fact.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Mapping

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt
from .checkpoint_review import OwnerPinnedFloor, verify_owner_checkpoint
from .event_journal import SourceAuthority, SourceEventJournal


@dataclass(frozen=True)
class OperationalReadiness:
    status: str
    source_id: str
    reason_codes: tuple[str, ...]
    durable_record_count: int
    local_journal_integrity_valid: bool
    cryptographic_checkpoint_locally_verified: bool
    trusted_host_proven_independently: bool = False
    monotonic_floor_proven_independently: bool = False
    production_monitoring_authorized: bool = False
    network_calls: int = 0
    real_model_failure_proven: bool = False
    public_incident_publication_authorized: bool = False


def inspect_source_operation(
    *,
    source: SourceAuthority,
    journal: SourceEventJournal | None,
    expected_allowlist_sha256: str,
    signed_receipt: AuthenticatedReceipt | None,
    owner_pinned_floor: OwnerPinnedFloor | None,
    trusted_checkpoint_keys: Mapping[str, str] | None,
    now: datetime,
    owner_source_approval: bool = False,
    durable_host_operator_attestation: bool = False,
) -> OperationalReadiness:
    """Machine-check local prerequisites without escalating their authority.

    Even when the local signature and metadata are fully valid, this can
    produce at most LOCAL_CUSTODY_CHECKS_PASS_OWNER_REVIEW_REQUIRED, never
    an external host trust, network grant or production READY status.
    """
    source_id = getattr(source, "source_id", "UNKNOWN")
    issues: set[str] = set()
    count = len(journal.entries) if isinstance(journal, SourceEventJournal) else 0
    chain_good = isinstance(journal, SourceEventJournal) and journal.verify_chain()
    if (
        not isinstance(source, SourceAuthority)
        or not isinstance(source_id, str) or not source_id
        or not isinstance(journal, SourceEventJournal)
        or journal.authorities != {source_id: source}
        or not chain_good
    ):
        issues.add("SOURCE_OWNER_OR_LOCAL_JOURNAL_INVALID")
    if owner_source_approval is not True:
        issues.add("OWNER_SOURCE_APPROVAL_MISSING")
    if durable_host_operator_attestation is not True:
        issues.add("PERSISTENT_HOST_OPERATOR_ATTESTATION_MISSING")
    if not isinstance(signed_receipt, AuthenticatedReceipt):
        issues.add("SIGNED_CHECKPOINT_MISSING")
    if not isinstance(owner_pinned_floor, OwnerPinnedFloor):
        issues.add("EXTERNAL_MONOTONIC_FLOOR_MISSING")
    if not isinstance(trusted_checkpoint_keys, Mapping) or not trusted_checkpoint_keys:
        issues.add("INDEPENDENT_OWNER_TRUST_KEYS_MISSING")
    checkpoint_valid = False
    if (
        not issues.intersection({
            "SOURCE_OWNER_OR_LOCAL_JOURNAL_INVALID",
            "SIGNED_CHECKPOINT_MISSING",
            "EXTERNAL_MONOTONIC_FLOOR_MISSING",
            "INDEPENDENT_OWNER_TRUST_KEYS_MISSING",
        })
        and journal is not None
        and isinstance(source, SourceAuthority)
    ):
        try:
            proof = verify_owner_checkpoint(
                journal=journal,
                expected_allowlist_sha256=expected_allowlist_sha256,
                signed_receipt=signed_receipt,
                trusted_checkpoint_keys=trusted_checkpoint_keys,
                owner_pinned_floor=owner_pinned_floor,
                now=now,
            )
        except (ValueError, TypeError, AttributeError):
            issues.add("CHECKPOINT_VERIFIER_REJECTED_INPUT")
        else:
            checkpoint_valid = (
                proof.state == "OWNER_CHECKPOINT_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE"
                and proof.signer_authenticated_against_owner_root
                and proof.previous_owner_pin_ancestry_verified
                and proof.next_floor_candidate is not None
            )
            if not checkpoint_valid:
                issues.update(proof.reason_codes)
    return OperationalReadiness(
        status=(
            "LOCAL_CUSTODY_CHECKS_PASS_OWNER_REVIEW_REQUIRED"
            if not issues and checkpoint_valid else "HOLD"
        ),
        source_id=source_id,
        reason_codes=tuple(sorted(issues)) if issues else (
            "EXTERNAL_TRUST_PROVENANCE_AND_RELEASE_STILL_UNVERIFIED",
        ),
        durable_record_count=count,
        local_journal_integrity_valid=chain_good,
        cryptographic_checkpoint_locally_verified=checkpoint_valid,
    )
