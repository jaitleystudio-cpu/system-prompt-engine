"""CWC-1 frozen scorer (contract section 5 + amendment 3). Deterministic, no LLM judge, numpy only.
Usage: python3 -m spe_runtime.research.cwc1.score LOGDIR [--label SCORED] [--seeds 101,202,303] > score.json
Per episode: std_error = (raw_error[0] - norm_mu) / norm_sigma (computed by the harness from BoxingGym's own
evaluate_predictions). Per task: mean over seeds. Primary: paired task-level C-B and C-A, 95% percentile bootstrap
over tasks (10,000 resamples, numpy default_rng(7)). Lower error is better, so a negative difference favours C.
Primary analysis = complete cases: a task enters only if every (arm, seed) episode scored. Sensitivity analysis
(amendment 3): an unscorable episode is given the worst standardised error observed in that task (any arm/seed)."""
import glob
import json
import os
import sys

import numpy as np

ARMS = ("A", "B", "C")


def load(d, label, seeds):
    eps = {}
    for fn in sorted(glob.glob(os.path.join(d, f"{label}_*.json"))):
        L = json.load(open(fn))
        if L.get("label") != label or int(L["seed"]) not in seeds:
            continue
        eps[(L["env"], L["goal"], int(L["seed"]), L["arm"])] = L
    return eps


def boot(diffs, n=10_000, seed=7):
    diffs = np.asarray(diffs, float)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(diffs), size=(n, len(diffs)))
    means = diffs[idx].mean(axis=1)
    return float(diffs.mean()), float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def verdict(cb, ca):
    if cb[2] < 0 and ca[2] < 0:
        return "SUPPORTED_PENDING_BRO_RESCORE_AND_WITNESS_CHECK"
    if cb[1] > 0:
        return "REFUTED"
    return "NOT_PROVEN"


def witness_ok(eps):
    bad = n = 0
    for k, L in eps.items():
        if k[3] != "C":
            continue
        for s in L["steps"]:
            w = s.get("witness")
            if not w:
                continue
            n += 1
            sp = w["spreads"]
            if w["chosen_index"] != max(range(len(sp)), key=lambda j: (sp[j], -j)):
                bad += 1
    return n, bad


def main():
    a = sys.argv[1:]
    d = a[0]
    label = a[a.index("--label") + 1] if "--label" in a else "SCORED"
    seeds = tuple(int(x) for x in (a[a.index("--seeds") + 1] if "--seeds" in a else "101,202,303").split(","))
    eps = load(d, label, seeds)
    tasks = sorted({(e, g) for (e, g, _, _) in eps})
    per_task, complete, sens = {}, [], []
    fails = {arm: 0 for arm in ARMS}
    for t in tasks:
        cell = {arm: [eps.get((t[0], t[1], s, arm), {}).get("std_error") for s in seeds] for arm in ARMS}
        for arm in ARMS:
            fails[arm] += sum(v is None for v in cell[arm])
        vals = [v for arm in ARMS for v in cell[arm] if v is not None]
        worst = max(vals) if vals else None
        per_task["/".join(t)] = {arm: cell[arm] for arm in ARMS}
        if all(v is not None for arm in ARMS for v in cell[arm]):
            complete.append((t, {arm: float(np.mean(cell[arm])) for arm in ARMS}))
        if worst is not None:
            sens.append((t, {arm: float(np.mean([worst if v is None else v for v in cell[arm]])) for arm in ARMS}))

    def analysis(rows):
        if len(rows) < 2:
            return {"n_tasks": len(rows), "note": "too few tasks"}
        cb = boot([r["C"] - r["B"] for _, r in rows])
        ca = boot([r["C"] - r["A"] for _, r in rows])
        ba = boot([r["B"] - r["A"] for _, r in rows])
        return {"n_tasks": len(rows), "tasks": ["/".join(t) for t, _ in rows],
                "arm_mean_std_error": {arm: float(np.mean([r[arm] for _, r in rows])) for arm in ARMS},
                "C_minus_B": cb, "C_minus_A": ca, "B_minus_A": ba,
                "C_beats_B_tasks": int(sum(r["C"] < r["B"] for _, r in rows)),
                "C_beats_A_tasks": int(sum(r["C"] < r["A"] for _, r in rows)),
                "verdict_rule": verdict(cb, ca)}
    nw, bw = witness_ok(eps)
    out = {"label": label, "seeds": seeds, "n_episodes": len(eps), "unscorable_episodes": fails,
           "digests": sorted({L["model_digest"] for L in eps.values()}),
           "witness_steps": nw, "witness_argmax_violations": bw,
           "cwc_fallbacks_total": int(sum(L.get("cwc_fallbacks", 0) for k, L in eps.items() if k[3] == "C")),
           "calls_per_arm": {arm: int(sum(L["calls"] for k, L in eps.items() if k[3] == arm)) for arm in ARMS},
           "primary_complete_case": analysis(complete), "sensitivity_worst_impute": analysis(sens), "per_task": per_task}
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
