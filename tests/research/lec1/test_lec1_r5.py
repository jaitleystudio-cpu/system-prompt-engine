"""LEC-1 R5 tests with hand-built inputs. Run: python3 -m tests.research.lec1.test_lec1_r5
Every test takes the module under test as `m` so the mutation gate can rerun them on planted mutants."""
import math
import random

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0
from spe_runtime.research.lec1 import r1 as R1
from spe_runtime.research.lec1 import r5 as R5


def test_constants(m=R5):
    assert m.ALPHA == 0.10 and m.DELTA == 0.10
    assert m.C_ANCHOR == 0.55 and m.SAFETY == 1.15
    assert abs(m.FIT_FRAC - 0.2) < 1e-12
    assert m.N_UNLABELED == 20_000
    assert m.budget_split(500) == (100, 400)
    assert m.budget_split(250) == (50, 200)
    assert m.budget_split(1000) == (200, 800)


def test_isotonic_nonincreasing(m=R5):
    lab = [(0.5, 1)] * 20 + [(0.7, 1)] * 5 + [(0.7, 0)] * 15 + [(0.9, 0)] * 30
    xs, gs = m.fit_isotonic_nonincreasing(lab)
    assert xs == sorted(xs)
    assert all(gs[i] >= gs[i + 1] - 1e-12 for i in range(len(gs) - 1)), gs
    assert m.predict_isotonic((xs, gs), 0.4) >= m.predict_isotonic((xs, gs), 0.95) - 1e-12
    assert m.fit_isotonic_nonincreasing([]) == ([], [])
    xs1, gs1 = m.fit_isotonic_nonincreasing([(0.8, 1)])
    assert xs1 == [0.8] and abs(gs1[0] - 1.0) < 1e-12


def test_isotonic_recovers_monotone_means(m=R5):
    lab = [(0.55, 1)] * 40 + [(0.75, 0)] * 20 + [(0.75, 1)] * 20 + [(0.95, 0)] * 40
    xs, gs = m.fit_isotonic_nonincreasing(lab)
    assert abs(gs[0] - 1.0) < 1e-9
    assert abs(gs[1] - 0.5) < 1e-9
    assert abs(gs[2] - 0.0) < 1e-9


def test_pava_kills_increasing_wiggle(m=R5):
    lab = [(0.6, 0)] * 10 + [(0.7, 1)] * 10 + [(0.8, 0)] * 10
    xs, gs = m.fit_isotonic_nonincreasing(lab)
    assert all(gs[i] >= gs[i + 1] - 1e-12 for i in range(len(gs) - 1))


def test_predict_step_interior(m=R5):
    model = ([0.5, 0.7, 0.9], [0.8, 0.4, 0.1])
    assert abs(m.predict_isotonic(model, 0.6) - 0.8) < 1e-12
    assert abs(m.predict_isotonic(model, 0.7) - 0.4) < 1e-12
    assert abs(m.predict_isotonic(model, 0.85) - 0.4) < 1e-12
    assert abs(m.predict_isotonic(model, 0.9) - 0.1) < 1e-12
    assert abs(m.predict_isotonic(model, 0.99) - 0.1) < 1e-12


def test_learned_floor_uses_U_only(m=R5):
    model = ([0.6, 0.9], [0.05, 0.01])
    u = sorted([0.55] * 100 + [0.7] * 100 + [0.95] * 100)
    fl0 = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.6)
    fl = m.learned_floor(u, model, fl0, alpha=0.10)
    assert fl >= fl0
    model_bad = ([0.6, 0.9], [0.5, 0.4])
    assert m.learned_floor(u, model_bad, fl0, alpha=0.10) == fl0


def test_learned_floor_alpha_tenth(m=R5):
    """Default alpha must be 0.10: mean ĝ≈0.15 raises under α=0.5 but not under α=0.10."""
    model = ([0.6, 0.99], [0.20, 0.15])
    u = sorted([0.7] * 200 + [0.95] * 200)
    fl0 = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.65)
    fl_default = m.learned_floor(u, model, fl0)  # must use ALPHA=0.10
    assert fl_default == fl0, fl_default
    fl_loose = m.learned_floor(u, model, fl0, alpha=0.5)
    assert fl_loose > fl0


def test_fit_only_pilot_size(m=R5):
    """ĝ must be fit on exactly B_FIT pilot labels (not cert)."""
    u = sorted(s for s, _ in core.sample(5_000, random.Random(7)))
    for b in (100, 250, 500):
        b_fit, _ = m.budget_split(b)
        m.run_cif(u, random.Random(99 + b), b)
        assert m.LAST_FIT_N == b_fit, (b, m.LAST_FIT_N, b_fit)


def test_cert_uses_learned_floor(m=R5):
    """run_cif floor must equal learned_floor(U, ĝ(pilot), f0); cert stream starts at that floor."""
    u = sorted(s for s, _ in core.sample(8_000, random.Random(11)))
    seed = 12345
    frng = random.Random(seed)
    fl0 = R1.label_free_floor(u)
    b_fit, b_cert = m.budget_split(200)
    pilot, _ = R0.focused_sample(b_fit, m.GRID[fl0], frng)
    model = m.fit_isotonic_nonincreasing(pilot)
    fl_expected = m.learned_floor(u, model, fl0)
    o = m.run_cif(u, random.Random(seed), 200)
    assert o["floor0"] == fl0
    assert o["floor"] == fl_expected, (o["floor"], fl_expected, fl0)
    assert o["labels"] == 200
    assert o["b_fit"] == b_fit and o["b_cert"] == b_cert
    assert o["idx"] is None or o["idx"] >= o["floor"]


def test_mask_below_learned_floor(m=R5):
    stage = [(0.99, 0)] * 50 + [(0.55, 1)] * 50
    fl = next(i for i in range(m.N_GRID) if m.GRID[i] >= 0.9)
    counts = R0.certify_counts(stage, fl)
    assert all(counts[i] == (0, 0) for i in range(fl))
    assert counts[fl][0] > 0


def test_label_accounting(m=R5):
    u = sorted(s for s, _ in core.sample(8_000, random.Random(40001)))
    for b in (250, 500, 1000):
        o = m.run_cif(u, random.Random(50001), b)
        assert o["labels"] == b
        assert o["b_fit"] + o["b_cert"] == b
        assert o["b_fit"] == int(math.floor(0.2 * b))


def test_ltt_direction_via_cif(m=R5):
    u = sorted([0.99] * 2000 + [0.5] * 2000)
    fl0 = R1.label_free_floor(u)
    model = ([0.7, 0.99], [0.02, 0.01])
    fl = m.learned_floor(u, model, fl0)
    cert = [(0.995, 0)] * 80
    idx = R0.ltt(R0.certify_counts(cert, fl))
    assert idx is not None and idx >= fl


def test_imports_lf_baseline(m=R5):
    u = sorted(s for s, _ in core.sample(3_000, random.Random(41)))
    assert R1.run_lf(u, random.Random(42), 80)["labels"] == 80
    assert m.run_cif(u, random.Random(42), 80)["labels"] == 80


ALL = [
    test_constants,
    test_isotonic_nonincreasing,
    test_isotonic_recovers_monotone_means,
    test_pava_kills_increasing_wiggle,
    test_predict_step_interior,
    test_learned_floor_uses_U_only,
    test_learned_floor_alpha_tenth,
    test_fit_only_pilot_size,
    test_cert_uses_learned_floor,
    test_mask_below_learned_floor,
    test_label_accounting,
    test_ltt_direction_via_cif,
    test_imports_lf_baseline,
]

if __name__ == "__main__":
    for t in ALL:
        t()
        print("PASS", t.__name__)
    print(f"{len(ALL)}/{len(ALL)} passed")
