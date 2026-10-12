"""H12 false-success detail: E vs E_randprobe on R2 holdout. Usage: python tools/replay/h12_false_success_detail.py ROWS.jsonl"""
import json, math, sys
from collections import defaultdict
sys.path.insert(0, "."); from spe_runtime.research.lvt3r2.stats import paired
R = [json.loads(l) for l in open(sys.argv[1])]
A, B = "E", "E_randprobe"
def wilson(k, n, z=1.96):
    if n == 0: return (0, 0)
    p = k / n; d = 1 + z*z/n; c = p + z*z/(2*n); h = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))
    return ((c-h)/d, (c+h)/d)
idx = {(r["config"], r["seed"], r["task"]): r for r in R}
out = {}
for c in (A, B):
    rr = [r for r in R if r["config"] == c]; dec = [r for r in rr if r["declared"]]; fs = [r for r in dec if not r["verified"]]
    out[c] = {"tasks": len(rr), "declared": len(dec), "false_success": len(fs), "verified": sum(r["verified"] for r in rr),
              "abstain": len(rr) - len(dec),
              "fs_per_declared": len(fs)/len(dec), "fs_per_declared_wilson95": wilson(len(fs), len(dec)),
              "fs_per_task": len(fs)/len(rr), "fs_per_task_wilson95": wilson(len(fs), len(rr)),
              "exec_total": sum(r["exec"] for r in rr), "exec_per_task": sum(r["exec"] for r in rr)/len(rr)}
# paired task-level outcome table (same seed, same task)
tab = defaultdict(int); states = defaultdict(int)
for (c, s, t), ra in idx.items():
    if c != A: continue
    rb = idx[(B, s, t)]
    st = lambda r: "verified" if r["verified"] else ("false_success" if r["declared"] else "abstain")
    states[f"{A}={st(ra)} | {B}={st(rb)}"] += 1
    fa, fb = ra["declared"] and not ra["verified"], rb["declared"] and not rb["verified"]
    tab[(fa, fb)] += 1
b, c_ = tab[(True, False)], tab[(False, True)]
n = b + c_; p = min(1.0, 2*sum(math.comb(n, k) for k in range(0, min(b, c_)+1)) / 2**n) if n else 1.0
out["paired_false_success_2x2"] = {"both_fs": tab[(True, True)], "E_only_fs": b, "randprobe_only_fs": c_, "neither": tab[(False, False)],
                                   "mcnemar_exact_two_sided_p": p}
out["paired_state_table"] = dict(sorted(states.items()))
# family-level (unit) difference in per-task false-success rate
fam = defaultdict(lambda: defaultdict(list))
for r in R:
    if r["config"] in (A, B): fam[r["config"]][r["family"]].append(r["declared"] and not r["verified"])
fams = sorted(fam[A]); d = [sum(fam[A][f])/len(fam[A][f]) - sum(fam[B][f])/len(fam[B][f]) for f in fams]
out["family_level_fs_per_task_diff_E_minus_randprobe"] = paired(d)
out["note"] = "fs_per_declared has different denominators per arm (declared counts differ); fs_per_task and the paired/family analyses use a common denominator (1200 tasks = 80 families x 5 tasks x 3 seeds)."
print(json.dumps(out, indent=1, default=list))
