"""G1R-9R adversarial recheck — claim-laundering attacks against K7."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.qualification import (
    ClaimCandidate,
    ClaimPolicy,
    ClaimScope,
    ClaimStage,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceBasis,
    IndependenceClass,
    STAGE_FLOORS,
    StageObligation,
    qualify_claim,
    record_qualification_evidence,
    validate_policy,
)

ROOT = Path(__file__).resolve().parents[2]
CK, SUB = "RING0_DEMO", "subject-demo-1"


def S(**kw):
    d = dict(component="ring0-demo", platform="python", runtime="cpython", environment="local", revision="rev-a")
    d.update(kw)
    return ClaimScope(**d)


def ev(kind, **kw):
    return record_qualification_evidence(
        evidence_kind=kind,
        subject_id=kw.pop("subject_id", SUB),
        claim_key=kw.pop("claim_key", CK),
        scope=kw.pop("scope", S()),
        verdict=kw.pop("verdict", EvidenceVerdict.PASS),
        independence=kw.pop("independence", IndependenceClass.INTERNAL),
        producer_class=kw.pop("producer_class", "unit_test"),
        **kw,
    )


def review(n, **kw):
    return ev(
        EvidenceKind.EXTERNAL_REVIEW,
        independence=IndependenceClass.EXTERNAL,
        producer_class=f"external_reviewer_{n}",
        artifact_ref=f"review:{n}",
        evidence_digest=f"{n:064x}",
        **kw,
    )


def cand(stage, **kw):
    return ClaimCandidate(
        claim_key=kw.pop("claim_key", CK),
        subject_id=kw.pop("subject_id", SUB),
        requested_stage=stage,
        scope=kw.pop("scope", S()),
        claim_code=kw.pop("claim_code", kw.get("claim_key", CK)),
        policy_id=kw.pop("policy_id", "default_ring0"),
        **kw,
    )


def base_tested():
    return [
        ev(EvidenceKind.SPECIFICATION),
        ev(EvidenceKind.IMPLEMENTATION_BINDING),
        ev(EvidenceKind.TEST_RESULT),
    ]


# ----- F01 policy downgrade -----


def test_f01_caller_claimpolicy_object_rejected():
    weak = {
        st: (StageObligation(evidence_kinds=(EvidenceKind.TEST_RESULT,), code="WEAK"),)
        for st in ClaimStage
    }
    pol = ClaimPolicy(policy_id="malicious", obligations=weak)
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(cand(ClaimStage.INDEPENDENTLY_REPLICATED), [ev(EvidenceKind.TEST_RESULT)], pol)
    assert ei.value.code is ErrorCode.K7_INVALID_POLICY


def test_f01_weak_policy_fails_floor_validation():
    weak = {
        st: (StageObligation(evidence_kinds=(EvidenceKind.TEST_RESULT,), code="WEAK"),)
        for st in ClaimStage
    }
    with pytest.raises(SpeTypedError) as ei:
        validate_policy(ClaimPolicy(policy_id="malicious", obligations=weak))
    assert ei.value.code is ErrorCode.K7_INVALID_POLICY


def test_f01_user_intent_cannot_weaken_policy():
    # Human/model desire expressed as ClaimPolicy object — rejected.
    with pytest.raises(SpeTypedError):
        qualify_claim(
            cand(ClaimStage.INDEPENDENTLY_REPLICATED),
            base_tested(),
            ClaimPolicy(policy_id="default_ring0", obligations=STAGE_FLOORS),  # even matching object rejected
        )


# ----- F02 self-declared independence -----


def test_f02_declared_independent_enum_without_custody_downgraded():
    e = ev(
        EvidenceKind.EXTERNAL_REVIEW,
        independence=IndependenceClass.EXTERNAL,
        producer_class="someone",
    )
    assert e.independence is IndependenceClass.INTERNAL
    assert e.independence_basis is IndependenceBasis.DECLARED


def test_f02_synthetic_independent_replication_rejected():
    with pytest.raises(SpeTypedError):
        ev(
            EvidenceKind.INDEPENDENT_REPLICATION,
            independence=IndependenceClass.INDEPENDENT,
            producer_class="i_say_so",
            artifact_ref="review:x",
            evidence_digest="a" * 64,
        )


def test_f02_structural_bound_still_not_crypto_auth():
    e = ev(
        EvidenceKind.INDEPENDENT_REPLICATION,
        independence=IndependenceClass.INDEPENDENT,
        producer_class="independent_lab:alpha",
        artifact_ref="review:repl",
        evidence_digest="b" * 64,
    )
    assert e.independence_basis is IndependenceBasis.STRUCTURAL_BOUND
    assert any("not_cryptographically_authenticated" in lim for lim in e.limitations)


# ----- F03 evidence reuse -----


def test_f03_one_external_review_cannot_earn_qualified():
    ladder = base_tested() + [review(1)]
    q = qualify_claim(cand(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"), ladder)
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert "NEED_QUALIFICATION_REVIEW" in q.unmet_requirements


def test_f03_two_distinct_reviews_can_earn_qualified_under_subsystem_policy():
    ladder = base_tested() + [review(1), review(2)]
    q = qualify_claim(cand(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"), ladder)
    assert q.earned_stage is ClaimStage.QUALIFIED


def test_f03_same_source_digest_cannot_satisfy_two_reviews():
    # Two wrappers, same digest → unique_source blocks second obligation.
    r1 = ev(
        EvidenceKind.EXTERNAL_REVIEW,
        independence=IndependenceClass.EXTERNAL,
        producer_class="external_reviewer_a",
        artifact_ref="review:a",
        evidence_digest="s" * 64,
    )
    r2 = ev(
        EvidenceKind.EXTERNAL_REVIEW,
        independence=IndependenceClass.EXTERNAL,
        producer_class="external_reviewer_b",
        artifact_ref="review:b",
        evidence_digest="s" * 64,  # same underlying source
    )
    q = qualify_claim(
        cand(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"),
        base_tested() + [r1, r2],
    )
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert "NEED_QUALIFICATION_REVIEW" in q.unmet_requirements


def test_f03_default_ring0_caps_before_qualified():
    ladder = base_tested() + [review(1), review(2)]
    q = qualify_claim(cand(ClaimStage.QUALIFIED), ladder)
    assert q.earned_stage is ClaimStage.VERIFIED_WITHIN_SCOPE
    assert any("POLICY_MAX_STAGE" in u for u in q.unmet_requirements)


# ----- F04 production -----


@pytest.mark.parametrize("env", ["remote_ci", "ci", "qa", "preview", "staging", "test", "dev_cloud"])
def test_f04_non_production_envs_rejected(env):
    with pytest.raises(SpeTypedError) as ei:
        ev(
            EvidenceKind.PRODUCTION_OBSERVATION,
            scope=S(environment=env),
            independence=IndependenceClass.EXTERNAL,
            producer_class="ops",
            artifact_ref="obs:1",
            evidence_digest="c" * 64,
        )
    assert ei.value.code is ErrorCode.K7_INVALID_EVIDENCE


def test_f04_production_label_alone_rejected():
    with pytest.raises(SpeTypedError):
        ev(
            EvidenceKind.PRODUCTION_OBSERVATION,
            scope=S(environment="production"),
            independence=IndependenceClass.EXTERNAL,
            producer_class="ops",
        )


def test_f04_production_with_custody_records_limitation():
    e = ev(
        EvidenceKind.PRODUCTION_OBSERVATION,
        scope=S(environment="production"),
        independence=IndependenceClass.EXTERNAL,
        producer_class="production_observer:ops",
        artifact_ref="obs:prod",
        evidence_digest="d" * 64,
    )
    assert e.scope.environment == "production"
    assert any("structurally_declared" in lim for lim in e.limitations)


# ----- F05 revision / scope omission -----


def test_f05_claim_revision_none_does_not_cover_bound_evidence():
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(
            cand(ClaimStage.SPECIFIED, scope=S(revision=None)),
            [ev(EvidenceKind.SPECIFICATION, scope=S(revision="SHA_A"))],
        )
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_f05_both_unbound_revision_ok():
    q = qualify_claim(
        cand(ClaimStage.SPECIFIED, scope=S(revision=None)),
        [ev(EvidenceKind.SPECIFICATION, scope=S(revision=None))],
    )
    assert q.earned_stage is ClaimStage.SPECIFIED


# ----- F06 same-source wrapper -----


def test_f06_same_digest_external_and_independent_wrappers():
    digest = "e" * 64
    a = ev(
        EvidenceKind.EXTERNAL_REVIEW,
        independence=IndependenceClass.EXTERNAL,
        producer_class="external_reviewer_1",
        artifact_ref="review:a",
        evidence_digest=digest,
    )
    b = ev(
        EvidenceKind.INDEPENDENT_REPLICATION,
        independence=IndependenceClass.INDEPENDENT,
        producer_class="independent_lab:lab",
        artifact_ref="review:b",
        evidence_digest=digest,
    )
    assert a.source_key() == b.source_key()
    # Under subsystem max QUALIFIED, independent stage unreachable; source reuse still blocks.
    ladder = base_tested() + [a, review(2), b]
    q = qualify_claim(cand(ClaimStage.QUALIFIED, policy_id="subsystem_pass_external"), ladder)
    # QUALIFIED may succeed via review(2) distinct source; independent not requested as max
    assert q.earned_stage is ClaimStage.QUALIFIED


# ----- user validation / formal / stage jump -----


def test_synthetic_user_validation_rejected():
    with pytest.raises(SpeTypedError):
        ev(
            EvidenceKind.USER_VALIDATION,
            independence=IndependenceClass.EXTERNAL,
            producer_class="model_generated_survey",
            artifact_ref="study:1",
            evidence_digest="f" * 64,
        )


def test_user_validation_requires_prefix_and_custody():
    with pytest.raises(SpeTypedError):
        ev(
            EvidenceKind.USER_VALIDATION,
            independence=IndependenceClass.EXTERNAL,
            producer_class="developer_clicking_ui",
            artifact_ref="study:1",
            evidence_digest="f" * 64,
        )


def test_formal_model_check_requires_custody():
    with pytest.raises(SpeTypedError):
        ev(EvidenceKind.FORMAL_MODEL_CHECK, verdict=EvidenceVerdict.PASS)


def test_stage_jump_independent_only_blocked():
    alone = [
        ev(
            EvidenceKind.INDEPENDENT_REPLICATION,
            independence=IndependenceClass.INDEPENDENT,
            producer_class="independent_lab:z",
            artifact_ref="review:z",
            evidence_digest="g" * 64,
        )
    ]
    q = qualify_claim(cand(ClaimStage.INDEPENDENTLY_REPLICATED), alone)
    assert q.earned_stage is None
    assert "NEED_SPECIFICATION" in q.unmet_requirements


def test_stage_jump_production_only_blocked():
    alone = [
        ev(
            EvidenceKind.PRODUCTION_OBSERVATION,
            scope=S(environment="production"),
            independence=IndependenceClass.EXTERNAL,
            producer_class="production_observer:z",
            artifact_ref="obs:z",
            evidence_digest="h" * 64,
        )
    ]
    q = qualify_claim(
        cand(ClaimStage.PRODUCTION_OBSERVED, scope=S(environment="production")),
        alone,
    )
    assert q.earned_stage is None


def test_fail_not_outvoted_by_pass_copies():
    fail = ev(EvidenceKind.TEST_RESULT, verdict=EvidenceVerdict.FAIL, producer_class="failer")
    passes = [
        ev(EvidenceKind.TEST_RESULT, producer_class=f"p{i}", evidence_digest=f"{i:064x}")
        for i in range(20)
    ]
    q = qualify_claim(
        cand(ClaimStage.TESTED),
        [
            ev(EvidenceKind.SPECIFICATION),
            ev(EvidenceKind.IMPLEMENTATION_BINDING),
            fail,
            *passes,
        ],
    )
    assert q.earned_stage is ClaimStage.IMPLEMENTED
    assert any(u.startswith("BLOCKED_BY_FAIL") for u in q.unmet_requirements)


def test_claim_policy_binding_mismatch():
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(
            cand(
                ClaimStage.VERIFIED_WITHIN_SCOPE,
                claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT",
                claim_code="PORTABLE_SEMANTIC_BINDING_ARTIFACT",
                policy_id="default_ring0",  # requires subsystem_pass_external
            ),
            base_tested() + [review(1, claim_key="PORTABLE_SEMANTIC_BINDING_ARTIFACT")],
        )
    assert ei.value.code is ErrorCode.K7_INVALID_POLICY


def test_historical_g1r8_review_cannot_cover_g1r9_revision():
    old = S(revision="5100c76d70971d1bf37c84747f66e964ff6086d3")
    new = S(revision="8766bfdc7a8907340b72d81e9c5d1bb82482ce51")
    ev_old = base_tested()  # uses rev-a by default — use explicit
    ev_old = [
        ev(EvidenceKind.SPECIFICATION, scope=old, claim_key="G1R9_K7"),
        ev(EvidenceKind.IMPLEMENTATION_BINDING, scope=old, claim_key="G1R9_K7"),
        ev(EvidenceKind.TEST_RESULT, scope=old, claim_key="G1R9_K7"),
        review(1, scope=old, claim_key="G1R9_K7"),
    ]
    with pytest.raises(SpeTypedError) as ei:
        qualify_claim(
            cand(ClaimStage.VERIFIED_WITHIN_SCOPE, claim_key="G1R9_K7", claim_code="G1R9_K7", scope=new),
            ev_old,
        )
    assert ei.value.code is ErrorCode.K7_SCOPE_MISMATCH


def test_g1r9_local_tests_cannot_self_qualify_pass_external():
    """Local G1R-9 tests ≠ PASS_EXTERNAL / QUALIFIED."""
    from spe_runtime.qualification import QualificationVerdict

    key = "G1R9_K7"
    local = [
        ev(EvidenceKind.SPECIFICATION, claim_key=key),
        ev(EvidenceKind.IMPLEMENTATION_BINDING, claim_key=key),
        ev(EvidenceKind.TEST_RESULT, claim_key=key),
    ]
    q = qualify_claim(cand(ClaimStage.QUALIFIED, claim_key=key, claim_code=key), local)
    assert q.earned_stage is ClaimStage.TESTED
    assert q.verdict is QualificationVerdict.PARTIALLY_EARNED


def test_g1_remains_not_bound_and_pass():
    key = "G1_RUNTIME_BINDING"
    local = [
        ev(EvidenceKind.SPECIFICATION, claim_key=key),
        ev(EvidenceKind.IMPLEMENTATION_BINDING, claim_key=key),
        ev(EvidenceKind.TEST_RESULT, claim_key=key),
    ]
    q = qualify_claim(cand(ClaimStage.QUALIFIED, claim_key=key, claim_code=key), local)
    assert q.earned_stage is ClaimStage.TESTED


def test_world_aliases_unqualifiable():
    for key in ("BEST_IN_WORLD", "GLOBAL_BEST", "SUPER_GOD_MODE_VERIFIED", "UNHACKABLE"):
        q = qualify_claim(cand(ClaimStage.QUALIFIED, claim_key=key, claim_code=key), base_tested())
        assert q.verdict.value == "UNQUALIFIABLE_UNDER_POLICY", key


def test_immutability_evidence_and_qualification():
    e = ev(EvidenceKind.TEST_RESULT)
    with pytest.raises(Exception):
        e.limitations = ("mutated",)  # type: ignore[misc]
    q = qualify_claim(cand(ClaimStage.TESTED), base_tested())
    with pytest.raises(Exception):
        q.scope = S(component="hijacked")  # type: ignore[misc]


def test_mechanical_g1_gates_still_green():
    import tests.unit.test_g1_runtime_binding as b

    b.test_g1_qualification_owner_unique()
    b.test_g1_no_unowned_required_ring0_responsibility()


def test_writer_counts_unchanged():
    writers = json.loads((ROOT / "proofs/g1/semantic_writer_map.json").read_text())
    assert writers["unowned_facts"] == []
    for fact, path in (
        ("qualification_evidence", "spe_runtime/qualification/evidence.py"),
        ("claim_qualification", "spe_runtime/qualification/evaluate.py"),
        ("spe_artifact_identity", "spe_runtime/storage/build.py"),
        ("prompt_artifact", "spe_runtime/prompt/build.py"),
        ("proof_receipt", "spe_runtime/proof/verify.py"),
    ):
        row = next(f for f in writers["facts"] if f["semantic_fact"] == fact)
        assert path in row["writer_modules"] or row["writer_modules"] == [path]
        assert row["duplicate_writer"] is False
