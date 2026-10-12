"""Run the frozen AGI-BRAIN R1 experiment (docs/agi-brain/CONTRACT_R1.md).
Usage: python3 -m spe_runtime.research.agi_brain.experiment_r1 OUT_DIR"""
from __future__ import annotations
import hashlib, json, math, os, random, statistics, sys, time
from multiprocessing import Pool
from typing import Dict, List
# Reuse LVT-3 statistics (no duplicate implementation): paired t-CI (df=9) and paired bootstrap.
from spe_runtime.research.lvt3.experiment import ci_t, ci_boot, _sd
from .families import FAMILIES, BEST_KNOWN, fid
from . import netsearch, evaluator_r1

SEEDS = list(range(10))
CONDS = ["A", "B", "C", "D"]
BUDGET = 1500
N_TRAIN = 9  # of 23 families per seed; the remaining 14 are held-out test families
T_BONF_DF9 = 2.933  # t_{0.99167, 9}: Bonferroni over 3 primary/secondary quality contrasts
# Reference sizes = pruned Knuth merge-exchange network (frozen in contract, normalisation only).
REF = {"sort4": 5, "sort5": 9, "sort6": 12, "sort7": 16, "sort8": 19, "sort9": 26, "sort10": 31, "sort11": 37,
       "sort12": 41, "minmax4": 4, "minmax5": 6, "minmax6": 8, "minmax7": 9, "minmax8": 10, "minmax9": 12,
       "minmax10": 14, "minmax11": 16, "minmax12": 18, "median3": 3, "median5": 8, "median7": 14,
       "median9": 22, "median11": 31}


def split(seed: int):
    fams = list(FAMILIES); random.Random(f"split|{seed}").shuffle(fams)
    return fams[:N_TRAIN], fams[N_TRAIN:]


def build_library(seed: int) -> Dict:
    """LVT-style admission: a train-family solution enters the library only if the INDEPENDENT evaluator accepts it."""
    train, _ = split(seed); lib = {}; cost = 0
    for f in train:
        if f[0] != "sort": continue
        r = netsearch.search(f, "C", seed, BUDGET); cost += r["cost"]
        if evaluator_r1.verify(f[0], f[1], r["net"], seed)["valid"]:
            lib[f] = r["net"]
    return {"lib": lib, "cost": cost}


def run_seed_cond(args):
    seed, cond = args
    _, test = split(seed)
    lib = build_library(seed)["lib"] if cond in ("C", "D") else None
    rows = []
    for f in test:
        t0 = time.time()
        r = netsearch.search(f, cond, seed, BUDGET, library=lib)
        v = evaluator_r1.verify(f[0], f[1], r["net"], seed)
        q = (REF[fid(f)] / r["size"]) if v["valid"] and r["size"] else 0.0
        rows.append({"seed": seed, "cond": cond, "family": fid(f), "claimed_valid": True, "valid": v["valid"],
                     "size": r["size"], "depth": r["depth"], "cost": r["cost"], "quality": q,
                     "best_known": BEST_KNOWN.get(f), "hits_best_known": bool(v["valid"] and BEST_KNOWN.get(f) and r["size"] <= BEST_KNOWN[f]),
                     "net_sha": hashlib.sha256(json.dumps(r["net"]).encode()).hexdigest()[:16], "sec": round(time.time() - t0, 3)})
    return rows


def per_seed(rows, cond):
    out = {}
    for s in SEEDS:
        rr = [r for r in rows if r["seed"] == s and r["cond"] == cond]
        out[s] = {"quality": statistics.mean(r["quality"] for r in rr),
                  "false_success": sum(not r["valid"] for r in rr) / len(rr),
                  "log_cost": math.log(sum(r["cost"] for r in rr)),
                  "cost": sum(r["cost"] for r in rr),
                  "depth": statistics.mean(r["depth"] for r in rr if r["valid"]) if any(r["valid"] for r in rr) else float("nan")}
    return out


def main(out_dir: str):
    os.makedirs(out_dir, exist_ok=True); t0 = time.time()
    with Pool(min(8, os.cpu_count() or 2)) as p:
        rows = [r for rr in p.map(run_seed_cond, [(s, c) for s in SEEDS for c in CONDS]) for r in rr]
    with open(os.path.join(out_dir, "rows.jsonl"), "w") as fh:
        for r in rows: fh.write(json.dumps(r, sort_keys=True) + "\n")
    ps = {c: per_seed(rows, c) for c in CONDS}
    means = {c: {k: statistics.mean(ps[c][s][k] for s in SEEDS) for k in ("quality", "false_success", "cost", "depth")} for c in CONDS}

    def contrast(a, b, k):
        d = [ps[a][s][k] - ps[b][s][k] for s in SEEDS]
        m, lo, hi = ci_t(d); bl, bh = ci_boot(d); hw = T_BONF_DF9 * _sd(d) / math.sqrt(len(d))
        return {"mean": m, "t95": [lo, hi], "boot95": [bl, bh], "bonf": [m - hw, m + hw]}

    res = {"means": means,
           "quality": {"B-A": contrast("B", "A", "quality"), "C-B": contrast("C", "B", "quality"), "D-C": contrast("D", "C", "quality")},
           "false_success": {"A-B": contrast("A", "B", "false_success")},
           "log_cost": {"D-C": contrast("D", "C", "log_cost"), "C-B": contrast("C", "B", "log_cost")},
           "runtime_sec": round(time.time() - t0, 1)}
    q, lc = res["quality"]["D-C"], res["log_cost"]["D-C"]
    h1 = lc["bonf"][1] < 0 and q["bonf"][0] > -0.02
    h2 = res["quality"]["C-B"]["bonf"][0] > 0
    h3 = res["quality"]["B-A"]["bonf"][0] > 0
    res["decisions"] = {"H1_world_model_cheaper_noninferior": h1, "H2_library_transfer_improves_quality": h2,
                        "H3_tools_improve_quality_over_plain": h3,
                        "verdict": "SUPPORTED_WITHIN_TESTED_SCOPE (H1)" if h1 else "NOT_PROVEN (H1)",
                        "programme_status": "RESEARCH_PROPOSAL - NOT AGI_PROVEN"}
    with open(os.path.join(out_dir, "results.json"), "w") as fh: json.dump(res, fh, indent=2, sort_keys=True)
    print(json.dumps(res, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
