"""LEC-1 R0 tests with hand-built inputs. Run: python3 -m tests.research.lec1.test_lec1_r0
Every test takes the module under test as `m` so the mutation gate can rerun them on planted mutants."""
import random

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0


def test_constants(m=R0):
    assert m.ALPHA == 0.10 and m.DELTA == 0.10
    assert m.budget_split(500) == (100, 400) and m.budget_split(250) == (50, 200) and m.budget_split(1000) == (200, 800)
    assert m.SAFETY == 1.25 and m.PILOT_NMIN == 20 and m.N_UNLABELED == 20_000


def test_pval_and_ltt_match_core(m=R0):
    assert m.pval(0, 0) == 1.0 and abs(m.pval(10, 0) - 0.9 ** 10) < 1e-12
    rng = random.Random(7)
    for _ in range(40):
        c = core.grid_counts(core.sample(rng.choice([100, 300, 800]), rng))
        assert m.ltt(c) == core.policy_ltt(c)


def test_pilot_threshold(m=R0):
    # 30 items at s=0.99 with 2 wrong (risk .067), 30 at s=0.70 all wrong.
    pilot = [(0.99, 1)] * 2 + [(0.99, 0)] * 28 + [(0.70, 1)] * 30
    i = m.pilot_threshold(pilot)
    assert m.GRID[i] > 0.70 and m.GRID[i - 1] <= 0.70  # loosest t that excludes the bad block
    assert m.pilot_threshold([(0.99, 0)] * 19) is None  # n_t < 20 everywhere
    assert m.pilot_threshold([(0.99, 1)] * 50) is None


def test_floor_rule(m=R0):
    u = sorted([0.6] * 600 + [0.9] * 200 + [0.99] * 200)  # cov(>=0.99)=.2, cov(>=0.9)=.4, cov(>=0.6)=1
    t_p = next(i for i in range(m.N_GRID) if m.GRID[i] > 0.95)  # cov_U = 0.2
    fl = m.floor_index(t_p, u)  # c_f = 0.25 -> largest index with cov >= .25 is last grid t <= 0.9
    assert m.GRID[fl] <= 0.9 and m.GRID[fl + 1] > 0.9
    assert m.floor_index(None, u) == 0
    assert m.floor_index(t_p, u, safety=1.0) > fl  # without safety factor the floor sits higher
    assert m.floor_from_coverage(u, 0.2) == m.N_GRID - 1 or m.GRID[m.floor_from_coverage(u, 0.2)] > 0.9


def test_focused_sampler(m=R0):
    out, screened = m.focused_sample(200, 0.95, random.Random(3))
    assert len(out) == 200 and all(s >= 0.95 for s, _ in out) and screened > 200


def test_mask_and_certify(m=R0):
    stage2 = [(0.999, 0)] * 300 + [(0.70, 1)] * 300
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.9)
    c = m.certify_counts(stage2, fl)
    assert all(c[i] == (0, 0) for i in range(fl)) and c[fl] == (300, 0)
    assert m.ltt(c) == fl  # stops exactly at the floor
    assert m.ltt(core.grid_counts(stage2)) < fl  # unmasked would certify below the floor from biased counts


def test_run_pf_accounting(m=R0):
    stream = core.sample(500, random.Random(30000))
    u = sorted(s for s, _ in core.sample(20_000, random.Random(40000)))
    o = m.run_pf(stream, u, random.Random(50000), 500)
    assert o["labels"] == 500
    assert o["n_at_floor"] == 400  # certification uses the 400 stage-2 labels only, never the pilot
    assert o["idx"] is None or o["idx"] >= o["floor"]


def test_masking_rejects_biased_low_thresholds(m=R0):
    # all stage-2 labels correct above floor => without masking LTT would wander to index 0
    stage2 = [(0.999, 0)] * 400
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.96)
    assert m.ltt(m.certify_counts(stage2, fl)) == fl
    assert m.ltt(core.grid_counts(stage2)) == 0


ALL = [test_constants, test_pval_and_ltt_match_core, test_pilot_threshold, test_floor_rule, test_focused_sampler,
       test_mask_and_certify, test_run_pf_accounting, test_masking_rejects_biased_low_thresholds]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
    print(f"{len(ALL)}/{len(ALL)} passed")
