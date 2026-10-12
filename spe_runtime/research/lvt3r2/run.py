"""Run R2. Usage:
  python -m spe_runtime.research.lvt3r2.run SPLIT OUT_DIR [--configs A,B,...] [--budget N] [--expect-prereg-sha SHA]
SPLIT in {val, holdout}. Agents learn on train (+dev) with evaluator feedback, then are scored on SPLIT
with no feedback. holdout refuses to run unless docs/lvt3/r2/PREREG.md matches --expect-prereg-sha and is
committed unmodified."""
from __future__ import annotations
import hashlib, json, os, random, subprocess, sys, time
from multiprocessing import Pool
from ..lvt3 import dsl
from ..lvt3.evaluator import Evaluator
from .tasks import make_tasks, family_plan, manifest_hash
from .agent import Agent

SEEDS = [0, 1, 2]
ALL = ["A", "B", "E", "E_CAPPED", "E_noguard", "E_randprobe", "E_shufv"]
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PREREG = os.path.join(REPO, "docs", "lvt3", "r2", "PREREG.md")


def job(args):
    seed, cfg, split, budget = args
    ev = Evaluator(1000 + seed)
    learn = make_tasks("train", seed) + make_tasks("dev", seed)
    test = make_tasks(split, seed)
    decoys = None
    if cfg == "E_shufv":
        r = random.Random(f"r2shuf|{seed}"); specs = [t.spec for t in learn]
        decoys = {}
        for t in learn:
            d = r.choice(specs)
            while d == t.spec: d = r.choice(specs)
            decoys[t.task_id] = d
    ag = Agent(cfg, seed, ev, budget=budget, decoys=decoys)
    for t in learn:
        ag.feedback(t, ag.solve(t), learn=True)
    rows = []
    for t in test:
        res = ag.solve(t); p = res["program"]
        ok = bool(ev.verify(t.task_id, t.spec, lambda x, q=p: dsl.run(q, x))["pass"]) if p is not None else False
        rows.append({"seed": seed, "config": cfg, "task": t.task_id, "family": t.family, "kind": t.kind,
                     "declared": p is not None, "verified": ok, "exec": res["exec"],
                     "source": res["source"], "budget_hit": res["budget_hit"]})
    ncaps = len([c for c in ag.reg.caps.values() if c.admitted and not c.revoked]) if ag.reg else len(ag.lib)
    return rows, {"seed": seed, "config": cfg, "library_size": ncaps,
                  "revoked": len([c for c in ag.reg.caps.values() if c.revoked]) if ag.reg else 0}


def main():
    a = sys.argv[1:]; split, out = a[0], a[1]
    cfgs = ALL; budget = None; sha = None
    if "--configs" in a: cfgs = a[a.index("--configs") + 1].split(",")
    if "--budget" in a: budget = float(a[a.index("--budget") + 1])
    if "--expect-prereg-sha" in a: sha = a[a.index("--expect-prereg-sha") + 1]
    if split == "holdout":
        if not os.path.exists(PREREG): sys.exit("REFUSED: no PREREG.md")
        actual = hashlib.sha256(open(PREREG, "rb").read()).hexdigest()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", PREREG, os.path.dirname(__file__)], cwd=REPO, capture_output=True, text=True).stdout.strip()
        if sha != actual or dirty:
            sys.exit(f"REFUSED: prereg sha {actual} != expected {sha} or file not committed ({dirty!r})")
    if ("E_CAPPED" in cfgs or "B" in cfgs) and budget is None:
        sys.exit("E_CAPPED/B require --budget")
    os.makedirs(out, exist_ok=True); t0 = time.time()
    with Pool(8) as p:
        res = p.map(job, [(s, c, split, budget) for c in cfgs for s in SEEDS])
    with open(os.path.join(out, "rows.jsonl"), "w") as fh:
        for rows, _ in res:
            for r in rows: fh.write(json.dumps(r) + "\n")
    meta = {"split": split, "configs": cfgs, "seeds": SEEDS, "budget": budget,
            "manifest_sha256": manifest_hash(family_plan()), "agents": [m for _, m in res],
            "runtime_s": round(time.time() - t0, 1)}
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), indent=1)
    print(json.dumps(meta)[:2000])


if __name__ == "__main__":
    main()
