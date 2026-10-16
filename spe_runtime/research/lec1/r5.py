"""LEC-1 R5 per docs/lec1/CONTRACT_R5.md: cross-fitted isotonic focusing (CIF).
Label-free coarse floor (R1) → B_FIT isotonic non-increasing ĝ(Y|s) → learned floor from U+ĝ
→ B_CERT cert labels + masked fixed-sequence binomial LTT. Not PPI, not betting.
Grid index 0 = loosest t (0.50), 199 = strictest (0.995).
Usage: python3 -m spe_runtime.research.lec1.r5 OUTDIR"""
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

# Frozen a priori (CONTRACT_R5)
C_ANCHOR = R1.C_ANCHOR  # 0.55
SAFETY = R1.SAFETY      # 1.15
FIT_FRAC = 0.2
LAST_FIT_N = 0  # set by run_cif for tests/mutation gate


def budget_split(b: int):
    """B_FIT = floor(0.2*B), B_CERT = B - B_FIT (frozen a priori)."""
    b_fit = int(math.floor(FIT_FRAC * b))
    return b_fit, b - b_fit


def _pava_decreasing(values):
    """Pool Adjacent Violators for a non-increasing sequence (in place on block means).
    values: list of floats already ordered by ascending covariate.
    Returns list of fitted values, same length, non-increasing.
    """
    n = len(values)
    if n == 0:
        return []
    # blocks: [start, end_exclusive, sum, weight]
    blocks = [[i, i + 1, values[i], 1.0] for i in range(n)]
    i = 0
    while i < len(blocks) - 1:
        m_i = blocks[i][2] / blocks[i][3]
        m_j = blocks[i + 1][2] / blocks[i + 1][3]
        if m_i < m_j - 1e-15:  # violator for non-increasing
            # merge i and i+1
            blocks[i][1] = blocks[i + 1][1]
            blocks[i][2] += blocks[i + 1][2]
            blocks[i][3] += blocks[i + 1][3]
            del blocks[i + 1]
            if i > 0:
                i -= 1  # re-check previous
        else:
            i += 1
    out = [0.0] * n
    for start, end, s, w in blocks:
        m = s / w
        for j in range(start, end):
            out[j] = m
    return out


def fit_isotonic_nonincreasing(labeled):
    """Fit ĝ(s) = P̂(wrong|s) non-increasing in s from pilot labels [(s,y), ...].
    Collapses ties at identical s by averaging y first. Returns (xs, gs) unique ascending xs.
    Empty / single-point handled. Pure Python PAVA.
    """
    if not labeled:
        return ([], [])
    # collapse ties
    buckets = {}
    for s, y in labeled:
        buckets.setdefault(s, []).append(float(y))
    xs = sorted(buckets)
    ys = [sum(buckets[x]) / len(buckets[x]) for x in xs]
    gs = _pava_decreasing(ys)
    # clip to [0,1] (Bernoulli means)
    gs = [min(1.0, max(0.0, g)) for g in gs]
    return (xs, gs)


def predict_isotonic(model, s: float) -> float:
    """Piecewise-constant step: ĝ(s) = g_i for s in [x_i, x_{i+1}); endpoints extend flat."""
    xs, gs = model
    if not xs:
        return ALPHA  # uninformative fallback (no pilot); floor rule then keeps f0 if mean > α often
    if s <= xs[0]:
        return gs[0]
    if s >= xs[-1]:
        return gs[-1]
    # largest i with xs[i] <= s
    i = bisect.bisect_right(xs, s) - 1
    return gs[i]


def mean_ghat_above(u_sorted, model, t: float) -> float | None:
    """Mean ĝ over unlabeled scores >= t. None if empty set."""
    j = bisect.bisect_left(u_sorted, t)
    if j >= len(u_sorted):
        return None
    n = len(u_sorted) - j
    return sum(predict_isotonic(model, u_sorted[k]) for k in range(j, len(u_sorted))) / n


def learned_floor(u_sorted, model, floor0: int, alpha: float = ALPHA) -> int:
    """Largest grid index t >= floor0 with mean_U[s>=GRID[t]] ĝ(s) <= alpha; else floor0.
    Uses only U + ĝ(pilot) — no cert labels.
    """
    best = floor0
    for t in range(floor0, N_GRID):
        m = mean_ghat_above(u_sorted, model, GRID[t])
        if m is not None and m <= alpha:
            best = t
    return best


def run_cif(u_sorted, frng: random.Random, b: int):
    """CIF: coarse lf floor → fit isotonic on B_FIT → learned floor → certify B_CERT with masked LTT."""
    fl0 = R1.label_free_floor(u_sorted, C_ANCHOR, SAFETY)
    b_fit, b_cert = budget_split(b)
    pilot, screened1 = R0.focused_sample(b_fit, GRID[fl0], frng)
    global LAST_FIT_N
    LAST_FIT_N = len(pilot)
    model = fit_isotonic_nonincreasing(pilot)
    fl = learned_floor(u_sorted, model, fl0)
    cert, screened2 = R0.focused_sample(b_cert, GRID[fl], frng)
    counts = R0.certify_counts(cert, fl)  # cert labels ONLY, masked below learned floor
    return {
        "idx": R0.ltt(counts),
        "floor0": fl0,
        "floor": fl,
        "screened": screened1 + screened2,
        "labels": len(pilot) + len(cert),
        "b_fit": b_fit,
        "b_cert": b_cert,
        "c_f": min(1.0, C_ANCHOR * SAFETY),
        "n_cert_at_floor": counts[fl][0],
        "model_n_unique": len(model[0]),
    }


def run(pop_counts, draws=range(N_DRAWS)):
    oracle = core.policy_oracle(pop_counts)
    o_risk, o_cov = core.truth(pop_counts, oracle, N_POP)
    rows = []

    def rec(k, name, idx, **extra):
        r, cv = core.truth(pop_counts, idx, N_POP)
        rows.append({"k": k, "arm": name, "t": None if idx is None else round(GRID[idx], 4),
                     "risk": round(r, 6), "coverage": round(cv, 6), "violation": int(r > ALPHA), **extra})

    def rec_lab(k, name, o, u_sorted, extra=None):
        d = {"labels": o["labels"], "floor_t": round(GRID[o["floor"]], 4),
             "floor_cov": round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6), "screened": o["screened"]}
        if extra:
            d.update(extra)
        rec(k, name, o["idx"], **d)

    for k in draws:
        stream = core.sample(2000, random.Random(30000 + k))
        u_sorted = sorted(s for s, _ in core.sample(N_UNLABELED, random.Random(40000 + k)))

        for b in (250, 500, 1000, 2000):
            rec(k, f"rand_{b}", R0.ltt(core.grid_counts(stream[:b])), labels=b)

        # lf baselines: fresh Random(50000+k) per arm (exact pairing within R5)
        for b in (250, 400, 500, 1000):
            o = R1.run_lf(u_sorted, random.Random(50000 + k), b)
            rec_lab(k, f"lf_ltt_{b}", o, u_sorted)

        # primary CIF arms
        for b in (250, 500, 1000):
            o = run_cif(u_sorted, random.Random(50000 + k), b)
            rec_lab(k, f"cif_ltt_{b}", o, u_sorted, extra={
                "floor0_t": round(GRID[o["floor0"]], 4),
                "b_fit": o["b_fit"], "b_cert": o["b_cert"],
                "learned_raised": int(o["floor"] > o["floor0"]),
            })

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
        if "learned_raised" in rs[0]:
            summ[a]["learned_raised_n"] = sum(x["learned_raised"] for x in rs)
            summ[a]["mean_b_fit"] = round(sum(x["b_fit"] for x in rs) / len(rs), 2)
            summ[a]["mean_b_cert"] = round(sum(x["b_cert"] for x in rs) / len(rs), 2)
        b_expected = int(a.rsplit("_", 1)[-1])
        assert all(x["labels"] == b_expected for x in rs), (a, [x["labels"] for x in rs[:3]])

    by = {}
    for x in rows:
        by.setdefault(x["k"], {})[x["arm"]] = x["coverage"]
    ks = sorted(by)
    pairs = {}
    for a, bname in (
        ("cif_ltt_500", "lf_ltt_500"),
        ("cif_ltt_500", "lf_ltt_400"),
        ("cif_ltt_500", "rand_500"),
        ("cif_ltt_500", "rand_1000"),
        ("cif_ltt_250", "lf_ltt_250"),
        ("cif_ltt_1000", "lf_ltt_1000"),
        ("lf_ltt_500", "rand_500"),
        ("lf_ltt_400", "rand_500"),
    ):
        pairs[f"{a}_minus_{bname}"] = R0.paired([by[k][a] - by[k][bname] for k in ks])
    summ["paired"] = pairs
    return summ, rows


def _tri(d, bar):
    return "SUPPORTED" if d["lb95_1s"] > bar else ("REJECTED" if d["ub95_1s"] < bar else "NOT_PROVEN")


def verdicts(s):
    p = s["cif_ltt_500"]
    h1 = "REJECTED" if p["cp95"][0] > DELTA else ("SUPPORTED" if p["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if p["coverage_ratio_vs_oracle"] >= 0.85 else "NOT_PROVEN"
    pr = s["paired"]
    h3 = _tri(pr["cif_ltt_500_minus_lf_ltt_500"], 0.0)
    h4 = _tri(pr["cif_ltt_500_minus_lf_ltt_500"], -0.01)
    g = "PASS" if p["abstain_all"] <= p["n"] // 2 else "FAIL"
    if h1 == "SUPPORTED" and h3 == "SUPPORTED" and g == "PASS":
        overall = "SUPPORTED"
    elif h1 == "REJECTED" or h3 == "REJECTED" or g == "FAIL":
        overall = "REJECTED"
    else:
        overall = "NOT_PROVEN"
    return {"H1_validity": h1, "H2_utility_085_oracle": h2, "H3_beats_lf_ltt_500": h3,
            "H4_noninferior_lf_ltt_500": h4, "G_abstain_guard": g, "overall": overall}


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    summ, rows = run(pop)
    res = {"experiment": "LEC-1 R5", "alpha": ALPHA, "delta": DELTA, "cost_inr": 0, "n_draws": N_DRAWS,
           "constants": {"c_anchor": C_ANCHOR, "safety": SAFETY, "c_f_primary": min(1.0, C_ANCHOR * SAFETY),
                         "fit_frac": FIT_FRAC, "n_unlabeled": N_UNLABELED,
                         "isotonic": "non_increasing_PAVA_pure_python",
                         "learned_floor": "max_t>=f0_mean_ghat_U_le_alpha"},
           "results": summ, "verdicts": verdicts(summ)}
    with open(f"{out}/summary.json", "w") as f:
        json.dump(res, f, indent=2, sort_keys=True)
    with open(f"{out}/rows.json", "w") as f:
        json.dump(rows, f, sort_keys=True)
    print(json.dumps(res["verdicts"], indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
