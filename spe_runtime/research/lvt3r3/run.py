"""Usage: python -m spe_runtime.research.lvt3r3.run SPLIT OUT_DIR --budget N [--configs ..] [--expect-prereg-sha SHA]
SPLIT in {r3val, r3holdout}. r3holdout refuses unless docs/lvt3/r3/PREREG.md matches the sha and it and the
lvt3r3 package are committed unmodified."""
from __future__ import annotations
import hashlib, json, os, subprocess, sys, time
from multiprocessing import Pool
from ..lvt3 import dsl
from ..lvt3.evaluator import Evaluator
from .tasks import make_tasks, r3_plan, manifest_hash
from .agent import Agent

SEEDS = [0, 1, 2]
ALL = ["A", "U", "R", "RR", "U_guard"]
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PREREG = os.path.join(REPO, "docs", "lvt3", "r3", "PREREG.md")


def job(a):
    seed, cfg, split, budget = a
    ev = Evaluator(3000 + seed); ag = Agent(cfg, seed, ev, budget)
    for t in make_tasks("train", seed) + make_tasks("dev", seed): ag.learn(t)
    rows = []
    for t in make_tasks(split, seed):
        r = ag.solve(t); p = r["program"]
        ok = bool(ev.verify(t.task_id, t.spec, lambda x, q=p: dsl.run(q, x))["pass"]) if p is not None else False
        rows.append({"seed": seed, "config": cfg, "task": t.task_id, "family": t.family, "kind": t.kind,
                     "declared": p is not None, "verified": ok, "exec": r["exec"], "budget_hit": r["budget_hit"],
                     "probes_used": r["probes_used"]})
    return rows


def main():
    a = sys.argv[1:]; split, out = a[0], a[1]
    budget = float(a[a.index("--budget") + 1]) if "--budget" in a else None
    cfgs = a[a.index("--configs") + 1].split(",") if "--configs" in a else ALL
    sha = a[a.index("--expect-prereg-sha") + 1] if "--expect-prereg-sha" in a else None
    if split == "r3holdout":
        if not os.path.exists(PREREG): sys.exit("REFUSED: no PREREG.md")
        actual = hashlib.sha256(open(PREREG, "rb").read()).hexdigest()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", PREREG, os.path.dirname(__file__)],
                               cwd=REPO, capture_output=True, text=True).stdout.strip()
        if sha != actual or dirty: sys.exit(f"REFUSED: prereg sha {actual} != {sha} or dirty {dirty!r}")
    if any(c != "A" for c in cfgs) and budget is None: sys.exit("library arms require --budget")
    os.makedirs(out, exist_ok=True); t0 = time.time()
    with Pool(8) as p:
        res = p.map(job, [(s, c, split, budget) for c in cfgs for s in SEEDS])
    with open(os.path.join(out, "rows.jsonl"), "w") as fh:
        for rows in res:
            for r in rows: fh.write(json.dumps(r) + "\n")
    meta = {"split": split, "configs": cfgs, "seeds": SEEDS, "budget": budget,
            "manifest_sha256": manifest_hash(r3_plan()), "runtime_s": round(time.time() - t0, 1)}
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), indent=1); print(json.dumps(meta))


if __name__ == "__main__":
    main()
