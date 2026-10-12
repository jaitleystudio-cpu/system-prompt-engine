"""Run the frozen LVT-3 experiment and compute statistics. Usage:
python -m spe_runtime.research.lvt3.experiment OUT_DIR"""
from __future__ import annotations
import json, math, os, random, statistics, sys, time
from multiprocessing import Pool
from typing import Dict, List
from . import dsl
from .evaluator import Evaluator
from .generator import stream, TRANSFER, TRAPS
from .solver import Agent

CONFIGS = ["A", "B", "C", "D", "E", "E_shuf"]
SEEDS = list(range(10))
T975_DF9 = 2.262


def run_config(args):
    seed, config = args
    tasks = stream(seed)
    ev = Evaluator(seed)
    decoys = None
    if config == "E_shuf":
        r = random.Random(f"shuf|{seed}")
        ids = [t.task_id for t in tasks]
        specs = {t.task_id: t.spec for t in tasks}
        decoys = {}
        for t in tasks:
            while True:
                d = r.choice(ids)
                if d != t.task_id and specs[d] != t.spec: break
            decoys[t.task_id] = specs[d]
    agent = Agent(config, seed, ev, decoys)
    rows = []
    for t in tasks:
        res = agent.solve(t)
        prog = res["program"]
        v = ev.verify(t.task_id, t.spec, (lambda x, p=prog: dsl.run(p, x))) if prog is not None else {"pass": False}
        rows.append({"task": t.task_id, "family": t.family, "split": t.split, "declared": prog is not None,
                     "verified": bool(v["pass"]), "source": "|".join(res["source"]) if isinstance(res["source"], tuple) else res["source"],
                     "exec": res["search_exec"] + res["extra_exec"], "program": repr(prog)})
        agent.feedback(t, res)
    caps = []
    if agent.reg:
        caps = [{"cap": c.cap_id, "s": c.s, "f": c.f, "admitted": c.admitted, "revoked": c.revoked,
                 "dev_s": c.dev_s, "dev_f": c.dev_f} for c in agent.reg.caps.values() if c.admitted or c.revoked]
    return seed, config, rows, caps


def metrics(rows: List[Dict]) -> Dict[str, float]:
    h = [r for r in rows if r["split"] == "hidden"]
    dec = [r for r in h if r["declared"]]
    ver = sum(r["verified"] for r in h)
    tr = [r for r in h if r["family"] in TRANSFER]
    tp = [r for r in h if r["family"] in TRAPS]
    dv = [r for r in rows if r["split"] == "dev"]
    return {
        "verified_success": ver / len(h),
        "false_success": (sum(not r["verified"] for r in dec) / len(dec)) if dec else 0.0,
        "abstain": 1 - len(dec) / len(h),
        "transfer_success": sum(r["verified"] for r in tr) / len(tr),
        "trap_success": sum(r["verified"] for r in tp) / len(tp),
        "cost_per_verified": (sum(r["exec"] for r in h) / ver) if ver else float("inf"),
        "dev_verified_success": sum(r["verified"] for r in dv) / len(dv),
        "reuse_rate": sum(r["source"] not in ("search", None) for r in dec) / len(dec) if dec else 0.0,
    }


def ci_t(d: List[float]):
    m = statistics.mean(d); sd = statistics.stdev(d) if len(d) > 1 else 0.0
    hw = T975_DF9 * sd / math.sqrt(len(d))
    return m, m - hw, m + hw


def ci_boot(d: List[float], n=10000):
    r = random.Random(12345); k = len(d)
    ms = sorted(statistics.mean(r.choice(d) for _ in range(k)) for _ in range(n))
    return ms[int(0.025 * n)], ms[int(0.975 * n) - 1]


def main(out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    t0 = time.time()
    jobs = [(s, c) for s in SEEDS for c in CONFIGS]
    with Pool(min(8, os.cpu_count() or 2)) as p:
        results = p.map(run_config, jobs)
    per = {c: {} for c in CONFIGS}
    caps = {}
    with open(os.path.join(out_dir, "task_rows.jsonl"), "w") as fh:
        for seed, c, rows, cp in results:
            per[c][seed] = metrics(rows); caps[f"{c}/{seed}"] = cp
            for r in rows: fh.write(json.dumps({"seed": seed, "config": c, **r}) + "\n")
    keys = list(next(iter(per["A"].values())).keys())
    summary = {c: {k: {"mean": statistics.mean(per[c][s][k] for s in SEEDS),
                       "sd": statistics.stdev(per[c][s][k] for s in SEEDS)} for k in keys} for c in CONFIGS}
    def diff(a, b, k):
        d = [per[a][s][k] - per[b][s][k] for s in SEEDS]
        m, lo, hi = ci_t(d); blo, bhi = ci_boot(d)
        return {"mean": m, "t_lo": lo, "t_hi": hi, "boot_lo": blo, "boot_hi": bhi}
    comps = {}
    for b in ["A", "B", "C", "D", "E_shuf"]:
        for k in ["verified_success", "false_success", "transfer_success"]:
            comps[f"E-{b}:{k}"] = diff("E", b, k)
    for k in ["verified_success", "false_success"]:
        comps[f"D-C:{k}"] = diff("D", "C", k)
    out = {"per_seed": per, "summary": summary, "comparisons": comps, "capabilities": caps,
           "runtime_s": time.time() - t0}
    with open(os.path.join(out_dir, "results.json"), "w") as fh:
        json.dump(out, fh, indent=1, default=str)
    return out


if __name__ == "__main__":
    o = main(sys.argv[1])
    for c, m in o["summary"].items():
        print(c, {k: round(v["mean"], 4) for k, v in m.items()})
    for k, v in o["comparisons"].items():
        print(k, {a: round(b, 4) for a, b in v.items()})
    print("runtime_s", round(o["runtime_s"], 1))
