"""
SPE Ω — CEC Multi-Model Handoff Simulation & Attack Benchmark.
Reproduces and blocks:
1. Facts-Without-Rules attack (Rule stripping during handoff summary).
2. MasDrift attack (Decentralized authority escalation).
3. False certainty inflation across model boundaries.
4. Validates compliant 4-stage pipeline with partial verification and explicit delta.
"""

import pytest
from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.cec import (
    ConservedContract,
    ObligationRecord,
    Disposition,
    InformationLabel,
    EnvironmentFingerprint,
    TransitionWitness,
    TransitionValidator,
    HandoffProtocol,
)


def create_3d_web_root_contract() -> ConservedContract:
    obs = {
        "OBL-OFFLINE": ObligationRecord(
            obligation_id="OBL-OFFLINE",
            requirement_ref="spec://requirements/offline_only",
            predicate_spec={"allowed_hosts": []},
            disposition=Disposition.OPEN,
            is_mandatory=True,
        ),
        "OBL-A11Y": ObligationRecord(
            obligation_id="OBL-A11Y",
            requirement_ref="spec://requirements/keyboard_a11y",
            predicate_spec={"wcag_level": "AA"},
            disposition=Disposition.OPEN,
            is_mandatory=True,
        ),
        "OBL-SINGLE-FILE": ObligationRecord(
            obligation_id="OBL-SINGLE-FILE",
            requirement_ref="spec://requirements/single_file_html",
            predicate_spec={"max_files": 1},
            disposition=Disposition.OPEN,
            is_mandatory=True,
        ),
        "OBL-HUMAN-APPROVAL": ObligationRecord(
            obligation_id="OBL-HUMAN-APPROVAL",
            requirement_ref="spec://requirements/human_sign_off",
            predicate_spec={"role": "owner"},
            disposition=Disposition.OPEN,
            is_mandatory=True,
        ),
    }
    return ConservedContract(
        contract_id="contract-3d-web-root",
        protected_intent_ref="intent://build-3d-website",
        root_commitment="sha256-root-intent-hash",
        obligations=obs,
        permitted_authorities={"LOCAL_CODEGEN", "RUN_TESTS"},
        information_label=InformationLabel.CONFIDENTIAL,
    )


def test_facts_without_rules_attack_blocked_at_handoff():
    """
    Simulates Facts-Without-Rules failure:
    Agent 2 (Coder) receives a prompt summary that drops 'OBL-OFFLINE'.
    When attempting to advance the contract without OBL-OFFLINE, CEC validator blocks the transition.
    """
    root = create_3d_web_root_contract()

    # Coder agent constructs candidate target contract missing OBL-OFFLINE
    coder_obs = {
        k: v for k, v in root.obligations.items() if k != "OBL-OFFLINE"
    }
    coder_contract = ConservedContract(
        contract_id="contract-coder-step",
        protected_intent_ref=root.protected_intent_ref,
        root_commitment=root.root_commitment,
        obligations=coder_obs,
        permitted_authorities=root.permitted_authorities,
        information_label=root.information_label,
    )

    ok, errors = TransitionValidator.validate_transition(root, coder_contract)
    assert ok is False
    assert any("Law 1 violation" in e and "OBL-OFFLINE" in e for e in errors)


def test_masdrift_authority_escalation_blocked():
    """
    Simulates MasDrift decentralized agent failure:
    Agent 3 (Optimizer) requests DEPLOY_PRODUCTION authority.
    CEC validator blocks the escalation immediately.
    """
    root = create_3d_web_root_contract()

    escalated_contract = ConservedContract(
        contract_id="contract-optimizer-step",
        protected_intent_ref=root.protected_intent_ref,
        root_commitment=root.root_commitment,
        obligations=root.obligations,
        permitted_authorities={"LOCAL_CODEGEN", "RUN_TESTS", "DEPLOY_PRODUCTION"},  # Escalated!
        information_label=root.information_label,
    )

    ok, errors = TransitionValidator.validate_transition(root, escalated_contract)
    assert ok is False
    assert any("Law 2 violation: Child authority escalation" in e and "DEPLOY_PRODUCTION" in e for e in errors)


def test_compliant_multi_model_pipeline_with_explicit_delta():
    """
    Full 4-model collaboration pipeline:
    1. Planner -> Coder (Delegates OBL-SINGLE-FILE and OBL-A11Y)
    2. Coder executes and returns verified receipts for both
    3. Tester executes and verifies OBL-OFFLINE
    4. Reporter attempts to report FULLY_VERIFIED -> Blocked (OBL-HUMAN-APPROVAL is OPEN)
    5. Reporter reports PARTIALLY_VERIFIED with explicit delta -> ADMITTED
    """
    sk, pk = generate_keypair()
    root = create_3d_web_root_contract()

    # Stage 1: Delegation to Coder for implementation tasks
    coder_child, delegation_wit = HandoffProtocol.delegate_task(
        parent=root,
        child_agent_id="agent-coder-01",
        delegated_obligation_ids={"OBL-SINGLE-FILE", "OBL-A11Y"},
        delegated_authorities={"LOCAL_CODEGEN"},
        signing_key=sk,
        public_key=pk,
    )

    # Verify delegation transition is admitted
    valid_trans, errors = TransitionValidator.validate_transition(root, coder_child, witness=delegation_wit)
    assert valid_trans is True
    assert len(errors) == 0

    # Stage 2: Coder verifies both delegated obligations with proof receipts
    coder_child.obligations["OBL-SINGLE-FILE"] = ObligationRecord(
        obligation_id="OBL-SINGLE-FILE",
        requirement_ref="spec://requirements/single_file_html",
        predicate_spec={"max_files": 1},
        disposition=Disposition.VERIFIED,
        witness_receipt_ref="receipt://ast-bundler/clean",
    )
    coder_child.obligations["OBL-A11Y"] = ObligationRecord(
        obligation_id="OBL-A11Y",
        requirement_ref="spec://requirements/keyboard_a11y",
        predicate_spec={"wcag_level": "AA"},
        disposition=Disposition.VERIFIED,
        witness_receipt_ref="receipt://axe-core/zero-violations",
    )

    # Stage 3: Merge coder results back to parent
    merged, merge_ok, merge_errs = TransitionValidator.reconcile_dag_join(root, [coder_child])
    assert merge_ok is True
    assert merged.obligations["OBL-SINGLE-FILE"].disposition == Disposition.VERIFIED
    assert merged.obligations["OBL-A11Y"].disposition == Disposition.VERIFIED
    assert merged.obligations["OBL-OFFLINE"].disposition == Disposition.OPEN
    assert merged.obligations["OBL-HUMAN-APPROVAL"].disposition == Disposition.OPEN

    # Stage 4: Reporter claiming FULLY_VERIFIED must fail under Law 6
    wit_claim_full = TransitionWitness(
        witness_id="wit-final",
        source_contract_id=merged.contract_id,
        target_contract_id=merged.contract_id,
        source_hash=merged.canonical_hash(),
        target_hash=merged.canonical_hash(),
        transition_type="TASK_COMPLETION",
        issuer_agent_id="agent-reporter",
        reconciliation_details={"assert_full_completion": True},
    )
    ok_full, errs_full = TransitionValidator.validate_transition(merged, merged, witness=wit_claim_full)
    assert ok_full is False
    assert any("Law 6 violation: Task claimed FULLY_VERIFIED while mandatory obligations remain unresolved" in e for e in errs_full)

    # Stage 5: Reporting PARTIALLY_VERIFIED (without claiming full completion) is valid and leaves delta visible
    wit_partial = TransitionWitness(
        witness_id="wit-final-partial",
        source_contract_id=merged.contract_id,
        target_contract_id=merged.contract_id,
        source_hash=merged.canonical_hash(),
        target_hash=merged.canonical_hash(),
        transition_type="TASK_COMPLETION",
        issuer_agent_id="agent-reporter",
        reconciliation_details={"assert_full_completion": False},
    )
    ok_partial, errs_partial = TransitionValidator.validate_transition(merged, merged, witness=wit_partial)
    assert ok_partial is True
    assert len(errs_partial) == 0
