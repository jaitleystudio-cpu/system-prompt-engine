"""Plant mutants in r2.py source; each must make at least one R2 test fail. Run: python3 -m tests.research.crc1.mutation_gate_r2"""
import importlib.util
import pathlib
import sys

from tests.research.crc1 import test_crc1_r2 as T

SRC = pathlib.Path("spe_runtime/research/crc1/r2.py").read_text()
MUTANTS = {
    "sgr_direction_flipped": ("        if b_i < r_star:\n            z_max = z", "        if b_i >= r_star:\n            z_max = z"),
    "sgr_no_union_bound": ("b_i = bstar(r_i, delta / k, m_t)", "b_i = bstar(r_i, delta, m_t)"),
    "altt_lookahead_bet": ("mu = agrapa(sl[i], sl[i], t_cnt[i], alpha)", "mu = agrapa(sl[i] + w, sl[i] + w, t_cnt[i] + 1, alpha)"),
    "kstar_off_by_one": ("    _KS[key] = lo\n    return lo", "    _KS[key] = lo + 1\n    return lo + 1"),
    # first gate: "planner_no_refusal" survived as an EQUIVALENT mutant (power < target whenever p >= alpha); replaced:
    "planner_uses_normal_approx": ("    res = first if (first", "    first = n_normal(p, alpha, delta, power)\n    res = first if (first"),
    "pilot_tests_on_pilot": ("    n, e = tc[cand]", "    n, e = pc[cand]"),
}


def load(src):
    spec = importlib.util.spec_from_loader("spe_runtime.research.crc1.r2_mut", loader=None)
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = "spe_runtime.research.crc1"
    exec(compile(src, "r2_mut", "exec"), mod.__dict__)
    return mod


killed = 0
for name, (a, b) in MUTANTS.items():
    assert SRC.count(a) == 1, name
    m = load(SRC.replace(a, b))
    dead = False
    for t in T.ALL:
        try:
            t(m)
        except Exception:
            dead = True
            break
    killed += dead
    print(("KILLED " if dead else "SURVIVED ") + name)
print(f"{killed}/{len(MUTANTS)} killed")
sys.exit(0 if killed == len(MUTANTS) else 1)
