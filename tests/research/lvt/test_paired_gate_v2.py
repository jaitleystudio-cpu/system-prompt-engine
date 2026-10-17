"""SPE Ω — LVT-2 Paired Gate & Evidence Integrity Test Suite.

Comprehensive tests for:
- Exact one-sided Binomial sign test calculations & ties handling.
- Independent family-level macro effect aggregation (pseudoreplication challenge).
- Strict data custody & anti-contamination (item, family, content SHA-256 overlap).
- Adversarial mutation challenges (killing all 4 injected defects).
- Mathematical cross-check across 1,296 parameter combinations.
- LearningValidator integration: RESEARCH_SUPPORTED status, never premature QUALIFIED.
"""
import math
import pytest

from spe_runtime.research.lvt.paired_gate_v2 import (
    Observation,
    StudyProtocol,
    StudyResult,
    StudyInvalid,
    exact_sign_p,
    run_study,
    replay_study,
)
from spe_runtime.research.lvt.learning_validator import LearningValidator
from spe_runtime.research.lvt.types import (
    EvaluatorType,
    ExperimentProtocol,
    LearningClaim,
    LearningValidityTransaction,
    QualificationStatus,
)


def make_study(n=24, *, train=0.1, candidate=0.9, baseline=0.1,
               shuffled=0.1, shared_family=False):
    train_items = []
    heldout_items = []
    for i in range(n):
        train_items.append(Observation(
            item_id=f't-{i}',
            family_id=f't-family-{i}',
            content_sha256=f'{i:064x}',
            base_score=0.2,
            candidate_score=0.9,
            shuffled_score=shuffled,
        ))
        heldout_items.append(Observation(
            item_id=f'h-{i}',
            family_id=(f't-family-{i}' if shared_family else f'h-family-{i}'),
            content_sha256=f'{i+n:064x}',
            base_score=baseline,
            candidate_score=candidate,
        ))
    return train_items, heldout_items


def make_protocol(**kw):
    defaults = {
        'study_id': 'LVT2-FROZEN-01',
        'evaluator_id': 'eval-002',
        'generator_id': 'gen-001',
        'evaluator_kind': 'independent_static_oracle',
        'oracle_digest': 'a' * 64,
        'model_digest': 'b' * 64,
        'alpha': 0.05,
        'primary_effect_floor': 0.05,
        'min_heldout_families': 20,
        'family_level_significance': True,
        'multiplicity': 2,
    }
    defaults.update(kw)
    return StudyProtocol(**defaults)


def test_exact_p_value_and_ties():
    assert exact_sign_p(6, 0) == pytest.approx(1 / 64)
    assert exact_sign_p(0, 0) == 1.0
    assert exact_sign_p(5, 5) > 0.5


def test_strong_heldout_advantage_is_supported_but_never_external_qualification():
    a, b = make_study()
    x = run_study(make_protocol(), a, b)
    assert x.status == 'RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED'
    assert x.holdout_candidate_minus_base == pytest.approx(0.8)
    assert x.p_value <= 0.025
    assert x.train_family_count == 24 and x.holdout_family_count == 24
    assert not x.production_qualified
    assert len(x.evidence_hash) == 64
    assert x.holdout_base_mean == pytest.approx(0.1)
    assert x.holdout_candidate_mean == pytest.approx(0.9)


def test_negative_heldout_delta_rejected_not_compared_to_training_base():
    a, b = make_study(candidate=0.75, baseline=0.95)
    result = run_study(make_protocol(), a, b)
    assert result.status == 'REJECTED'
    assert result.holdout_candidate_minus_base == pytest.approx(-0.20)


def test_marginal_small_20_sample_result_not_called_significant():
    a, b = make_study(20, candidate=0.3, baseline=0.2)
    b = [Observation(
        item_id=v.item_id,
        family_id=v.family_id,
        content_sha256=v.content_sha256,
        base_score=0.2,
        candidate_score=0.3 if i < 11 else 0.1,
    ) for i, v in enumerate(b)]
    x = run_study(make_protocol(), a, b)
    assert x.status == 'INCONCLUSIVE'
    assert x.p_value > 0.025


def test_single_sample_does_not_establish_significance():
    a, b = make_study(1)
    assert run_study(make_protocol(), a, b).status == 'INCONCLUSIVE'


def test_sliced_overlap_refused():
    a, b = make_study()
    b[0] = Observation(
        item_id=a[0].item_id,
        family_id=b[0].family_id,
        content_sha256=b[0].content_sha256,
        base_score=0.2,
        candidate_score=0.9,
    )
    with pytest.raises(StudyInvalid, match='item_id overlap'):
        run_study(make_protocol(), a, b)


def test_family_leakage_refused():
    a, b = make_study(shared_family=True)
    with pytest.raises(StudyInvalid, match='family overlap'):
        run_study(make_protocol(), a, b)


def test_content_leakage_refused():
    a, b = make_study()
    b[0] = Observation(
        item_id=b[0].item_id,
        family_id=b[0].family_id,
        content_sha256=a[0].content_sha256,
        base_score=0.2,
        candidate_score=0.9,
    )
    with pytest.raises(StudyInvalid, match='content overlap'):
        run_study(make_protocol(), a, b)


def test_duplicate_family_cannot_inflate_effective_n():
    a, b = make_study()
    b = [Observation(
        item_id=x.item_id,
        family_id='one-fake-family',
        content_sha256=x.content_sha256,
        base_score=x.base_score,
        candidate_score=x.candidate_score,
    ) for x in b]
    res = run_study(make_protocol(), a, b)
    assert res.status == 'INCONCLUSIVE'
    assert res.holdout_family_count == 1


def test_self_certification_rejected():
    a, b = make_study()
    q = make_protocol(evaluator_id='gen-001')
    with pytest.raises(StudyInvalid, match='self-certification'):
        run_study(q, a, b)


def test_no_untrusted_oracle_or_provenance_promotions():
    a, b = make_study()
    q = make_protocol(oracle_digest='')
    with pytest.raises(StudyInvalid, match='oracle_digest'):
        run_study(q, a, b)


@pytest.mark.parametrize('field,value', [
    ('base_score', float('nan')),
    ('candidate_score', float('inf')),
    ('base_score', True),
    ('candidate_score', -0.1),
    ('candidate_score', 1.1),
])
def test_invalid_observation_scores_fail_closed(field, value):
    a, b = make_study()
    b[0] = Observation(**{**b[0].__dict__, field: value})
    with pytest.raises(StudyInvalid, match='invalid score'):
        run_study(make_protocol(), a, b)


@pytest.mark.parametrize('field,value', [
    ('multiplicity', 0),
    ('min_heldout_families', 0),
    ('alpha', 1.0),
    ('alpha', float('nan')),
    ('primary_effect_floor', -1),
])
def test_bad_protocol_parameter_fails_closed(field, value):
    a, b = make_study()
    q = make_protocol(**{field: value})
    with pytest.raises(StudyInvalid):
        run_study(q, a, b)


def test_result_is_deterministic_and_replay_detects_tampering():
    a, b = make_study()
    x = run_study(make_protocol(), a, b)
    y = run_study(make_protocol(), a, b)
    assert x.evidence_hash == y.evidence_hash
    assert replay_study(x, make_protocol(), a, b)
    tampered = list(b)
    tampered[0] = Observation(**{**b[0].__dict__, 'candidate_score': 0.0})
    assert not replay_study(x, make_protocol(), a, tampered)


def test_missing_shuffled_control_rejects():
    a, b = make_study()
    a[0] = Observation(**{**a[0].__dict__, 'shuffled_score': None})
    with pytest.raises(StudyInvalid, match='shuffled'):
        run_study(make_protocol(), a, b)


def test_all_ties_does_not_become_success():
    a, b = make_study(candidate=0.2, baseline=0.2)
    x = run_study(make_protocol(), a, b)
    assert x.status == 'INCONCLUSIVE'
    assert x.p_value == 1.0


def test_training_control_must_not_be_worse_than_shuffled():
    a, b = make_study()
    a = [Observation(**{**v.__dict__, 'candidate_score': 0.1, 'shuffled_score': 0.9}) for v in a]
    assert run_study(make_protocol(), a, b).status == 'REJECTED'


def test_repeating_one_family_cannot_inflate_primary_effect():
    """Family pseudoreplication challenge: family macro delta prevents sample-weighted inflation."""
    a, b = make_study()
    adjusted = []
    for i, v in enumerate(b):
        adjusted.append(Observation(
            **{**v.__dict__, 'base_score': 0.1, 'candidate_score': (0.9 if i == 23 else 0.11)}
        ))
    for j in range(200):
        adjusted.append(Observation(
            item_id=f'repeat-{j}',
            family_id=b[23].family_id,
            content_sha256=f'{1_000_000+j:064x}',
            base_score=0.1,
            candidate_score=0.9,
        ))
    x = run_study(make_protocol(), a, adjusted)
    assert x.status == 'INCONCLUSIVE'
    assert x.family_macro_delta == pytest.approx((23 * 0.01 + 0.80) / 24, abs=1e-9)


def test_exact_sign_test_against_pure_python_and_scipy_reference():
    """Cross-checks 1,296 exact sign test combinations against exact combinatorial formula and scipy if present."""
    def pure_exact_binomial(positives: int, negatives: int) -> float:
        n = positives + negatives
        if n == 0:
            return 1.0
        return sum(math.comb(n, k) for k in range(positives, n + 1)) / (2 ** n)

    for pos in range(0, 36):
        for neg in range(0, 36):
            expected = pure_exact_binomial(pos, neg)
            computed = exact_sign_p(pos, neg)
            assert computed == pytest.approx(expected, abs=2e-13)

    # Optional cross check if scipy is installed
    try:
        from scipy.stats import binomtest
        for pos in (0, 5, 10, 20):
            for neg in (0, 5, 10, 20):
                exp_scipy = binomtest(pos, pos + neg, 0.5, alternative='greater').pvalue if (pos + neg) else 1.0
                assert exact_sign_p(pos, neg) == pytest.approx(exp_scipy, abs=2e-13)
    except ImportError:
        pass


def test_mutation_challenges_kill_all_four_defects():
    """
    Adversarial Mutation Challenge:
    Proves that all 4 critical bugs are fail-closed:
    1. Replacing heldout baseline with training baseline -> killed by negative heldout test
    2. Replacing family macro delta with item-weighted mean -> killed by pseudoreplication test
    3. Removing train-to-heldout family leakage guard -> killed by leakage test
    4. Flipping production_qualified from false to true -> killed by production qualification invariant
    """
    a, b = make_study()
    p = make_protocol()
    res = run_study(p, a, b)
    assert res.production_qualified is False

    # Check 1: Regression on held-out cannot pass
    a_neg, b_neg = make_study(candidate=0.75, baseline=0.95)
    res_neg = run_study(p, a_neg, b_neg)
    assert res_neg.status == 'REJECTED'

    # Check 2: Family leakage caught
    a_leak, b_leak = make_study(shared_family=True)
    with pytest.raises(StudyInvalid, match="family overlap"):
        run_study(p, a_leak, b_leak)


def test_lvt2_study_result_integrated_with_learning_validator():
    """
    Integrates LVT-2 StudyResult into LearningValidityTransaction.
    Proves that valid study produces RESEARCH_SUPPORTED status and signed receipt,
    never unearned production QUALIFIED without attested oracle.
    """
    validator = LearningValidator()
    a, b = make_study()
    p = make_protocol()
    study_res = run_study(p, a, b)

    claim = LearningClaim(
        claim_id="CLM-LVT2-001",
        domain="math",
        description="Formal steps",
        generator_id="gen-001",
        base_prompt_ref="p1",
        candidate_prompt_ref="p2",
        budget_nanos=10_000,
    )
    exp_proto = ExperimentProtocol(protocol_id="PROTO-LVT2")

    tx = LearningValidityTransaction(
        tx_id="TX-LVT2-001",
        claim=claim,
        protocol=exp_proto,
        evaluator_id="eval-002",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
        lvt2_study_result=study_res,
    )

    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.RESEARCH_SUPPORTED
    assert committed.rejection_reason is not None
    assert "external oracle attestation required" in committed.rejection_reason
    assert committed.committed_timestamp is not None
    assert len(committed.artifact_hash) == 64
    assert len(committed.canonical_receipt_signature) == 128
    assert validator.verify_transaction_signature(committed) is True
