"""R14: external provider incident ID is NOT an internal SPE Failure Genome ID.

Source identity mapping is an independently reviewed claim bound to the
actual R2 journal, its current version, and a separately owner-pinned Ed25519
receipt. No provider-internal cause, repair, or public publishing authority.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import TYPE_CHECKING, Mapping

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt, verify_receipt_signature
from .event_journal import SourceEventJournal, SourceSnapshot, _digest_ok

if TYPE_CHECKING:
    from .models import FailureGenomeEntry


IDENTITY_SCOPE = "SPE_FAILURE_TO_EXTERNAL_SOURCE_ID_REVIEW_ONLY"
IDENTITY_SCHEMA = "spe.failure_genome.external_identity.v1"


@dataclass(frozen=True)
class IncidentLinkProposal:
    failure_id: str
    external_source_id: str
    external_event_id: str
    source_url: str
    source_content_sha256: str
    source_published_at: str
    source_observed_at: str
    source_chain_digest: str
    journal_head_sha256: str
    model_id: str
    model_revision: str
    reproducer_sha256: str


@dataclass(frozen=True)
class IncidentLinkAssessment:
    state: str
    reason_codes: tuple[str, ...]
    failure_id: str
    source_id: str
    external_event_id: str
    owner_signature_valid: bool = False
    source_identity_bound_within_scope: bool = False
    provider_model_revision_proven: bool = False
    external_failure_reproduced: bool = False
    root_cause_verified: bool = False
    repair_verified: bool = False
    publication_authorized: bool = False


def propose_incident_link(
    failure: FailureGenomeEntry,
    journal: SourceEventJournal,
    *,
    source_id: str,
    external_event_id: str,
) -> IncidentLinkProposal:
    """Build unsigned review request without minting publication authority."""
    if not isinstance(journal, SourceEventJournal) or not journal.verify_chain():
        raise ValueError("INVALID_JOURNAL")
    if not getattr(failure, "failure_id", "").startswith("SPE-FG-"):
        raise ValueError("INVALID_FAILURE_ID")
    if not isinstance(failure.minimal_reproducer, str) or not failure.minimal_reproducer:
        raise ValueError("INVALID_REPRODUCER")
    if not isinstance(failure.model, str) or not failure.model.strip():
        raise ValueError("MISSING_MODEL_ID")
    if not isinstance(failure.model_version, str) or not failure.model_version.strip():
        raise ValueError("MISSING_MODEL_REVISION")
    last = journal.latest_entry(source_id, external_event_id)
    source = next((item for item in reversed(journal.observations)
                   if item.source_id == source_id and item.event_id == external_event_id), None)
    if not last or not isinstance(source, SourceSnapshot) or last.content_sha256 != source.content_sha256:
        raise ValueError("EXTERNAL_SOURCE_ID_NOT_IN_JOURNAL")
    return IncidentLinkProposal(
        failure_id=failure.failure_id,
        external_source_id=source_id,
        external_event_id=external_event_id,
        source_url=source.url,
        source_content_sha256=source.content_sha256,
        source_published_at=source.source_published_at,
        source_observed_at=source.observed_at,
        source_chain_digest=last.chain_digest,
        journal_head_sha256=journal.entries[-1].chain_digest,
        model_id=failure.model,
        model_revision=failure.model_version,
        reproducer_sha256=hashlib.sha256(failure.minimal_reproducer.encode("utf-8")).hexdigest(),
    )


def incident_link_payload(proposal: IncidentLinkProposal) -> dict[str, object]:
    return {
        "schema": IDENTITY_SCHEMA,
        "scope": IDENTITY_SCOPE,
        "failure_id": proposal.failure_id,
        "external_source_id": proposal.external_source_id,
        "external_event_id": proposal.external_event_id,
        "source_url": proposal.source_url,
        "source_content_sha256": proposal.source_content_sha256,
        "source_published_at": proposal.source_published_at,
        "source_observed_at": proposal.source_observed_at,
        "source_chain_digest": proposal.source_chain_digest,
        "journal_head_sha256": proposal.journal_head_sha256,
        "model_id": proposal.model_id,
        "model_revision": proposal.model_revision,
        "reproducer_sha256": proposal.reproducer_sha256,
    }


def verify_incident_link(
    *,
    failure: FailureGenomeEntry,
    journal: SourceEventJournal,
    proposal: IncidentLinkProposal,
    owner_receipt: AuthenticatedReceipt | None,
    trusted_identity_keys: Mapping[str, str] | None,
) -> IncidentLinkAssessment:
    """Rederive every mapping field from source before trusting owner signer."""
    fid = getattr(failure, "failure_id", "UNKNOWN")
    sid = getattr(proposal, "external_source_id", "UNKNOWN")
    eid = getattr(proposal, "external_event_id", "UNKNOWN")
    issues: set[str] = set()
    if not isinstance(proposal, IncidentLinkProposal):
        return IncidentLinkAssessment("HOLD", ("INVALID_LINK_PROPOSAL",), str(fid), str(sid), str(eid))
    if getattr(failure, "scope", None) != "GLOBAL" or getattr(failure, "consent", None) is not True:
        issues.add("PRIVATE_OR_UNCONSENTED_FAILURE")
    if not _digest_ok(proposal.reproducer_sha256) or not _digest_ok(proposal.source_content_sha256):
        issues.add("SOURCE_OR_REPRODUCER_HASH_MALFORMED")
    try:
        fresh = propose_incident_link(
            failure, journal,
            source_id=proposal.external_source_id,
            external_event_id=proposal.external_event_id,
        )
    except (ValueError, TypeError, AttributeError):
        fresh = None
        issues.add("SOURCE_IDENTITY_NOT_FOUND_OR_INVALID")
    if fresh is not None and fresh != proposal:
        issues.add("STALE_OR_FORGED_EXTERNAL_SOURCE_MAPPING")
    if not isinstance(owner_receipt, AuthenticatedReceipt):
        issues.add("OWNER_SIGNED_LINK_RECEIPT_MISSING")
    if not isinstance(trusted_identity_keys, Mapping) or not trusted_identity_keys:
        issues.add("INDEPENDENT_IDENTITY_TRUST_ROOT_MISSING")
    if isinstance(owner_receipt, AuthenticatedReceipt) and isinstance(trusted_identity_keys, Mapping):
        key = trusted_identity_keys.get(owner_receipt.signer_key_id)
        if not isinstance(key, str) or not _digest_ok(key):
            issues.add("IDENTITY_SIGNER_NOT_OWNER_ENROLLED")
        elif owner_receipt.spec_version != "0.1.0" or owner_receipt.canonical_payload != incident_link_payload(proposal):
            issues.add("SIGNED_INCIDENT_IDENTITY_MISMATCH")
        elif not verify_receipt_signature(owner_receipt, key):
            issues.add("IDENTITY_OWNER_SIGNATURE_INVALID")
    return IncidentLinkAssessment(
        state="OWNER_REVIEWED_SOURCE_IDENTITY_ONLY" if not issues else "HOLD",
        reason_codes=tuple(sorted(issues)) if issues else ("SIGNATURE_PROVES_LINK_REVIEW_NOT_PROVIDER_MODEL_FAILURE",),
        failure_id=proposal.failure_id,
        source_id=proposal.external_source_id,
        external_event_id=proposal.external_event_id,
        owner_signature_valid=not issues,
        source_identity_bound_within_scope=not issues,
    )
