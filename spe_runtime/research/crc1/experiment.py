"""Run CRC-1 R0 exactly per docs/crc1/CONTRACT_R0.md. Usage: python3 -m spe_runtime.research.crc1.experiment OUTDIR"""
from __future__ import annotations

import json
import random
import sys
import time

from . import core

N_POP = 400_000
SEEDS = range(500)


def run_arm(pop_counts, n_cal, z_mu_cal=1.2):
    oracle = core.policy_oracle(pop_counts)
    o_risk, o_cov = core.truth(pop_counts, oracle, N_POP)
    rows = []
    for seed in SEEDS:
        cal = core.grid_counts(core.sample(n_cal, random.Random(10_000 + seed), z_mu_cal))
        for name, fn in (("raw_conf", core.policy_raw_conf), ("naive_cal", core.policy_naive_cal), ("ltt", core.policy_ltt)):
            idx = fn(cal)
            r, c = core.truth(pop_counts, idx, N_POP)
            rows.append({"seed": seed, "policy": name, "t": None if idx is None else round(core.GRID[idx], 4),
                         "risk": r, "coverage": c, "violation": int(r > core.ALPHA)})
    summ = {"oracle": {"t": None if oracle is None else round(core.GRID[oracle], 4), "risk": o_risk, "coverage": o_cov}}
    for name in ("raw_conf", "naive_cal", "ltt"):
        rs = [x for x in rows if x["policy"] == name]
        v = sum(x["violation"] for x in rs)
        lo, hi = core.clopper_pearson(v, len(rs))
        cov = sum(x["coverage"] for x in rs) / len(rs)
        summ[name] = {"violations": v, "n": len(rs), "violation_rate": v / len(rs), "cp95": [lo, hi],
                      "mean_coverage": cov, "coverage_ratio_vs_oracle": (cov / o_cov) if o_cov else None,
                      "mean_risk": sum(x["risk"] for x in rs) / len(rs),
                      "abstain_all": sum(1 for x in rs if x["t"] is None)}
    return summ, rows


def verdicts(s):
    ltt, nv = s["ltt"], s["naive_cal"]
    h1 = "REJECTED" if ltt["cp95"][0] > 0.10 else ("SUPPORTED" if ltt["cp95"][1] <= 0.12 else "NOT_PROVEN")
    h2 = "SUPPORTED" if nv["cp95"][0] > 0.10 else "NOT_PROVEN"
    h3 = "SUPPORTED" if (ltt["coverage_ratio_vs_oracle"] or 0) >= 0.85 else "NOT_PROVEN"
    overall = "SUPPORTED" if (h1, h2, h3) == ("SUPPORTED",) * 3 else ("REJECTED" if h1 == "REJECTED" else "NOT_PROVEN")
    return {"H1_validity": h1, "H2_naive_invalid": h2, "H3_utility": h3, "overall": overall}


def main(out):
    t0 = time.time()
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    pop_shift = core.grid_counts(core.sample(N_POP, random.Random(999), z_mu=0.6))
    primary, rows = run_arm(pop, 500)
    e1, _ = run_arm(pop, 100)
    e2, _ = run_arm(pop_shift, 500)
    res = {"primary": primary, "verdicts": verdicts(primary), "exploratory": {"E1_ncal100": e1, "E2_shift": e2},
           "alpha": core.ALPHA, "delta": core.DELTA, "runtime_s": round(time.time() - t0, 1), "cost_inr": 0}
    json.dump(res, open(f"{out}/summary.json", "w"), indent=2)
    json.dump(rows, open(f"{out}/rows_primary.json", "w"))
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
