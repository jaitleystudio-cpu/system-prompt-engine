"""LEC-1 R0 per docs/lec1/CONTRACT_R0.md: pilot-focused LTT (two-phase, score-only active labeling) vs i.i.d. random
calibration at equal label budget. Reuses the CRC-1 DGP + R0 fixed-sequence LTT unchanged.
Grid index 0 = loosest t (0.50), 199 = strictest (0.995). Usage: python3 -m spe_runtime.research.lec1.r0 OUTDIR"""
from __future__ import annotations

import bisect
import json
import math
import random
import sys

from spe_runtime.research.crc1 import core

ALPHA, DELTA = core.ALPHA, core.DELTA
GRID = core.GRID
N_GRID = len(GRID)
N_POP = 400_000
N_DRAWS = 1000
PILOT_FRAC = 0.2
PILOT_NMIN = 20
SAFETY = 1.25
N_UNLABELED = 20_000
HINDSIGHT_CF = 0.60


def pval(n: int, e: int, alpha: float = ALPHA) -> float:
    return 1.0 if n == 0 else core.binom_cdf(e, n, alpha)


def ltt(counts, alpha: float = ALPHA, delta: float = DELTA):
    """R0 fixed sequence (same rule as core.policy_ltt): strict -> loose, stop at first failure, loosest accepted."""
    chosen = None
    for i in range(N_GRID - 1, -1, -1):
        if pval(*counts[i], alpha) <= delta:
            chosen = i
        else:
            break
    return chosen


def budget_split(b: int):
    b1 = round(PILOT_FRAC * b)
    return b1, b - b1


def pilot_threshold(pilot, alpha: float = ALPHA, n_min: int = PILOT_NMIN):
    """Naive threshold on pilot labels: smallest grid index with n_t >= n_min and e_t/n_t <= alpha."""
    for i, (n, e) in enumerate(core.grid_counts(pilot)):
        if n >= n_min and e / n <= alpha:
            return i
    return None


def cov_u(u_sorted, t: float) -> float:
    return (len(u_sorted) - bisect.bisect_left(u_sorted, t)) / len(u_sorted)


def floor_from_coverage(u_sorted, c_f: float) -> int:
    """Largest grid index whose unlabeled coverage is >= c_f (0 if none)."""
    for i in range(N_GRID - 1, -1, -1):
        if cov_u(u_sorted, GRID[i]) >= c_f:
            return i
    return 0


def floor_index(t_p, u_sorted, safety: float = SAFETY) -> int:
    if t_p is None:
        return 0
    c_f = min(1.0, safety * cov_u(u_sorted, GRID[t_p]))
    return floor_from_coverage(u_sorted, c_f)


def focused_sample(n_labels: int, floor_t: float, rng: random.Random, z_mu: float = 1.2):
    """Screen items by score only; query the label only when s >= floor_t. Returns (labeled items, n_screened)."""
    out, screened = [], 0
    while len(out) < n_labels:
        s, w = core.sample(1, rng, z_mu)[0]
        screened += 1
        if s >= floor_t:
            out.append((s, w))
    return out, screened


def mask_below(counts, floor_idx: int):
    return [(0, 0) if i < floor_idx else c for i, c in enumerate(counts)]


def certify_counts(stage2, floor_idx: int):
    """Counts used for certification: stage-2 labels ONLY, masked below the floor."""
    return mask_below(core.grid_counts(stage2), floor_idx)


def run_pf(labeled_stream, u_sorted, frng: random.Random, b: int):
    b1, b2 = budget_split(b)
    pilot = labeled_stream[:b1]
    t_p = pilot_threshold(pilot)
    fl = floor_index(t_p, u_sorted)
    stage2, screened = focused_sample(b2, GRID[fl], frng)
    counts = certify_counts(stage2, fl)
    return {"idx": ltt(counts), "floor": fl, "fallback": t_p is None, "screened": screened,
            "labels": b1 + len(stage2), "n_at_floor": counts[fl][0]}


def run_hindsight(u_sorted, frng: random.Random, b: int):
    fl = floor_from_coverage(u_sorted, HINDSIGHT_CF)
    stage2, screened = focused_sample(b, GRID[fl], frng)
    return {"idx": ltt(certify_counts(stage2, fl)), "floor": fl, "screened": screened, "labels": len(stage2)}


def paired(d):
    m = sum(d) / len(d)
    sd = math.sqrt(sum((x - m) ** 2 for x in d) / (len(d) - 1)) if len(d) > 1 else 0.0
    se = sd / math.sqrt(len(d))
    return {"mean": round(m, 6), "sd": round(sd, 6), "lb95_1s": round(m - 1.645 * se, 6), "ub95_1s": round(m + 1.645 * se, 6),
            "wins": sum(1 for x in d if x > 1e-12), "losses": sum(1 for x in d if x < -1e-12)}


def summarize(rs, o_cov):
    v = sum(x["violation"] for x in rs)
    lo, hi = core.clopper_pearson(v, len(rs))
    cov = sum(x["coverage"] for x in rs) / len(rs)
    return {"n": len(rs), "violations": v, "violation_rate": round(v / len(rs), 6), "cp95": [round(lo, 6), round(hi, 6)],
            "mean_coverage": round(cov, 6), "coverage_ratio_vs_oracle": round(cov / o_cov, 6),
            "mean_risk": round(sum(x["risk"] for x in rs) / len(rs), 6),
            "abstain_all": sum(1 for x in rs if x["t"] is None)}


def run(pop_counts, draws=range(N_DRAWS)):
    oracle = core.policy_oracle(pop_counts)
    o_risk, o_cov = core.truth(pop_counts, oracle, N_POP)
    rows = []

    def rec(k, name, idx, **extra):
        r, c = core.truth(pop_counts, idx, N_POP)
        rows.append({"k": k, "arm": name, "t": None if idx is None else round(GRID[idx], 4), "risk": round(r, 6),
                     "coverage": round(c, 6), "violation": int(r > ALPHA), **extra})

    for k in draws:
        stream = core.sample(2000, random.Random(30000 + k))
        u_sorted = sorted(s for s, _ in core.sample(N_UNLABELED, random.Random(40000 + k)))
        for b in (250, 500, 1000, 2000):
            rec(k, f"rand_{b}", ltt(core.grid_counts(stream[:b])), labels=b)
        frng = random.Random(50000 + k)  # one focused stream per draw, consumed in a fixed order
        for b in (250, 500, 1000):
            o = run_pf(stream, u_sorted, frng, b)
            rec(k, f"pf_ltt_{b}", o["idx"], labels=o["labels"], floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(cov_u(u_sorted, GRID[o["floor"]]), 6), fallback=int(o["fallback"]), screened=o["screened"])
        o = run_hindsight(u_sorted, frng, 500)
        rec(k, "hindsight_500", o["idx"], labels=o["labels"], floor_t=round(GRID[o["floor"]], 4), screened=o["screened"])

    arms = sorted({x["arm"] for x in rows})
    summ = {"oracle": {"t": round(GRID[oracle], 4), "risk": round(o_risk, 6), "coverage": round(o_cov, 6)}}
    for a in arms:
        rs = [x for x in rows if x["arm"] == a]
        summ[a] = summarize(rs, o_cov)
        if "floor_cov" in rs[0]:
            fc = sorted(x["floor_cov"] for x in rs)
            summ[a].update({"floor_cov_median": fc[len(fc) // 2], "floor_cov_p10": fc[len(fc) // 10],
                            "floor_cov_p90": fc[(9 * len(fc)) // 10], "fallbacks": sum(x["fallback"] for x in rs)})
        if "screened" in rs[0]:
            summ[a]["mean_screened"] = round(sum(x["screened"] for x in rs) / len(rs), 2)
        assert all(x["labels"] == int(a.split("_")[-1]) for x in rs), a
    by = {}
    for x in rows:
        by.setdefault(x["k"], {})[x["arm"]] = x["coverage"]
    ks = sorted(by)
    pairs = {}
    for a, bname in (("pf_ltt_500", "rand_500"), ("pf_ltt_500", "rand_1000"), ("pf_ltt_250", "rand_250"),
                     ("pf_ltt_1000", "rand_1000"), ("pf_ltt_1000", "rand_2000"), ("pf_ltt_500", "rand_2000"),
                     ("hindsight_500", "rand_500")):
        pairs[f"{a}_minus_{bname}"] = paired([by[k][a] - by[k][bname] for k in ks])
    summ["paired"] = pairs
    return summ, rows


def verdicts(s):
    p = s["pf_ltt_500"]
    h1 = "REJECTED" if p["cp95"][0] > DELTA else ("SUPPORTED" if p["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if p["coverage_ratio_vs_oracle"] >= 0.85 else "NOT_PROVEN"
    d3 = s["paired"]["pf_ltt_500_minus_rand_500"]
    h3 = "SUPPORTED" if d3["lb95_1s"] > 0 else ("REJECTED" if d3["ub95_1s"] < 0 else "NOT_PROVEN")
    d4 = s["paired"]["pf_ltt_500_minus_rand_1000"]
    h4 = "SUPPORTED" if d4["lb95_1s"] > -0.01 else ("REJECTED" if d4["ub95_1s"] < -0.01 else "NOT_PROVEN")
    overall = "SUPPORTED" if (h1, h2, h3) == ("SUPPORTED",) * 3 else ("REJECTED" if "REJECTED" in (h1, h3) else "NOT_PROVEN")
    return {"H1_validity": h1, "H2_utility_085_oracle": h2, "H3_beats_rand_500": h3, "H4_noninferior_rand_1000": h4,
            "overall": overall}


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    summ, rows = run(pop)
    res = {"experiment": "LEC-1 R0", "alpha": ALPHA, "delta": DELTA, "cost_inr": 0, "n_draws": N_DRAWS,
           "constants": {"pilot_frac": PILOT_FRAC, "pilot_nmin": PILOT_NMIN, "safety": SAFETY, "n_unlabeled": N_UNLABELED,
                         "hindsight_cf": HINDSIGHT_CF},
           "results": summ, "verdicts": verdicts(summ)}
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    with open(f"{out}/rows.json", "w") as f:
        json.dump(rows, f, sort_keys=True)
    print(json.dumps(res["verdicts"], indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
