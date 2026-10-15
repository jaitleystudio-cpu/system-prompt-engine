"""LEC-1 R3 per docs/lec1/CONTRACT_R3.md: PPI rectifier + WSR/betting finite-sample p-values.
Primary: ppi_wsr_ltt. Baselines: R2 ppi_ltt (asymptotic), R1 lf_ltt, R0 rand.
Grid index 0 = loosest t (0.50), 199 = strictest (0.995).
Usage: python3 -m spe_runtime.research.lec1.r3 OUTDIR"""
from __future__ import annotations

import bisect
import json
import math
import random
import sys

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0
from spe_runtime.research.lec1 import r1 as R1
from spe_runtime.research.lec1 import r2 as R2

ALPHA, DELTA = R0.ALPHA, R0.DELTA
GRID = R0.GRID
N_GRID = R0.N_GRID
N_POP = R0.N_POP
N_DRAWS = R0.N_DRAWS
N_UNLABELED = R0.N_UNLABELED

# Frozen a priori (CONTRACT_R3)
C_ANCHOR = R1.C_ANCHOR  # 0.55
SAFETY = R1.SAFETY      # 1.15
LAMBDA = 1.0            # rectifier offset weight; classical PPI Z = Y - f(s)
N_MIN_LABELED = 2
EPS_LAM = 1e-6
EPS_MU = 1e-12


def f_pred(s: float) -> float:
    """Frozen a-priori predictor of P(wrong|s): clip(1-s, 0, 1)."""
    return min(1.0, max(0.0, 1.0 - s))


def mu_f_hat(u_scores, labeled) -> float:
    """Unlabeled predictor mean; labeled f-mean fallback if |U|=0."""
    if len(u_scores) == 0:
        n = len(labeled)
        if n == 0:
            return 0.0
        return sum(f_pred(s) for s, _ in labeled) / n
    return sum(f_pred(u) for u in u_scores) / len(u_scores)


def wsr_pvalue(zs, theta: float) -> float:
    """Finite-sample one-sided WSR/betting p-value for H0: E[Z] >= theta, Z in [-1,1].

    Maps X=(Z+1)/2 in [0,1], mu0=(theta+1)/2; capital M_t = M_{t-1}*(1+lam_t*(mu0-X_t))
    with predictable truncated Kelly stakes. p = min(1, 1/M_n).
    Ville: under H0 the capital is a nonnegative supermartingale => valid p-value.
    """
    n = len(zs)
    if n < N_MIN_LABELED:
        return 1.0
    mu0 = (theta + 1.0) / 2.0
    if mu0 <= 0.0 or mu0 >= 1.0:
        return 1.0  # null boundary outside (0,1): no interior bet; honest abstain on reject
    lam_max = (1.0 - EPS_LAM) / max(1.0 - mu0, EPS_MU)
    wealth = 1.0
    sum_x = 0.0
    for t, z in enumerate(zs, start=1):
        x = (z + 1.0) / 2.0
        x = min(1.0, max(0.0, x))  # numerical safety
        if t == 1:
            lam = lam_max / 2.0
        else:
            m_hat = sum_x / (t - 1)
            denom = max(mu0 * (1.0 - mu0), EPS_MU)
            lam = (mu0 - m_hat) / denom
            lam = min(max(lam, 0.0), lam_max)
        # supermartingale multiplier under H0 when lam in [0, lam_max]
        wealth *= (1.0 + lam * (mu0 - x))
        if wealth <= 0.0:
            # numerical floor: should not happen with lam < 1/(1-mu0)
            wealth = EPS_MU
            break
        sum_x += x
    return min(1.0, 1.0 / wealth)


def wsr_rect_pvalue(labeled, u_scores, alpha: float = ALPHA) -> float:
    """PPI-rectifier WSR p-value: condition on U, bet on Z=Y-f against H0: E[Z] >= alpha - mu_f."""
    n = len(labeled)
    if n < N_MIN_LABELED:
        return 1.0
    # Deterministic order: ascending s (stable by original position via enumerate)
    ordered = sorted(enumerate(labeled), key=lambda iv: (iv[1][0], iv[0]))
    zs = [y - f_pred(s) for _, (s, y) in ordered]
    mu_f = mu_f_hat(u_scores, labeled)
    theta = alpha - mu_f
    return wsr_pvalue(zs, theta)


def ltt_from_pvals(pvals):
    """Fixed-sequence LTT on a list of p-values (index 0=loosest). Strict→loose."""
    chosen = None
    for i in range(N_GRID - 1, -1, -1):
        if pvals[i] <= DELTA:
            chosen = i
        else:
            break
    return chosen


def pvals_wsr(stage, u_sorted, floor_idx: int):
    """Build length-N_GRID WSR p-value list; mask below floor with p=1."""
    pvals = [1.0] * N_GRID
    stage_sorted = sorted(stage)  # by s ascending
    for i in range(floor_idx, N_GRID):
        t = GRID[i]
        lab = [(s, y) for s, y in stage_sorted if s >= t]
        j = bisect.bisect_left(u_sorted, t)
        u_i = u_sorted[j:]
        pvals[i] = wsr_rect_pvalue(lab, u_i, ALPHA)
    return pvals


def run_wsr(u_sorted, frng: random.Random, b: int):
    """All B labels above label-free floor; certify with WSR-PPI LTT."""
    fl = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)
    stage, screened = R0.focused_sample(b, GRID[fl], frng)
    pvals = pvals_wsr(stage, u_sorted, fl)
    return {
        "idx": ltt_from_pvals(pvals),
        "floor": fl,
        "screened": screened,
        "labels": len(stage),  # primary B accounting
        "c_f": min(1.0, C_ANCHOR * SAFETY),
        "lam": LAMBDA,
        "kind": "wsr",
    }


def run(pop_counts, draws=range(N_DRAWS)):
    oracle = core.policy_oracle(pop_counts)
    o_risk, o_cov = core.truth(pop_counts, oracle, N_POP)
    rows = []

    def rec(k, name, idx, **extra):
        r, c = core.truth(pop_counts, idx, N_POP)
        rows.append({
            "k": k, "arm": name,
            "t": None if idx is None else round(GRID[idx], 4),
            "risk": round(r, 6), "coverage": round(c, 6),
            "violation": int(r > ALPHA), **extra,
        })

    for k in draws:
        stream = core.sample(2000, random.Random(30000 + k))
        u_sorted = sorted(s for s, _ in core.sample(N_UNLABELED, random.Random(40000 + k)))

        for b in (250, 500, 1000, 2000):
            rec(k, f"rand_{b}", R0.ltt(core.grid_counts(stream[:b])), labels=b)

        # R1 lf_ltt paired baseline
        frng_lf = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = R1.run_lf(u_sorted, frng_lf, b)
            rec(k, f"lf_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6))

        # R2 asymptotic ppi_ltt paired previous best (imported, not rewritten)
        frng_ppi = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = R2.run_ppi(u_sorted, frng_ppi, b, lam=R2.LAMBDA, kind="ppi")
            rec(k, f"ppi_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6), lam=o["lam"])

        # Primary ppi_wsr_ltt: independent F_k = Random(50000+k), consume 250→500→1000
        frng_wsr = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = run_wsr(u_sorted, frng_wsr, b)
            rec(k, f"ppi_wsr_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6), lam=o["lam"])

    arms = sorted({x["arm"] for x in rows})
    summ = {"oracle": {"t": round(GRID[oracle], 4), "risk": round(o_risk, 6), "coverage": round(o_cov, 6)}}
    for a in arms:
        rs = [x for x in rows if x["arm"] == a]
        summ[a] = R0.summarize(rs, o_cov)
        if "floor_cov" in rs[0]:
            fc = sorted(x["floor_cov"] for x in rs)
            summ[a].update({
                "floor_cov_median": fc[len(fc) // 2],
                "floor_cov_p10": fc[len(fc) // 10],
                "floor_cov_p90": fc[(9 * len(fc)) // 10],
            })
        if "screened" in rs[0]:
            summ[a]["mean_screened"] = round(sum(x["screened"] for x in rs) / len(rs), 2)
        if "lam" in rs[0]:
            lams = [x["lam"] for x in rs]
            summ[a]["mean_lam"] = round(sum(lams) / len(lams), 4)
        b_expected = int(a.rsplit("_", 1)[-1])
        assert all(x["labels"] == b_expected for x in rs), (a, [x["labels"] for x in rs[:3]])

    by = {}
    for x in rows:
        by.setdefault(x["k"], {})[x["arm"]] = x["coverage"]
    ks = sorted(by)
    pairs = {}
    for a, bname in (
        ("ppi_wsr_ltt_500", "ppi_ltt_500"),
        ("ppi_wsr_ltt_500", "lf_ltt_500"),
        ("ppi_wsr_ltt_500", "rand_500"),
        ("ppi_wsr_ltt_500", "rand_1000"),
        ("ppi_wsr_ltt_250", "ppi_ltt_250"),
        ("ppi_wsr_ltt_250", "lf_ltt_250"),
        ("ppi_wsr_ltt_1000", "ppi_ltt_1000"),
        ("ppi_wsr_ltt_1000", "lf_ltt_1000"),
        ("ppi_wsr_ltt_1000", "rand_1000"),
        ("ppi_ltt_500", "lf_ltt_500"),
        ("lf_ltt_500", "rand_1000"),
    ):
        pairs[f"{a}_minus_{bname}"] = R0.paired([by[k][a] - by[k][bname] for k in ks])
    summ["paired"] = pairs
    return summ, rows


def verdicts(s):
    p = s["ppi_wsr_ltt_500"]
    h1 = "REJECTED" if p["cp95"][0] > DELTA else ("SUPPORTED" if p["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if p["coverage_ratio_vs_oracle"] >= 0.85 else "NOT_PROVEN"
    d3 = s["paired"]["ppi_wsr_ltt_500_minus_ppi_ltt_500"]
    h3 = "SUPPORTED" if d3["lb95_1s"] > -0.02 else ("REJECTED" if d3["ub95_1s"] < -0.02 else "NOT_PROVEN")
    d3b = s["paired"]["ppi_wsr_ltt_500_minus_lf_ltt_500"]
    h3b = "SUPPORTED" if d3b["lb95_1s"] > 0 else ("REJECTED" if d3b["ub95_1s"] < 0 else "NOT_PROVEN")
    d4 = s["paired"]["ppi_wsr_ltt_500_minus_rand_1000"]
    h4 = "SUPPORTED" if d4["lb95_1s"] > -0.01 else ("REJECTED" if d4["ub95_1s"] < -0.01 else "NOT_PROVEN")
    overall = (
        "SUPPORTED" if (h1, h3, h3b) == ("SUPPORTED",) * 3
        else ("REJECTED" if "REJECTED" in (h1, h3, h3b) else "NOT_PROVEN")
    )
    return {
        "H1_validity": h1,
        "H2_utility_085_oracle": h2,
        "H3_noninferior_ppi_ltt_500": h3,
        "H3b_beats_lf_ltt_500": h3b,
        "H4_noninferior_rand_1000": h4,
        "overall": overall,
    }


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    summ, rows = run(pop)
    res = {
        "experiment": "LEC-1 R3",
        "alpha": ALPHA,
        "delta": DELTA,
        "cost_inr": 0,
        "n_draws": N_DRAWS,
        "constants": {
            "c_anchor": C_ANCHOR,
            "safety": SAFETY,
            "c_f_primary": min(1.0, C_ANCHOR * SAFETY),
            "lambda": LAMBDA,
            "n_min_labeled": N_MIN_LABELED,
            "n_unlabeled": N_UNLABELED,
            "predictor": "clip(1-s,0,1)",
            "pvalue": "WSR_betting_predictable_truncated_Kelly",
            "eps_lam": EPS_LAM,
            "eps_mu": EPS_MU,
        },
        "results": summ,
        "verdicts": verdicts(summ),
    }
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    with open(f"{out}/rows.json", "w") as f:
        json.dump(rows, f, sort_keys=True)
    print(json.dumps(res["verdicts"], indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
