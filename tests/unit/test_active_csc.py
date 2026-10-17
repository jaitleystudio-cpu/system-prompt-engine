"""
Unit tests for SPE Ω Active Counterfactual Specification Closure (CSC) Kernel
"Challenge This Result" Anti-Lucky-Pass Verification Engine
"""

import pytest
from spe_runtime.csc.kernel import (
    ActiveCscReport,
    CandidateClaim,
    CounterfactualScenario,
    MinimalCutRepair,
    PerturbationOperator,
    ReleaseVerdict,
    challenge_candidate_claim,
    generate_minimal_cut_repairs,
    simulate_scenario_execution,
    synthesize_counterfactual_scenarios,
)


@pytest.fixture
def stripe_claim() -> CandidateClaim:
    return CandidateClaim(
        id="claim-stripe-test",
        title="Stripe Checkout Route",
        category="PAYMENT",
        claimed_capability="Charges card and records payment without duplicate charges.",
        baseline_test_count=8,
        baseline_pass_count=8,
        implementation_code="""
def handle_checkout(req):
    charge = stripe.Charge.create(amount=req.amount, customer=req.user_id)
    db.payments.insert(charge_id=charge.id, status='paid')
    return {'status': 200, 'charge_id': charge.id}
""",
        baseline_test_code="def test_checkout(): assert handle_checkout(mock_req)['status'] == 200",
        declared_invariants=["Charge must be exactly single-execution per cart."],
    )


@pytest.fixture
def resilient_claim() -> CandidateClaim:
    return CandidateClaim(
        id="claim-resilient-test",
        title="Hardened Distributed Snapshot Engine",
        category="DISTRIBUTED",
        claimed_capability="Writes snapshot with idempotency, locks, and transactional rollbacks.",
        baseline_test_count=15,
        baseline_pass_count=15,
        implementation_code="""
def write_snapshot(req):
    # Schema validation with positive amount
    validated = SafeSchema.validate(req.body)
    if not rate_limiter.check(req.ip):
        return {'status': 429, 'retry_after': 5}
    # Idempotency check
    if db.snapshots.find(idempotency_key=req.idempotency_key):
        return {'status': 200, 'result': 'reconciled'}
    # Transactional row lock and rollback
    with db.atomic_transaction() as tx:
        lock = tx.acquire_lock(req.entity_id)
        result = tx.snapshots.create(idempotency_key=req.idempotency_key)
    return {'status': 200, 'result': result}
""",
        baseline_test_code="def test_resilient(): assert write_snapshot(mock_req)['status'] == 200",
        declared_invariants=["Must survive mid-execution network drops without duplicate writes."],
    )


def test_synthesize_scenarios(stripe_claim: CandidateClaim):
    scenarios = synthesize_counterfactual_scenarios(stripe_claim)
    assert len(scenarios) == 5
    operators = [s.operator for s in scenarios]
    assert PerturbationOperator.NETWORK_DISCONNECT_MID_TRANSACTION in operators
    assert PerturbationOperator.STALE_CACHE_RACE in operators
    assert PerturbationOperator.MALFORMED_INPUT_INVERSION in operators
    assert PerturbationOperator.STATE_ROLLBACK_AFTER_FAILURE in operators
    assert PerturbationOperator.RATE_LIMIT_BURST_COLLISION in operators


def test_stripe_lucky_pass_detection(stripe_claim: CandidateClaim):
    report: ActiveCscReport = challenge_candidate_claim(stripe_claim)
    assert report.claim_id == "claim-stripe-test"
    assert report.baseline_pass_rate == 1.0
    assert report.failed_stress_scenarios >= 1
    assert report.lucky_pass_count >= 1
    assert report.release_verdict == ReleaseVerdict.HOLD_PENDING_REPAIR
    assert report.delta_pass_probability > 0.0

    network_res = next(
        r for r in report.scenarios
        if r.operator == PerturbationOperator.NETWORK_DISCONNECT_MID_TRANSACTION
    )
    assert not network_res.passed
    assert network_res.lucky_pass_detected
    assert "Duplicate transaction detected" in (network_res.observed_failure_detail or "")


def test_causal_minimal_cut_repairs(stripe_claim: CandidateClaim):
    report = challenge_candidate_claim(stripe_claim)
    assert len(report.minimal_cut_repairs) >= 1
    idempotency_repair = next(
        r for r in report.minimal_cut_repairs
        if r.operator_targeted == PerturbationOperator.NETWORK_DISCONNECT_MID_TRANSACTION
    )
    assert "idempotency_key" in idempotency_repair.recommended_patch


def test_resilient_claim_stress_certified(resilient_claim: CandidateClaim):
    report = challenge_candidate_claim(resilient_claim)
    assert report.release_verdict == ReleaseVerdict.PASS_STRESS_CERTIFIED
    assert report.failed_stress_scenarios == 0
    assert report.lucky_pass_count == 0
    assert report.delta_pass_probability == 0.0
    assert report.confidence_score == 100.0
    assert len(report.minimal_cut_repairs) == 0
    assert report.cryptographic_digest.startswith("spe:csc:sha256:")
    assert report.airgap_execution_guarantee is True
