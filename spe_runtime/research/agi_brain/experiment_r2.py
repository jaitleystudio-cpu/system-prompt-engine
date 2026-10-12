"""Run the frozen AGI-BRAIN R2 experiment (docs/agi-brain/CONTRACT_R2.md).
Usage: python3 -m spe_runtime.research.agi_brain.experiment_r2 OUT_DIR"""
from __future__ import annotations
import hashlib, itertools, json, math, os, resource, statistics, sys, time
from multiprocessing import Pool
from spe_runtime.research.lvt3.experiment import ci_t, ci_boot  # reused, not copied (df=9 -> 10 seeds)
from .netsearch_r2 import search_r2, COND_R2
from .evaluator_r2 import verify
from .r2_starts import FAMS_R2

SEEDS = list(range(10))
CPU_BUDGET = 8.0          # CPU-seconds of search per (family, condition, seed), identical for all conditions
WORKERS = 4
BEST_KNOWN = {"sort13": 45, "sort14": 51, "sort15": 56, "sort16": 60}  # Knuth TAOCP 5.3.4 / later literature
HERE = os.path.dirname(__file__)


def _starts(out_dir):
    return json.load(open(os.path.join(out_dir, "..", "r2", "starts.json")))


def job(args):
    seed, cond, fam, start = args
    r = search_r2(fam, cond, seed, CPU_BUDGET, start_net=start)
    v = verify(fam, r["net"], seed)
    ref = len(start)
    return {"seed": seed, "cond": cond, "family": fam, "ref": ref, "size": r["size"], "depth": r["depth"],
            "valid": v["valid"], "success": bool(v["valid"] and r["size"] < ref),
            "quality": (ref / r["size"]) if v["valid"] else 0.0, "evals": r["evals"], "proposals": r["proposals"],
            "verifier_calls": r["verifier_calls"], "cpu_used": round(r["cpu_used"], 3),
            "cpu_to_best": round(r["cpu_to_best"], 3), "model_size": r["model_size"],
            "maxrss_kb_worker": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024,
            "best_known": BEST_KNOWN.get(fam),
            "net_sha": hashlib.sha256(json.dumps(r["net"]).encode()).hexdigest()[:16]}


def signflip_p(d):
    """Exact two-sided paired sign-flip permutation p-value."""
    obs = abs(sum(d)); n = len(d); cnt = 0
    for signs in itertools.product((1, -1), repeat=n):
        if abs(sum(s * x for s, x in zip(signs, d))) >= obs - 1e-12: cnt += 1
    return cnt / 2 ** n


def holm(ps):
    order = sorted(ps, key=ps.get); m = len(ps); adj = {}; run = 0.0
    for i, k in enumerate(order):
        run = max(run, min(1.0, (m - i) * ps[k])); adj[k] = run
    return adj


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True); starts = json.load(open(os.path.join(os.path.dirname(out_dir.rstrip("/")), "r2", "starts.json"))) if not os.path.exists(os.path.join(out_dir, "starts.json")) else json.load(open(os.path.join(out_dir, "starts.json")))
    jobs = [(s, c, f, starts[f]) for s in SEEDS for f in FAMS_R2 for c in COND_R2]
    t0 = time.time()
    with Pool(WORKERS) as p: rows = p.map(job, jobs, chunksize=1)
    with open(os.path.join(out_dir, "rows.jsonl"), "w") as fh:
        for r in rows: fh.write(json.dumps(r, sort_keys=True) + "\n")
    ps = {c: {s: {} for s in SEEDS} for c in COND_R2}
    for c in COND_R2:
        for s in SEEDS:
            rr = [r for r in rows if r["cond"] == c and r["seed"] == s]
            ps[c][s] = {"quality": statistics.mean(r["quality"] for r in rr),
                        "success": statistics.mean(r["success"] for r in rr),
                        "correct": statistics.mean(r["valid"] for r in rr),
                        "log_evals": math.log(sum(r["evals"] for r in rr)),
                        "cpu": sum(r["cpu_used"] for r in rr)}
    means = {c: {k: statistics.mean(ps[c][s][k] for s in SEEDS) for k in ("quality", "success", "correct", "cpu")} for c in COND_R2}
    contrasts = {"spe_wm-cegis": ("spe_wm", "cegis"), "spe_wm-plain": ("spe_wm", "plain"), "cegis-plain": ("cegis", "plain")}
    res = {"means": means, "runtime_wall_sec": round(time.time() - t0, 1), "endpoints": {}}
    for ep in ("quality", "success"):
        out = {}; pv = {}
        for name, (a, b) in contrasts.items():
            d = [ps[a][s][ep] - ps[b][s][ep] for s in SEEDS]
            m, lo, hi = ci_t(d); bl, bh = ci_boot(d); pv[name] = signflip_p(d)
            out[name] = {"mean": m, "t95": [lo, hi], "boot95": [bl, bh], "p_signflip": pv[name]}
        for k, v in holm(pv).items(): out[k]["p_holm"] = v
        res["endpoints"][ep] = out
    q = res["endpoints"]["quality"]
    res["decisions"] = {
        "H1_spe_wm_beats_cegis_quality": q["spe_wm-cegis"]["p_holm"] < 0.05 and q["spe_wm-cegis"]["mean"] > 0,
        "H2_spe_wm_beats_plain_quality": q["spe_wm-plain"]["p_holm"] < 0.05 and q["spe_wm-plain"]["mean"] > 0,
        "H3_cegis_beats_plain_quality": q["cegis-plain"]["p_holm"] < 0.05 and q["cegis-plain"]["mean"] > 0,
        "correctness_all_claims_valid": all(r["valid"] for r in rows),
        "programme_status": "RESEARCH_PROPOSAL - NOT AGI_PROVEN"}
    d = res["decisions"]
    d["provisional_verdict"] = ("SPE_WM_ADVANTAGE_OVER_CEGIS_WITHIN_SCOPE" if d["H1_spe_wm_beats_cegis_quality"] else
                                "NO_ADVANTAGE_OVER_ESTABLISHED_CEGIS (NOT_PROVEN)")
    json.dump(res, open(os.path.join(out_dir, "results.json"), "w"), indent=2, sort_keys=True)
    print(json.dumps(res, indent=2, sort_keys=True))


if __name__ == "__main__":
    main(sys.argv[1])
