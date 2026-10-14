"""CRC-1 R2 tests. Every count vector is built from explicit (s, wrong) observations (nested by construction).
Run: python3 -m tests.research.crc1.test_crc1_r2   (each test takes module m so the mutation gate can reuse it)"""
import math

from spe_runtime.research.crc1 import core
from spe_runtime.research.crc1 import r2 as R2
from tests.research.crc1 import test_crc1_r1 as T1


def obs(groups):
    """groups: list of (score, n_items, n_wrong) -> observation list."""
    out = []
    for s, n, w in groups:
        out += [(s, 1)] * w + [(s, 0)] * (n - w)
    return out


def test_nesting_checker(m=R2):
    assert not m.is_nested(T1._ltt_vec())          # R1 hand vector is NOT from nested observations
    c = core.grid_counts(obs([(0.999, 100, 0), (0.9, 200, 10), (0.6, 200, 120)]))
    assert m.is_nested(c)
    assert not m.is_nested([(10, 2), (12, 2)]) and not m.is_nested([(10, 5), (9, 1)])


def test_kstar(m=R2):
    assert m.kstar(21) == -1 and m.kstar(22) == 0      # 0.9^21 = .1094 > .1, 0.9^22 = .0985
    assert m.kstar(10) == -1
    k = m.kstar(500)
    assert m.cdf(k, 500, .1) <= .1 < m.cdf(k + 1, 500, .1)


def test_cdf_large(m=R2):
    for k, n, p in [(500, 6000, .09), (40, 500, .1), (130, 1200, .1)]:
        assert abs(m.cdf(k, n, p) - core.binom_cdf(k, n, p)) < 1e-9


def test_bstar(m=R2):
    assert abs(m.bstar(0.0, 0.05, 2) - (1 - math.sqrt(0.05))) < 1e-9
    assert abs(m.bstar(0.0, 0.05, 1) - 0.95) < 1e-9
    b = m.bstar(0.1, 0.1, 10)                         # (1-b)^10 + 10 b (1-b)^9 = 0.1
    assert abs((1 - b) ** 10 + 10 * b * (1 - b) ** 9 - 0.1) < 1e-9 and abs(b - 0.3368) < 1e-3


def test_sgr_hand(m=R2):
    d = [(0.1, 1), (0.2, 0), (0.3, 0), (0.4, 0)]       # m=4 -> k=2
    tr = m.sgr_trace(d, r_star=0.1, delta=0.1)
    assert [t for t, _ in tr] == [0.3, 0.4]
    assert abs(tr[0][1] - (1 - math.sqrt(0.05))) < 1e-9 and abs(tr[1][1] - 0.95) < 1e-9
    assert m.policy_sgr_faithful(d) is None
    tr = m.sgr_trace(d, r_star=0.9, delta=0.1)
    assert [t for t, _ in tr] == [0.3, 0.2]
    assert abs(tr[1][1] - (1 - 0.05 ** (1 / 3))) < 1e-9
    assert m.policy_sgr_faithful(d, alpha=0.9) == 0.2
    assert m.policy_sgr_best(d, alpha=0.9) == 0.2
    # m=500, k=9: z = 251,126,64,95,111,103,99,101,100 -> last iterate theta=0.6 FAILS, so faithful Alg.1
    # output (theta_k, b_k) has b_k >= r* and SPE abstains; sgr_best keeps the passing 0.99 iterate.
    big = obs([(0.99, 400, 0), (0.6, 100, 100)])
    assert [t for t, _ in m.sgr_trace(big)][-1] == 0.6
    assert m.policy_sgr_faithful(big) is None and m.policy_sgr_best(big) == 0.99


def test_altt_hand(m=R2):
    p = m.altt_pvalues([(0.999, 0)] * 6)
    mhat = 0.5 / 6
    v = (0.25 + 5 * mhat ** 2) / 6
    mu = (0.1 - mhat) / (v + (0.1 - mhat) ** 2)
    assert abs(p[199] - 1 / (1 + mu * 0.1)) < 1e-12
    assert all(abs(x - 1.0) < 1e-12 for x in m.altt_pvalues([(0.999, 0)] * 5))  # no bet until m_hat < alpha
    assert m.policy_altt([(0.999, 1)] * 300) is None
    assert m.policy_altt(obs([(0.999, 400, 0)])) is not None


def test_planner(m=R2):
    n = m.n_needed(0.05)
    assert all(m.power_exact(x, 0.05) >= 0.8 for x in range(n, n + 21))
    assert m.power_exact(n - 1, 0.05) < 0.8
    assert m.n_needed(0.10) is None and m.n_needed(0.12) is None
    assert m.n_needed(0.098, budget=500) is None
    assert m.n_normal(0.05) < n                       # normal approx undershoots here


def test_pilot_split(m=R2):
    good = [(0.99, 0)] * 1000
    assert m.policy_pilot_split(good) is not None
    assert m.policy_pilot_split([(0.99, 1)] * 1000) is None
    # added after first mutation gate: clean pilot, dirty test split -> the decision must come from the test split
    assert m.policy_pilot_split([(0.99, 0)] * 300 + [(0.99, 1)] * 700) is None


ALL = [test_nesting_checker, test_kstar, test_cdf_large, test_bstar, test_sgr_hand, test_altt_hand, test_planner, test_pilot_split]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
