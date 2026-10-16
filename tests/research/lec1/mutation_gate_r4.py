"""Plant mutants in lec1/r4.py; every mutant must make a test fail.
Run: python3 -m tests.research.lec1.mutation_gate_r4"""
import importlib
import os
import sys

from tests.research.lec1 import test_lec1_r4 as T

SRC = os.path.join("spe_runtime", "research", "lec1", "r4.py")
MUT = os.path.join("spe_runtime", "research", "lec1", "_r4_mut.py")

MUTANTS = [
    ("M1_wrong_f_pred_uses_s", "return min(1.0, max(0.0, 1.0 - s))", "return min(1.0, max(0.0, s))"),
    ("M2_p_equals_wealth_inverted", "    return min(1.0, 1.0 / best)", "    return min(1.0, best)"),
    ("M3_stake_peeks_current_w", "        m_hat = (M0 + s1) / t\n", "        m_hat = (M0 + s1 + w) / (t + 1)\n"),
    ("M4_no_truncation", "        lam = min(max(lam, 0.0), lam_max)\n        wealth", "        lam = max(lam, 0.0)\n        wealth"),
    ("M5_mu_f_ignored", "    mu_f = mu_f_hat(u_scores, labeled)\n    ws =", "    mu_f = 0.0\n    ws ="),
    ("M6_sorted_by_s", "    lab = [(s, y) for s, y in stage if s >= t]  # acquisition order preserved",
     "    lab = sorted((s, y) for s, y in stage if s >= t)"),
    ("M7_wrong_alpha", "ALPHA, DELTA = R0.ALPHA, R0.DELTA", "ALPHA, DELTA = 0.2, R0.DELTA"),
    ("M8_no_mask_eager", "    for i in range(floor_idx, N_GRID):\n        pvals[i]", "    for i in range(0, N_GRID):\n        pvals[i]"),
    ("M8b_no_mask_lazy", "        if i < floor_idx:\n            break  # masked p = 1 > delta",
     "        if False:\n            break"),
    ("M9_label_count_not_B", "        \"labels\": len(stage),", "        \"labels\": len(stage) - 1,"),
    ("M10_always_accept_mean_below", "    return min(1.0, 1.0 / best)", "    return 0.0 if sum(ws) / n < alpha else 1.0"),
]


def _killed(mod) -> bool:
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
        assert src.count(old) == 1, (name, src.count(old))
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.lec1._r4_mut", None)
        mod = importlib.import_module("spe_runtime.research.lec1._r4_mut")
        k = _killed(mod)
        results[name] = "KILLED" if k else "SURVIVED"
        ok &= k
    if os.path.exists(MUT):
        os.remove(MUT)
    from spe_runtime.research.lec1 import r4 as clean
    for t in T.ALL:
        t(clean)
    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL", f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
