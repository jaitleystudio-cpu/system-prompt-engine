"""CRC-1 R3 per docs/crc1/CONTRACT_R3.md: feasible risk target (alpha=0.08) + minimal KS shift gate.
Pure Python, deterministic. Usage: python3 -m spe_runtime.research.crc1.r3 OUTDIR"""
from __future__ import annotations

import bisect
import json
import math
import random
import sys

from . import core
from . import r2 as R2

GRID = core.GRID
N_GRID = len(GRID)
N_POP = 400_000
ALPHA_FEAS = 0.08
ALPHA_PREV = 0.10
DELTA = 0.10
KS_P = 0.01
ORACLE_RS = (0.06, 0.07, 0.08, 0.09, 0.10)
CAL_SEED, DEP_SEED, BOOT_SEED, BOOT_B = 40_000, 60_000, 31_337, 2000


# ---------------------------------------------------------------- policies
def policy_ltt(counts, alpha, delta=DELTA):
    """R0 fixed sequence strict -> loose at an arbitrary alpha (core.policy_ltt with alpha passed through)."""
    return core.policy_ltt(counts, alpha=alpha, delta=delta)


def oracle_idx(pop_grid, r):
    """Loosest grid index whose population selective risk <= r (R0 policy_oracle with ALPHA -> r)."""
    for i, (n, e) in enumerate(pop_grid):
        if n >= 1 and e / n <= r:
            return i
    return None


# ---------------------------------------------------------------- KS shift detector
def ks_stat(a, b):
    """Two-sample KS statistic D = sup |F_a - F_b| (exact for ties by stepping through merged values)."""
    a, b = sorted(a), sorted(b)
    na, nb = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < na and j < nb:
        x = min(a[i], b[j])
        while i < na and a[i] <= x:
            i += 1
        while j < nb and b[j] <= x:
            j += 1
        d = max(d, abs(i / na - j / nb))
    return d


def q_ks(lam):
    """Kolmogorov survival function Q(lam) = 2 sum (-1)^(j-1) exp(-2 j^2 lam^2)."""
    if lam < 1e-3:
        return 1.0
    tot, sign = 0.0, 1.0
    for j in range(1, 101):
        term = sign * 2.0 * math.exp(-2.0 * j * j * lam * lam)
        tot += term
        if abs(term) < 1e-12:
            break
        sign = -sign
    return min(1.0, max(0.0, tot))


def ks_pvalue(a, b):
    ne = len(a) * len(b) / (len(a) + len(b))
    d = ks_stat(a, b)
    lam = (math.sqrt(ne) + 0.12 + 0.11 / math.sqrt(ne)) * d
    return q_ks(lam)


def shift_gate(cal_scores, deploy_scores, p_thresh=KS_P):
    """True = shift detected -> withhold 'verified' (abstain-all). Takes scores only."""
    return ks_pvalue(cal_scores, deploy_scores) < p_thresh


def policy_shiftgate(cal_data, deploy_scores, alpha=ALPHA_FEAS, delta=DELTA, p_thresh=KS_P):
    """Returns (grid index or None, gate_fired)."""
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
    d = [x - y for x, y in zip(a, b)]
    m = mean(d)
    se = math.sqrt(sum((x - m) ** 2 for x in d) / (len(d) - 1)) / math.sqrt(len(d))
    return {"mean": round(m, 6), "lb95_1s": round(m - 1.645 * se, 6), "ub95_1s": round(m + 1.645 * se, 6)}


def boot_ratio(cov, denom, b=BOOT_B, seed=BOOT_SEED):
    """One-sided 95% percentile bootstrap (5th, 95th) of mean(cov)/denom."""
    rng = random.Random(seed)
    n = len(cov)
    ms = sorted(sum(cov[rng.randrange(n)] for _ in range(n)) / n for _ in range(b))
    return round(ms[int(0.05 * b)] / denom, 6), round(ms[int(0.95 * b) - 1] / denom, 6)


# ---------------------------------------------------------------- experiment
ARMS = (("ltt_r0_a10", ALPHA_PREV), ("ltt_r0_a08", ALPHA_FEAS), ("ltt_r0_a08_shiftgate", ALPHA_FEAS))


def run_cond(pop, n_cal, draws, deploy_z_mu):
    oracle = {}
    for r in ORACLE_RS:
        o = oracle_idx(pop.grid, r)
        risk, cov = pop.at(None if o is None else GRID[o])
        oracle[f"{r:.2f}"] = {"t": None if o is None else round(GRID[o], 4), "risk": round(risk, 6), "coverage": round(cov, 6)}
    rows = {a: [] for a, _ in ARMS}
    fired, a08_nonabstain = 0, 0
    for k in draws:
        cal = core.sample(n_cal, random.Random(CAL_SEED + k))
        dep_scores = [s for s, _ in core.sample(n_cal, random.Random(DEP_SEED + k), z_mu=deploy_z_mu)]
        counts = core.grid_counts(cal)
        for name, a in ARMS[:2]:
            i = policy_ltt(counts, a)
            th = None if i is None else GRID[i]
            rk, cv = pop.at(th)
            rows[name].append((rk, cv, th is None, a))
        i, f = policy_shiftgate(cal, dep_scores)
        fired += f
        a08_nonabstain += rows["ltt_r0_a08"][-1][2] is False
        th = None if i is None else GRID[i]
        rk, cv = pop.at(th)
        rows["ltt_r0_a08_shiftgate"].append((rk, cv, th is None, ALPHA_FEAS))
    out = {"n_cal": n_cal, "draws": len(draws), "deploy_z_mu": deploy_z_mu, "oracle": oracle,
           "gate_fired": fired, "a08_nonabstain": a08_nonabstain,
           "gate_fire_rate_given_nonabstain": round(fired / a08_nonabstain, 6) if a08_nonabstain else None}
    for name, a in ARMS:
        rs = rows[name]
        v = sum(1 for rk, _, _, aa in rs if rk > aa)
        lo, hi = core.clopper_pearson(v, len(rs))
        cov = [c for _, c, _, _ in rs]
        ab = sum(1 for _, _, x, _ in rs if x)
        alo, ahi = core.clopper_pearson(ab, len(rs))
        o08, o10 = oracle["0.08"]["coverage"], oracle["0.10"]["coverage"]
        own = oracle[f"{a:.2f}"]["coverage"]
        out[name] = {"alpha": a, "violations": v, "violation_rate": round(v / len(rs), 6), "cp95": [round(lo, 6), round(hi, 6)],
                     "mean_coverage": round(mean(cov), 6), "mean_risk": round(mean([r for r, _, _, _ in rs]), 6),
                     "abstain_all": ab, "abstain_rate": round(ab / len(rs), 6), "abstain_cp95": [round(alo, 6), round(ahi, 6)],
                     "cov_x_oracle_own": round(mean(cov) / own, 6) if own else None,
                     "cov_x_oracle_008": round(mean(cov) / o08, 6) if o08 else None,
                     "cov_x_oracle_010": round(mean(cov) / o10, 6) if o10 else None,
                     "boot_x_oracle_008": list(boot_ratio(cov, o08)) if o08 else None,
                     "boot_x_oracle_own": list(boot_ratio(cov, own)) if own else None}
    c = {a: [x[1] for x in rows[a]] for a, _ in ARMS}
    out["paired_a08_minus_a10"] = paired(c["ltt_r0_a08"], c["ltt_r0_a10"])
    out["paired_gate_minus_a08"] = paired(c["ltt_r0_a08_shiftgate"], c["ltt_r0_a08"])
    return out


def verdicts(base, shift):
    a08 = base["ltt_r0_a08"]
    h1 = "SUPPORTED" if a08["cp95"][1] <= DELTA else ("REFUTED" if a08["cp95"][0] > DELTA else "NOT_PROVEN")
    ratio, (lb, ub) = a08["cov_x_oracle_008"], a08["boot_x_oracle_008"]
    if h1 == "SUPPORTED" and ratio >= 0.85 and lb >= 0.85:
        h2 = "SUPPORTED"
    elif ub < 0.85:
        h2 = "REFUTED"
    else:
        h2 = "NOT_PROVEN"
    a10 = base["ltt_r0_a10"]
    h3 = {"raw_cov_a08": a08["mean_coverage"], "raw_cov_a10": a10["mean_coverage"],
          "a08_x_oracle_008": ratio, "a10_x_oracle_010": a10["cov_x_oracle_010"],
          "a08_meets_085": ratio >= 0.85, "a10_meets_085": a10["cov_x_oracle_010"] >= 0.85,
          "paired_a08_minus_a10": base["paired_a08_minus_a10"],
          "beats_previous_best": h1 == "SUPPORTED" and h2 == "SUPPORTED"}
    g = shift["ltt_r0_a08_shiftgate"]
    if g["cp95"][1] <= DELTA and g["abstain_rate"] >= 0.90:
        h4 = "SUPPORTED"
    elif g["cp95"][0] > DELTA:
        h4 = "REFUTED"
    else:
        h4 = "NOT_PROVEN"
    overall = "SUPPORTED" if (h1, h2, h4) == ("SUPPORTED",) * 3 else ("REFUTED" if h1 == "REFUTED" else "NOT_PROVEN")
    return {"H1_validity_a08": h1, "H2_feasible_coverage": h2, "H3": h3, "H4_shift_gate": h4,
            "H4_descriptive_a08_shift_violation": shift["ltt_r0_a08"]["violation_rate"], "overall": overall}


def planner(pop):
    o08 = oracle_idx(pop.grid, 0.08)
    r08 = pop.at(GRID[o08])[0]
    return {"oracle_008_risk": round(r08, 6),
            "n_needed_at_oracle008_alpha008": R2.n_needed(r08, alpha=ALPHA_FEAS),
            "n_needed_at_oracle008_alpha010": R2.n_needed(r08, alpha=ALPHA_PREV)}


def main(out):
    pop = R2.Pop(core.sample(N_POP, random.Random(999)))
    pop_shift = R2.Pop(core.sample(N_POP, random.Random(999), z_mu=0.6))
    res = {"experiment": "CRC-1 R3", "alpha_feas": ALPHA_FEAS, "alpha_prev": ALPHA_PREV, "delta": DELTA, "ks_p": KS_P,
           "cost_inr": 0}
    res["base_500"] = run_cond(pop, 500, range(1000), 1.2)
    res["shift_500"] = run_cond(pop_shift, 500, range(1000), 0.6)
    res["base_2000"] = run_cond(pop, 2000, range(300), 1.2)
    res["shift_2000"] = run_cond(pop_shift, 2000, range(300), 0.6)
    res["verdicts"] = verdicts(res["base_500"], res["shift_500"])
    res["verdicts_exploratory_2000"] = verdicts(res["base_2000"], res["shift_2000"])
    res["planner"] = planner(pop)
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    print(json.dumps({"verdicts": res["verdicts"], "planner": res["planner"]}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
