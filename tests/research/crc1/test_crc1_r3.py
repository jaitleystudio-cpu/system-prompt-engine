"""CRC-1 R3 tests (hand-computed). Run: python3 -m tests.research.crc1.test_crc1_r3
Each test takes module m so mutation_gate_r3 can reuse it. Count vectors are built from explicit observations."""
import json

from spe_runtime.research.crc1 import core
from spe_runtime.research.crc1 import r2 as R2
from spe_runtime.research.crc1 import r3 as R3


def obs(groups):
    out = []
    for s, n, w in groups:
        out += [(s, 1)] * w + [(s, 0)] * (n - w)
    return out


def test_q_ks(m=R3):
    for lam, p in [(1.3581, 0.05), (1.6276, 0.01), (1.2238, 0.10)]:  # Kolmogorov critical values
        assert abs(m.q_ks(lam) - p) < 2e-4
    assert m.q_ks(0.0) == 1.0


def test_ks_stat(m=R3):
    assert m.ks_stat([1, 2, 3], [4, 5, 6]) == 1.0
    assert m.ks_stat([4, 5, 6], [1, 2, 3]) == 1.0             # two-sided
    assert m.ks_stat([1, 3], [2, 4]) == 0.5
    assert m.ks_stat([1, 2, 3, 4], [1, 2, 3, 4]) == 0.0
    assert abs(m.ks_stat([1, 2, 3, 4], [1, 2, 3, 4, 5, 6, 7, 8]) - 0.5) < 1e-12


def test_ks_pvalue_hand(m=R3):
    a = list(range(100))
    b = list(range(20, 120))                                  # D = 0.2, Ne = 50 -> lambda 1.44132, p ~ 0.031377
    assert abs(m.ks_stat(a, b) - 0.2) < 1e-9
    assert abs(m.ks_pvalue(a, b) - 0.0313767) < 1e-5
    assert m.ks_pvalue(a, a) == 1.0


def test_gate_direction(m=R3):
    a = [i / 500 for i in range(500)]
    assert m.shift_gate(a, [x + 0.5 for x in a]) is True        # clear shift -> fire
    assert m.shift_gate(a, list(a)) is False                    # no shift -> no fire
    b = list(range(100))
    c = list(range(20, 120))                                    # p = 0.0314: fires at 0.05, not at the declared 0.01
    assert m.shift_gate(b, c) is False and m.shift_gate(b, c, p_thresh=0.05) is True
    assert m.KS_P == 0.01


def test_alpha_path(m=R3):
    d = obs([(0.999, 100, 5)])                                  # p(0.10)=0.0576 pass; p(0.08)=0.1799 fail
    c = core.grid_counts(d)
    assert m.policy_ltt(c, 0.10) == 0 and m.policy_ltt(c, 0.08) is None
    c4 = core.grid_counts(obs([(0.999, 100, 4)]))               # p(0.08)=0.0903 pass
    assert m.policy_ltt(c4, 0.08) == 0
    assert m.ALPHA_FEAS == 0.08


def test_oracle_idx(m=R3):
    pop = core.grid_counts(obs([(0.999, 100, 5), (0.9, 100, 13), (0.6, 100, 60)]))
    # t<=0.6: 78/300=.26; 0.6<t<=0.9: 18/200=.09; t>0.9: .05
    i8, i10, i6 = m.oracle_idx(pop, 0.08), m.oracle_idx(pop, 0.10), m.oracle_idx(pop, 0.04)
    assert core.GRID[i8] > 0.9 and core.GRID[i8 - 1] <= 0.9
    assert core.GRID[i10] > 0.6 and core.GRID[i10 - 1] <= 0.6
    assert i6 is None


def test_policy_shiftgate(m=R3):
    cal = obs([(0.999, 200, 0), (0.7, 300, 30)])
    i0 = m.policy_ltt(core.grid_counts(cal), 0.08)
    assert i0 is not None
    same = [s for s, _ in cal]
    assert m.policy_shiftgate(cal, same) == (i0, False)
    assert m.policy_shiftgate(cal, [0.55] * 500) == (None, True)
    bad = obs([(0.999, 200, 100)])                              # LTT abstains -> gate not consulted
    assert m.policy_shiftgate(bad, [0.55] * 200) == (None, False)


def test_violation_uses_arm_alpha(m=R3):
    pop = R2.Pop(obs([(0.999, 1000, 90)]))                       # risk 0.09 at every threshold
    out = m.run_cond(pop, 500, range(6), 1.2)
    a08, a10 = out["ltt_r0_a08"], out["ltt_r0_a10"]
    assert a08["violations"] == 6 - a08["abstain_all"] and a08["abstain_all"] < 6
    assert a10["violations"] == 0
    assert out["oracle"]["0.08"]["coverage"] == 0.0 and out["oracle"]["0.10"]["coverage"] == 1.0


def test_boot_and_paired(m=R3):
    lb, ub = m.boot_ratio([0.4] * 50, 0.5)
    assert abs(lb - 0.8) < 1e-9 and abs(ub - 0.8) < 1e-9
    p = m.paired([1.0, 2.0, 3.0], [0.0, 1.0, 2.0])
    assert p["mean"] == 1.0 and p["lb95_1s"] == 1.0


def _fake(cp_hi, cp_lo, ratio, lb, ub, g_hi, g_lo, g_ab):
    a = {"cp95": [cp_lo, cp_hi], "cov_x_oracle_008": ratio, "boot_x_oracle_008": [lb, ub], "mean_coverage": 0.3,
         "violation_rate": 0.2}
    a10 = {"mean_coverage": 0.4, "cov_x_oracle_010": 0.5}
    g = {"cp95": [g_lo, g_hi], "abstain_rate": g_ab}
    base = {"ltt_r0_a08": a, "ltt_r0_a10": a10, "paired_a08_minus_a10": {}}
    return base, {"ltt_r0_a08": a, "ltt_r0_a08_shiftgate": g}


def test_verdicts(m=R3):
    v = m.verdicts(*_fake(0.08, 0.04, 0.9, 0.87, 0.93, 0.01, 0.0, 0.95))
    assert v["overall"] == "SUPPORTED" and v["H3"]["beats_previous_best"]
    v = m.verdicts(*_fake(0.12, 0.06, 0.9, 0.87, 0.93, 0.01, 0.0, 0.95))  # H1 not proven -> H2 cannot be SUPPORTED
    assert v["H1_validity_a08"] == "NOT_PROVEN" and v["H2_feasible_coverage"] == "NOT_PROVEN" and v["overall"] == "NOT_PROVEN"
    v = m.verdicts(*_fake(0.08, 0.04, 0.6, 0.55, 0.65, 0.01, 0.0, 0.95))
    assert v["H2_feasible_coverage"] == "REFUTED" and not v["H3"]["beats_previous_best"]
    v = m.verdicts(*_fake(0.08, 0.04, 0.9, 0.87, 0.93, 0.01, 0.0, 0.85))  # gate abstains < 0.90
    assert v["H4_shift_gate"] == "NOT_PROVEN"
    v = m.verdicts(*_fake(0.2, 0.15, 0.9, 0.87, 0.93, 0.01, 0.0, 0.95))
    assert v["H1_validity_a08"] == "REFUTED" and v["overall"] == "REFUTED"


def test_deterministic(m=R3):
    pop = R2.Pop(core.sample(20_000, __import__("random").Random(999)))
    a = json.dumps(m.run_cond(pop, 200, range(4), 0.6), sort_keys=True)
    b = json.dumps(m.run_cond(pop, 200, range(4), 0.6), sort_keys=True)
    assert a == b


ALL = [test_q_ks, test_ks_stat, test_ks_pvalue_hand, test_gate_direction, test_alpha_path, test_oracle_idx,
       test_policy_shiftgate, test_violation_uses_arm_alpha, test_boot_and_paired, test_verdicts, test_deterministic]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
