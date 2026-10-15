"""LEC-1 R2 per docs/lec1/CONTRACT_R2.md: prediction-powered LTT (ppi_ltt) + R1 label-free floor.
Reuses R0/R1 helpers + CRC-1 DGP. Predictor f(s)=1-s, λ=1 (classical PPI, asymptotic CLT p-values).
Grid index 0 = loosest t (0.50), 199 = strictest (0.995). Usage: python3 -m spe_runtime.research.lec1.r2 OUTDIR"""
from __future__ import annotations

import bisect
import json
import math
import random
import sys

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0
from spe_runtime.research.lec1 import r1 as R1

ALPHA, DELTA = R0.ALPHA, R0.DELTA
GRID = R0.GRID
N_GRID = R0.N_GRID
N_POP = R0.N_POP
N_DRAWS = R0.N_DRAWS
N_UNLABELED = R0.N_UNLABELED

# Frozen a priori (CONTRACT_R2)
C_ANCHOR = R1.C_ANCHOR  # 0.55
SAFETY = R1.SAFETY      # 1.15
LAMBDA = 1.0            # classical PPI; not data-tuned in primary
N_MIN_LABELED = 2
SE_FLOOR = 1e-12
PPIPP_LAMBDA_GRID = (0.0, 0.25, 0.5, 0.75, 1.0)
PPIPP_TUNE_FRAC = 0.20


def f_pred(s: float) -> float:
    """Frozen a-priori predictor of P(wrong|s): clip(1-s, 0, 1)."""
    return min(1.0, max(0.0, 1.0 - s))


def _norm_cdf(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def _sample_var(xs) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    m = sum(xs) / n
    return sum((x - m) ** 2 for x in xs) / (n - 1)


def ppi_estimate(labeled, u_scores, lam: float = LAMBDA):
    """Classical / PPI++ point estimate and SE for E[Y] on the selected set.
    labeled: list of (s, y); u_scores: list of scores (same selection).
    R̂_λ = mean_L(Y) + λ (mean_U f - mean_L f) = λ mean_U f + mean_L(Y - λ f).
    Returns (Rhat, SE, n_lab, n_u) or (None, None, n_lab, n_u) if n_lab < N_MIN_LABELED.
    """
    n = len(labeled)
    N = len(u_scores)
    if n < N_MIN_LABELED:
        return None, None, n, N
    ys = [y for _, y in labeled]
    f_l = [f_pred(s) for s, _ in labeled]
    if N == 0:
        f_u = list(f_l)  # degenerate fallback per contract
        N_eff = n
    else:
        f_u = [f_pred(u) for u in u_scores]
        N_eff = N
    mu_f = sum(f_u) / N_eff
    # rectifier of (Y - λ f)
    rect = [y - lam * f for y, f in zip(ys, f_l)]
    rhat = lam * mu_f + sum(rect) / n
    # variance: Var(λ f)/N + Var(Y - λ f)/n
    var_f = _sample_var([lam * fu for fu in f_u]) if N_eff >= 2 else 0.0
    var_r = _sample_var(rect)
    se = math.sqrt(var_f / N_eff + var_r / n)
    se = max(se, SE_FLOOR)
    return rhat, se, n, N


def ppi_pvalue(labeled, u_scores, alpha: float = ALPHA, lam: float = LAMBDA) -> float:
    """Asymptotic one-sided p-value for H0: R ≥ alpha. Φ((R̂ - alpha)/SE)."""
    rhat, se, n, _N = ppi_estimate(labeled, u_scores, lam)
    if rhat is None:
        return 1.0
    return _norm_cdf((rhat - alpha) / se)


def hoeff_rect_pvalue(labeled, u_scores, alpha: float = ALPHA) -> float:
    """Exploratory E3: rectified Hoeffding p-value. Condition on U; Z=Y-f ∈ [-1,1].
    p = exp(-n * max(0, (α - μ̂_f) - mean_Z)^2 / 2)."""
    n = len(labeled)
    if n < N_MIN_LABELED:
        return 1.0
    if len(u_scores) == 0:
        mu_f = sum(f_pred(s) for s, _ in labeled) / n
    else:
        mu_f = sum(f_pred(u) for u in u_scores) / len(u_scores)
    zs = [y - f_pred(s) for s, y in labeled]
    mean_z = sum(zs) / n
    gap = (alpha - mu_f) - mean_z  # positive => mean_Z below null boundary => evidence for R < α
    if gap <= 0:
        return 1.0
    return math.exp(-n * gap * gap / 2.0)


def ltt_from_pvals(pvals):
    """Fixed-sequence LTT on a list of p-values (index 0=loosest). Strict→loose."""
    chosen = None
    for i in range(N_GRID - 1, -1, -1):
        if pvals[i] <= DELTA:
            chosen = i
        else:
            break
    return chosen


def pvals_ppi(stage, u_sorted, floor_idx: int, lam: float = LAMBDA, kind: str = "ppi"):
    """Build length-N_GRID p-value list; mask below floor with p=1."""
    pvals = [1.0] * N_GRID
    # Pre-sort for efficient suffix selection
    stage_sorted = sorted(stage)  # by s ascending
    for i in range(floor_idx, N_GRID):
        t = GRID[i]
        # labeled with s >= t
        lab = [(s, y) for s, y in stage_sorted if s >= t]
        # unlabeled scores >= t
        # u_sorted ascending; bisect
        j = bisect.bisect_left(u_sorted, t)
        u_i = u_sorted[j:]
        if kind == "ppi":
            pvals[i] = ppi_pvalue(lab, u_i, ALPHA, lam)
        elif kind == "hoeff":
            pvals[i] = hoeff_rect_pvalue(lab, u_i, ALPHA)
        else:
            raise ValueError(kind)
    return pvals


def run_ppi(u_sorted, frng: random.Random, b: int, lam: float = LAMBDA, kind: str = "ppi"):
    """All B labels above label-free floor; certify with PPI (or hoeff) LTT."""
    fl = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)
    stage, screened = R0.focused_sample(b, GRID[fl], frng)
    pvals = pvals_ppi(stage, u_sorted, fl, lam=lam, kind=kind)
    return {
        "idx": ltt_from_pvals(pvals),
        "floor": fl,
        "screened": screened,
        "labels": len(stage),  # primary B accounting
        "c_f": min(1.0, C_ANCHOR * SAFETY),
        "lam": lam,
        "kind": kind,
    }


def estimate_lambda_star(tune_labeled, u_scores) -> float:
    """E2: pick λ in PPIPP_LAMBDA_GRID minimizing plug-in SE^2 on the tune slice."""
    best_lam, best_var = 1.0, float("inf")
    for lam in PPIPP_LAMBDA_GRID:
        rhat, se, n, _N = ppi_estimate(tune_labeled, u_scores, lam)
        if rhat is None:
            continue
        v = se * se
        if v < best_var:
            best_var, best_lam = v, lam
    return best_lam


def run_ppipp(u_sorted, frng: random.Random, b: int):
    """E2: 20/80 split for λ*; certify on holdout with asymptotic PPI at λ*."""
    fl = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)
    stage, screened = R0.focused_sample(b, GRID[fl], frng)
    n_tune = max(N_MIN_LABELED, round(PPIPP_TUNE_FRAC * b))
    tune, hold = stage[:n_tune], stage[n_tune:]
    # λ* from tune at the floor threshold (most labels)
    j = bisect.bisect_left(u_sorted, GRID[fl])
    u_at_floor = u_sorted[j:]
    lam_star = estimate_lambda_star(tune, u_at_floor)
    # certify on holdout only (honest split)
    if len(hold) < N_MIN_LABELED:
        return {
            "idx": None, "floor": fl, "screened": screened, "labels": len(stage),
            "c_f": min(1.0, C_ANCHOR * SAFETY), "lam": lam_star, "kind": "ppipp",
        }
    pvals = pvals_ppi(hold, u_sorted, fl, lam=lam_star, kind="ppi")
    return {
        "idx": ltt_from_pvals(pvals),
        "floor": fl,
        "screened": screened,
        "labels": len(stage),
        "c_f": min(1.0, C_ANCHOR * SAFETY),
        "lam": lam_star,
        "kind": "ppipp",
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

        # R1 lf_ltt paired baseline: same F seed consumption 250→500→1000
        frng_lf = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = R1.run_lf(u_sorted, frng_lf, b)
            rec(k, f"lf_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6))

        # Primary ppi_ltt: independent F_k = Random(50000+k), consume 250→500→1000
        frng_ppi = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = run_ppi(u_sorted, frng_ppi, b, lam=LAMBDA, kind="ppi")
            rec(k, f"ppi_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6), lam=o["lam"])

        # E2 PPI++ at B=500 (separate F stream)
        o = run_ppipp(u_sorted, random.Random(50000 + k), 500)
        rec(k, "ppi_ppipp_500", o["idx"], labels=o["labels"],
            floor_t=round(GRID[o["floor"]], 4),
            floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
            screened=o["screened"], c_f=round(o["c_f"], 6), lam=o["lam"])

        # E3 rectified Hoeffding at B=500
        o = run_ppi(u_sorted, random.Random(50000 + k), 500, lam=LAMBDA, kind="hoeff")
        rec(k, "ppi_hoeff_500", o["idx"], labels=o["labels"],
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
        # label budget check
        b_expected = int(a.rsplit("_", 1)[-1])
        assert all(x["labels"] == b_expected for x in rs), (a, [x["labels"] for x in rs[:3]])

    by = {}
    for x in rows:
        by.setdefault(x["k"], {})[x["arm"]] = x["coverage"]
    ks = sorted(by)
    pairs = {}
    for a, bname in (
        ("ppi_ltt_500", "lf_ltt_500"),
        ("ppi_ltt_500", "rand_500"),
        ("ppi_ltt_500", "rand_1000"),
        ("ppi_ltt_250", "lf_ltt_250"),
        ("ppi_ltt_250", "rand_250"),
        ("ppi_ltt_1000", "lf_ltt_1000"),
        ("ppi_ltt_1000", "rand_1000"),
        ("ppi_ltt_1000", "rand_2000"),
        ("lf_ltt_500", "rand_1000"),
        ("ppi_ppipp_500", "lf_ltt_500"),
        ("ppi_hoeff_500", "lf_ltt_500"),
        ("ppi_hoeff_500", "ppi_ltt_500"),
    ):
        pairs[f"{a}_minus_{bname}"] = R0.paired([by[k][a] - by[k][bname] for k in ks])
    summ["paired"] = pairs
    return summ, rows


def verdicts(s):
    p = s["ppi_ltt_500"]
    h1 = "REJECTED" if p["cp95"][0] > DELTA else ("SUPPORTED" if p["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if p["coverage_ratio_vs_oracle"] >= 0.85 else "NOT_PROVEN"
    d3 = s["paired"]["ppi_ltt_500_minus_lf_ltt_500"]
    h3 = "SUPPORTED" if d3["lb95_1s"] > 0 else ("REJECTED" if d3["ub95_1s"] < 0 else "NOT_PROVEN")
    d4 = s["paired"]["ppi_ltt_500_minus_rand_1000"]
    h4 = "SUPPORTED" if d4["lb95_1s"] > -0.01 else ("REJECTED" if d4["ub95_1s"] < -0.01 else "NOT_PROVEN")
    overall = (
        "SUPPORTED" if (h1, h2, h3) == ("SUPPORTED",) * 3
        else ("REJECTED" if "REJECTED" in (h1, h3) else "NOT_PROVEN")
    )
    return {
        "H1_validity": h1,
        "H2_utility_085_oracle": h2,
        "H3_beats_lf_ltt_500": h3,
        "H4_noninferior_rand_1000": h4,
        "overall": overall,
    }


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    summ, rows = run(pop)
    res = {
        "experiment": "LEC-1 R2",
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
            "pvalue": "asymptotic_CLT_Phi",
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
