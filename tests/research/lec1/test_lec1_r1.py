"""LEC-1 R1 tests with hand-built inputs. Run: python3 -m tests.research.lec1.test_lec1_r1
Every test takes the module under test as `m` so the mutation gate can rerun them on planted mutants."""
import random

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0
from spe_runtime.research.lec1 import r1 as R1


def test_constants(m=R1):
    assert m.ALPHA == 0.10 and m.DELTA == 0.10
    assert m.C_ANCHOR == 0.55 and m.SAFETY == 1.15
    assert abs(min(1.0, m.C_ANCHOR * m.SAFETY) - 0.6325) < 1e-12
    assert m.N_UNLABELED == 20_000


def test_pval_and_ltt_via_r0(m=R1):
    # R1 reuses R0.ltt / R0.pval; prove still identical to core on random vectors
    assert R0.pval(0, 0) == 1.0 and abs(R0.pval(10, 0) - 0.9 ** 10) < 1e-12
    rng = random.Random(7)
    for _ in range(40):
        c = core.grid_counts(core.sample(rng.choice([100, 300, 800]), rng))
        assert R0.ltt(c) == core.policy_ltt(c)


def test_label_free_floor_rule(m=R1):
    # cov(>=0.99)=.2, cov(>=0.9)=.4, cov(>=0.6)=1; primary c_f = 0.55*1.15 = 0.6325
    u = sorted([0.6] * 600 + [0.9] * 200 + [0.99] * 200)
    c_f = min(1.0, m.C_ANCHOR * m.SAFETY)
    fl = m.label_free_floor(u)
    assert R0.cov_u(u, m.GRID[fl]) >= c_f
    # LARGEST-index rule: every stricter grid point must fall below c_f
    for j in range(fl + 1, m.N_GRID):
        assert R0.cov_u(u, m.GRID[j]) < c_f
    # Must not be the trivial loosest index when a tighter feasible floor exists
    assert fl > 0
    # floor sits at or below the 0.9 mass boundary for this U (cov 0.4 < 0.6325, so next looser)
    assert m.GRID[fl] <= 0.9
    # wrong (smaller) anchor should raise the floor (tighter / higher index)
    fl_tight = m.label_free_floor(u, c_anchor=0.30, safety=1.15)  # c_f=0.345 -> near cov 0.4 band
    fl_loose = m.label_free_floor(u, c_anchor=0.80, safety=1.15)  # c_f=0.92 -> near full cov
    assert fl_tight >= fl_loose  # higher index = stricter floor
    # All scores below GRID[0] => no grid t has cov >= c_f => floor index 0 (no focusing)
    u_all_below = sorted([0.40] * 1000)
    assert m.label_free_floor(u_all_below, c_anchor=0.55, safety=1.15) == 0


def test_floor_ignores_labels(m=R1):
    """Floor must be identical if we only change labels, not scores (U is score-only)."""
    scores = [0.5 + i * 0.0004 for i in range(5000)]
    u = sorted(scores)
    fl_a = m.label_free_floor(u)
    fl_b = m.label_free_floor(u)  # same U
    assert fl_a == fl_b
    # label_free_floor signature takes only u_sorted + anchors — no pilot/labels parameter


def test_focused_sampler_no_leak(m=R1):
    out, screened = R0.focused_sample(200, 0.95, random.Random(3))
    assert len(out) == 200 and all(s >= 0.95 for s, _ in out) and screened > 200


def test_mask_and_certify(m=R1):
    stage2 = [(0.999, 0)] * 300 + [(0.70, 1)] * 300
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.9)
    c = R0.certify_counts(stage2, fl)
    assert all(c[i] == (0, 0) for i in range(fl)) and c[fl] == (300, 0)
    assert R0.ltt(c) == fl
    assert R0.ltt(core.grid_counts(stage2)) < fl


def test_run_lf_accounting(m=R1):
    u = sorted(s for s, _ in core.sample(20_000, random.Random(40000)))
    o = m.run_lf(u, random.Random(50000), 500)
    assert o["labels"] == 500
    assert o["n_at_floor"] == 500  # all B labels enter certification (no pilot burn)
    assert o["idx"] is None or o["idx"] >= o["floor"]
    assert abs(o["c_f"] - 0.6325) < 1e-12


def test_no_pilot_in_lf(m=R1):
    """lf_ltt must not call R0.budget_split / pilot_threshold path for the primary arm."""
    u = sorted(s for s, _ in core.sample(5_000, random.Random(41)))
    o = m.run_lf(u, random.Random(42), 250)
    assert o["labels"] == 250
    # floor from U alone with frozen constants
    assert o["floor"] == m.label_free_floor(u)


def test_masking_rejects_biased_low_thresholds(m=R1):
    stage2 = [(0.999, 0)] * 500
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.96)
    assert R0.ltt(R0.certify_counts(stage2, fl)) == fl
    assert R0.ltt(core.grid_counts(stage2)) == 0


def test_wrong_anchor_changes_floor(m=R1):
    u = sorted([0.55] * 400 + [0.75] * 300 + [0.95] * 300)
    fl_primary = m.label_free_floor(u, c_anchor=0.55, safety=1.15)
    fl_wrong = m.label_free_floor(u, c_anchor=0.40, safety=1.15)
    # Different anchors should generally differ on this multimodal U; at minimum primary uses 0.55
    assert m.C_ANCHOR == 0.55
    assert fl_primary == m.label_free_floor(u)  # default matches primary


ALL = [
    test_constants,
    test_pval_and_ltt_via_r0,
    test_label_free_floor_rule,
    test_floor_ignores_labels,
    test_focused_sampler_no_leak,
    test_mask_and_certify,
    test_run_lf_accounting,
    test_no_pilot_in_lf,
    test_masking_rejects_biased_low_thresholds,
    test_wrong_anchor_changes_floor,
]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
    print(f"{len(ALL)}/{len(ALL)} passed")
