"""G1R-4 K2 Proof Transaction — minimum foundation tests."""

from __future__ import annotations

import pytest

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.categories.c07_execute.engine import form_execution_intent
from spe_runtime.contract import (
    ContractValidity,
    ProtectedIntentContract,
    confirm_requirement,
    propose_requirement,
)
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof import (
    DeltaAction,
    LeaseStatus,
    ProofCarryingPatch,
    ProofLedger,
    ProofObligation,
    ProofType,
    SemanticProofLease,
    SemanticSnapshot,
    Verdict,
    append_entry,
    commit_semantic_patch,
    empty_ledger,
    issue_semantic_lease,
    make_obligation,
    make_patch,
    make_snapshot,
    proof_type_compatible,
    verify_obligation,
)
from spe_runtime.proof.patch import SemanticDeltaStep
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import ConflictType, RequirementKind
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _base_contract() -> ProtectedIntentContract:
    return propose_requirement(
        ProtectedIntentContract(),
        semantic_key="budget",
        kind=RequirementKind.MUST,
        value=100,
        provenance=Provenance.USER_EXPLICIT,
    )


def _snapshot(contract: ProtectedIntentContract | None = None, version: int = 0) -> SemanticSnapshot:
    return make_snapshot(contract or _base_contract(), version=version)


def _invariant_obligation(subject: str) -> ProofObligation:
    return make_obligation(
        obligation_type="no_hard_conflict",
        subject=subject,
        required_proof_type=ProofType.DETERMINISTIC_INVARIANT,
        scope="requirement_graph",
    )


def _pass_verifier(proof_type: ProofType = ProofType.DETERMINISTIC_INVARIANT):
    def _v(obligation: ProofObligation, candidate):
        snap = candidate.get("snapshot_id") if isinstance(candidate, dict) else None
        patch = candidate.get("patch_id") if isinstance(candidate, dict) else None
        return {
            "proof_type": proof_type,
            "verdict": Verdict.PASS,
            "evidence": {"ok": True, "check": obligation.obligation_type},
            "subject_id": obligation.subject,
            "snapshot_id": snap or obligation.subject,
            "patch_id": patch,
            "verifier_id": "test_invariant_verifier",
        }

    return _v


def _commit_bundle(
    *,
    snap: SemanticSnapshot | None = None,
    proof_type: ProofType = ProofType.DETERMINISTIC_INVARIANT,
    delta: list | None = None,
    extra_receipt_mutate=None,
):
    snap = snap or _snapshot()
    obl = make_obligation(
        obligation_type="no_hard_conflict",
        subject=snap.snapshot_id,
        required_proof_type=proof_type,
        scope="requirement_graph",
    )
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT, DeltaAction.CONFIRM_REQUIREMENT),
    )
    if delta is None:
        delta = [
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="color",
                kind=RequirementKind.SHOULD.value,
                value="blue",
                provenance=Provenance.MODEL_PROPOSED.value,
            )
        ]
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=snap.version,
        lease_id=lease.lease_id,
        semantic_delta=delta,
        obligation_ids=(obl.obligation_id,),
    )
    candidate = {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id}
    receipt = verify_obligation(obl, candidate, _pass_verifier(proof_type))
    if extra_receipt_mutate:
        receipt = extra_receipt_mutate(receipt)
    ledger = empty_ledger()
    return snap, ledger, lease, patch, (receipt,), obl


# ---------------------------------------------------------------------------
# Deterministic identity
# ---------------------------------------------------------------------------


def test_snapshot_identity_deterministic():
    c = _base_contract()
    a = make_snapshot(c, version=0)
    b = make_snapshot(c, version=0)
    assert a.snapshot_id == b.snapshot_id
    assert a.snapshot_id.startswith("snap-")
    assert a.version == 0


def test_equivalent_snapshot_content_stable_identity():
    c1 = _base_contract()
    c2 = _base_contract()
    assert make_snapshot(c1).snapshot_id == make_snapshot(c2).snapshot_id


def test_obligation_identity_deterministic():
    a = make_obligation(
        obligation_type="schema",
        subject="snap-x",
        required_proof_type=ProofType.STRUCTURAL_CONFORMANCE,
        scope="envelope",
    )
    b = make_obligation(
        obligation_type="schema",
        subject="snap-x",
        required_proof_type=ProofType.STRUCTURAL_CONFORMANCE,
        scope="envelope",
    )
    assert a.obligation_id == b.obligation_id
    assert a.obligation_id.startswith("obl-")


def test_receipt_identity_deterministic():
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    candidate = {"snapshot_id": snap.snapshot_id, "patch_id": "patch-test"}
    r1 = verify_obligation(obl, candidate, _pass_verifier())
    r2 = verify_obligation(obl, candidate, _pass_verifier())
    assert r1.receipt_id == r2.receipt_id
    assert r1.receipt_id.startswith("rcpt-")


def test_patch_identity_deterministic():
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    delta = [
        {
            "action": DeltaAction.ADD_REQUIREMENT,
            "semantic_key": "x",
            "kind": "SHOULD",
            "value": 1,
            "provenance": "INFERRED",
        }
    ]
    p1 = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=delta,
        obligation_ids=(obl.obligation_id,),
    )
    p2 = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=delta,
        obligation_ids=(obl.obligation_id,),
        verified=True,  # ignored
    )
    assert p1.patch_id == p2.patch_id
    assert p1.patch_id.startswith("patch-")


def test_lease_binds_snapshot_version_obligations():
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    assert lease.base_snapshot_id == snap.snapshot_id
    assert lease.base_version == snap.version
    assert lease.allowed_obligation_ids == (obl.obligation_id,)
    assert lease.status is LeaseStatus.ACTIVE
    assert lease.lease_id.startswith("lease-")
    # deterministic
    lease2 = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    assert lease.lease_id == lease2.lease_id


# ---------------------------------------------------------------------------
# Valid commit
# ---------------------------------------------------------------------------


def test_valid_commit_returns_new_snapshot_ledger_consumes_lease():
    snap, ledger, lease, patch, receipts, _ = _commit_bundle()
    before_snap_id = snap.snapshot_id
    before_ledger = ledger
    result = commit_semantic_patch(snap, ledger, lease, patch, receipts)
    assert result.previous_snapshot_id == before_snap_id
    assert result.new_snapshot.version == snap.version + 1
    assert result.new_snapshot.parent_snapshot_id == snap.snapshot_id
    assert result.new_snapshot.snapshot_id != snap.snapshot_id
    assert result.proof_ledger is not before_ledger
    assert len(result.proof_ledger.entries) == 1
    assert result.consumed_lease.status is LeaseStatus.CONSUMED
    assert result.ledger_digest.startswith("led-")
    # originals unchanged
    assert snap.version == 0
    assert ledger.entries == ()
    assert lease.status is LeaseStatus.ACTIVE
    # K0/K1 still hold
    assert result.new_snapshot.protected_intent.protected_for("budget").value == 100


def test_version_increments_once_per_successful_commit():
    snap, ledger, lease, patch, receipts, _ = _commit_bundle()
    r1 = commit_semantic_patch(snap, ledger, lease, patch, receipts)
    assert r1.new_snapshot.version == 1

    obl2 = make_obligation(
        obligation_type="no_hard_conflict",
        subject=r1.new_snapshot.snapshot_id,
        required_proof_type=ProofType.DETERMINISTIC_INVARIANT,
        scope="requirement_graph",
    )
    lease2 = issue_semantic_lease(
        snapshot=r1.new_snapshot,
        obligations=(obl2,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch2 = make_patch(
        base_snapshot_id=r1.new_snapshot.snapshot_id,
        base_version=1,
        lease_id=lease2.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="tone",
                kind="PREFERENCE",
                value="formal",
                provenance="SPE_SUGGESTED",
            )
        ],
        obligation_ids=(obl2.obligation_id,),
    )
    cand = {"snapshot_id": r1.new_snapshot.snapshot_id, "patch_id": patch2.patch_id}
    rcpt = verify_obligation(obl2, cand, _pass_verifier())
    r2 = commit_semantic_patch(
        r1.new_snapshot, r1.proof_ledger, lease2, patch2, (rcpt,)
    )
    assert r2.new_snapshot.version == 2


# ---------------------------------------------------------------------------
# Staleness negatives
# ---------------------------------------------------------------------------


def test_patch_rejects_wrong_snapshot():
    snap, ledger, lease, patch, receipts, _ = _commit_bundle()
    other = make_snapshot(_base_contract(), version=0)
    # force different parent to get different id while same version content may collide —
    # use version trick: mutate contract
    other_c = propose_requirement(
        _base_contract(),
        semantic_key="other",
        kind=RequirementKind.SHOULD,
        value=1,
        provenance=Provenance.INFERRED,
    )
    other = make_snapshot(other_c, version=0)
    assert other.snapshot_id != snap.snapshot_id
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(other, ledger, lease, patch, receipts)
    assert ei.value.code is ErrorCode.K2_STALE_PATCH
    assert snap.version == 0
    assert ledger.entries == ()


def test_patch_rejects_stale_version():
    snap, ledger, lease, patch, receipts, _ = _commit_bundle()
    # fabricate a snapshot object with same contract but claimed higher version
    stale_current = make_snapshot(snap.protected_intent, version=1, parent=snap)
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(stale_current, ledger, lease, patch, receipts)
    assert ei.value.code is ErrorCode.K2_STALE_PATCH
    assert ledger.entries == ()


def test_receipt_rejects_wrong_patch():
    snap, ledger, lease, patch, receipts, obl = _commit_bundle()

    def mutate(r):
        from dataclasses import replace

        return replace(r, patch_id="patch-other-not-matching")

    # rebuild with mutated receipt (new identity content but wrong patch bind)
    snap, ledger, lease, patch, _, obl = _commit_bundle()
    cand = {"snapshot_id": snap.snapshot_id, "patch_id": "patch-wrong"}
    bad = verify_obligation(obl, cand, _pass_verifier())
    assert bad.patch_id != patch.patch_id
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (bad,))
    assert ei.value.code is ErrorCode.K2_VERIFICATION_FAILED
    assert ledger.entries == ()


def test_receipt_rejects_wrong_snapshot():
    snap, ledger, lease, patch, _, obl = _commit_bundle()
    cand = {"snapshot_id": "snap-not-current", "patch_id": patch.patch_id}
    bad = verify_obligation(obl, cand, _pass_verifier())
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (bad,))
    assert ei.value.code is ErrorCode.K2_VERIFICATION_FAILED
    assert ledger.entries == ()


def test_lease_rejects_wrong_snapshot_and_version():
    snap, ledger, _, patch, receipts, obl = _commit_bundle()
    other_c = propose_requirement(
        _base_contract(),
        semantic_key="zz",
        kind=RequirementKind.SHOULD,
        value=9,
        provenance=Provenance.INFERRED,
    )
    other = make_snapshot(other_c, version=0)
    bad_lease = issue_semantic_lease(
        snapshot=other,
        obligations=(
            make_obligation(
                obligation_type="no_hard_conflict",
                subject=other.snapshot_id,
                required_proof_type=ProofType.DETERMINISTIC_INVARIANT,
                scope="requirement_graph",
            ),
        ),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT, DeltaAction.CONFIRM_REQUIREMENT),
    )
    # patch still points at original snap; lease does not
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, bad_lease, patch, receipts)
    assert ei.value.code is ErrorCode.K2_INVALID_SEMANTIC_LEASE
    assert ledger.entries == ()


# ---------------------------------------------------------------------------
# Proof negatives
# ---------------------------------------------------------------------------


def test_missing_required_receipt_rejected():
    snap, ledger, lease, patch, _, _ = _commit_bundle()
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, ())
    assert ei.value.code is ErrorCode.K2_MISSING_PROOF_OBLIGATION
    assert ledger.entries == ()


def test_fail_receipt_rejected():
    snap = _snapshot()
    obl = make_obligation(
        obligation_type="no_hard_conflict",
        subject=snap.snapshot_id,
        required_proof_type=ProofType.DETERMINISTIC_INVARIANT,
        scope="requirement_graph",
    )
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="a",
                kind="SHOULD",
                value=1,
                provenance="INFERRED",
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )

    def fail_v(obligation, candidate):
        return {
            "proof_type": ProofType.DETERMINISTIC_INVARIANT,
            "verdict": Verdict.FAIL,
            "evidence": {"ok": False},
            "subject_id": obligation.subject,
            "snapshot_id": snap.snapshot_id,
            "patch_id": patch.patch_id,
            "verifier_id": "fail_v",
        }

    receipt = verify_obligation(obl, {}, fail_v)
    ledger = empty_ledger()
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (receipt,))
    assert ei.value.code is ErrorCode.K2_VERIFICATION_FAILED
    assert ledger.entries == ()


def test_unknown_receipt_rejected():
    snap = _snapshot()
    obl = make_obligation(
        obligation_type="no_hard_conflict",
        subject=snap.snapshot_id,
        required_proof_type=ProofType.DETERMINISTIC_INVARIANT,
        scope="requirement_graph",
    )
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="a",
                kind="SHOULD",
                value=1,
                provenance="INFERRED",
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )

    def unk_v(obligation, candidate):
        return {
            "proof_type": ProofType.DETERMINISTIC_INVARIANT,
            "verdict": Verdict.UNKNOWN,
            "evidence": {"maybe": True},
            "subject_id": obligation.subject,
            "snapshot_id": snap.snapshot_id,
            "patch_id": patch.patch_id,
            "verifier_id": "unk_v",
        }

    receipt = verify_obligation(obl, {}, unk_v)
    ledger = empty_ledger()
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (receipt,))
    assert ei.value.code is ErrorCode.K2_VERIFICATION_FAILED


def test_wrong_obligation_receipt_rejected():
    snap, ledger, lease, patch, _, _ = _commit_bundle()
    other = make_obligation(
        obligation_type="other",
        subject=snap.snapshot_id,
        required_proof_type=ProofType.DETERMINISTIC_INVARIANT,
        scope="requirement_graph",
    )
    cand = {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id}
    wrong = verify_obligation(other, cand, _pass_verifier())
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (wrong,))
    assert ei.value.code is ErrorCode.K2_MISSING_PROOF_OBLIGATION


def test_wrong_proof_type_rejected():
    snap = _snapshot()
    obl = make_obligation(
        obligation_type="world",
        subject=snap.snapshot_id,
        required_proof_type=ProofType.EXTERNAL_WORLD_OBSERVATION,
        scope="external",
    )
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="a",
                kind="SHOULD",
                value=1,
                provenance="INFERRED",
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )
    # Verifier provides MODEL_JUDGMENT instead
    receipt = verify_obligation(
        obl,
        {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id},
        _pass_verifier(ProofType.MODEL_JUDGMENT),
    )
    ledger = empty_ledger()
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (receipt,))
    assert ei.value.code is ErrorCode.K2_PROOF_TYPE_MISMATCH


def test_model_judgment_cannot_satisfy_external_world_observation():
    assert (
        proof_type_compatible(
            ProofType.EXTERNAL_WORLD_OBSERVATION, ProofType.MODEL_JUDGMENT
        )
        is False
    )
    snap = _snapshot()
    obl = make_obligation(
        obligation_type="observe",
        subject=snap.snapshot_id,
        required_proof_type=ProofType.EXTERNAL_WORLD_OBSERVATION,
        scope="world",
    )
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="a",
                kind="SHOULD",
                value=1,
                provenance="INFERRED",
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )
    receipt = verify_obligation(
        obl,
        {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id},
        _pass_verifier(ProofType.MODEL_JUDGMENT),
    )
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, empty_ledger(), lease, patch, (receipt,))
    assert ei.value.code is ErrorCode.K2_PROOF_TYPE_MISMATCH


def test_structural_conformance_pass_does_not_create_fact_verified():
    snap = _snapshot()
    obl = make_obligation(
        obligation_type="schema",
        subject=snap.snapshot_id,
        required_proof_type=ProofType.STRUCTURAL_CONFORMANCE,
        scope="schema",
    )
    receipt = verify_obligation(
        obl,
        {"snapshot_id": snap.snapshot_id, "patch_id": None},
        _pass_verifier(ProofType.STRUCTURAL_CONFORMANCE),
    )
    assert receipt.verdict is Verdict.PASS
    assert receipt.proof_type is ProofType.STRUCTURAL_CONFORMANCE
    assert not hasattr(receipt, "FACT_VERIFIED")
    payload = receipt.to_canonical_payload()
    assert "FACT_VERIFIED" not in payload
    assert "fact_verified" not in payload


def test_human_judgment_is_not_observation():
    assert (
        proof_type_compatible(
            ProofType.EXTERNAL_WORLD_OBSERVATION, ProofType.HUMAN_JUDGMENT
        )
        is False
    )


def test_arbitrary_dict_receipt_rejected():
    snap, ledger, lease, patch, _, _ = _commit_bundle()
    fake = {
        "receipt_id": "rcpt-fake",
        "obligation_id": patch.obligation_ids[0],
        "verdict": "PASS",
        "proof_type": "DETERMINISTIC_INVARIANT",
    }
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (fake,))  # type: ignore[arg-type]
    assert ei.value.code is ErrorCode.K2_VERIFICATION_FAILED
    assert ledger.entries == ()


def test_self_declared_verified_true_ignored():
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="a",
                kind="SHOULD",
                value=1,
                provenance="INFERRED",
            )
        ],
        obligation_ids=(obl.obligation_id,),
        verified=True,
    )
    assert not hasattr(patch, "verified") or getattr(patch, "verified", None) is not True
    # Without receipts, still rejected
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, empty_ledger(), lease, patch, ())
    assert ei.value.code is ErrorCode.K2_MISSING_PROOF_OBLIGATION


def test_unrelated_evidence_wrong_subject_rejected():
    snap, ledger, lease, patch, _, obl = _commit_bundle()

    def bad_subject(obligation, candidate):
        return {
            "proof_type": ProofType.DETERMINISTIC_INVARIANT,
            "verdict": Verdict.PASS,
            "evidence": {"unrelated": True},
            "subject_id": "totally-other-subject",
            "snapshot_id": snap.snapshot_id,
            "patch_id": patch.patch_id,
            "verifier_id": "bad",
        }

    bad = verify_obligation(obl, {}, bad_subject)
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (bad,))
    assert ei.value.code is ErrorCode.K2_VERIFICATION_FAILED


# ---------------------------------------------------------------------------
# Atomicity
# ---------------------------------------------------------------------------


def test_atomicity_k0_violation_leaves_state_unchanged():
    """INFERRED overwrite attempt via patch must fail; snapshot+ledger unchanged."""
    snap = _snapshot()  # budget=100 USER_EXPLICIT
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    # Patch proposes conflicting INFERRED value for same key — creates conflict,
    # but does not overwrite. Use CONFIRM on nonexistent to force hard failure,
    # or propose USER_CONFIRMED which raises.
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="budget",
                kind="MUST",
                value=999,
                provenance="USER_CONFIRMED",  # propose cannot mint
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )
    cand = {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id}
    receipt = verify_obligation(obl, cand, _pass_verifier())
    ledger = empty_ledger()
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, lease, patch, (receipt,))
    assert ei.value.code is ErrorCode.K0_INVALID_PROVENANCE_TRANSITION
    assert snap.version == 0
    assert ledger.entries == ()
    assert lease.status is LeaseStatus.ACTIVE


def test_atomicity_lease_failure_leaves_state_unchanged():
    snap, ledger, lease, patch, receipts, _ = _commit_bundle()
    from dataclasses import replace

    consumed = replace(lease, status=LeaseStatus.CONSUMED)
    with pytest.raises(SpeTypedError) as ei:
        commit_semantic_patch(snap, ledger, consumed, patch, receipts)
    assert ei.value.code is ErrorCode.K2_INVALID_SEMANTIC_LEASE
    assert ledger.entries == ()
    assert snap.version == 0


def test_atomicity_inferred_conflict_preserved_after_valid_commit():
    """Valid patch adding inferred conflict peer leaves contract CONFLICTED."""
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.ADD_REQUIREMENT,
                semantic_key="budget",
                kind="MUST",
                value=200,
                provenance="INFERRED",
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )
    cand = {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id}
    receipt = verify_obligation(obl, cand, _pass_verifier())
    result = commit_semantic_patch(snap, empty_ledger(), lease, patch, (receipt,))
    c = result.new_snapshot.protected_intent
    assert c.protected_for("budget").value == 100
    assert any(x.conflict_type is ConflictType.INFERENCE_CONFLICT for x in c.conflicts)
    assert c.validity is ContractValidity.CONFLICTED


# ---------------------------------------------------------------------------
# Authority / confirmation separation
# ---------------------------------------------------------------------------


def test_semantic_lease_is_not_authority_grant():
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.ADD_REQUIREMENT,),
    )
    assert not isinstance(lease, AuthorityGrant)
    assert isinstance(lease, SemanticProofLease)


def test_receipt_and_commit_are_not_execution_authority():
    snap, ledger, lease, patch, receipts, _ = _commit_bundle()
    result = commit_semantic_patch(snap, ledger, lease, patch, receipts)
    assert not isinstance(receipts[0], AuthorityGrant)
    assert not isinstance(result, AuthorityGrant)
    assert not isinstance(patch, AuthorityGrant)
    assert result.consumed_lease.status is LeaseStatus.CONSUMED

    # C07 without grant remains BLOCKED — PASS/commit ≠ execution auth
    env = CrossCategoryEnvelope(
        envelope_id="env-g1r4",
        goal_identity="goal",
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
    )
    blocked = form_execution_intent(
        env,
        grant=None,
        action_type="WRITE_LOCAL_TEMP_FILE",
        canonical_target="/tmp/x",
        canonical_arguments={"path": "/tmp/x", "content": "hi"},
        expected_effect="write",
    )
    assert blocked.status == "BLOCKED"


def test_confirmation_boundary_via_patch():
    """propose path in delta cannot mint USER_CONFIRMED; confirm path can."""
    c = propose_requirement(
        ProtectedIntentContract(),
        semantic_key="dest",
        kind=RequirementKind.MUST,
        value="NYC",
        provenance=Provenance.USER_EXPLICIT,
    )
    rid = next(iter(c.graph.nodes))
    snap = make_snapshot(c, version=0)
    obl = _invariant_obligation(snap.snapshot_id)
    lease = issue_semantic_lease(
        snapshot=snap,
        obligations=(obl,),
        allowed_scope=(DeltaAction.CONFIRM_REQUIREMENT,),
    )
    patch = make_patch(
        base_snapshot_id=snap.snapshot_id,
        base_version=0,
        lease_id=lease.lease_id,
        semantic_delta=[
            SemanticDeltaStep(
                action=DeltaAction.CONFIRM_REQUIREMENT,
                requirement_id=rid,
            )
        ],
        obligation_ids=(obl.obligation_id,),
    )
    cand = {"snapshot_id": snap.snapshot_id, "patch_id": patch.patch_id}
    receipt = verify_obligation(obl, cand, _pass_verifier())
    result = commit_semantic_patch(snap, empty_ledger(), lease, patch, (receipt,))
    assert result.new_snapshot.protected_intent.get(rid).provenance is Provenance.USER_CONFIRMED


def test_ledger_append_idempotent_rejects_mutation():
    snap = _snapshot()
    obl = _invariant_obligation(snap.snapshot_id)
    r = verify_obligation(
        obl,
        {"snapshot_id": snap.snapshot_id, "patch_id": "p1"},
        _pass_verifier(),
    )
    led = empty_ledger()
    led2 = append_entry(led, r)
    led3 = append_entry(led2, r)
    assert led3.entries == led2.entries
    from dataclasses import replace

    mutated = replace(r, details={"tampered": True})
    # same receipt_id different content
    assert mutated.receipt_id == r.receipt_id
    with pytest.raises(SpeTypedError):
        append_entry(led2, mutated)


def test_error_codes_wire_strings():
    assert ErrorCode.K2_STALE_PATCH.value == "K2_STALE_PATCH"
    assert ErrorCode.K2_INVALID_SEMANTIC_LEASE.value == "K2_INVALID_SEMANTIC_LEASE"
    assert ErrorCode.K2_MISSING_PROOF_OBLIGATION.value == "K2_MISSING_PROOF_OBLIGATION"
    assert ErrorCode.K2_PROOF_TYPE_MISMATCH.value == "K2_PROOF_TYPE_MISMATCH"
    assert ErrorCode.K2_VERIFICATION_FAILED.value == "K2_VERIFICATION_FAILED"
    assert ErrorCode.K2_ATOMIC_COMMIT_REJECTED.value == "K2_ATOMIC_COMMIT_REJECTED"


def test_no_public_mint_pass_receipt():
    import spe_runtime.proof as proof_pkg
    import spe_runtime.proof.receipt as receipt_mod

    assert not hasattr(proof_pkg, "mint_pass_receipt")
    assert not hasattr(receipt_mod, "mint_pass_receipt")
