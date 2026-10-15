"""Plant mutants in lec1/r0.py; every mutant must make at least one test fail. Run: python3 -m tests.research.lec1.mutation_gate_r0"""
import importlib
import os
import sys

from tests.research.lec1 import test_lec1_r0 as T

SRC = os.path.join("spe_runtime", "research", "lec1", "r0.py")
MUT = os.path.join("spe_runtime", "research", "lec1", "_r0_mut.py")
MUTANTS = [
    ("M1_no_mask_below_floor", "return [(0, 0) if i < floor_idx else c for i, c in enumerate(counts)]", "return list(counts)"),
    ("M2_pilot_reused_in_test", "counts = certify_counts(stage2, fl)", "counts = certify_counts(pilot + stage2, fl)"),
    ("M3_sampler_accepts_below_floor", "if s >= floor_t:", "if True:"),
    ("M4_safety_dropped", "SAFETY = 1.25", "SAFETY = 1.0"),
    ("M5_upper_tail_pvalue", "else core.binom_cdf(e, n, alpha)", "else 1.0 - core.binom_cdf(e - 1, n, alpha)"),
    ("M6_wrong_alpha", "ALPHA, DELTA = core.ALPHA, core.DELTA", "ALPHA, DELTA = 0.2, core.DELTA"),
    ("M7_floor_smallest_index", "    for i in range(N_GRID - 1, -1, -1):\n        if cov_u(", "    for i in range(N_GRID):\n        if cov_u("),
    ("M8_pilot_frac", "PILOT_FRAC = 0.2", "PILOT_FRAC = 0.3"),
    ("M9_no_stop_at_failure", "            chosen = i\n        else:\n            break", "            chosen = i\n        else:\n            continue"),
    ("M10_pilot_nmin_ignored", "if n >= n_min and e / n <= alpha:", "if n >= 1 and e / n <= alpha:"),
]


def main():
    src = open(SRC).read()
    results, ok = {}, True
    for name, old, new in MUTANTS:
        assert src.count(old) == 1, name
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.lec1._r0_mut", None)
        mod = importlib.import_module("spe_runtime.research.lec1._r0_mut")
        killed = False
        for t in T.ALL:
            try:
                t(mod)
            except Exception:
                killed = True
                break
        results[name] = "KILLED" if killed else "SURVIVED"
        ok &= killed
    os.remove(MUT)
    for t in T.ALL:
        t()
    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL", f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
