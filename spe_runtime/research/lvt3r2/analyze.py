"""Family-level analysis. Usage: python -m spe_runtime.research.lvt3r2.analyze RUN_DIR [--delta 0.05]"""
from __future__ import annotations
import json, os, sys
from collections import defaultdict
from .stats import paired, holm, n_required

def load(run):
    fam = defaultdict(lambda: defaultdict(list)); cost = defaultdict(list); dec = defaultdict(lambda: [0, 0]); kinds = {}
    for line in open(os.path.join(run, "rows.jsonl")):
        r = json.loads(line); c = r["config"]
        fam[c][r["family"]].append(r["verified"]); cost[c].append(r["exec"]); kinds[r["family"]] = r["kind"]
        if r["declared"]: dec[c][0] += 1; dec[c][1] += (not r["verified"])
    fm = {c: {f: sum(v) / len(v) for f, v in d.items()} for c, d in fam.items()}
    return fm, cost, dec, kinds

def diff(fm, a, b, fams):
    return paired([fm[a][f] - fm[b][f] for f in fams])

def main():
    run = sys.argv[1]; delta = float(sys.argv[sys.argv.index("--delta") + 1]) if "--delta" in sys.argv else 0.05
    fm, cost, dec, kinds = load(run); cfgs = list(fm); fams = sorted(next(iter(fm.values())))
    out = {"n_families": len(fams), "configs": {}}
    for c in cfgs:
        out["configs"][c] = {"verified_success": sum(fm[c].values()) / len(fams),
                             "mean_exec_per_task": sum(cost[c]) / len(cost[c]),
                             "false_success_rate": dec[c][1] / dec[c][0] if dec[c][0] else 0.0,
                             "by_kind": {k: sum(fm[c][f] for f in fams if kinds[f] == k) / max(1, sum(kinds[f] == k for f in fams))
                                         for k in sorted(set(kinds.values()))}}
    comps = {}
    pairs = [("E_CAPPED", "B"), ("E_CAPPED", "A"), ("E", "B"), ("E", "E_noguard"), ("E", "E_randprobe"),
             ("E", "E_shufv"), ("B", "A")]
    for a, b in pairs:
        if a in fm and b in fm: comps[f"{a}-{b}"] = diff(fm, a, b, fams)
    for k in ("long", "transfer", "novel"):
        fk = [f for f in fams if kinds[f] == k]
        for a, b in (("E", "E_noguard"), ("E", "E_randprobe"), ("E_CAPPED", "B")):
            if a in fm and b in fm and len(fk) > 1: comps[f"{a}-{b}@{k}"] = diff(fm, a, b, fk)
    prim = [h for h in ("E_CAPPED-B", "E_CAPPED-A", "E-B") if h in comps]
    if prim: out["holm"] = holm({h: comps[h]["p_one_sided"] for h in prim})
    if "E_CAPPED-B" in comps:
        out["power_n_required_for_delta"] = n_required(comps["E_CAPPED-B"]["sd"], delta)
    out["comparisons"] = comps
    json.dump(out, open(os.path.join(run, "analysis.json"), "w"), indent=1)
    print(json.dumps(out, indent=1))

if __name__ == "__main__":
    main()
