"""
SPE Ω — CEC Adversarial Tampering & Cryptographic Integrity Tests.
Tests:
1. Forged transition witness Ed25519 signature rejection.
2. Content-addressable obligation specification tampering detection.
3. Unbounded delegation loop (DoS attack) depth rejection.
4. Privacy declassification evasion attempt blocking.
"""

import pytest
from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.cec import (
    ConservedContract,
    ObligationRecord,
    Disposition,
    InformationLabel,
    TransitionWitness,
    TransitionValidator,
    HandoffProtocol,
)


def test_transition_witness_signature_verification_and_forgery():
    """Verifies that an altered payload or invalid signature is rejected."""
    sk_real, pk_real = generate_keypair()
    sk_attacker, pk_attacker = generate_keypair()

    parent = ConservedContract(
        contract_id="c-parent",
        protected_intent_ref="intent://sample",
        root_commitment="sha256-root",
        obligations={},
        permitted_authorities={"EXECUTE"},
    )

    child, valid_witness = HandoffProtocol.delegate_task(
        parent=parent,
        child_agent_id="child-1",
        delegated_obligation_ids=set(),
        delegated_authorities={"EXECUTE"},
        signing_key=sk_real,
        public_key=pk_real,
    )

    # 1. Valid signature passes verification
    assert HandoffProtocol.verify_witness_signature(valid_witness, pk_real) is True

    # 2. Verification against attacker's key fails
    assert HandoffProtocol.verify_witness_signature(valid_witness, pk_attacker) is False

    # 3. Tampered payload fails verification
    tampered_witness = TransitionWitness(
        witness_id=valid_witness.witness_id,
        source_contract_id=valid_witness.source_contract_id,
        target_contract_id="c-tampered-target",  # Modified!
        source_hash=valid_witness.source_hash,
        target_hash=valid_witness.target_hash,
        transition_type=valid_witness.transition_type,
        issuer_agent_id=valid_witness.issuer_agent_id,
        signature=valid_witness.signature,
    )
    assert HandoffProtocol.verify_witness_signature(tampered_witness, pk_real) is False


def test_content_addressable_obligation_spec_tampering():
    """Detects when an attacker alters the underlying specification without changing the obligation ID."""
    spec_original = {"min_password_len": 16, "require_mfa": True}
    computed_id = ObligationRecord.compute_content_id("spec://auth/policy", spec_original)

    # Attacker weakens the specification
    spec_tampered = {"min_password_len": 4, "require_mfa": False}
    tampered_computed_id = ObligationRecord.compute_content_id("spec://auth/policy", spec_tampered)

    # Immutable content addresses must differ
    assert computed_id != tampered_computed_id


def test_unbounded_delegation_chain_depth_rejection():
    """Blocks recursive delegation chains that exceed max permitted depth (depth > 5)."""
    parent = ConservedContract(
        contract_id="c-root",
        protected_intent_ref="intent://root",
        root_commitment="sha256-root",
        obligations={},
        permitted_authorities={"EXECUTE"},
        delegation_depth=5,  # Already at depth 5
    )

    # Child at depth 6
    child = ConservedContract(
        contract_id="c-depth-6",
        protected_intent_ref="intent://root",
        root_commitment="sha256-root",
        obligations={},
        permitted_authorities={"EXECUTE"},
        parent_contract_id=parent.contract_id,
        delegation_depth=6,  # Exceeds max depth 5
    )

    ok, errors = TransitionValidator.validate_transition(parent, child)
    assert ok is False
    assert any("Maximum delegation depth exceeded: 6 > 5" in e for e in errors)


def test_privacy_label_demotion_evasion_blocked():
    """Blocks attempts to demote AIR_GAPPED or CONFIDENTIAL labels to PUBLIC."""
    parent = ConservedContract(
        contract_id="c-confidential",
        protected_intent_ref="intent://root",
        root_commitment="sha256-root",
        obligations={},
        permitted_authorities={"READ"},
        information_label=InformationLabel.AIR_GAPPED,
    )

    child_demoted = ConservedContract(
        contract_id="c-public-attempt",
        protected_intent_ref="intent://root",
        root_commitment="sha256-root",
        obligations={},
        permitted_authorities={"READ"},
        information_label=InformationLabel.PUBLIC,
    )

    ok, errors = TransitionValidator.validate_transition(parent, child_demoted)
    assert ok is False
    assert any("Confidentiality label demotion" in e for e in errors)
