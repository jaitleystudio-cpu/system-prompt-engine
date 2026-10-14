"""CRC-1 R4 per docs/crc1/CONTRACT_R4.md: planner-margin oracle endpoint (certify α=0.10, judge vs oracle(α−m)).
Pure Python, deterministic. Usage: python3 -m spe_runtime.research.crc1.r4 OUTDIR"""
from __future__ import annotations

import json
import math
import random
import sys

from . import core
from . import r2 as R2
from . import r3 as R3

GRID = core.GRID
N_POP = 400_000
ALPHA = 0.10
ALPHA_DESC = 0.08
DELTA = 0.10
KS_P = R3.KS_P  # 0.01; do not retune
# Frozen in CONTRACT_R4.md from Pop(Random(999)) before any calibration draws:
MARGIN_M = 0.05
ORACLE_TARGET = ALPHA - MARGIN_M  # 0.05
ORACLE_COVERAGE_AM = 0.183753  # frozen denominator for H2
ORACLE_RISK_AM = 0.043782
N_NEEDED_AM = 116
ORACLE_COVERAGE_010 = 0.438528  # continuity with R0/R3
CAL_SEED, DEP_SEED, BOOT_SEED, BOOT_B = 40_000, 60_000, 31_337, 2000
ORACLE_RS = (0.05, 0.06, 0.07, 0.08, 0.09, 0.10)


# ---------------------------------------------------------------- policies (reuse R3)
def policy_ltt(counts, alpha, delta=DELTA):
    return R3.policy_ltt(counts, alpha, delta)


def oracle_idx(pop_grid, r):
    return R3.oracle_idx(pop_grid, r)


def shift_gate(cal_scores, deploy_scores, p_thresh=KS_P):
    return R3.shift_gate(cal_scores, deploy_scores, p_thresh)


def policy_shiftgate_a10(cal_data, deploy_scores, alpha=ALPHA, delta=DELTA, p_thresh=KS_P):
    """R0 LTT at α=0.10 + R3 KS gate. Returns (grid index or None, gate_fired)."""
    idx = policy_ltt(core.grid_counts(cal_data), alpha, delta)
    if idx is None:
        return None, False
    if shift_gate([s for s, _ in cal_data], deploy_scores, p_thresh):
        return None, True
    return idx, False


# ---------------------------------------------------------------- stats
def mean(x):
    return sum(x) / len(x)


def paired(a, b):
    return R3.paired(a, b)


def boot_ratio(cov, denom, b=BOOT_B, seed=BOOT_SEED):
    return R3.boot_ratio(cov, denom, b=b, seed=seed)


# ---------------------------------------------------------------- experiment
ARMS = (("ltt_r0_a10", ALPHA), ("ltt_r0_a08", ALPHA_DESC), ("ltt_r0_a10_shiftgate", ALPHA))


def run_cond(pop, n_cal, draws, deploy_z_mu):
    oracle = {}
    for r in ORACLE_RS:
        o = oracle_idx(pop.grid, r)
        risk, cov = pop.at(None if o is None else GRID[o])
        oracle[f"{r:.2f}"] = {
            "t": None if o is None else round(GRID[o], 4),
            "risk": round(risk, 6),
            "coverage": round(cov, 6),
        }
    rows = {a: [] for a, _ in ARMS}
    fired, a10_nonabstain = 0, 0
    for k in draws:
        cal = core.sample(n_cal, random.Random(CAL_SEED + k))
        dep_scores = [s for s, _ in core.sample(n_cal, random.Random(DEP_SEED + k), z_mu=deploy_z_mu)]
        counts = core.grid_counts(cal)
        i10 = policy_ltt(counts, ALPHA)
        th10 = None if i10 is None else GRID[i10]
        rk, cv = pop.at(th10)
        rows["ltt_r0_a10"].append((rk, cv, th10 is None, ALPHA))
        i08 = policy_ltt(counts, ALPHA_DESC)
        th08 = None if i08 is None else GRID[i08]
        rk8, cv8 = pop.at(th08)
        rows["ltt_r0_a08"].append((rk8, cv8, th08 is None, ALPHA_DESC))
        i, f = policy_shiftgate_a10(cal, dep_scores)
        fired += f
        a10_nonabstain += rows["ltt_r0_a10"][-1][2] is False
        th = None if i is None else GRID[i]
        rk, cv = pop.at(th)
        rows["ltt_r0_a10_shiftgate"].append((rk, cv, th is None, ALPHA))
    out = {
        "n_cal": n_cal,
        "draws": len(draws),
        "deploy_z_mu": deploy_z_mu,
        "oracle": oracle,
        "gate_fired": fired,
        "a10_nonabstain": a10_nonabstain,
        "gate_fire_rate_given_nonabstain": round(fired / a10_nonabstain, 6) if a10_nonabstain else None,
    }
    o_am = oracle[f"{ORACLE_TARGET:.2f}"]["coverage"]
    o10 = oracle["0.10"]["coverage"]
    for name, a in ARMS:
        rs = rows[name]
        v = sum(1 for rk, _, _, aa in rs if rk > aa)
        lo, hi = core.clopper_pearson(v, len(rs))
        cov = [c for _, c, _, _ in rs]
        ab = sum(1 for _, _, x, _ in rs if x)
        alo, ahi = core.clopper_pearson(ab, len(rs))
        out[name] = {
            "alpha": a,
            "violations": v,
            "violation_rate": round(v / len(rs), 6),
            "cp95": [round(lo, 6), round(hi, 6)],
            "mean_coverage": round(mean(cov), 6),
            "mean_risk": round(mean([r for r, _, _, _ in rs]), 6),
            "abstain_all": ab,
            "abstain_rate": round(ab / len(rs), 6),
            "abstain_cp95": [round(alo, 6), round(ahi, 6)],
            "cov_x_oracle_am": round(mean(cov) / o_am, 6) if o_am else None,
            "cov_x_oracle_010": round(mean(cov) / o10, 6) if o10 else None,
            "boot_x_oracle_am": list(boot_ratio(cov, o_am)) if o_am else None,
            "boot_x_oracle_010": list(boot_ratio(cov, o10)) if o10 else None,
        }
    c = {a: [x[1] for x in rows[a]] for a, _ in ARMS}
    out["paired_gate_minus_a10"] = paired(c["ltt_r0_a10_shiftgate"], c["ltt_r0_a10"])
    return out


def verdicts(base, shift):
    a10 = base["ltt_r0_a10"]
    h1 = "SUPPORTED" if a10["cp95"][1] <= DELTA else ("REFUTED" if a10["cp95"][0] > DELTA else "NOT_PROVEN")
    ratio, (lb, ub) = a10["cov_x_oracle_am"], a10["boot_x_oracle_am"]
    if h1 == "SUPPORTED" and ratio >= 0.85 and lb >= 0.85:
        h2 = "SUPPORTED"
    elif ub < 0.85:
        h2 = "REFUTED"
    else:
        h2 = "NOT_PROVEN"
    h3 = {
        "raw_cov_a10": a10["mean_coverage"],
        "a10_x_oracle_am": ratio,
        "a10_x_oracle_010": a10["cov_x_oracle_010"],
        "previous_best_x_oracle_010": 0.48,
        "h2_supported": h2 == "SUPPORTED",
        "beats_previous_best": h2 == "SUPPORTED",  # H3 := H2 per contract (same selector; honest endpoint)
        "note": "same R0 selector; H3 does not claim coverage improved over R0 vs oracle(0.10)",
    }
    g = shift["ltt_r0_a10_shiftgate"]
    if g["cp95"][1] <= DELTA and g["abstain_rate"] >= 0.90:
        h4 = "SUPPORTED"
    elif g["cp95"][0] > DELTA:
        h4 = "REFUTED"
    else:
        h4 = "NOT_PROVEN"
    overall = (
        "SUPPORTED"
        if (h1, h2, h4) == ("SUPPORTED",) * 3
        else ("REFUTED" if h1 == "REFUTED" else "NOT_PROVEN")
    )
    return {
        "H1_validity_a10": h1,
        "H2_planner_margin_coverage": h2,
        "H3": h3,
        "H4_shift_gate": h4,
        "H4_descriptive_a10_shift_violation": shift["ltt_r0_a10"]["violation_rate"],
        "overall": overall,
    }


def frozen_margin_block(pop):
    """Recompute margin scan for evidence; must match CONTRACT_R4 frozen numbers."""
    rows = []
    for m in (0.01, 0.02, 0.03, 0.04, 0.05):
        target = ALPHA - m
        o = oracle_idx(pop.grid, target)
        risk, cov = pop.at(None if o is None else GRID[o])
        need = R2.n_needed(risk, alpha=ALPHA)
        rows.append({
            "m": m,
            "target": target,
            "risk": round(risk, 6),
            "coverage": round(cov, 6),
            "n_needed": need,
            "qualify": need is not None and need <= 500,
            "t": None if o is None else round(GRID[o], 4),
        })
    quals = [r for r in rows if r["qualify"]]
    chosen = max(quals, key=lambda r: r["m"]) if quals else {"m": 0.05, "feasibility_fail": True}
    return {
        "scan": rows,
        "chosen_m": chosen["m"] if isinstance(chosen, dict) and "m" in chosen else 0.05,
        "feasibility_fail": not bool(quals),
        "contract_m": MARGIN_M,
        "contract_oracle_coverage_am": ORACLE_COVERAGE_AM,
        "contract_n_needed": N_NEEDED_AM,
        "contract_oracle_risk_am": ORACLE_RISK_AM,
        "match_contract": (
            abs(chosen.get("coverage", -1) - ORACLE_COVERAGE_AM) < 1e-6
            and chosen.get("n_needed") == N_NEEDED_AM
            and abs(chosen.get("m", -1) - MARGIN_M) < 1e-12
        ),
    }


def main(out):
    pop = R2.Pop(core.sample(N_POP, random.Random(999)))
    pop_shift = R2.Pop(core.sample(N_POP, random.Random(999), z_mu=0.6))
    margin = frozen_margin_block(pop)
    res = {
        "experiment": "CRC-1 R4",
        "alpha": ALPHA,
        "alpha_desc": ALPHA_DESC,
        "delta": DELTA,
        "ks_p": KS_P,
        "margin_m": MARGIN_M,
        "oracle_target_am": ORACLE_TARGET,
        "oracle_coverage_am_frozen": ORACLE_COVERAGE_AM,
        "n_needed_am": N_NEEDED_AM,
        "cost_inr": 0,
        "frozen_margin": margin,
    }
    res["base_500"] = run_cond(pop, 500, range(1000), 1.2)
    res["shift_500"] = run_cond(pop_shift, 500, range(1000), 0.6)
    res["base_2000"] = run_cond(pop, 2000, range(300), 1.2)
    res["shift_2000"] = run_cond(pop_shift, 2000, range(300), 0.6)
    res["verdicts"] = verdicts(res["base_500"], res["shift_500"])
    res["verdicts_exploratory_2000"] = verdicts(res["base_2000"], res["shift_2000"])
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    print(json.dumps({
        "verdicts": res["verdicts"],
        "margin_m": MARGIN_M,
        "frozen_margin_match": margin["match_contract"],
        "a10_x_am": res["base_500"]["ltt_r0_a10"]["cov_x_oracle_am"],
        "a10_x_010": res["base_500"]["ltt_r0_a10"]["cov_x_oracle_010"],
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
