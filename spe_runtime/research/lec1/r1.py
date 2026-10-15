"""LEC-1 R1 per docs/lec1/CONTRACT_R1.md: label-free quantile floor LTT (lf_ltt) vs R0 pf_ltt at equal budget.
Reuses R0 helpers + CRC-1 DGP. Floor from unlabeled scores only (C_ANCHOR=0.55, SAFETY=1.15).
Grid index 0 = loosest t (0.50), 199 = strictest (0.995). Usage: python3 -m spe_runtime.research.lec1.r1 OUTDIR"""
from __future__ import annotations

import json
import random
import sys

from spe_runtime.research.crc1 import core
from spe_runtime.research.lec1 import r0 as R0

ALPHA, DELTA = R0.ALPHA, R0.DELTA
GRID = R0.GRID
N_GRID = R0.N_GRID
N_POP = R0.N_POP
N_DRAWS = R0.N_DRAWS
N_UNLABELED = R0.N_UNLABELED

# Frozen a priori (CONTRACT_R1) — not tuned to R0 outcomes
C_ANCHOR = 0.55
SAFETY = 1.15
# Exploratory sensitivity only (post-hoc; not primary)
SENSITIVITY_ANCHORS = (0.45, 0.65)


def label_free_floor(u_sorted, c_anchor: float = C_ANCHOR, safety: float = SAFETY) -> int:
    """Largest grid index with unlabeled coverage >= min(1, c_anchor * safety); 0 if none.
    Floor is measurable from U alone — no labels / pilot."""
    c_f = min(1.0, c_anchor * safety)
    return R0.floor_from_coverage(u_sorted, c_f)


def run_lf(u_sorted, frng: random.Random, b: int, c_anchor: float = C_ANCHOR, safety: float = SAFETY):
    """All B labels from focused stream above label-free floor; certify with masked LTT."""
    fl = label_free_floor(u_sorted, c_anchor, safety)
    stage, screened = R0.focused_sample(b, GRID[fl], frng)
    counts = R0.certify_counts(stage, fl)
    return {
        "idx": R0.ltt(counts),
        "floor": fl,
        "screened": screened,
        "labels": len(stage),
        "n_at_floor": counts[fl][0],
        "c_f": min(1.0, c_anchor * safety),
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

        # R0 pf_ltt: same seed consumption order as R0 (250 then 500 then 1000) for fair pairing
        frng_pf = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = R0.run_pf(stream, u_sorted, frng_pf, b)
            rec(k, f"pf_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                fallback=int(o["fallback"]), screened=o["screened"])

        # Primary lf_ltt: independent F_k = Random(50000+k), consume 250 then 500 then 1000
        frng_lf = random.Random(50000 + k)
        for b in (250, 500, 1000):
            o = run_lf(u_sorted, frng_lf, b)
            rec(k, f"lf_ltt_{b}", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6))

        # Exploratory sensitivity (post-hoc): B=500 only, separate F streams per anchor
        for ca in SENSITIVITY_ANCHORS:
            o = run_lf(u_sorted, random.Random(50000 + k), 500, c_anchor=ca)
            rec(k, f"lf_sens_{ca}_500", o["idx"], labels=o["labels"],
                floor_t=round(GRID[o["floor"]], 4),
                floor_cov=round(R0.cov_u(u_sorted, GRID[o["floor"]]), 6),
                screened=o["screened"], c_f=round(o["c_f"], 6), c_anchor=ca)

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
            if "fallback" in rs[0]:
                summ[a]["fallbacks"] = sum(x["fallback"] for x in rs)
        if "screened" in rs[0]:
            summ[a]["mean_screened"] = round(sum(x["screened"] for x in rs) / len(rs), 2)
        # label budget check: arm name ends with _B
        b_expected = int(a.rsplit("_", 1)[-1])
        assert all(x["labels"] == b_expected for x in rs), (a, [x["labels"] for x in rs[:3]])

    by = {}
    for x in rows:
        by.setdefault(x["k"], {})[x["arm"]] = x["coverage"]
    ks = sorted(by)
    pairs = {}
    for a, bname in (
        ("lf_ltt_500", "pf_ltt_500"),
        ("lf_ltt_500", "rand_500"),
        ("lf_ltt_500", "rand_1000"),
        ("lf_ltt_250", "pf_ltt_250"),
        ("lf_ltt_250", "rand_250"),
        ("lf_ltt_1000", "pf_ltt_1000"),
        ("lf_ltt_1000", "rand_1000"),
        ("lf_ltt_1000", "rand_2000"),
        ("pf_ltt_500", "rand_500"),
    ):
        pairs[f"{a}_minus_{bname}"] = R0.paired([by[k][a] - by[k][bname] for k in ks])
    summ["paired"] = pairs
    return summ, rows


def verdicts(s):
    p = s["lf_ltt_500"]
    h1 = "REJECTED" if p["cp95"][0] > DELTA else ("SUPPORTED" if p["cp95"][1] <= DELTA else "NOT_PROVEN")
    h2 = "SUPPORTED" if p["coverage_ratio_vs_oracle"] >= 0.85 else "NOT_PROVEN"
    d3 = s["paired"]["lf_ltt_500_minus_pf_ltt_500"]
    h3 = "SUPPORTED" if d3["lb95_1s"] > 0 else ("REJECTED" if d3["ub95_1s"] < 0 else "NOT_PROVEN")
    d4 = s["paired"]["lf_ltt_500_minus_rand_1000"]
    h4 = "SUPPORTED" if d4["lb95_1s"] > -0.01 else ("REJECTED" if d4["ub95_1s"] < -0.01 else "NOT_PROVEN")
    overall = (
        "SUPPORTED" if (h1, h2, h3) == ("SUPPORTED",) * 3
        else ("REJECTED" if "REJECTED" in (h1, h3) else "NOT_PROVEN")
    )
    return {
        "H1_validity": h1,
        "H2_utility_085_oracle": h2,
        "H3_beats_pf_ltt_500": h3,
        "H4_noninferior_rand_1000": h4,
        "overall": overall,
    }


def main(out):
    pop = core.grid_counts(core.sample(N_POP, random.Random(999)))
    summ, rows = run(pop)
    res = {
        "experiment": "LEC-1 R1",
        "alpha": ALPHA,
        "delta": DELTA,
        "cost_inr": 0,
        "n_draws": N_DRAWS,
        "constants": {
            "c_anchor": C_ANCHOR,
            "safety": SAFETY,
            "c_f_primary": min(1.0, C_ANCHOR * SAFETY),
            "n_unlabeled": N_UNLABELED,
            "sensitivity_anchors": list(SENSITIVITY_ANCHORS),
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
