"""R03 analysis. Usage: python -m spe_runtime.research.rgd1.analyze RUN_DIR [--delta 0.10]"""
from __future__ import annotations
import json, math, os, random, sys
from collections import defaultdict

TCRIT = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
         11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093,
         20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 29: 2.045, 39: 2.023, 59: 2.001}


def tc(df):
    return TCRIT.get(df) or TCRIT[max(k for k in TCRIT if k <= df)]


def paired(d, perms=20000, seed=20261012):
    n = len(d); m = sum(d) / n; sd = (sum((x - m) ** 2 for x in d) / (n - 1)) ** 0.5 if n > 1 else 0.0
    hw = tc(n - 1) * sd / math.sqrt(n) if n > 1 else float("inf")
    r = random.Random(seed); ge = sum(1 for _ in range(perms) if sum(x if r.random() < 0.5 else -x for x in d) / n >= m - 1e-12)
    return {"n": n, "mean": m, "sd": sd, "ci_lo": m - hw, "ci_hi": m + hw, "p_one_sided": (ge + 1) / (perms + 1)}


def holm(ps, alpha=0.05):
    o = sorted(ps, key=ps.get); out = {}; run = 0.0; rej = True
    for i, h in enumerate(o):
        adj = min(1.0, max(run, (len(o) - i) * ps[h])); run = adj; rej = rej and adj < alpha
        out[h] = {"p": ps[h], "p_holm": adj, "reject_h0": rej}
    return out


def wilson(k, n, z=1.96):
    if n == 0: return [None, None]
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return [(c - h) / d, (c + h) / d]


def main():
    run = sys.argv[1]; delta = float(sys.argv[sys.argv.index("--delta") + 1]) if "--delta" in sys.argv else 0.10
    R = [json.loads(l) for l in open(os.path.join(run, "rows.jsonl"))]
    arms = sorted({r["arm"] for r in R}); out = {"arms": {}}
    ret = [r for r in R if r["kind"] == "retracted"]; ctl = [r for r in R if r["kind"] == "control"]
    for a in arms:
        rr = [r for r in ret if r["arm"] == a]; cc = [r for r in ctl if r["arm"] == a]
        hits = sum(r["hit"] for r in rr); nret = sum((r["n_retraction_docs"] or 0) for r in rr)
        fam = defaultdict(list)
        for r in rr: fam[r["family"]].append(r["hit"])
        out["arms"][a] = {
            "n_tasks": len(rr), "hits": hits, "hit_rate": hits / len(rr) if rr else None, "hit_wilson95": wilson(hits, len(rr)),
            "hit_rate_family_macro": sum(sum(v) / len(v) for v in fam.values()) / len(fam) if fam else None,
            "mrr": sum(1 / r["gold_rank"] for r in rr if r["gold_rank"]) / len(rr) if rr else None,
            "retraction_docs_retrieved": nret, "precision_gold_among_retraction_docs": (hits / nret) if nret else None,
            "control_n": len(cc), "control_false_alarm_any_retraction_doc": (sum(bool(r["any_retraction_doc"]) for r in cc) / len(cc)) if cc else None,
            "control_false_alarm_wilson95": wilson(sum(bool(r["any_retraction_doc"]) for r in cc), len(cc)) if cc else None,
            "queries_per_task": sum(r["queries"] for r in rr) / len(rr) if rr else None,
            "api_credits_total": sum(r["api_credits"] for r in rr + cc),
            "latency_s_mean": sum(r["latency_s"] for r in rr + cc) / len(rr + cc) if rr + cc else None}
    def fam_diff(a, b, subset=None):
        fa = defaultdict(dict)
        for r in ret:
            if r["arm"] in (a, b): fa[r["family"]].setdefault(r["task"], {})[r["arm"]] = r["hit"]
        d = []
        for f, ts in sorted(fa.items()):
            pairs = [(v[a], v[b]) for v in ts.values() if a in v and b in v]
            if pairs: d.append(sum(x - y for x, y in pairs) / len(pairs))
        return paired(d)
    comps = {}
    for a, b in (("R03", "B1"), ("R03", "B2")): comps[f"{a}-{b}"] = fam_diff(a, b)
    out["holm_primary"] = holm({k: v["p_one_sided"] for k, v in comps.items()})
    for a, b in (("R03", "OA"), ("R03T", "R03"), ("R03T", "B1"), ("B2", "B1")):
        if a in arms and b in arms: comps[f"{a}-{b}"] = fam_diff(a, b)
    # task-level sensitivity (unclustered)
    idx = {(r["task"], r["arm"]): r["hit"] for r in ret}
    for a, b in (("R03", "B1"), ("R03", "B2")):
        ts = sorted({r["task"] for r in ret}); comps[f"task_level:{a}-{b}"] = paired([idx[(t, a)] - idx[(t, b)] for t in ts])
    # negative control: shuffled gold (each task scored against another task's gold notice)
    tasks = sorted({r["task"] for r in ret}); gold = {}
    for r in ret: gold.setdefault(r["task"], None)
    tops = {(r["task"], r["arm"]): set(r["top"]) for r in ret}
    gid = json.load(open(os.path.join(run, "gold_map.json")))
    rng = random.Random("rgd1-shuffle"); perm = tasks[:]; rng.shuffle(perm)
    out["negative_control_shuffled_gold_hit_rate"] = {a: sum(bool(tops[(t, a)] & set(gid[p])) for t, p in zip(tasks, perm) if t != p) / len(tasks)
                                                      for a in arms if all((t, a) in tops for t in tasks)}
    # pre-specified secondary: hard subset = gold notice title shares < 50% of the task title's tokens
    from .retrieval import toks
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    ctitle = {}
    for l in open(os.path.join(root, "evidence", "rgd1", "frozen", "corpus.jsonl")):
        d = json.loads(l); ctitle[d["id"]] = d["title"]
    ttitle = {}
    for l in open(os.path.join(root, "evidence", "rgd1", "frozen", "tasks.jsonl")):
        t = json.loads(l); ttitle[t["task_id"]] = t["query_title"]
    def overlap(t):
        a = set(toks(ttitle[t])); return max((len(a & set(toks(ctitle.get(g, "")))) / max(1, len(a)) for g in gid[t]), default=0)
    hard = {t for t in tasks if overlap(t) < 0.5}
    out["hard_subset"] = {"n": len(hard), "hit_rate": {a: (sum(idx[(t, a)] for t in hard) / len(hard)) if hard else None for a in arms if all((t, a) in idx for t in hard)}}
    if hard:
        for a, b in (("R03", "B1"), ("R03", "B2")):
            comps[f"hard_task_level:{a}-{b}"] = paired([idx[(t, a)] - idx[(t, b)] for t in sorted(hard)]) if len(hard) > 1 else None
    for a in arms:
        rr = [r for r in ret if r["arm"] == a]
        out["arms"][a]["hit_at_1"] = sum(1 for r in rr if r["gold_rank"] == 1) / len(rr) if rr else None
        out["arms"][a]["hit_at_3"] = sum(1 for r in rr if r["gold_rank"] and r["gold_rank"] <= 3) / len(rr) if rr else None
    out["comparisons"] = comps; out["delta"] = delta
    json.dump(out, open(os.path.join(run, "analysis.json"), "w"), indent=1); print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
