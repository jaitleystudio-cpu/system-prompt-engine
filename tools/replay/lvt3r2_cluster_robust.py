"""Cluster-robust robustness check for LVT-3 R2 (Bro's replay analysis, re-derived 2026-10-13; NOT preregistered).

Clusters: the 80 held-out families are linked when they share an ordered ADJACENT op-pair (family "HOxx-a+b+c" has
pairs (a,b) and (b,c)); clusters = connected components (union-find). Effect per cluster = mean over its families
of [verified_success(E_CAPPED) - verified_success(B)]; overall = unweighted mean of cluster effects.
CI: normal approximation (z=1.96) over the cluster effects (reproduces Bro's interval); the t (df = n-1) and a
seeded cluster bootstrap are reported too.
Usage: python tools/replay/lvt3r2_cluster_robust.py [RUN_DIR] [--a E_CAPPED] [--b B]"""
from __future__ import annotations
import json, os, random, sys
from collections import defaultdict
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from spe_runtime.research.lvt3r2.analyze import load  # noqa: E402
from spe_runtime.research.lvt3r2.stats import sd, t_crit  # noqa: E402


def ops(fam: str) -> list[str]:
    return fam.split("-", 1)[1].split("+")


def op_pair_clusters(fams: list[str]) -> list[list[str]]:
    par = {f: f for f in fams}

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]; x = par[x]
        return x
    by_pair = defaultdict(list)
    for f in fams:
        o = ops(f)
        for i in range(len(o) - 1):
            by_pair[(o[i], o[i + 1])].append(f)
    for fs in by_pair.values():
        for g in fs[1:]:
            par[find(g)] = find(fs[0])
    cl = defaultdict(list)
    for f in fams:
        cl[find(f)].append(f)
    return sorted(cl.values(), key=lambda c: (-len(c), c[0]))


def analyse(run: str, a: str = "E_CAPPED", b: str = "B", boot: int = 20000, seed: int = 20261013) -> dict:
    fm, _, _, _ = load(run)
    fams = sorted(fm[b])
    cl = op_pair_clusters(fams)
    d = [sum(fm[a][f] - fm[b][f] for f in c) / len(c) for c in cl]
    n = len(d); m = sum(d) / n; se = sd(d) / n ** 0.5
    r = random.Random(seed); bs = sorted(sum(d[r.randrange(n)] for _ in range(n)) / n for _ in range(boot))
    fam_d = [fm[a][f] - fm[b][f] for f in fams]
    return {"contrast": f"{a}-{b}", "n_families": len(fams), "n_clusters": n, "largest_cluster": len(cl[0]),
            "cluster_sizes": [len(c) for c in cl], "mean_of_cluster_means": m, "se": se,
            "ci95_normal": [m - 1.96 * se, m + 1.96 * se], "ci95_t": [m - t_crit(n - 1) * se, m + t_crit(n - 1) * se],
            "ci95_cluster_bootstrap": [bs[int(0.025 * boot)], bs[int(0.975 * boot) - 1]],
            "family_level_mean_for_reference": sum(fam_d) / len(fam_d), "clusters": cl}


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    run = args[0] if args else os.path.join(os.path.dirname(__file__), "..", "..", "evidence", "lvt3r2", "holdout")
    kw = {k: sys.argv[sys.argv.index("--" + k) + 1] for k in ("a", "b") if "--" + k in sys.argv}
    print(json.dumps(analyse(run, **kw), indent=1))
