"""Plant mutants in lec1/r3.py; every mutant must make a test fail.
Run: python3 -m tests.research.lec1.mutation_gate_r3"""
import importlib
import os
import sys

from tests.research.lec1 import test_lec1_r3 as T

SRC = os.path.join("spe_runtime", "research", "lec1", "r3.py")
MUT = os.path.join("spe_runtime", "research", "lec1", "_r3_mut.py")

MUTANTS = [
    ("M1_wrong_f_pred_uses_s",
     "return min(1.0, max(0.0, 1.0 - s))",
     "return min(1.0, max(0.0, s))"),
    ("M2_p_equals_wealth_inverted",
     "    return min(1.0, 1.0 / wealth)",
     "    return min(1.0, wealth)  # ILLICIT: invert Ville"),
    ("M3_lambda_peeks_future",
     "        if t == 1:\n            lam = lam_max / 2.0\n        else:\n            m_hat = sum_x / (t - 1)\n            denom = max(mu0 * (1.0 - mu0), EPS_MU)\n            lam = (mu0 - m_hat) / denom\n            lam = min(max(lam, 0.0), lam_max)",
     "        # ILLICIT: peek at current x for stake\n        m_incl = (sum_x + x) / t\n        denom = max(mu0 * (1.0 - mu0), EPS_MU)\n        lam = (mu0 - m_incl) / denom\n        lam = min(max(lam, 0.0), lam_max)"),
    ("M4_always_accept_when_mean_below",
     "    return min(1.0, 1.0 / wealth)",
     "    mean_x = sum((z + 1.0) / 2.0 for z in zs) / len(zs)\n    return 0.0 if mean_x < mu0 else 1.0  # ILLICIT: no capital"),
    ("M5_wrong_alpha",
     "ALPHA, DELTA = R0.ALPHA, R0.DELTA",
     "ALPHA, DELTA = 0.2, R0.DELTA"),
    ("M6_mu_f_ignored",
     "    mu_f = mu_f_hat(u_scores, labeled)\n    theta = alpha - mu_f",
     "    mu_f = 0.0  # ILLICIT: ignore U\n    theta = alpha - mu_f"),
    ("M7_floor_uses_labels",
     "def run_wsr(u_sorted, frng: random.Random, b: int):\n    \"\"\"All B labels above label-free floor; certify with WSR-PPI LTT.\"\"\"\n    fl = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)\n    stage, screened = R0.focused_sample(b, GRID[fl], frng)",
     "def run_wsr(u_sorted, frng: random.Random, b: int):\n    \"\"\"All B labels above label-free floor; certify with WSR-PPI LTT.\"\"\"\n    # ILLICIT pilot-from-labels floor\n    pilot, _ = R0.focused_sample(max(1, b // 5), 0.0, frng)\n    t_p = R0.pilot_threshold(pilot)\n    fl = R0.floor_index(t_p, u_sorted) if t_p is not None else 0\n    stage, screened = R0.focused_sample(b - len(pilot), GRID[fl], frng)\n    stage = pilot + stage"),
    ("M8_label_count_not_B",
     "        \"labels\": len(stage),  # primary B accounting",
     "        \"labels\": len(stage) - 1,  # primary B accounting"),
    ("M9_no_mask_below_floor",
     "    pvals = [1.0] * N_GRID\n    stage_sorted = sorted(stage)  # by s ascending\n    for i in range(floor_idx, N_GRID):",
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
        assert count == 1, (name, count, repr(old[:120]))
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.lec1._r3_mut", None)
        mod = importlib.import_module("spe_runtime.research.lec1._r3_mut")
        killed = _run_tests_on(mod)
        results[name] = "KILLED" if killed else "SURVIVED"
        ok &= killed
    if os.path.exists(MUT):
        os.remove(MUT)

    importlib.reload(sys.modules["spe_runtime.research.lec1.r3"])
    from spe_runtime.research.lec1 import r3 as R3_clean
    for t in T.ALL:
        t(R3_clean)

    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL",
          f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
