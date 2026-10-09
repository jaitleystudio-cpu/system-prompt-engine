"""
SPE Ω — CEC Conservation Laws Test Battery.
Tests the 6 Conservation Laws individually:
- Law 1: Protected-Obligation Continuity
- Law 2: No Unauthorized Capability Expansion
- Law 3: No Unsupported Evidence Promotion
- Law 4: Privacy Boundaries Survive Compression
- Law 5: Evidence Expires with Its Assumptions
- Law 6: Unresolved Uncertainty Remains Visible
"""

import pytest
from spe_runtime.research.cec import (
    ConservedContract,
    ObligationRecord,
    Disposition,
    InformationLabel,
    EnvironmentFingerprint,
    TransitionWitness,
    TransitionValidator,
    AssumptionTracker,
)


def make_sample_env(commit: str = "commit-abc-001") -> EnvironmentFingerprint:
    return EnvironmentFingerprint(
        os_name="macOS-15-arm64",
        git_commit=commit,
        runtime_version="python-3.14",
        tool_digest="sha256-tools-clean",
    )


def make_sample_contract(
    contract_id: str = "c-root",
    authorities: set = None,
    label: InformationLabel = InformationLabel.CONFIDENTIAL,
    env: EnvironmentFingerprint = None,
    disposition_map: dict = None,
) -> ConservedContract:
    if authorities is None:
        authorities = {"READ_LOCAL", "WRITE_LOCAL"}
    if env is None:
        env = make_sample_env()

    dispositions = disposition_map or {
        "O-01": Disposition.OPEN,
        "O-02": Disposition.OPEN,
    }

    obs = {}
    for oid, disp in dispositions.items():
        obs[oid] = ObligationRecord(
            obligation_id=oid,
            requirement_ref=f"req://spec/{oid}",
            predicate_spec={"rule": f"rule_for_{oid}"},
            disposition=disp,
            is_mandatory=True,
            witness_receipt_ref=f"wit-{oid}" if disp == Disposition.VERIFIED else None,
        )

    return ConservedContract(
        contract_id=contract_id,
        protected_intent_ref="intent://user/001",
        root_commitment="sha256-root-intent-hash",
        obligations=obs,
        permitted_authorities=authorities,
        information_label=label,
        environment_fingerprint=env,
    )


def test_law_1_obligation_continuity_linear_and_delegated():
    """Law 1: Mandatory obligations must not be dropped in linear handoff or delegation."""
    parent = make_sample_contract("c-parent", disposition_map={"O-01": Disposition.OPEN, "O-02": Disposition.OPEN})

    # Case A: Linear handoff omitting O-02 -> VIOLATION
    target_omitted = make_sample_contract("c-linear", disposition_map={"O-01": Disposition.OPEN})
    ok, errs = TransitionValidator.validate_transition(parent, target_omitted)
    assert ok is False
    assert any("Law 1 violation" in e and "O-02" in e for e in errs)

    # Case B: Delegated handoff with proper retained obligation accounting -> VALID
    target_delegated = make_sample_contract("c-child", disposition_map={"O-01": Disposition.OPEN})
    target_delegated.parent_contract_id = parent.contract_id
    witness = TransitionWitness(
        witness_id="wit-del-1",
        source_contract_id=parent.contract_id,
        target_contract_id=target_delegated.contract_id,
        source_hash=parent.canonical_hash(),
        target_hash=target_delegated.canonical_hash(),
        transition_type="DELEGATION",
        issuer_agent_id="orchestrator",
        reconciliation_details={"retained_obligations": ["O-02"]},
    )
    ok, errs = TransitionValidator.validate_transition(parent, target_delegated, witness=witness)
    assert ok is True
    assert len(errs) == 0


def test_law_2_authority_attenuation():
    """Law 2: Child cannot gain authority not possessed by parent."""
    parent = make_sample_contract("c-parent", authorities={"READ_ONLY"})

    # Child attempts to gain WRITE_DATABASE
    child = make_sample_contract("c-child", authorities={"READ_ONLY", "WRITE_DATABASE"})
    child.parent_contract_id = parent.contract_id

    ok, errs = TransitionValidator.validate_transition(parent, child)
    assert ok is False
    assert any("Law 2 violation: Child authority escalation" in e for e in errs)


def test_law_3_no_unsupported_evidence_promotion():
    """Law 3: UNKNOWN or OPEN cannot transition to VERIFIED without a valid witness receipt."""
    parent = make_sample_contract("c-parent", disposition_map={"O-01": Disposition.UNKNOWN})

    # Target model asserts O-01 is VERIFIED, but provides no witness receipt ref
    child = make_sample_contract("c-child")
    child.obligations["O-01"] = ObligationRecord(
        obligation_id="O-01",
        requirement_ref="req://spec/O-01",
        predicate_spec={"rule": "rule_for_O-01"},
        disposition=Disposition.VERIFIED,  # Promoted!
        witness_receipt_ref=None,          # Missing witness!
    )

    ok, errs = TransitionValidator.validate_transition(parent, child)
    assert ok is False
    assert any("Law 3 violation" in e and "without witness receipt" in e for e in errs)

    # Laundering check: UNKNOWN -> OPEN is also forbidden
    child_launder = make_sample_contract("c-child")
    child_launder.obligations["O-01"] = ObligationRecord(
        obligation_id="O-01",
        requirement_ref="req://spec/O-01",
        predicate_spec={"rule": "rule_for_O-01"},
        disposition=Disposition.OPEN,  # Laundering UNKNOWN to OPEN!
    )
    ok_laund, errs_laund = TransitionValidator.validate_transition(parent, child_launder)
    assert ok_laund is False
    assert any("laundered from UNKNOWN to OPEN" in e for e in errs_laund)


def test_law_4_privacy_monotonicity():
    """Law 4: Confidentiality rank cannot be decreased across summaries or handoffs."""
    parent = make_sample_contract("c-parent", label=InformationLabel.CONFIDENTIAL)

    # Target attempts to demote to INTERNAL or PUBLIC
    target_demoted = make_sample_contract("c-target", label=InformationLabel.PUBLIC)
    ok, errs = TransitionValidator.validate_transition(parent, target_demoted)
    assert ok is False
    assert any("Law 4 violation: Confidentiality label demotion" in e for e in errs)

    # Promotion or equal is allowed
    target_elevated = make_sample_contract("c-target", label=InformationLabel.AIR_GAPPED)
    ok, errs = TransitionValidator.validate_transition(parent, target_elevated)
    assert ok is True


def test_law_5_assumption_expiration_on_drift():
    """Law 5: Evidence bound to an environment expires when assumptions drift."""
    env_v1 = make_sample_env(commit="git-v1.0")
    env_v2 = make_sample_env(commit="git-v2.0-drifted")

    parent = make_sample_contract(
        "c-parent",
        env=env_v1,
        disposition_map={"O-01": Disposition.VERIFIED},
    )

    # Apply drift invalidation
    demoted = AssumptionTracker.apply_drift_invalidation(parent, env_v2)
    assert demoted.obligations["O-01"].disposition == Disposition.STALE_RECHECK_REQUIRED
    assert demoted.environment_fingerprint.git_commit == "git-v2.0-drifted"


def test_law_6_unresolved_uncertainty_visibility():
    """Law 6: Task cannot declare FULLY_VERIFIED if any mandatory obligation is unresolved."""
    parent = make_sample_contract(
        "c-parent",
        disposition_map={"O-01": Disposition.VERIFIED, "O-02": Disposition.UNKNOWN},
    )

    witness_claiming_full = TransitionWitness(
        witness_id="wit-claim",
        source_contract_id=parent.contract_id,
        target_contract_id=parent.contract_id,
        source_hash=parent.canonical_hash(),
        target_hash=parent.canonical_hash(),
        transition_type="TASK_COMPLETION",
        issuer_agent_id="reporting_agent",
        reconciliation_details={"assert_full_completion": True},
    )

    ok, errs = TransitionValidator.validate_transition(parent, parent, witness=witness_claiming_full)
    assert ok is False
    assert any("Law 6 violation: Task claimed FULLY_VERIFIED while mandatory obligations remain unresolved" in e for e in errs)
