"""Plant mutants in lec1/r5.py; every mutant must make a test fail.
Run: python3 -m tests.research.lec1.mutation_gate_r5"""
import importlib
import os
import sys

from tests.research.lec1 import test_lec1_r5 as T

SRC = os.path.join("spe_runtime", "research", "lec1", "r5.py")
MUT = os.path.join("spe_runtime", "research", "lec1", "_r5_mut.py")

MUTANTS = [
    ("M1_increasing_isotonic",
     "        if m_i < m_j - 1e-15:  # violator for non-increasing",
     "        if m_i > m_j + 1e-15:  # MUTANT: increasing"),
    ("M2_fit_on_cert_labels",
     "    global LAST_FIT_N\n    LAST_FIT_N = len(pilot)\n    model = fit_isotonic_nonincreasing(pilot)\n"
     "    fl = learned_floor(u_sorted, model, fl0)\n"
     "    cert, screened2 = R0.focused_sample(b_cert, GRID[fl], frng)\n"
     "    counts = R0.certify_counts(cert, fl)  # cert labels ONLY, masked below learned floor",
     "    cert, screened2 = R0.focused_sample(b_cert, GRID[fl0], frng)\n"
     "    global LAST_FIT_N\n    LAST_FIT_N = len(pilot) + len(cert)\n"
     "    model = fit_isotonic_nonincreasing(pilot + cert)\n"
     "    fl = learned_floor(u_sorted, model, fl0)\n"
     "    counts = R0.certify_counts(cert, fl)  # MUTANT: ĝ saw cert"),
    ("M3_ignore_learned_floor",
     "    fl = learned_floor(u_sorted, model, fl0)\n    cert, screened2 = R0.focused_sample(b_cert, GRID[fl], frng)",
     "    fl = fl0  # MUTANT: ignore learned floor\n    cert, screened2 = R0.focused_sample(b_cert, GRID[fl], frng)"),
    ("M4_wrong_budget_split",
     "    b_fit = int(math.floor(FIT_FRAC * b))",
     "    b_fit = int(math.floor(0.5 * b))  # MUTANT"),
    ("M5_no_mask",
     "    counts = R0.certify_counts(cert, fl)  # cert labels ONLY, masked below learned floor",
     "    counts = core.grid_counts(cert)  # MUTANT: no mask"),
    ("M6_label_count_not_B",
     '        "labels": len(pilot) + len(cert),',
     '        "labels": len(pilot) + len(cert) - 1,'),
    ("M7_wrong_alpha_floor",
     "def learned_floor(u_sorted, model, floor0: int, alpha: float = ALPHA) -> int:",
     "def learned_floor(u_sorted, model, floor0: int, alpha: float = 0.5) -> int:  # MUTANT"),
    ("M8_always_accept",
     '        "idx": R0.ltt(counts),',
     '        "idx": 0,  # MUTANT always accept loosest'),
    ("M9_fit_frac_zero",
     "FIT_FRAC = 0.2",
     "FIT_FRAC = 0.0  # MUTANT"),
    ("M10_predict_reversed",
     "    return gs[i]",
     "    return gs[len(gs) - 1 - i]  # MUTANT reverse"),
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
        assert src.count(old) == 1, (name, src.count(old), old[:120])
        open(MUT, "w").write(src.replace(old, new, 1))
        sys.modules.pop("spe_runtime.research.lec1._r5_mut", None)
        mod = importlib.import_module("spe_runtime.research.lec1._r5_mut")
        k = _killed(mod)
        results[name] = "KILLED" if k else "SURVIVED"
        ok &= k
    if os.path.exists(MUT):
        os.remove(MUT)
    from spe_runtime.research.lec1 import r5 as clean
    importlib.reload(clean)
    for t in T.ALL:
        t(clean)
    print(results)
    print("MUTATION GATE", "PASS" if ok else "FAIL",
          f"{sum(v == 'KILLED' for v in results.values())}/{len(results)} killed")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
