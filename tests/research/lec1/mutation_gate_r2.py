"""Plant mutants in lec1/r2.py; every mutant must make a test fail.
Run: python3 -m tests.research.lec1.mutation_gate_r2"""
import importlib
import os
import sys

from tests.research.lec1 import test_lec1_r2 as T

SRC = os.path.join("spe_runtime", "research", "lec1", "r2.py")
MUT = os.path.join("spe_runtime", "research", "lec1", "_r2_mut.py")

MUTANTS = [
    ("M1_wrong_f_pred_uses_s",
     "return min(1.0, max(0.0, 1.0 - s))",
     "return min(1.0, max(0.0, s))"),
    ("M2_lambda_not_one",
     "LAMBDA = 1.0            # classical PPI; not data-tuned in primary",
     "LAMBDA = 0.0            # ILLICIT: labels-only"),
    ("M3_labels_only_mean_ignores_U",
     "    rhat = lam * mu_f + sum(rect) / n",
     "    rhat = sum(ys) / n  # ILLICIT: ignore unlabeled"),
    ("M4_upper_tail_phi",
     "    return _norm_cdf((rhat - alpha) / se)",
     "    return 1.0 - _norm_cdf((rhat - alpha) / se)"),
    ("M5_wrong_alpha",
     "ALPHA, DELTA = R0.ALPHA, R0.DELTA",
     "ALPHA, DELTA = 0.2, R0.DELTA"),
    ("M6_se_ignored_always_accept_low",
     "    return _norm_cdf((rhat - alpha) / se)",
     "    return 0.0 if rhat < alpha else 1.0"),
    ("M7_floor_uses_labels",
     "def run_ppi(u_sorted, frng: random.Random, b: int, lam: float = LAMBDA, kind: str = \"ppi\"):\n    \"\"\"All B labels above label-free floor; certify with PPI (or hoeff) LTT.\"\"\"\n    fl = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)\n    stage, screened = R0.focused_sample(b, GRID[fl], frng)",
     "def run_ppi(u_sorted, frng: random.Random, b: int, lam: float = LAMBDA, kind: str = \"ppi\"):\n    \"\"\"All B labels above label-free floor; certify with PPI (or hoeff) LTT.\"\"\"\n    # ILLICIT pilot-from-labels floor\n    pilot, _ = R0.focused_sample(max(1, b // 5), 0.0, frng)\n    t_p = R0.pilot_threshold(pilot)\n    fl = R0.floor_index(t_p, u_sorted) if t_p is not None else 0\n    stage, screened = R0.focused_sample(b - len(pilot), GRID[fl], frng)\n    stage = pilot + stage"),
    ("M8_label_count_not_B",
     "        \"labels\": len(stage),  # primary B accounting",
     "        \"labels\": len(stage) - 1,  # primary B accounting"),
    ("M9_no_mask_below_floor",
     "    pvals = [1.0] * N_GRID\n    # Pre-sort for efficient suffix selection\n    stage_sorted = sorted(stage)  # by s ascending\n    for i in range(floor_idx, N_GRID):",
     "    pvals = [1.0] * N_GRID\n    stage_sorted = sorted(stage)\n    for i in range(0, N_GRID):  # ILLICIT: no floor mask"),
]


def _run_tests_on(mod) -> bool:
    for t in T.ALL:
        try:
            t(mod)
        except Exception:
            return True
    return False


def main():
    src = open(SRC).read()
    results, ok = {}, True
    for name, old, new in MUTANTS:
        count = src.count(old)
        assert count == 1, (name, count, repr(old[:80]))
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.lec1._r2_mut", None)
        mod = importlib.import_module("spe_runtime.research.lec1._r2_mut")
        killed = _run_tests_on(mod)
        results[name] = "KILLED" if killed else "SURVIVED"
        ok &= killed
    if os.path.exists(MUT):
        os.remove(MUT)

    # Clean re-run on real module
    importlib.reload(sys.modules["spe_runtime.research.lec1.r2"])
    from spe_runtime.research.lec1 import r2 as R2_clean
    for t in T.ALL:
        t(R2_clean)

    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL",
          f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
