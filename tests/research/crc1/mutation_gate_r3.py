"""Plant mutants in r3.py source; each must make at least one R3 test fail. Run: python3 -m tests.research.crc1.mutation_gate_r3"""
import importlib.util
import pathlib
import sys

from tests.research.crc1 import test_crc1_r3 as T

SRC = pathlib.Path("spe_runtime/research/crc1/r3.py").read_text()
MUTANTS = {
    "gate_direction_flipped": ("return ks_pvalue(cal_scores, deploy_scores) < p_thresh", "return ks_pvalue(cal_scores, deploy_scores) > p_thresh"),
    "gate_skipped": ("    if shift_gate([s for s, _ in cal_data]", "    if False and shift_gate([s for s, _ in cal_data]"),
    "ks_wrong_effective_n": ("ne = len(a) * len(b) / (len(a) + len(b))", "ne = len(a) + len(b)"),
    "ks_one_sided": ("d = max(d, abs(i / na - j / nb))", "d = max(d, i / na - j / nb)"),
    "alpha_ignored": ("return core.policy_ltt(counts, alpha=alpha, delta=delta)", "return core.policy_ltt(counts, delta=delta)"),
    "oracle_const_alpha": ("if n >= 1 and e / n <= r:", "if n >= 1 and e / n <= core.ALPHA:"),
    "violation_wrong_target": ("v = sum(1 for rk, _, _, aa in rs if rk > aa)", "v = sum(1 for rk, _, _, aa in rs if rk > ALPHA_PREV)"),
    "h2_ignores_h1": ('if h1 == "SUPPORTED" and ratio >= 0.85 and lb >= 0.85:', "if ratio >= 0.85 and lb >= 0.85:"),
    "gate_threshold_005": ("KS_P = 0.01", "KS_P = 0.05"),
}


def load(src):
    spec = importlib.util.spec_from_loader("spe_runtime.research.crc1.r3_mut", loader=None)
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = "spe_runtime.research.crc1"
    exec(compile(src, "r3_mut", "exec"), mod.__dict__)
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
