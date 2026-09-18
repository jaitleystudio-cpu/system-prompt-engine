"""G1R-9 K7 ClaimQualification + QualificationEvidence — anti-laundering suite."""

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


def _ladder_up_to(stage: ClaimStage) -> list[QualificationEvidence]:
    """Minimum cumulative evidence to earn `stage` under default_ring0."""
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
            out.append(
                _ev(
                    EvidenceKind.EXTERNAL_REVIEW,
                    scope=s,
                    independence=IndependenceClass.EXTERNAL,
                    producer_class="external_reviewer",
                )
            )
        elif st is ClaimStage.QUALIFIED:
            # EXTERNAL_REVIEW already satisfies QUALIFIED under default policy;
            # add a second distinct review digest so obligations stay explicit.
            out.append(
                _ev(
                    EvidenceKind.EXTERNAL_REVIEW,
                    scope=s,
                    independence=IndependenceClass.EXTERNAL,
                    producer_class="qualification_reviewer",
                    evidence_digest="a" * 64,
                    limitations=("scoped_subsystem_only",),
                )
            )
        elif st is ClaimStage.VALIDATED_WITH_USERS:
            out.append(
                _ev(
                    EvidenceKind.USER_VALIDATION,
                    scope=s,
                    independence=IndependenceClass.EXTERNAL,
                    producer_class="user_study",
                )
            )
        elif st is ClaimStage.PRODUCTION_OBSERVED:
            out.append(
                _ev(
                    EvidenceKind.PRODUCTION_OBSERVATION,
                    scope=_scope(environment="production"),
                    independence=IndependenceClass.EXTERNAL,
                    producer_class="prod_telemetry",
                )
            )
        elif st is ClaimStage.INDEPENDENTLY_REPLICATED:
            out.append(
                _ev(
                    EvidenceKind.INDEPENDENT_REPLICATION,
                    scope=_scope(environment="production"),
                    independence=IndependenceClass.INDEPENDENT,
                    producer_class="independent_lab",
                    evidence_digest="b" * 64,
                )
            )
    return out


# ---------------------------------------------------------------------------
# Identity / determinism
# ---------------------------------------------------------------------------


def test_qualification_evidence_identity_deterministic():
    a = _ev(EvidenceKind.TEST_RESULT)
    b = _ev(EvidenceKind.TEST_RESULT)
    assert a.evidence_id == b.evidence_id
    assert a.evidence_id.startswith("qe-")
    assert len(a.evidence_id) == 3 + 64


def test_qualification_identity_deterministic():
    ev = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.TESTED), ev)
    q2 = qualify_claim(_cand(ClaimStage.TESTED), ev)
    assert q1.qualification_id == q2.qualification_id
    assert q1.qualification_id.startswith("qual-")
    assert q1.earned_stage is ClaimStage.TESTED


def test_same_evidence_reordered_same_qualification():
    ev = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.TESTED), ev)
    q2 = qualify_claim(_cand(ClaimStage.TESTED), list(reversed(ev)))
    assert q1.qualification_id == q2.qualification_id
    assert q1.earned_stage == q2.earned_stage


def test_duplicate_evidence_does_not_boost_stage():
    base = _ladder_up_to(ClaimStage.TESTED)
    q1 = qualify_claim(_cand(ClaimStage.QUALIFIED), base)
    copies = base + [base[0]] * 99
    q2 = qualify_claim(_cand(ClaimStage.QUALIFIED), copies)
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
# Stage ladder (positive)
# ---------------------------------------------------------------------------


def test_specification_evidence_can_support_specified():
    q = qualify_claim(_cand(ClaimStage.SPECIFIED), [_ev(EvidenceKind.SPECIFICATION)])
    assert q.earned_stage is ClaimStage.SPECIFIED
    assert q.verdict is QualificationVerdict.EARNED


def test_implementation_evidence_required_for_implemented():
    q = qualify_claim(_cand(ClaimStage.IMPLEMENTED), [_ev(EvidenceKind.SPECIFICATION)])
    assert q.earned_stage is ClaimStage.SPECIFIED
    assert "NEED_IMPLEMENTATION_BINDING" in q.unmet_requirements
    q2 = qualify_claim(_cand(ClaimStage.IMPLEMENTED), _ladder_up_to(ClaimStage.IMPLEMENTED))
    assert q2.earned_stage is ClaimStage.IMPLEMENTED


def test_tests_required_for_tested():
    q = qualify_claim(_cand(ClaimStage.TESTED), _ladder_up_to(ClaimStage.IMPLEMENTED))
    assert q.earned_stage is ClaimStage.IMPLEMENTED
    assert "NEED_TEST_RESULT" in q.unmet_requirements


def test_verification_required_for_verified_within_scope():
    q = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), _ladder_up_to(ClaimStage.TESTED))
    assert q.earned_stage is ClaimStage.TESTED
    assert "NEED_SCOPED_VERIFICATION" in q.unmet_requirements


def test_user_validation_required_for_validated_with_users():
    q = qualify_claim(
        _cand(ClaimStage.VALIDATED_WITH_USERS),
        _ladder_up_to(ClaimStage.QUALIFIED),
    )
    assert q.earned_stage is ClaimStage.QUALIFIED
    assert "NEED_USER_VALIDATION" in q.unmet_requirements


def test_production_observation_required_for_production_observed():
    # Production claim uses production environment scope.
    prod_scope = _scope(environment="production")
    # Build ladder with production-scoped evidence through QUALIFIED
    s_local = _scope()
    ev = [
        _ev(EvidenceKind.SPECIFICATION, scope=prod_scope),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, scope=prod_scope),
        _ev(EvidenceKind.TEST_RESULT, scope=prod_scope),
        _ev(
            EvidenceKind.EXTERNAL_REVIEW,
            scope=prod_scope,
            independence=IndependenceClass.EXTERNAL,
            producer_class="ext",
        ),
    ]
    q = qualify_claim(_cand(ClaimStage.PRODUCTION_OBSERVED, scope=prod_scope), ev)
    assert q.earned_stage is ClaimStage.QUALIFIED
    assert "NEED_PRODUCTION_OBSERVATION" in q.unmet_requirements or "NEED_USER_VALIDATION" in q.unmet_requirements


def test_independent_replication_required_for_independently_replicated():
    prod = _scope(environment="production")
    ev = _ladder_up_to(ClaimStage.PRODUCTION_OBSERVED)
    # Fix scopes to production for usable match
    ev = [
        _ev(EvidenceKind.SPECIFICATION, scope=prod),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, scope=prod),
        _ev(EvidenceKind.TEST_RESULT, scope=prod),
        _ev(
            EvidenceKind.EXTERNAL_REVIEW,
            scope=prod,
            independence=IndependenceClass.EXTERNAL,
            producer_class="ext",
        ),
        _ev(
            EvidenceKind.USER_VALIDATION,
            scope=prod,
            independence=IndependenceClass.EXTERNAL,
            producer_class="users",
        ),
        _ev(
            EvidenceKind.PRODUCTION_OBSERVATION,
            scope=prod,
            independence=IndependenceClass.EXTERNAL,
            producer_class="prod",
        ),
    ]
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED, scope=prod), ev)
    assert q.earned_stage is ClaimStage.PRODUCTION_OBSERVED
    assert "NEED_INDEPENDENT_REPLICATION" in q.unmet_requirements


def test_claim_ladder_incremental_no_skip():
    expected = [
        ClaimStage.SPECIFIED,
        ClaimStage.IMPLEMENTED,
        ClaimStage.TESTED,
        ClaimStage.VERIFIED_WITHIN_SCOPE,
        ClaimStage.QUALIFIED,
    ]
    for stage in expected:
        q = qualify_claim(_cand(stage), _ladder_up_to(stage))
        assert q.earned_stage is stage, (stage, q.earned_stage, q.unmet_requirements)

    # Distinct-evidence transitions must not skip when next obligation unmet.
    # SPECIFIED→IMPLEMENTED, IMPLEMENTED→TESTED, TESTED→VERIFIED require new kinds.
    for stage, nxt, need in (
        (ClaimStage.SPECIFIED, ClaimStage.IMPLEMENTED, "NEED_IMPLEMENTATION_BINDING"),
        (ClaimStage.IMPLEMENTED, ClaimStage.TESTED, "NEED_TEST_RESULT"),
        (ClaimStage.TESTED, ClaimStage.VERIFIED_WITHIN_SCOPE, "NEED_SCOPED_VERIFICATION"),
    ):
        q2 = qualify_claim(_cand(nxt), _ladder_up_to(stage))
        assert q2.earned_stage is stage
        assert need in q2.unmet_requirements

    # EXTERNAL_REVIEW that satisfies VERIFIED may also satisfy QUALIFIED under
    # default_ring0 — that is policy overlap, not stage skipping past unsupported
    # obligations. USER_VALIDATION remains a hard next gate.
    q3 = qualify_claim(
        _cand(ClaimStage.VALIDATED_WITH_USERS),
        _ladder_up_to(ClaimStage.QUALIFIED),
    )
    assert q3.earned_stage is ClaimStage.QUALIFIED
    assert "NEED_USER_VALIDATION" in q3.unmet_requirements


# ---------------------------------------------------------------------------
# Anti-laundering — stage
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
    # INTERNAL review fails VERIFIED min_independence=EXTERNAL → stays TESTED
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), ev)
    assert q.earned_stage is ClaimStage.TESTED
    assert stage_rank_safe(q.earned_stage) < stage_rank_safe(ClaimStage.INDEPENDENTLY_REPLICATED)


def stage_rank_safe(s: ClaimStage | None) -> int:
    if s is None:
        return -1
    return STAGE_ORDER.index(s)


def test_k2_pass_receipt_alone_cannot_earn_qualified():
    receipt = _ev(
        EvidenceKind.VERIFICATION_RECEIPT,
        independence=IndependenceClass.EXTERNAL,
        artifact_ref="rcpt-" + "c" * 64,
        producer_class="k2_verify",
    )
    # Need prior stages too — receipt alone with no spec/impl/test
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), [receipt])
    assert q.earned_stage is None or stage_rank_safe(q.earned_stage) < stage_rank_safe(
        ClaimStage.QUALIFIED
    )
    # With TESTED ladder + receipt only (no EXTERNAL_REVIEW) → VERIFIED ok, QUALIFIED not
    ev = _ladder_up_to(ClaimStage.TESTED) + [receipt]
    q2 = qualify_claim(_cand(ClaimStage.QUALIFIED), ev)
    assert q2.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert "NEED_QUALIFICATION_REVIEW" in q2.unmet_requirements


def test_k6_integrity_alone_cannot_earn_qualified():
    # Artifact integrity is not a K7 evidence kind that auto-qualifies.
    # Binding a spe- ref as TEST_RESULT still only reaches TESTED with full ladder.
    spe_ref = "spe-" + "d" * 64
    ev = [
        _ev(EvidenceKind.SPECIFICATION),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING),
        _ev(EvidenceKind.TEST_RESULT, artifact_ref=spe_ref),
    ]
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), ev)
    assert q.earned_stage is ClaimStage.TESTED


def test_user_statement_cannot_self_qualify_production():
    # User free-text is not evidence; marketing claim key is unqualifiable.
    q = qualify_claim(
        _cand(
            ClaimStage.PRODUCTION_OBSERVED,
            claim_key="PRODUCTION_READY",
            claim_code="PRODUCTION_READY",
        ),
        _ladder_up_to(ClaimStage.TESTED),
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY
    assert q.earned_stage is None


def test_model_statement_cannot_earn_verification():
    # Model text is not QualificationEvidence — empty evidence set.
    q = qualify_claim(_cand(ClaimStage.VERIFIED_WITHIN_SCOPE), [])
    assert q.earned_stage is None
    assert q.verdict is QualificationVerdict.NOT_EARNED


def test_prompt_text_cannot_self_qualify():
    # PromptArtifact text is not K7 evidence.
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), [])
    assert q.earned_stage is None


def test_spe_import_metadata_cannot_self_qualify():
    # Presence of spe- artifact ref without proper ladder/evidence kinds.
    q = qualify_claim(
        _cand(ClaimStage.QUALIFIED),
        [
            _ev(
                EvidenceKind.IMPLEMENTATION_BINDING,
                artifact_ref="spe-" + "e" * 64,
            )
        ],
    )
    assert q.earned_stage is None or stage_rank_safe(q.earned_stage) < stage_rank_safe(
        ClaimStage.QUALIFIED
    )


def test_benchmark_cannot_earn_world_1():
    assert "WORLD_1" in UNSUPPORTED_MARKETING_CLAIM_KEYS
    q = qualify_claim(
        _cand(ClaimStage.INDEPENDENTLY_REPLICATED, claim_key="WORLD_1", claim_code="WORLD_1"),
        [
            _ev(
                EvidenceKind.BENCHMARK_RESULT,
                claim_key="WORLD_1",
                independence=IndependenceClass.INDEPENDENT,
            )
        ],
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY
    assert q.earned_stage is None


def test_formal_claim_without_model_check_unqualifiable():
    q = qualify_claim(
        _cand(ClaimStage.VERIFIED_WITHIN_SCOPE, claim_key="FORMALLY_VERIFIED", claim_code="FORMALLY_VERIFIED"),
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
        _ev(
            EvidenceKind.EXTERNAL_REVIEW,
            scope=k6,
            claim_key="K6_PORTABLE",
            independence=IndependenceClass.EXTERNAL,
            producer_class="g1r8r",
        ),
    ]
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(
            _cand(ClaimStage.QUALIFIED, claim_key="FULL_RING0_IMPLEMENTATION", scope=ring0),
            # Retarget claim_key mismatch + scope
            ev,
        )
    assert ei.value.code in (ErrorCode.K7_SCOPE_MISMATCH, ErrorCode.K7_SUBJECT_MISMATCH)


def test_old_revision_evidence_not_reuse_for_new_revision():
    old = _ev(EvidenceKind.TEST_RESULT, scope=_scope(revision="rev-a"))
    claim = _cand(ClaimStage.TESTED, scope=_scope(revision="rev-b"))
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(claim, [old])
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


# ---------------------------------------------------------------------------
# Independence
# ---------------------------------------------------------------------------


def test_same_reviewer_duplicated_not_independent_replication():
    base = _ladder_up_to(ClaimStage.TESTED)
    rev = _ev(
        EvidenceKind.EXTERNAL_REVIEW,
        independence=IndependenceClass.EXTERNAL,
        producer_class="same_reviewer",
    )
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), base + [rev, rev])
    assert q.earned_stage is not ClaimStage.INDEPENDENTLY_REPLICATED
    assert stage_rank_safe(q.earned_stage) <= stage_rank_safe(ClaimStage.QUALIFIED)


def test_external_review_not_automatically_independent_replication():
    q = qualify_claim(
        _cand(ClaimStage.INDEPENDENTLY_REPLICATED),
        _ladder_up_to(ClaimStage.QUALIFIED),
    )
    assert q.earned_stage is ClaimStage.QUALIFIED
    assert "NEED_INDEPENDENT_REPLICATION" in q.unmet_requirements or "NEED_USER_VALIDATION" in q.unmet_requirements


def test_independent_replication_requires_independence_metadata():
    with pytest.raises(SpeTypedError) as ei:
        record_qualification_evidence(
            evidence_kind=EvidenceKind.INDEPENDENT_REPLICATION,
            subject_id=SUB,
            claim_key=CK,
            scope=_scope(),
            verdict=EvidenceVerdict.PASS,
            independence=IndependenceClass.EXTERNAL,  # wrong
            producer_class="lab",
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE


# ---------------------------------------------------------------------------
# Contradiction / UNKNOWN / irrelevant boost
# ---------------------------------------------------------------------------


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
    q1 = qualify_claim(_cand(ClaimStage.QUALIFIED), base)
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
    # subject mismatch on noise — only base subject hits usable; noise dropped via subject filter
    # When mixed subjects exist and our subject has usable evidence, qualify_claim uses usable only.
    # But noise has different subject — subject_hits still nonempty from base.
    q2 = qualify_claim(_cand(ClaimStage.QUALIFIED), base + noise)
    assert q1.earned_stage == q2.earned_stage == ClaimStage.TESTED


def test_limitations_preserved_on_earn():
    ev = _ladder_up_to(ClaimStage.QUALIFIED)
    q = qualify_claim(_cand(ClaimStage.QUALIFIED), ev)
    assert q.earned_stage is ClaimStage.QUALIFIED
    assert "scoped_subsystem_only" in q.limitations


def test_earned_stage_never_echoes_higher_request():
    q = qualify_claim(_cand(ClaimStage.INDEPENDENTLY_REPLICATED), _ladder_up_to(ClaimStage.TESTED))
    assert q.requested_stage is ClaimStage.INDEPENDENTLY_REPLICATED
    assert q.earned_stage is ClaimStage.TESTED
    assert q.verdict is QualificationVerdict.PARTIALLY_EARNED


# ---------------------------------------------------------------------------
# Current project claim vectors
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
        _ladder_up_to(ClaimStage.QUALIFIED),
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g1r8_scoped_claim_may_reach_verified_within_scope():
    s = _scope(component="k6-spe-artifact")
    ev = [
        _ev(EvidenceKind.SPECIFICATION, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT", scope=s),
        _ev(EvidenceKind.IMPLEMENTATION_BINDING, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT", scope=s),
        _ev(EvidenceKind.TEST_RESULT, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT", scope=s),
        _ev(
            EvidenceKind.EXTERNAL_REVIEW,
            claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT",
            scope=s,
            independence=IndependenceClass.EXTERNAL,
            producer_class="g1r8r_review",
        ),
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
    # Implementation-local evidence must not self-promote G1 to BOUND_AND_PASS / QUALIFIED.
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
    assert q.verdict is QualificationVerdict.PARTIALLY_EARNED


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


# ---------------------------------------------------------------------------
# Domain separation / immutability / writers
# ---------------------------------------------------------------------------


def test_direct_dataclass_not_canonical_writer():
    # Plain construction with forged earned_stage is not the canonical writer.
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
    assert real.qualification_id != forged.qualification_id


def test_qualify_does_not_mutate_inputs():
    ev = _ladder_up_to(ClaimStage.TESTED)
    ids_before = tuple(e.evidence_id for e in ev)
    cand = _cand(ClaimStage.TESTED)
    qualify_claim(cand, ev)
    assert tuple(e.evidence_id for e in ev) == ids_before
    assert cand.requested_stage is ClaimStage.TESTED


def test_canonical_writer_modules():
    assert record_qualification_evidence.__module__ == "spe_runtime.qualification.evidence"
    assert qualify_claim.__module__ == "spe_runtime.qualification.evaluate"


def test_gap_matrix_k7_movement():
    ring = json.loads((ROOT / "proofs/g1/ring0_gap_matrix.json").read_text())
    writers = json.loads((ROOT / "proofs/g1/semantic_writer_map.json").read_text())
    for name in ("claim qualification", "qualification evidence"):
        row = next(r for r in ring["requirements"] if r["requirement"] == name)
        assert row["status"] == "IMPLEMENTED", name
        assert row["implementation_modules"], name
    missing = [r["requirement"] for r in ring["requirements"] if r["status"] == "MISSING"]
    assert missing == []
    assert writers["unowned_facts"] == []
    qe = next(f for f in writers["facts"] if f["semantic_fact"] == "qualification_evidence")
    assert qe["writer_modules"] == ["spe_runtime/qualification/evidence.py"]
    assert qe["duplicate_writer"] is False
    cq = next(f for f in writers["facts"] if f["semantic_fact"] == "claim_qualification")
    assert cq["writer_modules"] == ["spe_runtime/qualification/evaluate.py"]
    assert cq["duplicate_writer"] is False


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
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE
