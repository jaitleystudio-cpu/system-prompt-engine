"""LEC-1 R2 tests with hand-built inputs. Run: python3 -m tests.research.lec1.test_lec1_r2
Every test takes the module under test as `m` so the mutation gate can rerun them on planted mutants."""
import math
import random

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0
from spe_runtime.research.lec1 import r1 as R1
from spe_runtime.research.lec1 import r2 as R2


def test_constants(m=R2):
    assert m.ALPHA == 0.10 and m.DELTA == 0.10
    assert m.C_ANCHOR == 0.55 and m.SAFETY == 1.15
    assert m.LAMBDA == 1.0  # classical PPI; not data-tuned in primary
    assert m.N_MIN_LABELED == 2
    assert m.N_UNLABELED == 20_000
    assert abs(min(1.0, m.C_ANCHOR * m.SAFETY) - 0.6325) < 1e-12


def test_f_pred(m=R2):
    assert abs(m.f_pred(0.8) - 0.2) < 1e-12
    assert m.f_pred(0.0) == 1.0
    assert m.f_pred(1.0) == 0.0
    assert m.f_pred(1.5) == 0.0  # clipped
    assert m.f_pred(-0.2) == 1.0  # clipped
    # Must be 1-s, NOT s
    assert abs(m.f_pred(0.3) - 0.7) < 1e-12
    assert abs(m.f_pred(0.3) - 0.3) > 0.1


def test_ppi_estimate_toy(m=R2):
    # Perfect predictor case-ish: y ≈ 1-s
    labeled = [(0.9, 0), (0.9, 0), (0.8, 0), (0.7, 1), (0.95, 0), (0.85, 0)]
    u = [0.9, 0.85, 0.8, 0.75, 0.95, 0.7, 0.88, 0.92]
    rhat, se, n, N = m.ppi_estimate(labeled, u, lam=1.0)
    assert n == 6 and N == 8
    assert se is not None and se >= m.SE_FLOOR
    # Classical mean of y on labeled
    mean_y = sum(y for _, y in labeled) / len(labeled)
    # PPI should be finite and in a reasonable band
    assert -0.5 <= rhat <= 1.5
    # λ=0 reduces toward labeled mean (exactly mean_Y when λ=0)
    r0, se0, _, _ = m.ppi_estimate(labeled, u, lam=0.0)
    assert abs(r0 - mean_y) < 1e-12


def test_ppi_pvalue_direction(m=R2):
    # Very safe labeled set: all correct, high scores → R̂ << α → small p
    safe = [(0.99, 0)] * 40
    u = [0.99] * 200
    p_safe = m.ppi_pvalue(safe, u)
    # Dangerous: half wrong at moderate scores
    bad = [(0.6, 1), (0.6, 0)] * 30
    u_bad = [0.6] * 200
    p_bad = m.ppi_pvalue(bad, u_bad)
    assert p_safe < 0.05, p_safe
    assert p_bad > p_safe
    # N_MIN gate
    assert m.ppi_pvalue([(0.9, 0)], u) == 1.0


def test_lambda_frozen_primary(m=R2):
    assert m.LAMBDA == 1.0
    u = sorted(s for s, _ in core.sample(5_000, random.Random(41)))
    o = m.run_ppi(u, random.Random(42), 100, lam=m.LAMBDA, kind="ppi")
    assert o["lam"] == 1.0
    assert o["kind"] == "ppi"
    assert o["labels"] == 100


def test_floor_reuses_r1(m=R2):
    u = sorted(s for s, _ in core.sample(20_000, random.Random(40000)))
    assert m.C_ANCHOR == R1.C_ANCHOR and m.SAFETY == R1.SAFETY
    fl_r2 = R1.label_free_floor(u, m.C_ANCHOR, m.SAFETY)
    o = m.run_ppi(u, random.Random(50000), 50)
    assert o["floor"] == fl_r2
    assert abs(o["c_f"] - 0.6325) < 1e-12


def test_mask_below_floor_in_pvals(m=R2):
    stage = [(0.999, 0)] * 50
    u = sorted([0.5] * 1000 + [0.999] * 1000)
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.9)
    pvals = m.pvals_ppi(stage, u, fl, lam=1.0, kind="ppi")
    assert all(pvals[i] == 1.0 for i in range(fl))
    # Above floor with all-correct high scores, some p should be small
    assert any(pvals[i] < 0.5 for i in range(fl, m.N_GRID))


def test_run_ppi_accounting(m=R2):
    u = sorted(s for s, _ in core.sample(20_000, random.Random(40000)))
    o = m.run_ppi(u, random.Random(50000), 500)
    assert o["labels"] == 500
    assert o["idx"] is None or o["idx"] >= o["floor"]
    assert o["lam"] == 1.0


def test_hoeff_separated_from_ppi(m=R2):
    """E3 Hoeffding path must not be the primary kind."""
    labeled = [(0.95, 0)] * 30 + [(0.9, 1)] * 5
    u = [0.92] * 500
    p_ppi = m.ppi_pvalue(labeled, u)
    p_h = m.hoeff_rect_pvalue(labeled, u)
    # Both valid probabilities
    assert 0.0 <= p_ppi <= 1.0 and 0.0 <= p_h <= 1.0
    # Primary run_ppi defaults to kind=ppi
    u2 = sorted(s for s, _ in core.sample(3_000, random.Random(9)))
    o = m.run_ppi(u2, random.Random(10), 80)
    assert o["kind"] == "ppi"


def test_ltt_from_pvals_sequence(m=R2):
    # All p=0 → accept loosest (0)
    assert m.ltt_from_pvals([0.0] * m.N_GRID) == 0
    # All p=1 → abstain
    assert m.ltt_from_pvals([1.0] * m.N_GRID) is None
    # Only strict half pass
    p = [1.0] * 100 + [0.01] * 100
    idx = m.ltt_from_pvals(p)
    assert idx == 100  # loosest accepted among the passing suffix... wait
    # Fixed sequence: start at 199, accept while p<=δ, stop at first failure.
    # Indices 100..199 have p=0.01 → accepted; index 99 has p=1 → stop.
    # Loosest accepted = 100.
    assert idx == 100


def test_focused_sampler_no_leak(m=R2):
    out, screened = R0.focused_sample(200, 0.95, random.Random(3))
    assert len(out) == 200 and all(s >= 0.95 for s, _ in out) and screened > 200


def test_ppipp_uses_split(m=R2):
    u = sorted(s for s, _ in core.sample(8_000, random.Random(11)))
    o = m.run_ppipp(u, random.Random(12), 100)
    assert o["kind"] == "ppipp"
    assert o["labels"] == 100
    assert o["lam"] in m.PPIPP_LAMBDA_GRID

def test_ppi_uses_unlabeled(m=R2):
    """PPI with λ=1 must move when U\'s f-mean differs from L\'s; labels-only mean must not."""
    # Labeled: all y=0, s=0.5 → f=0.5; mean_Y=0
    labeled = [(0.5, 0)] * 20
    # Unlabeled all high confidence s=0.99 → f=0.01 → μ̂_f small
    u_high = [0.99] * 500
    # Unlabeled all low confidence s=0.1 → f=0.9 → μ̂_f large
    u_low = [0.1] * 500
    r_high, _, _, _ = m.ppi_estimate(labeled, u_high, lam=1.0)
    r_low, _, _, _ = m.ppi_estimate(labeled, u_low, lam=1.0)
    mean_y = 0.0
    # Classical PPI: R̂ = μ̂_f + mean(Y-f) = μ̂_f + (0 - 0.5) = μ̂_f - 0.5
    assert abs(r_high - (0.01 - 0.5)) < 0.02, r_high
    assert abs(r_low - (0.9 - 0.5)) < 0.02, r_low
    assert r_low > r_high + 0.5  # U must matter
    assert abs(r_high - mean_y) > 0.3  # not equal to labels-only mean


def test_pvalue_uses_se(m=R2):
    """R̂ slightly below α with huge SE must NOT yield near-zero p (CLT Φ uses SE)."""
    # All-correct but scores vary; small n → R̂≈0.05 < α yet SE large → Φ((R̂-α)/SE) ~ 0.4
    labeled = [(0.9, 0), (0.2, 0), (0.9, 0), (0.2, 0)]
    u = [0.5] * 5
    rhat, se, n, N = m.ppi_estimate(labeled, u, lam=1.0)
    assert rhat is not None and rhat < m.ALPHA and se > 0.1, (rhat, se)
    p = m.ppi_pvalue(labeled, u)
    # Mutant M6 returns 0.0 whenever rhat < α; honest CLT p is far from 0
    assert p > 0.05, (rhat, se, p)
    # Safe tiny-SE case still small p
    safe = [(0.99, 0)] * 80
    u_safe = [0.99] * 5000
    assert m.ppi_pvalue(safe, u_safe) < 0.01


ALL = [
    test_constants,
    test_f_pred,
    test_ppi_estimate_toy,
    test_ppi_pvalue_direction,
    test_lambda_frozen_primary,
    test_floor_reuses_r1,
    test_mask_below_floor_in_pvals,
    test_run_ppi_accounting,
    test_hoeff_separated_from_ppi,
    test_ltt_from_pvals_sequence,
    test_focused_sampler_no_leak,
    test_ppipp_uses_split,
    test_ppi_uses_unlabeled,
    test_pvalue_uses_se,
]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
    print(f"{len(ALL)}/{len(ALL)} passed")
