"""R1 adversarial custody: external AI-failure claims never self-certify."""

from __future__ import annotations

from dataclasses import replace
import hashlib

import pytest

from spe_runtime.ci_gate.receipt import (
    generate_authenticated_receipt,
    generate_keypair,
)
from spe_runtime.failure_genome.incident_review import review_failure_for_publication
from spe_runtime.failure_genome.investigation import (
    GATE_VERSION,
    SOURCE_REVIEW_SCOPE,
    assemble_investigation,
    source_review_payload,
)
from spe_runtime.failure_genome.models import (
    FailureClass,
    FailureGenomeEntry,
    Severity,
)
from spe_runtime.quality.engine import governing_proof_refs
from spe_runtime.replay_capsule.capsule import create_replay_capsule
from spe_runtime.replay_capsule.models import ExecutionEnvironment


URL = "https://status.example.org/incidents/example-1"
PUBLISHED = "2026-10-13T10:00:00Z"
OBSERVED = "2026-10-13T10:01:00+00:00"
PROMPT = "Summarize this sample without disclosing secrets."
SOURCE_DIGEST = hashlib.sha256(b"example frozen official status body").hexdigest()


def specimen(**changes):
    data = dict(
        failure_id="SPE-FG-2026-000789", scope="GLOBAL", source="source-review",
        consent=True, model="example-model", model_version="rev-2026-10",
        prompt_digest="", protected_intent_digest="",
        minimal_reproducer=PROMPT,
        failure_class=FailureClass.PROMPT_INJECTION,
        severity=Severity.MEDIUM,
        affected_capability="PROMPT_VALIDATION",
        observations=["Synthetic lab observation only"],
        reproduction_count=1,
        root_cause="Pending causal analysis",
        candidate_repairs=[], regression_tests=[],
        first_seen=OBSERVED, last_seen=OBSERVED,
    )
    return FailureGenomeEntry(**(data | changes))


def inputs():
    return dict(source_urls=[URL], source_published_at=PUBLISHED,
                source_observed_at=OBSERVED, source_content_sha256=SOURCE_DIGEST)


def signed_source(entry, *, payload_mutation=None, signer=None):
    preflight = review_failure_for_publication(
        entry, source_urls=[URL], source_published_at=PUBLISHED, source_observed_at=OBSERVED,
    )
    payload = source_review_payload(
        entry, preflight,
        source_published_at=PUBLISHED, source_observed_at=OBSERVED,
        source_content_sha256=SOURCE_DIGEST,
    )
    if payload_mutation:
        payload.update(payload_mutation)
    private_key, public_key = signer or generate_keypair()
    receipt = generate_authenticated_receipt(
        payload, signing_key=private_key, public_key=public_key,
        key_id="owner-pinned-reviewer",
    )
    return receipt, {receipt.signer_key_id: public_key.hex()}


def capsule(entry, **changes):
    env = ExecutionEnvironment(
        provider="local-lab", model_id=entry.model, model_version=entry.model_version,
        temperature=0.0, seed=42,
    )
    data = dict(
        instruction_version_id=f"failure:{entry.failure_id}",
        environment=env, prompt_input=entry.minimal_reproducer,
        observed_output="A synthetic response", created_at=OBSERVED,
    )
    return create_replay_capsule(**(data | changes))


def reviewed(entry=None, **changes):
    entry = entry or specimen()
    receipt, trusted = signed_source(entry)
    args = inputs() | dict(
        source_receipt=receipt, trusted_source_keys=trusted,
        replay_capsule=capsule(entry),
    )
    args.update(changes)
    return assemble_investigation(entry, **args)


def quality_subject(prompt_variant="normal"):
    protected = {
        "authority_state": {"grants": [], "level": 0, "status": "NONE"},
        "budget": None, "category": "C01",
        "desired_output": "a short note",
        "facts": [{"fact_id": "f1", "statement": "The user asked for a note"}],
        "goal": "Ship the note",
        "hard_constraints": [{"constraint_id": "c1", "statement": "Do not invent facts", "strength": "HARD"}],
        "provenance": [{"provenance_id": "p1", "source": "user"}],
        "unknowns": [], "user_preferences": [],
    }
    chunks = [
        ("Objective", "Ship the note"),
        ("Hard constraints", "- Do not invent facts" if prompt_variant == "normal" else "- something else"),
        ("Budget", "none"),
        ("Facts", "- The user asked for a note"),
        ("Provenance", "- user"),
        ("Authority", "level=0; status=NONE; grants=none"),
        ("Deliverable", "a short note"),
        ("Effect: DIRECT", "Follow the objective directly. Do not invent examples."),
    ]
    prompt = "\n\n".join(f"## {name}\n{text}" for name, text in chunks)
    plan_chunks = [("Hard constraints", "- Do not invent facts") if k == "Hard constraints"
                   else (k, v) for k, v in chunks]
    plan_prompt = "\n\n".join(f"## {k}\n{v}" for k, v in plan_chunks)
    subject = {
        "compiled_prompt": prompt,
        "effect_plan": {
            "blocked_operations": [], "compiled_prompt": plan_prompt,
            "disposition": "BOUND", "effect_version": "k3.effect.g1r7r",
            "operations": ["DIRECT"],
            "protected_fields": {
                key: protected[key] for key in (
                    "authority_state", "budget", "desired_output", "facts", "goal",
                    "hard_constraints", "provenance",
                )
            },
            "renderable": True, "requirement_graph_digest": "gd-1",
            "schema_version": "prompt_effect_plan.v1",
            "sections": [{"code": "DIRECT", "text": "Follow the objective directly. Do not invent examples."}],
            "selection_id": "sel-1", "techniques": ["ZERO_SHOT"],
        },
        "enforcement": "AVAILABLE",
        "k3": {"selection_id": "sel-1", "techniques": ["ZERO_SHOT"]},
        "protected_intent": protected,
        "requirement_graph": {"graph_digest": "gd-1", "validity": "VALID"},
        "xcat": {"active_category": "C01", "taxonomy_version": "2"},
    }
    subject["proof_refs"] = governing_proof_refs(subject)
    return subject


def test_valid_signature_plus_matching_capsule_is_review_ready_not_truth():
    result = reviewed()
    assert result.gate_version == GATE_VERSION
    assert result.state == "READY_FOR_INDEPENDENT_REVIEW"
    assert result.source_receipt_signature_valid is True
    assert result.replay_capsule_integrity_valid is True
    assert result.external_failure_reproduced is False
    assert result.provider_root_cause_verified is False
    assert result.external_repair_validated is False
    assert result.publication_authorized is False
    assert "SOURCE_REVIEW_SIGNATURE_VERIFIED_ONLY" in result.reason_codes
    assert "CAPSULE_HASH_INTEGRITY_ONLY_NO_MODEL_REPLAY" in result.reason_codes
    assert result.evidence_graph["nodes"]["source_review"]["node_type"] == "EVIDENCE"
    assert result.evidence_graph["nodes"]["capsule"]["payload"]["evidence_scope"] == "HASH_ONLY"


def test_untrusted_self_signed_source_receipt_stays_hold():
    entry = specimen()
    receipt, _trusted = signed_source(entry)
    result = assemble_investigation(entry, **inputs(), source_receipt=receipt, replay_capsule=capsule(entry))
    assert result.state == "HOLD"
    assert not result.source_receipt_signature_valid
    assert "OWNER_TRUST_ROOT_UNCONFIGURED" in result.reason_codes


def test_missing_receipt_is_hold():
    entry = specimen()
    report = assemble_investigation(entry, **inputs(), replay_capsule=capsule(entry))
    assert report.state == "HOLD"
    assert "SIGNED_SOURCE_REVIEW_MISSING" in report.reason_codes


@pytest.mark.parametrize(
    "mutant",
    [{"source_urls": ["https://attacker.example.org/forged"]},
     {"source_observed_at": "2026-10-13T10:02:00Z"},
     {"source_published_at": "2026-10-13T09:00:00Z"}],
)
def test_receipt_bound_to_exact_source_and_timestamps(mutant):
    entry = specimen()
    receipt, trusted = signed_source(entry)
    result = assemble_investigation(
        entry, **(inputs() | mutant),
        source_receipt=receipt, trusted_source_keys=trusted,
        replay_capsule=capsule(entry),
    )
    assert result.state == "HOLD"
    assert "SOURCE_RECEIPT_BINDING_MISMATCH" in result.reason_codes


def test_signed_wrong_model_revision_fails_binding():
    entry = specimen()
    receipt, trusted = signed_source(entry)
    other = specimen(model_version="different-revision")
    report = assemble_investigation(other, **inputs(), source_receipt=receipt,
                                    trusted_source_keys=trusted, replay_capsule=capsule(other))
    assert report.state == "HOLD"
    assert "SOURCE_RECEIPT_BINDING_MISMATCH" in report.reason_codes


def test_validly_signed_wrong_schema_is_not_accepted():
    entry = specimen()
    receipt, trusted = signed_source(entry, payload_mutation={"scope": "CONFIRMS_INCIDENT"})
    report = assemble_investigation(entry, **inputs(), source_receipt=receipt,
                                    trusted_source_keys=trusted, replay_capsule=capsule(entry))
    assert report.state == "HOLD"
    assert "SOURCE_RECEIPT_BINDING_MISMATCH" in report.reason_codes


def test_signature_tamper_and_wrong_trust_key_refused():
    entry = specimen()
    receipt, trusted = signed_source(entry)
    altered = replace(receipt, signature_ed25519="0" * 128, verified=True)
    result = assemble_investigation(entry, **inputs(), source_receipt=altered,
                                    trusted_source_keys=trusted, replay_capsule=capsule(entry))
    assert result.state == "HOLD"
    assert "SOURCE_RECEIPT_SIGNATURE_INVALID" in result.reason_codes
    wrong = {receipt.signer_key_id: generate_keypair()[1].hex()}
    result = assemble_investigation(entry, **inputs(), source_receipt=receipt,
                                    trusted_source_keys=wrong, replay_capsule=capsule(entry))
    assert result.state == "HOLD"
    assert not result.source_receipt_signature_valid


def test_capsule_tamper_rejected_even_with_valid_attestation():
    entry = specimen()
    broken = replace(capsule(entry), observed_output="forged output")
    report = reviewed(entry, replay_capsule=broken)
    assert report.state == "HOLD"
    assert "REPLAY_CAPSULE_CONTENT_TAMPERED" in report.reason_codes


@pytest.mark.parametrize("change", [
    {"instruction_version_id": "other-incident"},
    {"prompt_input": "unrelated content"},
    {"environment": ExecutionEnvironment(provider="local-lab", model_id="example-model", model_version="WRONG")},
])
def test_capsule_cannot_be_reused_for_other_incident_or_revision(change):
    entry = specimen()
    result = reviewed(entry, replay_capsule=capsule(entry, **change))
    assert result.state == "HOLD"
    assert "REPLAY_SUBJECT_OR_MODEL_REVISION_MISMATCH" in result.reason_codes


def test_missing_capsule_is_hold_even_with_valid_signed_source():
    report = reviewed(replay_capsule=None)
    assert report.state == "HOLD"
    assert "REPLAY_CAPSULE_MISSING" in report.reason_codes


def test_private_incident_never_promotes_and_hides_public_urls():
    entry = specimen(scope="PRIVATE")
    result = reviewed(entry)
    assert result.state == "HOLD"
    assert "PRIVATE_OR_UNCONSENTED" in result.reason_codes
    assert result.preflight.source_urls == ()
    assert result.publication_authorized is False


def test_legacy_reproduction_and_claimed_root_cause_remain_unverified():
    entry = specimen(
        is_verified_by_reproduction=True, root_cause="Secret internal mechanism is confirmed",
        candidate_repairs=["This prompt completely fixes the bug"],
    )
    result = reviewed(entry)
    assert result.state == "READY_FOR_INDEPENDENT_REVIEW"
    assert "LEGACY_REPRODUCTION_FLAG_NOT_INDEPENDENT_PROOF" in result.reason_codes
    assert "ROOT_CAUSE_STILL_HYPOTHESIS" in result.reason_codes
    assert "EXTERNAL_REPAIR_NOT_TESTED" in result.reason_codes
    assert not result.external_failure_reproduced
    assert not result.provider_root_cause_verified
    assert not result.external_repair_validated
    assert "Secret internal mechanism is confirmed" not in str(result.evidence_graph)
    assert "completely fixes" not in str(result.evidence_graph)


def test_true_static_quality_improvement_never_qualifies_external_repair():
    before = quality_subject("dropped")
    after = quality_subject()
    report = reviewed(before_subject=before, after_subject=after)
    assert report.quality_disposition == "IMPROVED"
    assert "hard:c1" in report.quality_evidence["improved_obligation_ids"]
    assert report.quality_evidence["protected_regressions"] == ()
    assert report.evidence_graph["nodes"]["quality_delta"]["payload"]["disposition"] == "IMPROVED"
    assert not report.external_repair_validated
    assert not report.publication_authorized
    assert PROMPT not in str(report.quality_evidence)


def test_quality_regression_stays_unqualified():
    report = reviewed(
        before_subject=quality_subject(),
        after_subject=quality_subject("dropped"),
    )
    assert report.quality_disposition == "REGRESSED"
    assert report.quality_evidence["protected_regressions"]
    assert not report.external_repair_validated


def test_malformed_quality_pair_fails_closed_without_raw_prompts():
    report = reviewed(before_subject={"compiled_prompt": "private user text"}, after_subject=None)
    assert report.quality_disposition == "UNMEASURED"
    assert report.quality_evidence == {}
    assert "QUALITY_PAIR_INCOMPLETE" in report.reason_codes
    assert "private user text" not in str(report.evidence_graph)


def test_reordered_sources_never_reuse_signed_attestation():
    entry = specimen()
    source_list = [URL, "https://status.example.org/incidents/second"]
    pre = review_failure_for_publication(
        entry, source_urls=source_list, source_published_at=PUBLISHED, source_observed_at=OBSERVED,
    )
    private, public = generate_keypair()
    rec = generate_authenticated_receipt(
        source_review_payload(entry, pre, source_published_at=PUBLISHED, source_observed_at=OBSERVED, source_content_sha256=SOURCE_DIGEST),
        signing_key=private, public_key=public, key_id="owner-pinned",
    )
    report = assemble_investigation(
        entry, source_urls=list(reversed(source_list)),
        source_published_at=PUBLISHED, source_observed_at=OBSERVED,
        source_content_sha256=SOURCE_DIGEST, source_receipt=rec, trusted_source_keys={rec.signer_key_id: public.hex()},
        replay_capsule=capsule(entry),
    )
    assert report.state == "HOLD"
    assert "SOURCE_RECEIPT_BINDING_MISMATCH" in report.reason_codes


def test_missing_and_mutated_source_body_digest_are_not_signed_proof():
    entry = specimen()
    receipt, trusted = signed_source(entry)
    for supplied in (None, "", "0" * 64, SOURCE_DIGEST.upper()):
        args = inputs() | {"source_content_sha256": supplied}
        report = assemble_investigation(
            entry, **args, source_receipt=receipt,
            trusted_source_keys=trusted, replay_capsule=capsule(entry),
        )
        assert report.state == "HOLD"
        assert not report.source_receipt_signature_valid


def test_trusted_but_replaced_source_content_hash_fails_binding():
    entry = specimen()
    receipt, trusted = signed_source(entry)
    report = assemble_investigation(
        entry, **(inputs() | {"source_content_sha256": "a" * 64}),
        source_receipt=receipt, trusted_source_keys=trusted,
        replay_capsule=capsule(entry),
    )
    assert report.state == "HOLD"
    assert "SOURCE_RECEIPT_BINDING_MISMATCH" in report.reason_codes
