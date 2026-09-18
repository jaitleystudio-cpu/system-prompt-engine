"""G1R-9 K7 ClaimQualification + QualificationEvidence — updated for G1R-9R hardening."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.qualification import (
    STAGE_ORDER,
    ClaimCandidate,
    ClaimQualification,
    ClaimScope,
    ClaimStage,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceClass,
    QualificationEvidence,
    QualificationVerdict,
    UNSUPPORTED_MARKETING_CLAIM_KEYS,
    qualify_claim,
    record_qualification_evidence,
    scope_covers,
)

ROOT = Path(__file__).resolve().parents[2]

CK = "RING0_DEMO"
SUB = "subject-demo-1"


def _scope(
    *,
    component: str = "ring0-demo",
    platform: str = "python",
    runtime: str = "cpython",
    environment: str = "local",
    revision: str | None = "rev-a",
) -> ClaimScope:
    return ClaimScope(
        component=component,
        platform=platform,
        runtime=runtime,
        environment=environment,
        revision=revision,
    )


def _ev(
    kind: EvidenceKind,
    *,
    subject_id: str = SUB,
    claim_key: str = CK,
    scope: ClaimScope | None = None,
    verdict: EvidenceVerdict = EvidenceVerdict.PASS,
    independence: IndependenceClass = IndependenceClass.INTERNAL,
    producer_class: str = "unit_test",
    artifact_ref: str | None = None,
    evidence_digest: str | None = None,
    limitations: tuple[str, ...] = (),
) -> QualificationEvidence:
    return record_qualification_evidence(
        evidence_kind=kind,
        subject_id=subject_id,
        claim_key=claim_key,
        scope=scope or _scope(),
        verdict=verdict,
        independence=independence,
        producer_class=producer_class,
        artifact_ref=artifact_ref,
        evidence_digest=evidence_digest,
        limitations=limitations,
    )


def _review(n: int, *, scope: ClaimScope | None = None, claim_key: str = CK) -> QualificationEvidence:
    return _ev(
        EvidenceKind.EXTERNAL_REVIEW,
        scope=scope,
        claim_key=claim_key,
        independence=IndependenceClass.EXTERNAL,
        producer_class=f"external_reviewer_{n}",
        artifact_ref=f"review:{n}",
        evidence_digest=f"{n:064x}",
    )


def _cand(
    stage: ClaimStage,
    *,
    claim_key: str = CK,
    subject_id: str = SUB,
    scope: ClaimScope | None = None,
    claim_code: str | None = None,
    policy_id: str = "default_ring0",
) -> ClaimCandidate:
    return ClaimCandidate(
        claim_key=claim_key,
        subject_id=subject_id,
        requested_stage=stage,
        scope=scope or _scope(),
        claim_code=claim_code or claim_key,
        policy_id=policy_id,
    )


def _ladder_up_to(stage: ClaimStage, *, policy_id: str = "default_ring0") -> list[QualificationEvidence]:
    """Minimum cumulative evidence to earn `stage` under the given policy."""
    s = _scope()
    out: list[QualificationEvidence] = []
    for st in STAGE_ORDER:
        if STAGE_ORDER.index(st) > STAGE_ORDER.index(stage):
            break
        if st is ClaimStage.SPECIFIED:
            out.append(_ev(EvidenceKind.SPECIFICATION, scope=s))
        elif st is ClaimStage.IMPLEMENTED:
            out.append(_ev(EvidenceKind.IMPLEMENTATION_BINDING, scope=s))
        elif st is ClaimStage.TESTED:
            out.append(_ev(EvidenceKind.TEST_RESULT, scope=s))
        elif st is ClaimStage.VERIFIED_WITHIN_SCOPE:
            out.append(_review(1, scope=s))
        elif st is ClaimStage.QUALIFIED:
            # Distinct second review (consume semantics).
            out.append(_review(2, scope=s))
        elif st is ClaimStage.VALIDATED_WITH_USERS:
            out.append(
                _ev(
                    EvidenceKind.USER_VALIDATION,
                    scope=s,
                    independence=IndependenceClass.EXTERNAL,
                    producer_class="user_study:lab-a",
                    artifact_ref="study:users-1",
                    evidence_digest="u" * 64,
                )
            )
        elif st is ClaimStage.PRODUCTION_OBSERVED:
            prod = _scope(environment="production")
            # Rebuild prior with production scope — skip; use dedicated helpers in those tests.
            out.append(
                _ev(
                    EvidenceKind.PRODUCTION_OBSERVATION,
                    scope=prod,
                    independence=IndependenceClass.EXTERNAL,
                    producer_class="production_observer:ops",
                    artifact_ref="obs:prod-1",
                    evidence_digest="p" * 64,
                )
            )
        elif st is ClaimStage.INDEPENDENTLY_REPLICATED:
            prod = _scope(environment="production")
            out.append(
                _ev(
                    EvidenceKind.INDEPENDENT_REPLICATION,
                    scope=prod,
                    independence=IndependenceClass.INDEPENDENT,
                    producer_class="independent_lab:lab-x",
                    artifact_ref="review:repl-1",
                    evidence_digest="r" * 64,
                )
            )
    return out


def stage_rank_safe(s: ClaimStage | None) -> int:
    if s is None:
        return -1
    return STAGE_ORDER.index(s)


# ---------------------------------------------------------------------------
# Identity / determinism
# ---------------------------------------------------------------------------


def test_qualification_evidence_identity_deterministic():
    a = _ev(EvidenceKind.TEST_RESULT)
    b = _ev(EvidenceKind.TEST_RESULT)
    assert a.evidence_id == b.evidence_id
    assert a.evidence_id.startswith("qe-")


def test_qualification_identity_deterministic():
    ev = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.TESTED), ev)
    q2 = qualify_claim(_cand(ClaimStage.TESTED), ev)
    assert q1.qualification_id == q2.qualification_id
    assert q1.earned_stage is ClaimStage.TESTED


def test_same_evidence_reordered_same_qualification():
    ev = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.TESTED), ev)
    q2 = qualify_claim(_cand(ClaimStage.TESTED), list(reversed(ev)))
    assert q1.qualification_id == q2.qualification_id


def test_duplicate_evidence_does_not_boost_stage():
    base = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), base)
    copies = base + [base[0]] * 99
    q2 = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), copies)
    assert q1.earned_stage == q2.earned_stage == ClaimStage.TESTED
    assert q1.qualification_id == q2.qualification_id


def test_cross_process_qualification_stable():
    code = r"""
from spe_runtime.qualification import (
    ClaimCandidate, ClaimScope, ClaimStage, EvidenceKind, EvidenceVerdict,
    IndependenceClass, qualify_claim, record_qualification_evidence,
)
s = ClaimScope(component='ring0-demo', platform='python', runtime='cpython', environment='local', revision='rev-a')
ev = [
    record_qualification_evidence(evidence_kind=EvidenceKind.SPECIFICATION, subject_id='subject-demo-1', claim_key='RING0_DEMO', scope=s, verdict=EvidenceVerdict.PASS, independence=IndependenceClass.INTERNAL, producer_class='unit_test'),
    record_qualification_evidence(evidence_kind=EvidenceKind.IMPLEMENTATION_BINDING, subject_id='subject-demo-1', claim_key='RING0_DEMO', scope=s, verdict=EvidenceVerdict.PASS, independence=IndependenceClass.INTERNAL, producer_class='unit_test'),
    record_qualification_evidence(evidence_kind=EvidenceKind.TEST_RESULT, subject_id='subject-demo-1', claim_key='RING0_DEMO', scope=s, verdict=EvidenceVerdict.PASS, independence=IndependenceClass.INTERNAL, producer_class='unit_test'),
]
c = ClaimCandidate(claim_key='RING0_DEMO', subject_id='subject-demo-1', requested_stage=ClaimStage.TESTED, scope=s, claim_code='RING0_DEMO')
q = qualify_claim(c, ev)
print(q.qualification_id)
print(q.earned_stage.value)
"""
    a = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    b = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    assert a == b


# ---------------------------------------------------------------------------
# Stage ladder
# ---------------------------------------------------------------------------


def test_specification_evidence_can_support_specified():
    q = qualify_claim(_cand(ClaimStage.SPECIFIED), [_ev(EvidenceKind.SPECIFICATION)])
    assert q.earned_stage is ClaimStage.SPECIFIED


def test_implementation_evidence_required_for_implemented():
    q = qualify_claim(_cand(ClaimStage.IMPLEMENTED), [_ev(EvidenceKind.SPECIFICATION)])
    assert q.earned_stage is ClaimStage.SPECIFIED
    assert "NEED_IMPLEMENTATION_BINDING" in q.unmet_requirements


def test_tests_required_for_tested():
    q = qualify_claim(_cand(ClaimStage.TESTED), _ladder_up_to(ClaimStage.IMPLEMENTED))
    assert q.earned_stage is ClaimStage.IMPLEMENTED
    assert "NEED_TEST_RESULT" in q.unmet_requirements


def test_verification_required_for_verified_within_scope():
    q = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), _ladder_up_to(ClaimStage.TESTED))
    assert q.earned_stage is ClaimStage.TESTED
    assert "NEED_SCOPED_VERIFICATION" in q.unmet_requirements


def test_default_ring0_caps_at_verified():
    """Generic default_ring0 cannot award QUALIFIED (domain policy required)."""
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED),
        _ladder_up_to(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"),
    )
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert any("POLICY_MAX_STAGE" in u for u in q.unmet_requirements)


def test_subsystem_policy_qualified_needs_second_review():
    one = _ladder_up_to(ClaimStage.VERIFIED_WITHIN_SCOPE)
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"),
        one,
    )
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert "NEED_QUALIFICATION_REVIEW" in q.unmet_requirements
    two = one + [_review(2)]
    q2 = qualify_claim(
        _cand(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"),
        two,
    )
    assert q2.earned_stage is ClaimStage.QUALIFIED


def test_user_validation_required_for_validated_with_users():
    # Under subsystem policy, QUALIFIED is max — VALIDATED needs higher max.
    # default/subsystem max < VALIDATED → POLICY_MAX_STAGE
    q = qualify_claim(
        _cand(ClaimStage.VALIDATED_WITH_USERS, policy_id="subsystem_pass_external"),
        _ladder_up_to(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"),
    )
    assert q.earned_stage is ClaimStage.QUALIFIED
    assert any("POLICY_MAX_STAGE" in u or "NEED_USER_VALIDATION" in u for u in q.unmet_requirements)


def test_production_observation_required_structural():
    with pytest.raises(SpeTypedError) as ei:
        _ev(
            EvidenceKind.PRODUCTION_OBSERVATION,
            scope=_scope(environment="production"),
            independence=IndependenceClass.EXTERNAL,
            producer_class="ops",
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE


def test_independent_replication_rejects_self_asserted():
    with pytest.raises(SpeTypedError) as ei:
        _ev(
            EvidenceKind.INDEPENDENT_REPLICATION,
            independence=IndependenceClass.INDEPENDENT,
            producer_class="i_say_so",
            artifact_ref="review:x",
            evidence_digest="a" * 64,
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE


def test_claim_ladder_incremental_no_skip():
    for stage in (
        ClaimStage.SPECIFIED,
        ClaimStage.IMPLEMENTED,
        ClaimStage.TESTED,
        ClaimStage.VERIFIED_WITHIN_SCOPE,
    ):
        q = qualify_claim(_cand(stage), _ladder_up_to(stage))
        assert q.earned_stage is stage, (stage, q.earned_stage, q.unmet_requirements)
    for stage, nxt, need in (
        (ClaimStage.SPECIFIED, ClaimStage.IMPLEMENTED, "NEED_IMPLEMENTATION_BINDING"),
        (ClaimStage.IMPLEMENTED, ClaimStage.TESTED, "NEED_TEST_RESULT"),
        (ClaimStage.TESTED, ClaimStage.VERIFIED_WITHIN_SCOPE, "NEED_SCOPED_VERIFICATION"),
    ):
        q2 = qualify_claim(_cand(nxt), _ladder_up_to(stage))
        assert q2.earned_stage is stage
        assert need in q2.unmet_requirements


# ---------------------------------------------------------------------------
# Anti-laundering
# ---------------------------------------------------------------------------


def test_local_unit_test_cannot_earn_production_observed():
    local = _ladder_up_to(ClaimStage.TESTED)
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(
            _cand(ClaimStage.PRODUCTION_OBSERVED, scope=_scope(environment="production")),
            local,
        )
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_internal_review_cannot_earn_independently_replicated():
    ev = _ladder_up_to(ClaimStage.TESTED) + [
        _ev(
            EvidenceKind.EXTERNAL_REVIEW,
            independence=IndependenceClass.INTERNAL,
            producer_class="same_team_review",
        )
    ]
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), ev)
    assert q.earned_stage is ClaimStage.TESTED


def test_k2_pass_receipt_alone_cannot_earn_qualified():
    receipt = _ev(
        EvidenceKind.VERIFICATION_RECEIPT,
        independence=IndependenceClass.INTERNAL,
        artifact_ref="rcpt-" + "c" * 64,
        producer_class="k2_verify",
    )
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), [receipt])
    assert q.earned_stage is None or stage_rank_safe(q.earned_stage) < stage_rank_safe(
        ClaimStage.QUALIFIED
    )
    # Receipt cannot claim EXTERNAL; with TESTED ladder stays at TESTED (no EXTERNAL_REVIEW).
    ev = _ladder_up_to(ClaimStage.TESTED) + [receipt]
    q2 = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), ev)
    assert q2.earned_stage is ClaimStage.TESTED


def test_k2_receipt_cannot_declare_external():
    with pytest.raises(SpeTypedError) as ei:
        _ev(
            EvidenceKind.VERIFICATION_RECEIPT,
            independence=IndependenceClass.EXTERNAL,
            artifact_ref="rcpt-" + "c" * 64,
            producer_class="k2_verify",
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE


def test_k6_integrity_alone_cannot_earn_qualified():
    spe_ref = "spe-" + "d" * 64
    ev = [
        _ev(EvidenceKind.SPECIFICATION),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING),
        _ev(EvidenceKind.TEST_RESULT, artifact_ref=spe_ref),
    ]
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), ev)
    assert q.earned_stage is ClaimStage.TESTED


def test_user_statement_cannot_self_qualify_production():
    q = qualify_claim(
        _cand(
            ClaimStage.PRODUCTION_OBSERVED,
            claim_key="PRODUCTION_READY",
            claim_code="PRODUCTION_READY",
        ),
        _ladder_up_to(ClaimStage.TESTED),
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_model_statement_cannot_earn_verification():
    q = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), [])
    assert q.earned_stage is None


def test_prompt_text_cannot_self_qualify():
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), [])
    assert q.earned_stage is None


def test_spe_import_metadata_cannot_self_qualify():
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED),
        [_ev(EvidenceKind.IMPLEMENTATION_BINDING, artifact_ref="spe-" + "e" * 64)],
    )
    assert stage_rank_safe(q.earned_stage) < stage_rank_safe(ClaimStage.QUALIFIED)


def test_benchmark_cannot_earn_world_1():
    q = qualify_claim(
        _cand(ClaimStage.INDEPENDENTLY_REPLICATED, claim_key="WORLD_1", claim_code="WORLD_1"),
        [
            _ev(
                EvidenceKind.BENCHMARK_RESULT,
                claim_key="WORLD_1",
                independence=IndependenceClass.INTERNAL,
            )
        ],
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_formal_claim_without_model_check_unqualifiable():
    q = qualify_claim(
        _cand(
            ClaimStage.VERIFIED_WITHIN_SCOPE,
            claim_key="FORMALLY_VERIFIED",
            claim_code="FORMALLY_VERIFIED",
        ),
        [_ev(EvidenceKind.SPECIFICATION, claim_key="FORMALLY_VERIFIED")],
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_security_unhackable_unqualifiable():
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED, claim_key="SECURE_UNHACKABLE", claim_code="SECURE_UNHACKABLE"),
        _ladder_up_to(ClaimStage.TESTED),
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


# ---------------------------------------------------------------------------
# Scope / subject / revision
# ---------------------------------------------------------------------------


def test_local_python_cannot_cover_all_platform_claim():
    local = _ev(EvidenceKind.TEST_RESULT, scope=_scope(platform="python"))
    claim = _cand(ClaimStage.TESTED, scope=_scope(platform="all_platforms"))
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(claim, [local])
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_node_wasm_cannot_cover_browser_wasm():
    ev = _ev(EvidenceKind.TEST_RESULT, scope=_scope(runtime="node-wasm"))
    claim = _cand(ClaimStage.TESTED, scope=_scope(runtime="browser-wasm"))
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(claim, [ev])
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_k6_evidence_cannot_cover_full_ring0():
    k6 = _scope(component="k6-spe-artifact")
    ring0 = _scope(component="full-ring0")
    ev = [
        _ev(EvidenceKind.SPECIFICATION, scope=k6, claim_key="K6_PORTABLE"),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, scope=k6, claim_key="K6_PORTABLE"),
        _ev(EvidenceKind.TEST_RESULT, scope=k6, claim_key="K6_PORTABLE"),
        _review(1, scope=k6, claim_key="K6_PORTABLE"),
    ]
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(
            _cand(ClaimStage.QUALIFIED, claim_key="FULL_RING0_IMPLEMENTATION", scope=ring0),
            ev,
        )
    assert ei.value.code in (ErrorCode.K7_SCOPE_MISMATCH, ErrorCode.K7_SUBJECT_MISMATCH)


def test_old_revision_evidence_not_reuse_for_new_revision():
    old = _ev(EvidenceKind.TEST_RESULT, scope=_scope(revision="rev-a"))
    claim = _cand(ClaimStage.TESTED, scope=_scope(revision="rev-b"))
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(claim, [old])
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_revision_none_does_not_wildcard_over_bound_evidence():
    """UNBOUND != ALL (G1R9R-F05)."""
    bound = _ev(EvidenceKind.SPECIFICATION, scope=_scope(revision="SHA_A"))
    claim = _cand(ClaimStage.SPECIFIED, scope=_scope(revision=None))
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(claim, [bound])
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_artifact_a_evidence_not_usable_for_artifact_b():
    ev = _ev(EvidenceKind.TEST_RESULT, subject_id="artifact-A")
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(_cand(ClaimStage.TESTED, subject_id="artifact-B"), [ev])
    assert ei.value.code is ErrorCode.K7_SUBJECT_MISMATCH


def test_scope_covers_exact_match():
    a = _scope()
    assert scope_covers(a, a) is True
    assert scope_covers(_scope(platform="python"), _scope(platform="all")) is False
    assert scope_covers(_scope(revision="SHA_A"), _scope(revision=None)) is False


# ---------------------------------------------------------------------------
# Independence / contradiction
# ---------------------------------------------------------------------------


def test_same_reviewer_duplicated_not_independent_replication():
    base = _ladder_up_to(ClaimStage.TESTED)
    rev = _review(1)
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), base + [rev, rev])
    assert q.earned_stage is not ClaimStage.INDEPENDENTLY_REPLICATED


def test_external_review_not_automatically_independent_replication():
    q = qualify_claim(
        _cand(ClaimStage.INDEPENDENTLY_REPLICATED, policy_id="subsystem_pass_external"),
        _ladder_up_to(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"),
    )
    assert stage_rank_safe(q.earned_stage) <= stage_rank_safe(ClaimStage.QUALIFIED)


def test_independent_replication_requires_independence_metadata():
    with pytest.raises(SpeTypedError) as ei:
        record_qualification_evidence(
            evidence_kind=EvidenceKind.INDEPENDENT_REPLICATION,
            subject_id=SUB,
            claim_key=CK,
            scope=_scope(),
            verdict=EvidenceVerdict.PASS,
            independence=IndependenceClass.EXTERNAL,
            producer_class="lab",
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE


def test_mandatory_fail_blocks_stage():
    ev = _ladder_up_to(ClaimStage.IMPLEMENTED) + [
        _ev(EvidenceKind.TEST_RESULT, verdict=EvidenceVerdict.FAIL),
    ]
    q = qualify_claim(_cand(ClaimStage.TESTED), ev)
    assert q.earned_stage is ClaimStage.IMPLEMENTED
    assert any(u.startswith("BLOCKED_BY_FAIL:TEST_RESULT") for u in q.unmet_requirements)


def test_unknown_evidence_does_not_satisfy_pass():
    ev = _ladder_up_to(ClaimStage.IMPLEMENTED) + [
        _ev(EvidenceKind.TEST_RESULT, verdict=EvidenceVerdict.UNKNOWN),
    ]
    q = qualify_claim(_cand(ClaimStage.TESTED), ev)
    assert q.earned_stage is ClaimStage.IMPLEMENTED
    assert "NEED_TEST_RESULT" in q.unmet_requirements


def test_irrelevant_evidence_does_not_strengthen():
    base = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), base)
    noise = [
        _ev(
            EvidenceKind.TEST_RESULT,
            claim_key="OTHER_CLAIM",
            subject_id="other-subject",
            producer_class=f"noise-{i}",
            evidence_digest=f"{i:064x}",
        )
        for i in range(20)
    ]
    q2 = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), base + noise)
    assert q1.earned_stage == q2.earned_stage == ClaimStage.TESTED


def test_limitations_preserved_on_earn():
    ev = _ladder_up_to(ClaimStage.VERIFIED_WITHIN_SCOPE)
    # add limitation on review
    s = _scope()
    ev = [
        _ev(EvidenceKind.SPECIFICATION, scope=s),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, scope=s),
        _ev(EvidenceKind.TEST_RESULT, scope=s),
        _ev(
            EvidenceKind.EXTERNAL_REVIEW,
            scope=s,
            independence=IndependenceClass.EXTERNAL,
            producer_class="external_reviewer_1",
            artifact_ref="review:1",
            evidence_digest="1" * 64,
            limitations=("scoped_subsystem_only",),
        ),
    ]
    q = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), ev)
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert "scoped_subsystem_only" in q.limitations


def test_earned_stage_never_echoes_higher_request():
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), _ladder_up_to(ClaimStage.TESTED))
    assert q.requested_stage is ClaimStage.INDEPENDENTLY_REPLICATED
    assert q.earned_stage is ClaimStage.TESTED
    assert q.verdict is QualificationVerdict.PARTIALLY_EARNED


# ---------------------------------------------------------------------------
# Current project vectors
# ---------------------------------------------------------------------------


def test_current_project_production_not_qualified():
    q = qualify_claim(
        _cand(
            ClaimStage.PRODUCTION_OBSERVED,
            claim_key="PRODUCTION_READY",
            claim_code="PRODUCTION_READY",
            scope=_scope(component="spe-ring0", environment="production"),
        ),
        _ladder_up_to(ClaimStage.TESTED),
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_current_project_world_1_not_proven():
    q = qualify_claim(
        _cand(ClaimStage.INDEPENDENTLY_REPLICATED, claim_key="WORLD_1", claim_code="WORLD_1"),
        [],
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g1r8_portable_binding_not_broadened_to_full_replay():
    q = qualify_claim(
        _cand(
            ClaimStage.QUALIFIED,
            claim_key="SELF_CONTAINED_FULL_REPLAY",
            claim_code="SELF_CONTAINED_FULL_REPLAY",
            scope=_scope(component="k6-spe-artifact"),
        ),
        _ladder_up_to(ClaimStage.VERIFIED_WITHIN_SCOPE),
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g1r8_scoped_claim_may_reach_verified_within_scope():
    s = _scope(component="k6-spe-artifact")
    ev = [
        _ev(EvidenceKind.SPECIFICATION, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT", scope=s),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT", scope=s),
        _ev(EvidenceKind.TEST_RESULT, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT", scope=s),
        _review(1, scope=s, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT"),
    ]
    q = qualify_claim(
        _cand(
            ClaimStage.VERIFIED_WITHIN_SCOPE,
            claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT",
            scope=s,
            policy_id="subsystem_pass_external",
        ),
        ev,
    )
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE


def test_g1_during_impl_not_bound_and_pass():
    s = _scope(component="g1-runtime-binding")
    ev = [
        _ev(EvidenceKind.SPECIFICATION, claim_key="G1_RUNTIME_BINDING", scope=s),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, claim_key="G1_RUNTIME_BINDING", scope=s),
        _ev(EvidenceKind.TEST_RESULT, claim_key="G1_RUNTIME_BINDING", scope=s),
    ]
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED, claim_key="G1_RUNTIME_BINDING", scope=s),
        ev,
    )
    assert q.earned_stage is ClaimStage.TESTED


def test_full_ring0_not_qualified_during_g1r9_impl():
    s = _scope(component="full-ring0")
    ev = [
        _ev(EvidenceKind.SPECIFICATION, claim_key="FULL_RING0_IMPLEMENTATION", scope=s),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, claim_key="FULL_RING0_IMPLEMENTATION", scope=s),
        _ev(EvidenceKind.TEST_RESULT, claim_key="FULL_RING0_IMPLEMENTATION", scope=s),
    ]
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED, claim_key="FULL_RING0_IMPLEMENTATION", scope=s),
        ev,
    )
    assert stage_rank_safe(q.earned_stage) < stage_rank_safe(ClaimStage.QUALIFIED)


def test_direct_dataclass_not_canonical_writer():
    forged = ClaimQualification(
        qualification_id="qual-" + "f" * 64,
        claim_key=CK,
        subject_id=SUB,
        scope=_scope(),
        requested_stage=ClaimStage.INDEPENDENTLY_REPLICATED,
        earned_stage=ClaimStage.INDEPENDENTLY_REPLICATED,
        evidence_ids=(),
        unmet_requirements=(),
        limitations=(),
        verdict=QualificationVerdict.EARNED,
        policy_id="default_ring0",
    )
    real = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), [])
    assert forged.earned_stage is ClaimStage.INDEPENDENTLY_REPLICATED
    assert real.earned_stage is None


def test_qualify_does_not_mutate_inputs():
    ev = _ladder_up_to(ClaimStage.TESTED)
    ids_before = tuple(e.evidence_id for e in ev)
    cand = _cand(ClaimStage.TESTED)
    qualify_claim(cand, ev)
    assert tuple(e.evidence_id for e in ev) == ids_before


def test_canonical_writer_modules():
    assert record_qualification_evidence.__module__ == "spe_runtime.qualification.evidence"
    assert qualify_claim.__module__ == "spe_runtime.qualification.evaluate"


def test_gap_matrix_k7_movement():
    ring = json.loads((ROOT / "proofs/g1/ring0_gap_matrix.json").read_text())
    writers = json.loads((ROOT / "proofs/g1/semantic_writer_map.json").read_text())
    for name in ("claim qualification", "qualification evidence"):
        row = next(r for r in ring["requirements"] if r["requirement"] == name)
        assert row["status"] == "IMPLEMENTED", name
    missing = [r["requirement"] for r in ring["requirements"] if r["status"] == "MISSING"]
    assert missing == []
    assert writers["unowned_facts"] == []
    qe = next(f for f in writers["facts"] if f["semantic_fact"] == "qualification_evidence")
    assert qe["writer_modules"] == ["spe_runtime/qualification/evidence.py"]
    cq = next(f for f in writers["facts"] if f["semantic_fact"] == "claim_qualification")
    assert cq["writer_modules"] == ["spe_runtime/qualification/evaluate.py"]


def test_production_observation_rejects_local_env():
    with pytest.raises(SpeTypedError) as ei:
        record_qualification_evidence(
            evidence_kind=EvidenceKind.PRODUCTION_OBSERVATION,
            subject_id=SUB,
            claim_key=CK,
            scope=_scope(environment="local"),
            verdict=EvidenceVerdict.PASS,
            independence=IndependenceClass.EXTERNAL,
            producer_class="fake_prod",
            artifact_ref="obs:1",
            evidence_digest="a" * 64,
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE
