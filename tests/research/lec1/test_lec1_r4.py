"""LEC-1 R4 tests with hand-built inputs. Run: python3 -m tests.research.lec1.test_lec1_r4
Every test takes the module under test as `m` so the mutation gate can rerun them on planted mutants."""
import random

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0
from spe_runtime.research.lec1 import r1 as R1
from spe_runtime.research.lec1 import r2 as R2
from spe_runtime.research.lec1 import r4 as R4


def test_constants(m=R4):
    assert m.ALPHA == 0.10 and m.DELTA == 0.10
    assert m.C_ANCHOR == 0.55 and m.SAFETY == 1.15
    assert m.N_MIN_LABELED == 2 and m.C_TRUNC == 0.5
    assert abs(m.M0 - 0.05) < 1e-12 and abs(m.V0 - 0.09) < 1e-12
    assert m.N_UNLABELED == 20_000


def test_f_pred(m=R4):
    assert abs(m.f_pred(0.8) - 0.2) < 1e-12
    assert m.f_pred(1.5) == 0.0 and m.f_pred(-0.2) == 1.0
    assert abs(m.f_pred(0.3) - 0.7) < 1e-12


def _hand_p(ws, hi, alpha=0.10, c=0.5):
    """Hand-rolled past-only aGRAPA + running max."""
    wealth, best = 1.0, 1.0
    for t in range(1, len(ws) + 1):
        lam = R4.stake(ws[: t - 1], hi, alpha, c)
        wealth *= 1.0 + lam * (alpha - ws[t - 1])
        best = max(best, wealth)
    return min(1.0, 1.0 / best)


def test_stake_predictable_hand_path(m=R4):
    ws = [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0] * 3 + [0.0] * 30
    p = m.bet_pvalue(ws, 1.0)
    assert abs(p - _hand_p(ws, 1.0)) < 1e-9, (p, _hand_p(ws, 1.0))
    ws2 = [0.02, 0.97, 0.01, 0.03, 0.0, 0.04, 0.01, 0.02] * 6
    assert abs(m.bet_pvalue(ws2, 1.03) - _hand_p(ws2, 1.03)) < 1e-9


def test_stake_truncation(m=R4):
    lam = m.stake([0.0] * 50, 1.0)
    assert 0.0 < lam <= m.C_TRUNC / (1.0 - m.ALPHA) + 1e-12
    assert abs(lam - m.C_TRUNC / (1.0 - m.ALPHA)) < 1e-12  # all-safe history hits the cap
    assert m.stake([1.0] * 10, 1.0) == 0.0  # no bet when history looks risky


def test_running_max(m=R4):
    # early safe run grows wealth, late wrongs crash it: running-max p must keep the early evidence
    ws = [0.0] * 60 + [1.0] * 12
    p = m.bet_pvalue(ws, 1.0)
    assert p < 0.1, p
    # and final-wealth p would be much larger
    wealth = 1.0
    for t in range(1, len(ws) + 1):
        wealth *= 1.0 + m.stake(ws[: t - 1], 1.0) * (m.ALPHA - ws[t - 1])
    assert min(1.0, 1.0 / wealth) > p


def test_direction(m=R4):
    assert m.bet_pvalue([0.0] * 120, 1.0) < 0.01
    assert m.bet_pvalue([1.0, 0.0] * 30, 1.0) == 1.0
    assert m.bet_pvalue([0.0], 1.0) == 1.0  # N_MIN gate


def test_ppi_shift_uses_U(m=R4):
    lab = [(0.6, 0)] * 30 + [(0.6, 1)] * 2  # f=0.4 each
    p_low_mu = m.ppi_bet_pvalue(lab, [0.99] * 100)  # mu_f=0.01: W = y - 0.39 → very safe
    p_high_mu = m.ppi_bet_pvalue(lab, [0.4] * 100)  # mu_f=0.6: W = y + 0.2 → unsafe
    assert p_low_mu < 0.1 and p_high_mu == 1.0, (p_low_mu, p_high_mu)


def test_ppi_hi_bound(m=R4):
    # W must never exceed hi = mu_f + 1 so the multiplier stays positive
    lab = [(0.5, 1), (0.999, 1)] * 5
    u = [0.5, 0.999] * 10
    p = m.ppi_bet_pvalue(lab, u)
    assert 0.0 <= p <= 1.0
    mu = m.mu_f_hat(u, lab)
    assert all(y - m.f_pred(s) + mu <= mu + 1.0 + 1e-12 for s, y in lab)


def test_bern_uses_raw_y(m=R4):
    lab = [(0.9, 0)] * 60
    assert abs(m.bern_bet_pvalue(lab) - m.bet_pvalue([0.0] * 60, 1.0)) < 1e-12


def test_acquisition_order_not_sorted(m=R4):
    # risky items at HIGH s first, safe low-s items after: sorting by s would reorder and change p
    stage = [(0.99, 1)] * 6 + [(0.93, 0)] * 120
    u = sorted([0.95] * 100)
    i = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.9)
    p_acq = m._pval_at(stage, u, i, "ppi", m.C_TRUNC, "acq")
    lab = [(s, y) for s, y in stage if s >= m.GRID[i]]
    assert abs(p_acq - m.ppi_bet_pvalue(lab, u[__import__("bisect").bisect_left(u, m.GRID[i]):])) < 1e-12
    p_sorted = m._pval_at(stage, u, i, "ppi", m.C_TRUNC, "sorted")
    assert p_acq != p_sorted, (p_acq, p_sorted)


def test_mask_and_lazy_equals_eager(m=R4):
    stage = [(0.999, 0)] * 150 + [(0.92, 0)] * 100 + [(0.91, 1)] * 20
    u = sorted([0.5] * 1000 + [0.999] * 1000)
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.9)
    pv = m.pvals_bet(stage, u, fl)
    assert all(pv[i] == 1.0 for i in range(fl))
    assert any(pv[i] <= m.DELTA for i in range(fl, m.N_GRID))
    assert m.ltt_lazy(stage, u, fl) == m.ltt_from_pvals(pv)
    for kind in ("ppi", "bern"):
        uu = sorted(s for s, _ in core.sample(3000, random.Random(5)))
        st, _ = R0.focused_sample(300, 0.8, random.Random(6))
        f2 = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.8)
        assert m.ltt_lazy(st, uu, f2, kind) == m.ltt_from_pvals(m.pvals_bet(st, uu, f2, kind))


def test_floor_reuse_and_accounting(m=R4):
    u = sorted(s for s, _ in core.sample(20_000, random.Random(40000)))
    o = m.run_bet(u, random.Random(50000), 500)
    assert o["floor"] == R1.label_free_floor(u, 0.55, 1.15)
    assert o["labels"] == 500 and o["kind"] == "ppi_bet"
    assert o["idx"] is None or o["idx"] >= o["floor"]


def test_imports_baselines(m=R4):
    u = sorted(s for s, _ in core.sample(5_000, random.Random(41)))
    assert R2.run_ppi(u, random.Random(42), 80, lam=1.0, kind="ppi")["labels"] == 80
    assert R1.run_lf(u, random.Random(42), 80)["labels"] == 80


ALL = [test_constants, test_f_pred, test_stake_predictable_hand_path, test_stake_truncation, test_running_max,
       test_direction, test_ppi_shift_uses_U, test_ppi_hi_bound, test_bern_uses_raw_y,
       test_acquisition_order_not_sorted, test_mask_and_lazy_equals_eager, test_floor_reuse_and_accounting,
       test_imports_baselines]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
    print(f"{len(ALL)}/{len(ALL)} passed")
