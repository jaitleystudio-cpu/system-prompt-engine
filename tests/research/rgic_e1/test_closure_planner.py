import pytest
from spe_runtime.research.rgic_e1.types import (
    Obligation, ObligationState, VerificationAction, EvidenceReceipt,
    EvidenceClosureContract, ClaimScope
)
from spe_runtime.research.rgic_e1.closure_planner import ClosurePlanner
from spe_runtime.research.rgic_e1.adjudicator import Adjudicator
from spe_runtime.research.rgic_e1.portable_contract import PortableContract

def test_rejects_ungrounded_claims():
    adj = Adjudicator()
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1", state=ObligationState.PASS)
    contract = EvidenceClosureContract(schema_version="0.1", protected_intent_ref="I1", obligations=[obs])
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
    contract = EvidenceClosureContract(schema_version="0.1", protected_intent_ref="I1", obligations=[obs])
    adj.adjudicate(contract)
    assert contract.obligations[0].state == ObligationState.UNKNOWN
    assert contract.claim_scope == ClaimScope.UNRESOLVED

def test_minimal_utility_maximizing_probe():
    planner = ClosurePlanner()
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1")
    action1 = VerificationAction(id="A1", description="Probe", cost_nano_usd=1000, risk_score=10, is_authorized=True)
    action2 = VerificationAction(id="A2", description="Minimal", cost_nano_usd=100, risk_score=10, is_authorized=True)
    probe = planner.select_minimal_probe([action1, action2], obs)
    assert probe.id == "A2"

def test_portability():
    obs = Obligation(id="O1", requirement="Test", acceptance_rule_ref="R1", state=ObligationState.UNKNOWN)
    contract = EvidenceClosureContract(schema_version="0.1", protected_intent_ref="I1", obligations=[obs])
    s = PortableContract.serialize(contract)
    assert "schema_version" in s
    assert "UNKNOWN" in s
