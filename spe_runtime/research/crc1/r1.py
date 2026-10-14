"""CRC-1 R1 per docs/crc1/CONTRACT_R1.md. Grid index 0 = loosest t (0.50), 199 = strictest (0.995).
Usage: python3 -m spe_runtime.research.crc1.r1 OUTDIR"""
from __future__ import annotations

import json
import math
import random
import sys

from . import core

ALPHA, DELTA = core.ALPHA, core.DELTA
N_POP = 400_000
N_GRID = len(core.GRID)
SGR_K = math.ceil(math.log2(N_GRID))  # 8
BONF_IDX = list(range(0, N_GRID, 22))  # 0,22,...,198


def pval(n: int, e: int, alpha: float = ALPHA) -> float:
    return 1.0 if n == 0 else core.binom_cdf(e, n, alpha)


def policy_ltt_r0(counts):
    return core.policy_ltt(counts)


def ltt_start(counts, n_min: int):
    for i in range(N_GRID - 1, -1, -1):
        if counts[i][0] >= n_min:
            return i
    return None


def policy_ltt_mc(counts, n_min: int, alpha: float = ALPHA, delta: float = DELTA):
    start = ltt_start(counts, n_min)
    if start is None:
        return None
    chosen = None
    for i in range(start, -1, -1):
        if pval(*counts[i], alpha) <= delta:
            chosen = i
        else:
            break
    return chosen


def policy_sgr(counts, alpha: float = ALPHA, delta: float = DELTA, k: int = SGR_K):
    lo, hi, best = 0, N_GRID - 1, None
    for _ in range(k):
        if lo > hi:
            break
        mid = (lo + hi) // 2
        if pval(*counts[mid], alpha) <= delta / k:
            best, hi = mid, mid - 1
        else:
            lo = mid + 1
    return best


def policy_bonf10(counts, alpha: float = ALPHA, delta: float = DELTA):
    ok = [i for i in BONF_IDX if pval(*counts[i], alpha) <= delta / len(BONF_IDX)]
    return min(ok) if ok else None


def arms(n_cal):
    n_min = int(0.3 * n_cal)
    return (("naive_cal", core.policy_naive_cal), ("ltt_r0", policy_ltt_r0), ("sgr", policy_sgr),
            ("bonf10", policy_bonf10), ("ltt_mc", lambda c: policy_ltt_mc(c, n_min)))


def run_arm(pop_counts, n_cal, seeds=range(1000), z_mu_cal=1.2):
    oracle = core.policy_oracle(pop_counts)
    o_risk, o_cov = core.truth(pop_counts, oracle, N_POP)
    rows = []
    for seed in seeds:
        cal = core.grid_counts(core.sample(n_cal, random.Random(20_000 + seed), z_mu_cal))
        for name, fn in arms(n_cal):
            idx = fn(cal)
            r, c = core.truth(pop_counts, idx, N_POP)
            rows.append({"seed": seed, "policy": name, "t": None if idx is None else round(core.GRID[idx], 4),
                         "risk": round(r, 6), "coverage": round(c, 6), "violation": int(r > ALPHA)})
    summ = {"n_cal": n_cal, "n_min": int(0.3 * n_cal),
            "oracle": {"t": None if oracle is None else round(core.GRID[oracle], 4), "risk": round(o_risk, 6), "coverage": round(o_cov, 6)}}
    for name, _ in arms(n_cal):
        rs = [x for x in rows if x["policy"] == name]
        v = sum(x["violation"] for x in rs)
        lo, hi = core.clopper_pearson(v, len(rs))
        cov = sum(x["coverage"] for x in rs) / len(rs)
        summ[name] = {"violations": v, "n": len(rs), "violation_rate": round(v / len(rs), 6), "cp95": [round(lo, 6), round(hi, 6)],
                      "mean_coverage": round(cov, 6), "coverage_ratio_vs_oracle": round(cov / o_cov, 6) if o_cov else None,
                      "mean_risk": round(sum(x["risk"] for x in rs) / len(rs), 6),
                      "abstain_all": sum(1 for x in rs if x["t"] is None)}
    by = {}
    for x in rows:
        by.setdefault(x["seed"], {})[x["policy"]] = x["coverage"]
    d = [by[s]["ltt_mc"] - by[s]["sgr"] for s in sorted(by)]
    m = sum(d) / len(d)
    sd = math.sqrt(sum((x - m) ** 2 for x in d) / (len(d) - 1)) if len(d) > 1 else 0.0
    se = sd / math.sqrt(len(d))
    summ["paired_ltt_mc_minus_sgr"] = {"mean": round(m, 6), "sd": round(sd, 6), "lb95_1s": round(m - 1.645 * se, 6),
                                       "ub95_1s": round(m + 1.645 * se, 6),
                                       "wins": sum(1 for x in d if x > 1e-12), "losses": sum(1 for x in d if x < -1e-12)}
    return summ, rows


def verdicts(s):
    l, p = s["ltt_mc"], s["paired_ltt_mc_minus_sgr"]
    h1 = "REJECTED" if l["cp95"][0] > DELTA else ("SUPPORTED" if l["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if (l["coverage_ratio_vs_oracle"] or 0) >= 0.85 else "NOT_PROVEN"
    h3 = "SUPPORTED" if p["lb95_1s"] > 0 else ("REJECTED" if p["ub95_1s"] < 0 else "NOT_PROVEN")
    hs = (h1, h2, h3)
    overall = "SUPPORTED" if hs == ("SUPPORTED",) * 3 else ("REJECTED" if "REJECTED" in (h1, h3) else "NOT_PROVEN")
    return {"H1_validity": h1, "H2_utility": h2, "H3_beats_sgr": h3, "overall": overall,
            "sgr_valid_cp95_upper_le_delta": s["sgr"]["cp95"][1] <= DELTA}


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    pop_shift = core.grid_counts(core.sample(N_POP, random.Random(999), z_mu=0.6))
    primary, rows = run_arm(pop, 500)
    e1, _ = run_arm(pop, 100)
    e2, _ = run_arm(pop, 2000, seeds=range(300))
    e3, _ = run_arm(pop_shift, 500)
    res = {"experiment": "CRC-1 R1", "alpha": ALPHA, "delta": DELTA, "cost_inr": 0, "primary": primary,
           "verdicts": verdicts(primary),
           "exploratory": {"E1_ncal100": e1, "E2_ncal2000_300seeds": e2, "E3_shift": e3}}
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    with open(f"{out}/rows_primary.json", "w") as f:
        json.dump(rows, f, sort_keys=True)
    print(json.dumps({"primary": primary, "verdicts": res["verdicts"]}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
