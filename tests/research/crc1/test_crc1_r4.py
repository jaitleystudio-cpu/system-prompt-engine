"""CRC-1 R4 tests (hand-computed). Run: python3 -m tests.research.crc1.test_crc1_r4
Each test takes module m so mutation_gate_r4 can reuse it."""
import json
import random

from spe_runtime.research.crc1 import core
from spe_runtime.research.crc1 import r2 as R2
from spe_runtime.research.crc1 import r4 as R4


def obs(groups):
    out = []
    for s, n, w in groups:
        out += [(s, 1)] * w + [(s, 0)] * (n - w)
    return out


def test_frozen_margin_constants(m=R4):
    assert m.MARGIN_M == 0.05
    assert m.ORACLE_TARGET == 0.05
    assert m.ORACLE_COVERAGE_AM == 0.183753
    assert m.N_NEEDED_AM == 116
    assert m.KS_P == 0.01
    assert m.ALPHA == 0.10


def test_margin_scan_matches_contract(m=R4):
    pop = R2.Pop(core.sample(400_000, random.Random(999)))
    block = m.frozen_margin_block(pop)
    assert block["chosen_m"] == 0.05
    assert block["feasibility_fail"] is False
    assert block["match_contract"] is True
    # largest qualifier is 0.05; 0.01 and 0.02 must fail
    by_m = {r["m"]: r for r in block["scan"]}
    assert by_m[0.01]["qualify"] is False and by_m[0.02]["qualify"] is False
    assert by_m[0.03]["qualify"] and by_m[0.04]["qualify"] and by_m[0.05]["qualify"]
    assert by_m[0.05]["n_needed"] == 116
    assert abs(by_m[0.05]["coverage"] - 0.183753) < 1e-6


def test_policy_shiftgate_a10(m=R4):
    cal = obs([(0.999, 200, 0), (0.7, 300, 30)])
    i0 = m.policy_ltt(core.grid_counts(cal), 0.10)
    assert i0 is not None
    same = [s for s, _ in cal]
    assert m.policy_shiftgate_a10(cal, same) == (i0, False)
    assert m.policy_shiftgate_a10(cal, [0.55] * 500) == (None, True)
    bad = obs([(0.999, 200, 100)])
    assert m.policy_shiftgate_a10(bad, [0.55] * 200) == (None, False)


def test_alpha_path(m=R4):
    d = obs([(0.999, 100, 5)])  # p(0.10)=0.0576 pass; p(0.08)=0.1799 fail
    c = core.grid_counts(d)
    assert m.policy_ltt(c, 0.10) == 0 and m.policy_ltt(c, 0.08) is None


def test_oracle_idx(m=R4):
    pop = core.grid_counts(obs([(0.999, 100, 5), (0.9, 100, 13), (0.6, 100, 60)]))
    i5, i10 = m.oracle_idx(pop, 0.05), m.oracle_idx(pop, 0.10)
    assert core.GRID[i5] > 0.9 and core.GRID[i5 - 1] <= 0.9
    assert core.GRID[i10] > 0.6 and core.GRID[i10 - 1] <= 0.6


def test_violation_uses_arm_alpha(m=R4):
    pop = R2.Pop(obs([(0.999, 1000, 90)]))  # risk 0.09 everywhere
    out = m.run_cond(pop, 500, range(6), 1.2)
    a10, a08 = out["ltt_r0_a10"], out["ltt_r0_a08"]
    assert a10["violations"] == 0
    assert a08["violations"] == 6 - a08["abstain_all"] and a08["abstain_all"] < 6
    assert abs(out["oracle"]["0.05"]["coverage"] - 0.0) < 1e-12 or out["oracle"]["0.05"]["coverage"] == 0.0
    # risk 0.09 > 0.05 -> no oracle at 0.05; coverage 0
    assert out["oracle"]["0.05"]["coverage"] == 0.0
    assert out["oracle"]["0.10"]["coverage"] == 1.0


def test_h2_uses_oracle_am(m=R4):
    """Coverage ratio must divide by oracle(α−m), not oracle(0.10)."""
    pop = R2.Pop(obs([(0.999, 500, 10), (0.5, 500, 200)]))  # high-score risk 0.02, overall mixed
    out = m.run_cond(pop, 200, range(8), 1.2)
    a10 = out["ltt_r0_a10"]
    o_am = out["oracle"]["0.05"]["coverage"]
    o10 = out["oracle"]["0.10"]["coverage"]
    assert o_am > 0 and o10 > 0
    assert abs(a10["cov_x_oracle_am"] - a10["mean_coverage"] / o_am) < 1e-5
    # if oracles differ, ratios must differ (guards against accidentally using 0.10 denom)
    if abs(o_am - o10) > 1e-6:
        assert abs(a10["cov_x_oracle_am"] - a10["cov_x_oracle_010"]) > 1e-6


def test_boot_and_paired(m=R4):
    lb, ub = m.boot_ratio([0.4] * 50, 0.5)
    assert abs(lb - 0.8) < 1e-9 and abs(ub - 0.8) < 1e-9
    p = m.paired([1.0, 2.0, 3.0], [0.0, 1.0, 2.0])
    assert p["mean"] == 1.0 and p["lb95_1s"] == 1.0


def _fake(cp_hi, cp_lo, ratio, lb, ub, g_hi, g_lo, g_ab, x010=0.5):
    a10 = {
        "cp95": [cp_lo, cp_hi],
        "cov_x_oracle_am": ratio,
        "boot_x_oracle_am": [lb, ub],
        "mean_coverage": 0.3,
        "cov_x_oracle_010": x010,
        "violation_rate": 0.05,
    }
    g = {"cp95": [g_lo, g_hi], "abstain_rate": g_ab}
    base = {"ltt_r0_a10": a10}
    return base, {"ltt_r0_a10": a10, "ltt_r0_a10_shiftgate": g}


def test_verdicts(m=R4):
    v = m.verdicts(*_fake(0.08, 0.04, 0.9, 0.87, 0.93, 0.01, 0.0, 0.95))
    assert v["overall"] == "SUPPORTED" and v["H3"]["beats_previous_best"]
    assert v["H1_validity_a10"] == "SUPPORTED" and v["H2_planner_margin_coverage"] == "SUPPORTED"
    v = m.verdicts(*_fake(0.12, 0.06, 0.9, 0.87, 0.93, 0.01, 0.0, 0.95))
    assert v["H1_validity_a10"] == "NOT_PROVEN" and v["H2_planner_margin_coverage"] == "NOT_PROVEN"
    assert v["overall"] == "NOT_PROVEN"
    v = m.verdicts(*_fake(0.08, 0.04, 0.6, 0.55, 0.65, 0.01, 0.0, 0.95))
    assert v["H2_planner_margin_coverage"] == "REFUTED" and not v["H3"]["beats_previous_best"]
    v = m.verdicts(*_fake(0.08, 0.04, 0.9, 0.87, 0.93, 0.01, 0.0, 0.85))
    assert v["H4_shift_gate"] == "NOT_PROVEN"
    v = m.verdicts(*_fake(0.2, 0.15, 0.9, 0.87, 0.93, 0.01, 0.0, 0.95))
    assert v["H1_validity_a10"] == "REFUTED" and v["overall"] == "REFUTED"
    # H2 REFUTED by UB < 0.85 even if point ratio high-ish
    v = m.verdicts(*_fake(0.08, 0.04, 0.84, 0.80, 0.84, 0.01, 0.0, 0.95))
    assert v["H2_planner_margin_coverage"] == "REFUTED"


def test_gate_reuses_r3_ks(m=R4):
    a = [i / 500 for i in range(500)]
    assert m.shift_gate(a, [x + 0.5 for x in a]) is True
    assert m.shift_gate(a, list(a)) is False
    assert m.KS_P == 0.01


def test_deterministic(m=R4):
    pop = R2.Pop(core.sample(20_000, random.Random(999)))
    a = json.dumps(m.run_cond(pop, 200, range(4), 0.6), sort_keys=True)
    b = json.dumps(m.run_cond(pop, 200, range(4), 0.6), sort_keys=True)
    assert a == b


ALL = [
    test_frozen_margin_constants,
    test_margin_scan_matches_contract,
    test_policy_shiftgate_a10,
    test_alpha_path,
    test_oracle_idx,
    test_violation_uses_arm_alpha,
    test_h2_uses_oracle_am,
    test_boot_and_paired,
    test_verdicts,
    test_gate_reuses_r3_ks,
    test_deterministic,
]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
