"""Plant mutants in r1.py; every mutant must make at least one R1 test fail. Run: python3 -m tests.research.crc1.mutation_gate_r1"""
import importlib
import os
import sys

from tests.research.crc1 import test_crc1_r1 as T

SRC = os.path.join("spe_runtime", "research", "crc1", "r1.py")
MUT = os.path.join("spe_runtime", "research", "crc1", "_r1_mut.py")
MUTANTS = [
    ("M1_upper_tail_pvalue", "else core.binom_cdf(e, n, alpha)", "else 1.0 - core.binom_cdf(e - 1, n, alpha)"),
    ("M2_no_stop_at_failure", "            chosen = i\n        else:\n            break", "            chosen = i\n        else:\n            continue"),
    ("M3_start_ignores_nmin", "if counts[i][0] >= n_min:", "if True:"),
    ("M4_sgr_no_bonferroni", "<= delta / k:", "<= delta:"),
    ("M5_ltt_picks_strictest", "            chosen = i\n", "            chosen = i if chosen is None else chosen\n"),
    ("M6_bonf_picks_strictest", "return min(ok) if ok", "return max(ok) if ok"),
    ("M7_wrong_alpha", "ALPHA, DELTA = core.ALPHA, core.DELTA", "ALPHA, DELTA = 0.2, core.DELTA"),
    ("M8_sgr_wrong_direction", "best, hi = mid, mid - 1", "best, lo = mid, mid + 1"),
]


def main():
    src = open(SRC).read()
    results, ok = {}, True
    for name, old, new in MUTANTS:
        assert src.count(old) >= 1, name
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.crc1._r1_mut", None)
        mod = importlib.import_module("spe_runtime.research.crc1._r1_mut")
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
        t()  # original must pass
    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL", f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
