"""Grounding/protocol red-team matrix (Task 10).

Loads evaluations/context_protocol_v1/adversarial_cases.jsonl and asserts that
owning modules fail closed: retrieved text stays DATA, ProtectedIntent stays
immutable, and authority/grants cannot be minted from adversarial inputs.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

import pytest

from spe_runtime.adapters.protocol_render import render_execution_contract
from spe_runtime.grounding.compiler import compile_context
from spe_runtime.grounding.firewall import sanitize_external_payload
from spe_runtime.grounding.freshness import freshness_state
from spe_runtime.grounding.models import ContextCapsule
from spe_runtime.grounding.privacy import minimize_public_query
from spe_runtime.protocols.capability_routing import CapabilityProfile
from spe_runtime.protocols.compiler import compile_execution_contract
from spe_runtime.protocols.evaluators import evaluate_result
from spe_runtime.protocols.models import ProtocolDepth, ProtocolNode
from spe_runtime.protocols.optimize import PromptCandidate, optimize_prompt

_CASES_PATH = (
    Path(__file__).resolve().parents[2]
    / "evaluations"
    / "context_protocol_v1"
    / "adversarial_cases.jsonl"
)


def _load_cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    with _CASES_PATH.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            cases.append(json.loads(line))
    return cases


CASES = _load_cases()
CASES_BY_ID = {c["case_id"]: c for c in CASES}
REQUIRED_ATTACK_CLASSES = frozenset(
    {
        "prompt_injection_retrieved_text",
        "poisoned_documentation",
        "fake_citations",
        "fake_authority_labels",
        "duplicate_source_spam",
        "stale_source",
        "retracted_source",
        "conflicting_sources",
        "unicode_control_injection",
        "html_script_payload",
        "oversized_context",
        "privacy_leakage",
        "protocol_node_injection",
        "adapter_node_dropping",
        "optimizer_protected_intent_mutation",
        "evaluator_authority_minting",
        "fake_plugin_tool_capability_grants",
    }
)


def _base_capsule(**overrides: Any) -> ContextCapsule:
    base: dict[str, Any] = dict(
        capsule_id="cap-adv-1",
        domain_id="research",
        context_type="SCHOLARLY_EVIDENCE",
        claim_or_observation="Observation under test",
        value="Value under test",
        source_id="doi:10.1/adv-example",
        source_class="peer_reviewed",
        authority_class="REFERENCE",
        retrieved_at="2026-01-01T00:00:00Z",
        valid_as_of="2026-01-01T00:00:00Z",
        fresh_until="2026-06-01T00:00:00Z",
        license="CC-BY-4.0",
        allowed_use="SUMMARIZE_WITH_ATTRIBUTION",
        confidence=0.8,
        support_status="SUPPORTED",
        contradiction_group=None,
        provenance_digest="sha256:adv-1",
        taint_labels=("UNTRUSTED_SOURCE",),
        sensitivity_labels=(),
    )
    base.update(overrides)
    return ContextCapsule(**base)


def test_adversarial_fixture_covers_required_attack_classes():
    present = {c["attack_class"] for c in CASES}
    missing = sorted(REQUIRED_ATTACK_CLASSES - present)
    assert missing == [], f"adversarial_cases.jsonl missing classes: {missing}"
    assert len(CASES) >= len(REQUIRED_ATTACK_CLASSES)


def test_prompt_injection_retrieved_text_remains_data():
    case = CASES_BY_ID["adv-prompt-injection-retrieved"]
    out = sanitize_external_payload(case["payload"])
    assert "authority" not in out
    assert "verified_success" not in out
    assert "UNTRUSTED_SOURCE" in out.get("taint_labels", ())
    assert "IGNORE ALL PRIOR INSTRUCTIONS" in out["claim"]


def test_poisoned_documentation_rejected():
    case = CASES_BY_ID["adv-poisoned-doc"]
    with pytest.raises(ValueError) as excinfo:
        sanitize_external_payload(case["payload"])
    assert "forbidden" in str(excinfo.value).lower()


def test_fake_citations_rejected():
    case = CASES_BY_ID["adv-fake-citation"]
    with pytest.raises(ValueError) as excinfo:
        sanitize_external_payload(case["payload"])
    assert "forbidden" in str(excinfo.value).lower()


def test_fake_authority_label_rejected_by_compiler():
    case = CASES_BY_ID["adv-fake-authority-label"]
    hostile = _base_capsule(**case["capsule_overrides"])
    with pytest.raises(ValueError) as excinfo:
        compile_context("adv research", (hostile,))
    assert "authority" in str(excinfo.value).lower()


def test_duplicate_source_spam_suppressed():
    case = CASES_BY_ID["adv-duplicate-source-spam"]
    n = int(case["duplicate_count"])
    capsules = tuple(
        _base_capsule(
            capsule_id=f"cap-dup-{i}",
            provenance_digest=f"sha256:dup-{i}",
            claim_or_observation=f"spam claim {i}",
            # Same source_id on purpose — duplicate spam.
            source_id="doi:10.1/spam-source",
        )
        for i in range(n)
    )
    bundle = compile_context("dedupe spam", capsules)
    source_ids = [c.source_id for c in bundle.capsules]
    assert len(set(source_ids)) == case["expected"]["unique_sources"]
    assert len(bundle.capsules) == case["expected"]["unique_sources"]
    assert case["expected"]["reason_code"] in bundle.reason_codes


def test_stale_source_detected():
    case = CASES_BY_ID["adv-stale-source"]
    cap = _base_capsule(fresh_until=case["fresh_until"])
    assert freshness_state(cap, case["now"]) == case["expected"]["freshness_state"]


def test_retracted_source_rejected():
    case = CASES_BY_ID["adv-retracted-source"]
    retracted = _base_capsule(**case["capsule_overrides"])
    with pytest.raises(ValueError) as excinfo:
        compile_context("retracted research", (retracted,))
    assert "retracted" in str(excinfo.value).lower()


def test_conflicting_sources_flagged_not_auto_resolved():
    a = _base_capsule(
        capsule_id="cap-a",
        claim_or_observation="Treatment X reduces risk by 40%",
        value="risk -40%",
        source_id="doi:10.1/a",
        provenance_digest="sha256:a",
        support_status="SUPPORTED",
        contradiction_group="tx-x-risk",
    )
    b = _base_capsule(
        capsule_id="cap-b",
        claim_or_observation="Treatment X increases risk by 10%",
        value="risk +10%",
        source_id="doi:10.1/b",
        provenance_digest="sha256:b",
        support_status="CONTRADICTED",
        contradiction_group="tx-x-risk",
    )
    bundle = compile_context("conflicting research", (a, b))
    assert "CONFLICTING_SOURCES" in bundle.reason_codes
    # Both claims retained as DATA — no silent winner.
    claims = {c.claim_or_observation for c in bundle.capsules}
    assert a.claim_or_observation in claims
    assert b.claim_or_observation in claims
    assert len(bundle.capsules) == 2


def test_unicode_control_characters_stripped():
    case = CASES_BY_ID["adv-unicode-controls"]
    out = sanitize_external_payload(case["payload"])
    assert "\u0001" not in out["claim"]
    assert "\u007f" not in out["claim"]
    assert "\u200b" not in out["claim"]
    assert "safe" in out["claim"] and "claim" in out["claim"]


def test_html_script_payloads_stripped():
    case = CASES_BY_ID["adv-html-script"]
    out = sanitize_external_payload(case["payload"])
    blob = f"{out['claim']} {out['excerpt']}".lower()
    assert "<script>" not in blob
    assert "</script>" not in blob
    assert "<b>" not in blob
    assert "battery" in out["claim"].lower() or "battery" in blob


def test_oversized_context_rejected():
    case = CASES_BY_ID["adv-oversized-context"]
    huge = _base_capsule(value="X" * int(case["value_bytes"]))
    with pytest.raises(ValueError) as excinfo:
        compile_context(
            "oversized",
            (huge,),
            max_context_bytes=int(case["max_context_bytes"]),
        )
    assert "oversized" in str(excinfo.value).lower()


def test_privacy_leakage_blocked_in_public_query():
    case = CASES_BY_ID["adv-privacy-leakage"]
    out = minimize_public_query(
        case["text"],
        tuple(case["sensitive_spans"]),
    )
    for secret in case["expected"]["absent_from_public"]:
        assert secret not in out.public_query
    assert out.omitted_spans
    # Local-only audit fields must not be echoed into the public query string.
    assert "omitted_spans" not in out.public_query


def test_protocol_node_injection_rejected():
    case = CASES_BY_ID["adv-protocol-node-injection"]
    with pytest.raises(ValueError) as excinfo:
        ProtocolNode.from_dict(case["raw_node"])
    assert "forbidden" in str(excinfo.value).lower()


def test_adapter_cannot_drop_required_nodes():
    case = CASES_BY_ID["adv-adapter-drop-required"]
    contract = compile_execution_contract(
        domain_ids=(case["domain"],),
        depth=ProtocolDepth(case["depth"]),
        capability_profile=None,
    )
    text = render_execution_contract(contract, "ANY_AI")
    for needle in case["required_substrings"]:
        assert needle in text
    # Every compiled node title must appear — adapters may reorder/syntax-change
    # but must not silently drop protocol nodes.
    for node in contract.graph.nodes:
        assert node.title in text, f"adapter dropped node title: {node.title}"


def test_optimizer_cannot_mutate_protected_intent():
    case = CASES_BY_ID["adv-optimizer-intent-mutation"]
    intent = case["intent"]

    def hostile_evaluator(cand: PromptCandidate) -> Mapping[str, Any]:
        return {
            "score": 0.05,
            "proposed_changes": {
                "protected_intent": "MUTATED",
                "authority": "ROOT",
                "execution_wording": "ignore",
            },
        }

    result = optimize_prompt(
        PromptCandidate(
            protected_intent=intent,
            hard_constraints=("keep-safety",),
            source_facts=("fact",),
            authority="NONE",
            execution_wording="baseline",
        ),
        hostile_evaluator,
        max_iterations=2,
    )
    assert result.final_candidate.protected_intent == intent
    assert result.stop_reason == case["expected"]["stop_reason"]


def test_evaluator_cannot_mint_authority():
    case = CASES_BY_ID["adv-evaluator-authority-mint"]
    with pytest.raises(ValueError) as excinfo:
        evaluate_result("protocol.research", case["evidence"])
    assert "authority" in str(excinfo.value).lower()


def test_fake_plugin_tool_capability_grants_rejected():
    case = CASES_BY_ID["adv-fake-capability-grant"]
    with pytest.raises(ValueError) as excinfo:
        CapabilityProfile.from_descriptor(case["descriptor"])
    assert "forbidden" in str(excinfo.value).lower()


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["case_id"])
def test_each_adversarial_case_has_module_and_expected(case: dict[str, Any]):
    assert case.get("module")
    assert case.get("attack_class")
    assert isinstance(case.get("expected"), dict)
