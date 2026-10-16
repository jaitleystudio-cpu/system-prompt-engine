"""LEC-1 R4 per docs/lec1/CONTRACT_R4.md: tight-range PPI betting (Bernoulli-Y with per-item PPI shift),
aGRAPA predictable stakes, running-max Ville p-values, iid acquisition order, fixed-sequence LTT.
Primary: ppi_bet_ltt. Secondary: bern_bet_ltt. Baselines: R2 ppi_ltt, R1 lf_ltt, R0 rand.
Grid index 0 = loosest t (0.50), 199 = strictest (0.995).
Usage: python3 -m spe_runtime.research.lec1.r4 OUTDIR"""
from __future__ import annotations

import bisect
import json
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

# Frozen a priori (CONTRACT_R4)
C_ANCHOR = R1.C_ANCHOR  # 0.55
SAFETY = R1.SAFETY      # 1.15
N_MIN_LABELED = 2
C_TRUNC = 0.5
M0 = ALPHA / 2.0              # prior pseudo-observation mean
V0 = ALPHA * (1.0 - ALPHA)    # prior pseudo-observation variance


def f_pred(s: float) -> float:
    """Frozen a-priori predictor of P(wrong|s): clip(1-s, 0, 1)."""
    return min(1.0, max(0.0, 1.0 - s))


def mu_f_hat(u_scores, labeled) -> float:
    if len(u_scores) == 0:
        n = len(labeled)
        return 0.0 if n == 0 else sum(f_pred(s) for s, _ in labeled) / n
    return sum(f_pred(u) for u in u_scores) / len(u_scores)


def stake(ws_past, hi: float, alpha: float = ALPHA, c: float = C_TRUNC) -> float:
    """aGRAPA predictable stake from PAST observations only."""
    t = len(ws_past) + 1
    m_hat = (M0 + sum(ws_past)) / t
    var = (V0 + sum((w - m_hat) ** 2 for w in ws_past)) / t
    g = alpha - m_hat
    lam = g / (var + g * g)
    return min(max(lam, 0.0), c / (hi - alpha))


def bet_pvalue(ws, hi: float, alpha: float = ALPHA, c: float = C_TRUNC) -> float:
    """Anytime-valid p for H0: E[W] >= alpha, W <= hi. p = min(1, 1/max_t M_t)."""
    n = len(ws)
    if n < N_MIN_LABELED:
        return 1.0
    lam_max = c / (hi - alpha)
    wealth, best = 1.0, 1.0
    s1 = 0.0   # sum of past W
    s2 = 0.0   # sum of past W^2
    for t, w in enumerate(ws, start=1):
        m_hat = (M0 + s1) / t
        # sum_{j<t} (W_j - m_hat)^2 = s2 - 2 m_hat s1 + (t-1) m_hat^2
        ss = s2 - 2.0 * m_hat * s1 + (t - 1) * m_hat * m_hat
        var = (V0 + max(ss, 0.0)) / t
        g = alpha - m_hat
        lam = g / (var + g * g)
        lam = min(max(lam, 0.0), lam_max)
        wealth *= (1.0 + lam * (alpha - w))
        if wealth > best:
            best = wealth
        s1 += w
        s2 += w * w
    return min(1.0, 1.0 / best)


def ppi_bet_pvalue(labeled, u_scores, alpha: float = ALPHA, c: float = C_TRUNC) -> float:
    """labeled in acquisition order. W = y - f(s) + mu_f_hat(U), hi = mu_f + 1."""
    if len(labeled) < N_MIN_LABELED:
        return 1.0
    mu_f = mu_f_hat(u_scores, labeled)
    ws = [y - f_pred(s) + mu_f for s, y in labeled]
    return bet_pvalue(ws, mu_f + 1.0, alpha, c)


def bern_bet_pvalue(labeled, u_scores=None, alpha: float = ALPHA, c: float = C_TRUNC) -> float:
    if len(labeled) < N_MIN_LABELED:
        return 1.0
    return bet_pvalue([float(y) for _, y in labeled], 1.0, alpha, c)


def _pval_at(stage, u_sorted, i, kind, c, order):
    t = GRID[i]
    lab = [(s, y) for s, y in stage if s >= t]  # acquisition order preserved
    if order == "sorted":
        lab = sorted(lab, key=lambda sy: sy[0])  # E2 diagnostic only (R3 order)
    if kind == "bern":
        return bern_bet_pvalue(lab, None, ALPHA, c)
    j = bisect.bisect_left(u_sorted, t)
    return ppi_bet_pvalue(lab, u_sorted[j:], ALPHA, c)


def pvals_bet(stage, u_sorted, floor_idx: int, kind="ppi", c=C_TRUNC, order="acq"):
    """Eager length-N_GRID p-values; masked below floor with p=1."""
    pvals = [1.0] * N_GRID
    for i in range(floor_idx, N_GRID):
        pvals[i] = _pval_at(stage, u_sorted, i, kind, c, order)
    return pvals


def ltt_from_pvals(pvals):
    chosen = None
    for i in range(N_GRID - 1, -1, -1):
        if pvals[i] <= DELTA:
            chosen = i
        else:
            break
    return chosen


def ltt_lazy(stage, u_sorted, floor_idx: int, kind="ppi", c=C_TRUNC, order="acq"):
    """Same selection as ltt_from_pvals(pvals_bet(...)); computes only p-values the rule reads."""
    chosen = None
    for i in range(N_GRID - 1, -1, -1):
        if i < floor_idx:
            break  # masked p = 1 > delta
        if _pval_at(stage, u_sorted, i, kind, c, order) <= DELTA:
            chosen = i
        else:
            break
    return chosen


def run_bet(u_sorted, frng: random.Random, b: int, kind="ppi", c=C_TRUNC, order="acq"):
    fl = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)
    stage, screened = R0.focused_sample(b, GRID[fl], frng)
    return {
        "idx": ltt_lazy(stage, u_sorted, fl, kind, c, order),
        "floor": fl,
        "screened": screened,
        "labels": len(stage),
        "c_f": min(1.0, C_ANCHOR * SAFETY),
        "kind": f"{kind}_bet",
    }


def run(pop_counts, draws=range(N_DRAWS)):
    oracle = core.policy_oracle(pop_counts)
    o_risk, o_cov = core.truth(pop_counts, oracle, N_POP)
    rows = []

    def rec(k, name, idx, **extra):
        r, cv = core.truth(pop_counts, idx, N_POP)
        rows.append({"k": k, "arm": name, "t": None if idx is None else round(GRID[idx], 4),
                     "risk": round(r, 6), "coverage": round(cv, 6), "violation": int(r > ALPHA), **extra})

    def rec_lab(k, name, o, u_sorted):
        rec(k, name, o["idx"], labels=o["labels"], floor_t=round(GRID[o["floor"]], 4),
            floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6), screened=o["screened"])

    for k in draws:
        stream = core.sample(2000, random.Random(30000 + k))
        u_sorted = sorted(s for s, _ in core.sample(N_UNLABELED, random.Random(40000 + k)))
        for b in (250, 500, 1000, 2000):
            rec(k, f"rand_{b}", R0.ltt(core.grid_counts(stream[:b])), labels=b)
        for b in (250, 500, 1000):
            rec_lab(k, f"lf_ltt_{b}", R1.run_lf(u_sorted, random.Random(50000 + k), b), u_sorted)
            rec_lab(k, f"ppi_ltt_{b}", R2.run_ppi(u_sorted, random.Random(50000 + k), b, lam=R2.LAMBDA, kind="ppi"),
                    u_sorted)
            rec_lab(k, f"ppi_bet_ltt_{b}", run_bet(u_sorted, random.Random(50000 + k), b, "ppi"), u_sorted)
            rec_lab(k, f"bern_bet_ltt_{b}", run_bet(u_sorted, random.Random(50000 + k), b, "bern"), u_sorted)
        rec_lab(k, "ppi_bet_sorted_500", run_bet(u_sorted, random.Random(50000 + k), 500, "ppi", order="sorted"),
                u_sorted)
        rec_lab(k, "ppi_bet_c075_500", run_bet(u_sorted, random.Random(50000 + k), 500, "ppi", c=0.75), u_sorted)

    arms = sorted({x["arm"] for x in rows})
    summ = {"oracle": {"t": round(GRID[oracle], 4), "risk": round(o_risk, 6), "coverage": round(o_cov, 6)}}
    for a in arms:
        rs = [x for x in rows if x["arm"] == a]
        summ[a] = R0.summarize(rs, o_cov)
        if "floor_cov" in rs[0]:
            fc = sorted(x["floor_cov"] for x in rs)
            summ[a].update({"floor_cov_median": fc[len(fc) // 2], "floor_cov_p10": fc[len(fc) // 10],
                            "floor_cov_p90": fc[(9 * len(fc)) // 10],
                            "mean_screened": round(sum(x["screened"] for x in rs) / len(rs), 2)})
        b_expected = int(a.rsplit("_", 1)[-1])
        assert all(x["labels"] == b_expected for x in rs), (a, [x["labels"] for x in rs[:3]])

    by = {}
    for x in rows:
        by.setdefault(x["k"], {})[x["arm"]] = x["coverage"]
    ks = sorted(by)
    pairs = {}
    for a, bname in (
        ("ppi_bet_ltt_500", "lf_ltt_500"), ("ppi_bet_ltt_500", "bern_bet_ltt_500"),
        ("ppi_bet_ltt_500", "ppi_ltt_500"), ("ppi_bet_ltt_500", "rand_500"), ("ppi_bet_ltt_500", "rand_1000"),
        ("ppi_bet_ltt_250", "lf_ltt_250"), ("ppi_bet_ltt_1000", "lf_ltt_1000"),
        ("bern_bet_ltt_500", "lf_ltt_500"), ("ppi_bet_c075_500", "ppi_bet_ltt_500"),
        ("ppi_bet_sorted_500", "ppi_bet_ltt_500"), ("ppi_ltt_500", "lf_ltt_500"),
    ):
        pairs[f"{a}_minus_{bname}"] = R0.paired([by[k][a] - by[k][bname] for k in ks])
    summ["paired"] = pairs
    return summ, rows


def _tri(d, bar):
    return "SUPPORTED" if d["lb95_1s"] > bar else ("REJECTED" if d["ub95_1s"] < bar else "NOT_PROVEN")


def verdicts(s):
    p = s["ppi_bet_ltt_500"]
    h1 = "REJECTED" if p["cp95"][0] > DELTA else ("SUPPORTED" if p["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if p["coverage_ratio_vs_oracle"] >= 0.85 else "NOT_PROVEN"
    pr = s["paired"]
    h3 = _tri(pr["ppi_bet_ltt_500_minus_lf_ltt_500"], 0.0)
    h4 = _tri(pr["ppi_bet_ltt_500_minus_lf_ltt_500"], -0.01)
    h5 = _tri(pr["ppi_bet_ltt_500_minus_bern_bet_ltt_500"], 0.0)
    h6 = _tri(pr["ppi_bet_ltt_500_minus_ppi_ltt_500"], -0.02)
    g = "PASS" if p["abstain_all"] <= p["n"] // 2 else "FAIL"
    if h1 == "SUPPORTED" and h3 == "SUPPORTED" and g == "PASS":
        overall = "SUPPORTED"
    elif h1 == "REJECTED" or h3 == "REJECTED" or g == "FAIL":
        overall = "REJECTED"
    else:
        overall = "NOT_PROVEN"
    return {"H1_validity": h1, "H2_utility_085_oracle": h2, "H3_beats_lf_ltt_500": h3,
            "H4_noninferior_lf_ltt_500": h4, "H5_ppi_shift_beats_bern_bet": h5,
            "H6_noninferior_ppi_ltt_500": h6, "G_abstain_guard": g, "overall": overall}


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    summ, rows = run(pop)
    res = {"experiment": "LEC-1 R4", "alpha": ALPHA, "delta": DELTA, "cost_inr": 0, "n_draws": N_DRAWS,
           "constants": {"c_anchor": C_ANCHOR, "safety": SAFETY, "c_f_primary": min(1.0, C_ANCHOR * SAFETY),
                         "c_trunc": C_TRUNC, "m0": M0, "v0": V0, "n_min_labeled": N_MIN_LABELED,
                         "n_unlabeled": N_UNLABELED, "predictor": "clip(1-s,0,1)",
                         "pvalue": "aGRAPA_betting_running_max_Ville", "order": "acquisition"},
           "results": summ, "verdicts": verdicts(summ)}
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    with open(f"{out}/rows.json", "w") as f:
        json.dump(rows, f, sort_keys=True)
    print(json.dumps(res["verdicts"], indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
