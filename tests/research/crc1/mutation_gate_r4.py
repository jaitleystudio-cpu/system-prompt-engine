"""Plant mutants in r4.py source; each must make at least one R4 test fail. Run: python3 -m tests.research.crc1.mutation_gate_r4"""
import importlib.util
import pathlib
import sys

from tests.research.crc1 import test_crc1_r4 as T

SRC = pathlib.Path("spe_runtime/research/crc1/r4.py").read_text()
MUTANTS = {
    "margin_wrong_m": ("MARGIN_M = 0.05", "MARGIN_M = 0.02"),
    "h2_denom_oracle010": (
        'ratio, (lb, ub) = a10["cov_x_oracle_am"], a10["boot_x_oracle_am"]',
        'ratio, (lb, ub) = a10["cov_x_oracle_010"], a10["boot_x_oracle_010"]',
    ),
    "h2_ignores_h1": (
        'if h1 == "SUPPORTED" and ratio >= 0.85 and lb >= 0.85:',
        "if ratio >= 0.85 and lb >= 0.85:",
    ),
    "gate_direction_flipped": (
        "return R3.shift_gate(cal_scores, deploy_scores, p_thresh)",
        "return not R3.shift_gate(cal_scores, deploy_scores, p_thresh)",
    ),
    "gate_skipped": (
        "    if shift_gate([s for s, _ in cal_data], deploy_scores, p_thresh):",
        "    if False and shift_gate([s for s, _ in cal_data], deploy_scores, p_thresh):",
    ),
    "alpha_ignored": (
        "return R3.policy_ltt(counts, alpha, delta)",
        "return R3.policy_ltt(counts, ALPHA, delta)",
    ),
    "violation_wrong_target": (
        "v = sum(1 for rk, _, _, aa in rs if rk > aa)",
        "v = sum(1 for rk, _, _, aa in rs if rk > 0.08)",
    ),
    "h3_requires_x010": (
        '"beats_previous_best": h2 == "SUPPORTED",  # H3 := H2 per contract (same selector; honest endpoint)',
        '"beats_previous_best": h2 == "SUPPORTED" and a10["cov_x_oracle_010"] >= 0.85,',
    ),
    "ks_threshold_005": ("KS_P = R3.KS_P  # 0.01; do not retune", "KS_P = 0.05  # retuned"),
    "n_needed_wrong": ("N_NEEDED_AM = 116", "N_NEEDED_AM = 964"),
}


def load(src):
    spec = importlib.util.spec_from_loader("spe_runtime.research.crc1.r4_mut", loader=None)
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = "spe_runtime.research.crc1"
    exec(compile(src, "r4_mut", "exec"), mod.__dict__)
    return mod


killed = 0
for name, (a, b) in MUTANTS.items():
    assert SRC.count(a) == 1, f"{name}: count={SRC.count(a)}"
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
