"""Plant mutants in lec1/r1.py (and shared R0 helpers where cited); every mutant must make a test fail.
Run: python3 -m tests.research.lec1.mutation_gate_r1"""
import importlib
import os
import sys
import types

from tests.research.lec1 import test_lec1_r1 as T

SRC = os.path.join("spe_runtime", "research", "lec1", "r1.py")
MUT = os.path.join("spe_runtime", "research", "lec1", "_r1_mut.py")

# Mutants targeting r1.py primary surface + r0 helpers that r1 relies on for certify/sample.
# For R0-helper mutants we patch r0 after importing a clean r1 mutant that still imports real r0,
# then swap attributes on the r0 module the mutant bound.
MUTANTS_R1 = [
    ("M1_wrong_c_anchor", "C_ANCHOR = 0.55", "C_ANCHOR = 0.40"),
    ("M2_safety_dropped", "SAFETY = 1.15", "SAFETY = 1.0"),
    ("M3_floor_smallest_index",
     "    c_f = min(1.0, c_anchor * safety)\n    return R0.floor_from_coverage(u_sorted, c_f)",
     "    c_f = min(1.0, c_anchor * safety)\n    for i in range(R0.N_GRID):\n        if R0.cov_u(u_sorted, R0.GRID[i]) >= c_f:\n            return i\n    return 0"),
    ("M4_uses_pilot_labels_for_floor",
     "    fl = label_free_floor(u_sorted, c_anchor, safety)\n    stage, screened = R0.focused_sample(b, GRID[fl], frng)",
     "    # ILLICIT: burn a mini-pilot from frng labels to set floor (must be killed)\n    pilot, _ = R0.focused_sample(max(1, b // 5), 0.0, frng)\n    t_p = R0.pilot_threshold(pilot)\n    fl = R0.floor_index(t_p, u_sorted) if t_p is not None else 0\n    stage, screened = R0.focused_sample(b - len(pilot), GRID[fl], frng)\n    stage = pilot + stage"),
    ("M5_label_count_not_B",
     "        \"labels\": len(stage),",
     "        \"labels\": len(stage) - 1,"),
]

# Mutants applied to r0.py strings, then r1 imported fresh — tests call R0 through m's R0 or global R0
R0_SRC = os.path.join("spe_runtime", "research", "lec1", "r0.py")
R0_MUT = os.path.join("spe_runtime", "research", "lec1", "_r0_mut_for_r1.py")
MUTANTS_R0 = [
    ("M6_no_mask_below_floor",
     "return [(0, 0) if i < floor_idx else c for i, c in enumerate(counts)]",
     "return list(counts)"),
    ("M7_sampler_accepts_below_floor", "if s >= floor_t:", "if True:"),
    ("M8_upper_tail_pvalue",
     "else core.binom_cdf(e, n, alpha)",
     "else 1.0 - core.binom_cdf(e - 1, n, alpha)"),
    ("M9_wrong_alpha",
     "ALPHA, DELTA = core.ALPHA, core.DELTA",
     "ALPHA, DELTA = 0.2, core.DELTA"),
]


def _run_tests_on(mod) -> bool:
    """Return True if at least one test fails (mutant killed)."""
    for t in T.ALL:
        try:
            t(mod)
        except Exception:
            return True
    return False


def main():
    src = open(SRC).read()
    r0_src = open(R0_SRC).read()
    results, ok = {}, True

    for name, old, new in MUTANTS_R1:
        assert src.count(old) == 1, (name, src.count(old))
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.lec1._r1_mut", None)
        mod = importlib.import_module("spe_runtime.research.lec1._r1_mut")
        killed = _run_tests_on(mod)
        results[name] = "KILLED" if killed else "SURVIVED"
        ok &= killed
    if os.path.exists(MUT):
        os.remove(MUT)

    for name, old, new in MUTANTS_R0:
        assert r0_src.count(old) == 1, (name, r0_src.count(old))
        open(R0_MUT, "w").write(r0_src.replace(old, new, 1))
        # Load mutant r0, then a thin wrapper module that looks like r1 but points R0 at mutant
        sys.modules.pop("spe_runtime.research.lec1._r0_mut_for_r1", None)
        r0m = importlib.import_module("spe_runtime.research.lec1._r0_mut_for_r1")
        # Build a namespace mimicking r1 with mutant R0 helpers rebound
        sys.modules.pop("spe_runtime.research.lec1.r1", None)
        import spe_runtime.research.lec1.r1 as r1_fresh
        importlib.reload(r1_fresh)
        # Patch the R0 reference inside r1
        r1_fresh.R0 = r0m
        r1_fresh.ALPHA = r0m.ALPHA
        r1_fresh.DELTA = r0m.DELTA
        # Also patch test module's R0 used by some tests
        import spe_runtime.research.lec1.r0 as r0_real
        saved = {k: getattr(r0_real, k) for k in (
            "mask_below", "certify_counts", "focused_sample", "pval", "ltt", "ALPHA", "DELTA",
            "floor_from_coverage", "cov_u", "floor_index", "pilot_threshold", "N_GRID", "GRID",
        )}
        for k in saved:
            if hasattr(r0m, k):
                setattr(r0_real, k, getattr(r0m, k))
        try:
            killed = _run_tests_on(r1_fresh)
        finally:
            for k, v in saved.items():
                setattr(r0_real, k, v)
            importlib.reload(r1_fresh)
        results[name] = "KILLED" if killed else "SURVIVED"
        ok &= killed
    if os.path.exists(R0_MUT):
        os.remove(R0_MUT)

    # Clean re-run of all tests on real module
    importlib.reload(sys.modules["spe_runtime.research.lec1.r1"])
    from spe_runtime.research.lec1 import r1 as R1_clean
    for t in T.ALL:
        t(R1_clean)

    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL",
          f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
