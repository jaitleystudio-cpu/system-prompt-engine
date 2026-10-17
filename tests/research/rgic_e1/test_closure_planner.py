"""
Unit & Adversarial Tests for RGIC-E1 Evidence Closure Planner
Part of SPE Ω Research Quarantine.
"""

import pytest
import hashlib
from spe_runtime.research.rgic_e1.types import (
    Obligation, ObligationState, VerificationAction, VerificationActionKind,
    EvidenceReceipt, EvidencePolicy, AuthorityBoundary,
    EvidenceClosureContract, ClaimScope, JustifiedExclusion
)
from spe_runtime.research.rgic_e1.closure_planner import ClosurePlanner
from spe_runtime.research.rgic_e1.adjudicator import Adjudicator
from spe_runtime.research.rgic_e1.portable_contract import PortableContract

def test_rejects_ungrounded_claims():
    adj = Adjudicator()
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1", state=ObligationState.PASS)
    contract = EvidenceClosureContract(schema_version="0.2.0", protected_intent_ref="I1", obligations=[obs])
    adj.adjudicate(contract)
    assert contract.obligations[0].state == ObligationState.UNKNOWN
    assert contract.claim_scope == ClaimScope.UNRESOLVED

def test_rejects_unauthorized_actions():
    planner = ClosurePlanner()
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1")
    action = VerificationAction(id="A1", description="Probe", cost_nano_usd=100, risk_score=10, is_authorized=False)
    probe = planner.select_minimal_probe([action], obs)
    assert probe is None

def test_preserves_unknown():
    adj = Adjudicator()
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1", state=ObligationState.UNKNOWN)
    contract = EvidenceClosureContract(schema_version="0.2.0", protected_intent_ref="I1", obligations=[obs])
    adj.adjudicate(contract)
    assert contract.obligations[0].state == ObligationState.UNKNOWN
    assert contract.claim_scope == ClaimScope.UNRESOLVED

def test_minimal_utility_maximizing_probe():
    planner = ClosurePlanner()
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1")
    action1 = VerificationAction(id="A1", description="Expensive", cost_nano_usd=1000, risk_score=10, is_authorized=True)
    action2 = VerificationAction(id="A2", description="Minimal", cost_nano_usd=100, risk_score=10, is_authorized=True)
    probe = planner.select_minimal_probe([action1, action2], obs)
    assert probe is not None
    assert probe.id == "A2"

def test_anti_self_certification_rejected():
    adj = Adjudicator()
    # Agent tries to issue its own receipt
    self_receipt = EvidenceReceipt(
        id="R_self", data="trust_me_bro", is_valid=True, issuer_id="agent_alpha"
    )
    obs = Obligation(
        id="O_auth", requirement="Auth invariant", acceptance_rule_ref="R_auth",
        state=ObligationState.PASS, evidence_receipts=[self_receipt]
    )
    contract = EvidenceClosureContract(
        schema_version="0.2.0", protected_intent_ref="I1", agent_id="agent_alpha",
        obligations=[obs]
    )
    adj.adjudicate(contract)
    # Self-certification rejected -> Demoted to UNKNOWN
    assert contract.obligations[0].state == ObligationState.UNKNOWN
    assert contract.claim_scope == ClaimScope.UNRESOLVED

def test_independent_receipt_accepted():
    adj = Adjudicator()
    external_receipt = EvidenceReceipt(
        id="R_ext", data="verified", is_valid=True, issuer_id="independent_oracle_verifier"
    )
    obs = Obligation(
        id="O_sec", requirement="Zero leak", acceptance_rule_ref="R_sec",
        state=ObligationState.PASS, evidence_receipts=[external_receipt]
    )
    contract = EvidenceClosureContract(
        schema_version="0.2.0", protected_intent_ref="I1", agent_id="agent_alpha",
        obligations=[obs]
    )
    adj.adjudicate(contract)
    assert contract.obligations[0].state == ObligationState.PASS
    assert contract.claim_scope == ClaimScope.VERIFIED

def test_rule_tampering_attempt_demoted_to_fail():
    adj = Adjudicator()
    obs = Obligation(
        id="O_tamper", requirement="Hard constraint", acceptance_rule_ref="ORIGINAL_RULE_V1"
    )
    # Malicious actor changes the rule text
    obs.acceptance_rule_ref = "TAMPERED_RULE_EASY_PASS"
    obs.state = ObligationState.PASS

    contract = EvidenceClosureContract(
        schema_version="0.2.0", protected_intent_ref="I1", obligations=[obs]
    )
    adj.adjudicate(contract)
    assert contract.obligations[0].state == ObligationState.FAIL
    assert contract.claim_scope == ClaimScope.LIMITED

def test_justified_exclusion_handling():
    adj = Adjudicator()
    # 1. Unjustified NOT_APPLICABLE -> Demoted to UNKNOWN
    unjustified_obs = Obligation(
        id="O_na1", requirement="Compliance check", acceptance_rule_ref="R_comp",
        state=ObligationState.NOT_APPLICABLE, justified_exclusion=None
    )
    c1 = EvidenceClosureContract(schema_version="0.2.0", protected_intent_ref="I1", obligations=[unjustified_obs])
    adj.adjudicate(c1)
    assert c1.obligations[0].state == ObligationState.UNKNOWN
    assert c1.claim_scope == ClaimScope.UNRESOLVED

    # 2. Justified NOT_APPLICABLE -> Preserved
    justified_obs = Obligation(
        id="O_na2", requirement="Payment processor check", acceptance_rule_ref="R_pay",
        state=ObligationState.NOT_APPLICABLE,
        justified_exclusion=JustifiedExclusion(
            reason="Architecture is 100% static blog with no payments",
            justification_hash="hash123",
            authorized_by="LeadArchitect"
        )
    )
    c2 = EvidenceClosureContract(schema_version="0.2.0", protected_intent_ref="I1", obligations=[justified_obs])
    adj.adjudicate(c2)
    assert c2.obligations[0].state == ObligationState.NOT_APPLICABLE
    assert c2.claim_scope == ClaimScope.VERIFIED

def test_masdrift_delegation_handoff_validation():
    adj = Adjudicator()
    parent_obs = Obligation(
        id="O1", requirement="Keep safe", acceptance_rule_ref="R1",
        authority_boundary=AuthorityBoundary(boundary_id="B1", max_cost_nano_usd=1000, network_egress_allowed=False)
    )
    parent = EvidenceClosureContract(schema_version="0.2.0", protected_intent_ref="I1", obligations=[parent_obs])

    # Escalated child
    child_obs = Obligation(
        id="O1", requirement="Keep safe", acceptance_rule_ref="R1",
        authority_boundary=AuthorityBoundary(boundary_id="B2", max_cost_nano_usd=5000, network_egress_allowed=True)
    )
    child = EvidenceClosureContract(schema_version="0.2.0", protected_intent_ref="I1", obligations=[child_obs])

    # Must be rejected
    assert not adj.validate_delegation_handoff(parent, child)

def test_voi_clarification_friction_suppression():
    planner = ClosurePlanner()
    obs = Obligation(id="O_conf", requirement="Database engine selection", acceptance_rule_ref="R_db", criticality=7)

    tool_probe = VerificationAction(
        id="A_docker_ps", kind=VerificationActionKind.TOOL_CALL, description="Check running containers",
        cost_nano_usd=200_000, risk_score=5, is_authorized=True,
        expected_entropy_reduction=850, clarification_friction_score=0
    )
    interrupt_probe = VerificationAction(
        id="A_ask_user", kind=VerificationActionKind.TARGETED_QUESTION, description="Ask user what DB they use",
        cost_nano_usd=10_000, risk_score=10, is_authorized=True,
        expected_entropy_reduction=900, clarification_friction_score=600  # High friction!
    )

    best = planner.select_minimal_probe([tool_probe, interrupt_probe], obs)
    assert best is not None
    # VOI selects programmatic inspection over annoying user question
    assert best.id == "A_docker_ps"

def test_portability_and_adapters():
    obs = Obligation(id="O1", requirement="Strict schema", acceptance_rule_ref="R_schema", state=ObligationState.UNKNOWN)
    contract = EvidenceClosureContract(
        contract_id="C_100", schema_version="0.2.0", protected_intent_ref="I1", obligations=[obs]
    )

    # 1. Canonical serialization
    s = PortableContract.serialize(contract)
    assert "schema_version" in s
    digest = PortableContract.compute_digest(contract)
    assert len(digest) == 64

    # 2. Round-trip deserialization
    d = PortableContract.to_dict(contract)
    reconstructed = PortableContract.from_dict(d)
    assert reconstructed.contract_id == contract.contract_id
    assert len(reconstructed.obligations) == 1
    assert reconstructed.obligations[0].state == ObligationState.UNKNOWN

    # 3. Multi-runtime format adapters
    openai_fmt = PortableContract.to_openai_agents_format(contract)
    assert "openai_agents_contract" in openai_fmt
    assert openai_fmt["openai_agents_contract"]["guardrails"][0]["guardrail_id"] == "spe_guard_O1"

    langsmith_fmt = PortableContract.to_langsmith_format(contract)
    assert "langsmith_evaluation_suite" in langsmith_fmt
    assert langsmith_fmt["langsmith_evaluation_suite"]["evaluators"][0]["evaluator_name"] == "spe_O1"

    claude_fmt = PortableContract.to_claude_skill_format(contract)
    assert "claude_skill_verification" in claude_fmt
    assert claude_fmt["claude_skill_verification"]["assertions"][0]["assertion_id"] == "O1"
