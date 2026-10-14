"""Check a dry-run directory: identical eval ground truth across arms, C witness argmax consistency. Run with the BoxingGym venv."""
import json
import sys

d = sys.argv[1]
ok = True
for t in ["dugongs_direct", "peregrines_direct"]:
    L = {a: json.load(open(f"{d}/DRY_RUN_{t}_900_{a}.json")) for a in "ABC"}
    same = L["A"]["ground_truth"] == L["B"]["ground_truth"] == L["C"]["ground_truth"]
    w = [s["witness"] for s in L["C"]["steps"] if "witness" in s]
    arg = all(x["chosen_index"] == max(range(len(x["spreads"])), key=lambda j: (x["spreads"][j], -j)) for x in w)
    lab = all(v["label"] == "DRY_RUN" for v in L.values())
    print(t, "gt_identical", same, "witnesses", len(w), "fallbacks", L["C"]["cwc_fallbacks"], "argmax_ok", arg, "labelled", lab)
    ok &= same and arg and lab
print("DRY_RUN_PLUMBING", "OK" if ok else "FAIL")
sys.exit(0 if ok else 1)
