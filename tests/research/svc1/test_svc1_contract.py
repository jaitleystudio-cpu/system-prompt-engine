"""Unit tests for SVC-1 (no outcome peeking)."""
from spe_runtime.research.svc1.verifiers import make_claims, verify, TIER_COST
from spe_runtime.research.svc1.policies import always_v2, spe_svc
from spe_runtime.research.svc1.experiment import BUDGET


def test_claim_counts_and_mix():
    claims = make_claims(200)
    assert len(claims) == 200
    assert sum(1 for c in claims if c.item_id < 40) == 40
    assert sum(1 for c in claims if c.item_id >= 40) == 160
    easy = sum(1 for c in claims if c.difficulty == "easy")
    hard = sum(1 for c in claims if c.difficulty == "hard")
    assert 60 <= easy <= 100
    assert 20 <= hard <= 60


def test_matched_noise_deterministic():
    c = make_claims(1)[0]
    a = verify(c, "V1", seed=3)
    b = verify(c, "V1", seed=3)
    assert a == b


def test_budget_respected():
    claims = make_claims(200)
    holdout = [c for c in claims if c.item_id >= 40]
    r = always_v2(holdout, seed=0, budget=BUDGET)
    assert r.cost_used <= BUDGET
    assert r.cost_used % TIER_COST["V2"] == 0


def test_spe_svc_budget():
    claims = make_claims(200)
    calib = [c for c in claims if c.item_id < 40]
    holdout = [c for c in claims if c.item_id >= 40]
    r, tau = spe_svc(calib, holdout, seed=1, budget=BUDGET)
    assert 0.5 <= tau <= 0.9
    assert r.cost_used <= BUDGET
