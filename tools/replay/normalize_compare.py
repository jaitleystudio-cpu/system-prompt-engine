"""Compare a replay against committed evidence after dropping wall-clock fields.
Usage: python tools/replay/normalize_compare.py REPLAY_DIR EVIDENCE_DIR
Wall-clock fields (excluded from every endpoint): rows.jsonl `sec`, results.json `runtime_sec` (any depth)."""
import json, sys, os
WALL = {"sec", "runtime_sec", "runtime_s"}
def strip(o):
    if isinstance(o, dict): return {k: strip(v) for k, v in o.items() if k not in WALL}
    if isinstance(o, list): return [strip(v) for v in o]
    return o
def rows(p): return sorted(json.dumps(strip(json.loads(l)), sort_keys=True) for l in open(p) if l.strip())
a, b = sys.argv[1:3]; ok = True
for f in sorted(os.listdir(b)):
    pa, pb = os.path.join(a, f), os.path.join(b, f)
    if f.endswith(".jsonl"): same = rows(pa) == rows(pb)
    elif f.endswith(".json"): same = strip(json.load(open(pa))) == strip(json.load(open(pb)))
    else: continue
    print(f"{f}: {'IDENTICAL_AFTER_WALLCLOCK_STRIP' if same else 'DIFFERENT'}"); ok &= same
sys.exit(0 if ok else 1)
