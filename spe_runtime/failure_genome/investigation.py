"""SPE Failure Genome: read-only cross-owner evidence assembly (R1).

Binds an owner-pinned source-review signature to a failure specimen,
checks existing Replay Capsule content integrity, evaluates existing Quality
Delta artifacts, and builds an evidence-only Causal Proof Graph.

This is NOT a live feed reader, remote model replay, causal oracle, repair
verifier, publishing permission, or substitute for LVT/G6-H. No IO, credentials,
network calls, model execution, file writes, or automatic repair occur here.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Mapping, Sequence

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt, verify_receipt_signature
from spe_runtime.proof_graph.graph import CausalProofGraph
from spe_runtime.proof_graph.models import (
    CausalEdge,
    CausalEvidence,
    CausalNode,
    EdgeType,
    NodeType,
)
from spe_runtime.quality.engine import quality_delta
from spe_runtime.replay_capsule.capsule import verify_replay_capsule
from spe_runtime.replay_capsule.models import ReplayCapsule

from .incident_review import IncidentPreflight, ReviewState, review_failure_for_publication

if TYPE_CHECKING:
    from .models import FailureGenomeEntry


SOURCE_REVIEW_SCHEMA = "spe.failure_genome.source_review.v1"
SOURCE_REVIEW_SCOPE = "REVIEWED_SOURCE_METADATA_NOT_EVENT_PROOF"
GATE_VERSION = "spe.failure_genome.investigation_r1.v1"


@dataclass(frozen=True)
class InvestigationReport:
    failure_id: str
    gate_version: str
    state: str
    reason_codes: tuple[str, ...]
    preflight: IncidentPreflight
    source_receipt_signature_valid: bool
    replay_capsule_integrity_valid: bool
    quality_disposition: str
    quality_evidence: dict[str, Any]
    evidence_graph: dict[str, Any]
    external_failure_reproduced: bool = False
    provider_root_cause_verified: bool = False
    external_repair_validated: bool = False
    publication_authorized: bool = False


def source_review_payload(
    entry: FailureGenomeEntry,
    preflight: IncidentPreflight,
    *,
    source_published_at: str,
    source_observed_at: str,
) -> dict[str, Any]:
    """Build source-review bytes for a separately enrolled reviewer to sign.

    A valid signature authenticates reviewer provenance only, not event truth.
    """
    return {
        "schema": SOURCE_REVIEW_SCHEMA,
        "scope": SOURCE_REVIEW_SCOPE,
        "failure_id": entry.failure_id,
        "model_id": entry.model,
        "model_revision": entry.model_version,
        "reproducer_sha256": hashlib.sha256(entry.minimal_reproducer.encode("utf-8")).hexdigest(),
        "source_urls": list(preflight.source_urls),
        "source_published_at": source_published_at,
        "source_observed_at": source_observed_at,
    }


def _verify_source_review(
    entry: FailureGenomeEntry,
    preflight: IncidentPreflight,
    *,
    source_published_at: str | None,
    source_observed_at: str | None,
    receipt: AuthenticatedReceipt | None,
    trusted_source_keys: Mapping[str, str] | None,
) -> tuple[bool, str]:
    if preflight.state != ReviewState.READY_FOR_INDEPENDENT_REVIEW:
        return False, "PREFLIGHT_HOLD"
    if not isinstance(receipt, AuthenticatedReceipt):
        return False, "SIGNED_SOURCE_REVIEW_MISSING"
    if not isinstance(trusted_source_keys, Mapping) or not trusted_source_keys:
        return False, "OWNER_TRUST_ROOT_UNCONFIGURED"
    key_hex = trusted_source_keys.get(receipt.signer_key_id)
    if not isinstance(key_hex, str) or len(key_hex) != 64:
        return False, "SOURCE_SIGNER_NOT_OWNER_TRUSTED"
    # Receipt-declared keys, signatures and self-verified flags never enroll
    # a new trust root. The trust map is configured out-of-band by the owner.
    if receipt.spec_version != "0.1.0":
        return False, "SOURCE_RECEIPT_FORMAT_UNKNOWN"
    expected = source_review_payload(
        entry, preflight,
        source_published_at=source_published_at or "",
        source_observed_at=source_observed_at or "",
    )
    if receipt.canonical_payload != expected:
        return False, "SOURCE_RECEIPT_BINDING_MISMATCH"
    if not verify_receipt_signature(receipt, key_hex):
        return False, "SOURCE_RECEIPT_SIGNATURE_INVALID"
    return True, "SOURCE_REVIEW_SIGNATURE_VERIFIED_ONLY"


def _verify_capsule_binding(
    entry: FailureGenomeEntry,
    capsule: ReplayCapsule | None,
) -> tuple[bool, str]:
    if capsule is None:
        return False, "REPLAY_CAPSULE_MISSING"
    if not isinstance(capsule, ReplayCapsule):
        return False, "REPLAY_CAPSULE_MALFORMED"
    if not (
        capsule.instruction_version_id == f"failure:{entry.failure_id}"
        and capsule.environment.model_id == entry.model
        and capsule.environment.model_version == entry.model_version
        and capsule.prompt_input == entry.minimal_reproducer
    ):
        return False, "REPLAY_SUBJECT_OR_MODEL_REVISION_MISMATCH"
    try:
        # Existing verification without replay_fn checks digests, not an
        # observed execution. Content integrity never promotes reproduction.
        result = verify_replay_capsule(capsule)
    except (ValueError, TypeError, KeyError, OverflowError, AttributeError):
        return False, "REPLAY_CAPSULE_INTEGRITY_ERROR"
    if not result.is_valid:
        return False, "REPLAY_CAPSULE_CONTENT_TAMPERED"
    return True, "CAPSULE_HASH_INTEGRITY_ONLY_NO_MODEL_REPLAY"


def _quality_summary(
    before: Mapping[str, Any] | None,
    after: Mapping[str, Any] | None,
) -> tuple[str, dict[str, Any], str]:
    if before is None and after is None:
        return "UNMEASURED", {}, "QUALITY_COMPARISON_NOT_SUPPLIED"
    if not isinstance(before, Mapping) or not isinstance(after, Mapping):
        return "UNMEASURED", {}, "QUALITY_PAIR_INCOMPLETE"
    try:
        delta = quality_delta(before, after)
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        return "UNMEASURED", {}, "QUALITY_INPUT_MALFORMED"
    summary = {
        "disposition": delta["disposition"],
        "before_digest": delta["subject_before_digest"],
        "after_digest": delta["subject_after_digest"],
        "protected_regressions": tuple(delta["protected_regressions"]),
        "regressed_obligation_ids": tuple(delta["regressed_obligation_ids"]),
        "improved_obligation_ids": tuple(delta["improved_obligation_ids"]),
        "reason_codes": tuple(delta["reason_codes"]),
    }
    # Structural constraint comparison is not proof of external model success.
    return delta["disposition"], summary, "STATIC_QUALITY_DELTA_ONLY"


def assemble_investigation(
    entry: FailureGenomeEntry,
    *,
    source_urls: Sequence[str] = (),
    source_published_at: str | None = None,
    source_observed_at: str | None = None,
    source_receipt: AuthenticatedReceipt | None = None,
    trusted_source_keys: Mapping[str, str] | None = None,
    replay_capsule: ReplayCapsule | None = None,
    before_subject: Mapping[str, Any] | None = None,
    after_subject: Mapping[str, Any] | None = None,
) -> InvestigationReport:
    """Assemble an internal evidence chain without publishing anything."""
    preflight = review_failure_for_publication(
        entry,
        source_urls=source_urls,
        source_published_at=source_published_at,
        source_observed_at=source_observed_at,
    )
    verified_source, source_reason = _verify_source_review(
        entry, preflight,
        source_published_at=source_published_at,
        source_observed_at=source_observed_at,
        receipt=source_receipt,
        trusted_source_keys=trusted_source_keys,
    )
    capsule_valid, capsule_reason = _verify_capsule_binding(entry, replay_capsule)
    quality, summary, quality_reason = _quality_summary(before_subject, after_subject)
    issues = set(preflight.issue_codes)
    issues.update((source_reason, capsule_reason, quality_reason))
    if entry.root_cause and entry.root_cause != "Pending causal analysis":
        issues.add("ROOT_CAUSE_STILL_HYPOTHESIS")
    if entry.candidate_repairs:
        issues.add("EXTERNAL_REPAIR_NOT_TESTED")

    # Only ready for separately authorized independent review.
    ready = verified_source and capsule_valid and preflight.state == ReviewState.READY_FOR_INDEPENDENT_REVIEW
    state = "READY_FOR_INDEPENDENT_REVIEW" if ready else "HOLD"

    graph = CausalProofGraph()
    graph.add_node(CausalNode(
        "incident", NodeType.FAILURE_RECORD,
        "Failure specimen awaiting external validation",
        {"failure_id": entry.failure_id, "state": state},
    ))
    if verified_source:
        graph.add_node(CausalNode(
            "source_review", NodeType.EVIDENCE, "Trusted signer reviewed source metadata",
            {"scope": SOURCE_REVIEW_SCOPE},
        ))
        graph.add_edge(CausalEdge(
            "source_supports_specimen", "incident", "source_review", EdgeType.EVIDENCED_BY,
        ))
        graph.attach_evidence("source_review", CausalEvidence(
            evidence_id="owner_pinned_source_receipt",
            evidence_class="STATIC_ANALYSIS",
            metric="receipt_signature_bound_to_source_metadata",
            value=True,
            observed_at=source_observed_at or "",
        ))
    if capsule_valid:
        graph.add_node(CausalNode(
            "capsule", NodeType.EVIDENCE, "Replay Capsule integrity, without model execution",
            {"evidence_scope": "HASH_ONLY", "capsule_id": replay_capsule.capsule_id},
        ))
        graph.add_edge(CausalEdge(
            "capsule_supports_specimen", "incident", "capsule", EdgeType.EVIDENCED_BY,
        ))
        graph.attach_evidence("capsule", CausalEvidence(
            evidence_id="content_integrity_check",
            evidence_class="STATIC_ANALYSIS",
            metric="capsule_digests_match",
            value=True,
            observed_at=replay_capsule.created_at,
        ))
    if summary:
        graph.add_node(CausalNode(
            "quality_delta", NodeType.EVIDENCE,
            "Static protected-intent Quality Delta (not a model outcome)",
            {"disposition": quality},
        ))
        graph.add_edge(CausalEdge(
            "quality_associated_with_specimen",
            "incident", "quality_delta", EdgeType.EVIDENCED_BY,
        ))
    return InvestigationReport(
        failure_id=entry.failure_id,
        gate_version=GATE_VERSION,
        state=state,
        reason_codes=tuple(sorted(issues)),
        preflight=preflight,
        source_receipt_signature_valid=verified_source,
        replay_capsule_integrity_valid=capsule_valid,
        quality_disposition=quality,
        quality_evidence=summary,
        evidence_graph=graph.to_dict(),
    )
