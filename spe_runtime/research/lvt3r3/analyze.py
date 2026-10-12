"""Usage: python -m spe_runtime.research.lvt3r3.analyze RUN_DIR --delta-vs D1 --delta-fs D2"""
from __future__ import annotations
import json, math, os, sys
from collections import defaultdict
from ..lvt3r2.stats import paired, holm, n_required


def wilson(k, n, z=1.96):
    if n == 0: return [0.0, 0.0]
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return [(c - h) / d, (c + h) / d]


def main():
    run = sys.argv[1]; arg = sys.argv
    dvs = float(arg[arg.index("--delta-vs") + 1]); dfs = float(arg[arg.index("--delta-fs") + 1])
    R = [json.loads(l) for l in open(os.path.join(run, "rows.jsonl"))]
    cfgs = sorted({r["config"] for r in R})
    vs = defaultdict(lambda: defaultdict(list)); fs = defaultdict(lambda: defaultdict(list))
    for r in R:
        vs[r["config"]][r["family"]].append(r["verified"]); fs[r["config"]][r["family"]].append(r["declared"] and not r["verified"])
    fams = sorted(vs[cfgs[0]]); mean = lambda l: sum(l) / len(l)
    out = {"n_families": len(fams), "configs": {}}
    for c in cfgs:
        rr = [r for r in R if r["config"] == c]; dec = sum(r["declared"] for r in rr); f = sum(r["declared"] and not r["verified"] for r in rr)
        out["configs"][c] = {"tasks": len(rr), "declared": dec, "verified": sum(r["verified"] for r in rr), "false_success": f,
                             "verified_rate_family_macro": mean([mean(vs[c][x]) for x in fams]),
                             "fs_per_task": f / len(rr), "fs_per_task_wilson95": wilson(f, len(rr)),
                             "fs_per_declared": f / dec if dec else 0.0, "fs_per_declared_wilson95": wilson(f, dec),
                             "exec_per_task": mean([r["exec"] for r in rr]),
                             "budget_hit_rate": mean([r["budget_hit"] for r in rr])}
    comps = {}
    def d(metric, a, b):
        src = vs if metric == "VS" else fs
        return paired([mean(src[a][x]) - mean(src[b][x]) for x in fams])
    if all(c in cfgs for c in ("U", "R", "RR")):
        comps["VS:U-R"] = d("VS", "U", "R"); comps["VS:U-RR"] = d("VS", "U", "RR")
        comps["FS:R-U"] = d("FS", "R", "U"); comps["FS:RR-U"] = d("FS", "RR", "U")
        out["holm"] = holm({k: v["p_one_sided"] for k, v in comps.items()})
        out["power_n_required"] = {k: n_required(v["sd"], dvs if k.startswith("VS") else dfs, alpha_one_sided=0.05 / 3) for k, v in comps.items()}
    for a, b in (("U_guard", "U"), ("U", "A"), ("R", "A"), ("RR", "A")):
        if a in cfgs and b in cfgs:
            comps[f"VS:{a}-{b}"] = d("VS", a, b); comps[f"FS:{b}-{a}"] = d("FS", b, a)
    out["comparisons"] = comps
    json.dump(out, open(os.path.join(run, "analysis.json"), "w"), indent=1); print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
