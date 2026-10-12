"""EGAC-E01 harness: JSON minify OFF vs ON on a local Ollama model. Contract: docs/egac/E01_CONTRACT.md."""

from __future__ import annotations

import hashlib
import json
import math
import random
import sys
import time
import urllib.request
from pathlib import Path

from .conservation import MalformedJSON, classify, lex_json, run_gated
from .transforms import TECHNIQUES, minify_json_text

CATS = ["config", "api_response", "nested_records", "big_ints", "unicode_escapes",
        "numeric_arrays", "deep_nesting", "whitespace_in_strings"]
GEN_SEED, ORDER_SEED, BOOT_SEED, MODEL_SEED = 20261012, 7, 99, 1729
OPTIONS = {"temperature": 0, "seed": MODEL_SEED, "num_predict": 48, "num_ctx": 4096}
REPEATS, BOOT_N, NI_MARGIN = 3, 10_000, -0.05
WORDS = ["alpha", "bravo", "cedar", "delta", "ember", "fjord", "gamma", "harbor", "iris", "jade",
         "kilo", "lotus", "maple", "nova", "onyx", "pearl", "quartz", "raven", "sierra", "tango"]
UNI = [("Zo\\u00eb", "Zoë"), ("Ren\\u00e9e", "Renée"), ("M\\u00fcller", "Müller"), ("Jos\\u00e9", "José"),
       ("Bj\\u00f6rk", "Björk"), ("\\u00c5sa", "Åsa"), ("Fran\\u00e7ois", "François")]


def _pretty(obj_src: str) -> str:
    """Pretty-print from a raw minified JSON string WITHOUT json.loads (keeps big ints / escapes)."""
    out, ind = [], 0
    toks = [r for k, r in lex_json(obj_src) if k != "ws"]
    for i, t in enumerate(toks):
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if t in "{[":
            if nxt in "}]":
                out.append(t)
                continue
            ind += 1
            out.append(t + "\n" + "  " * ind)
        elif t in "}]":
            if out and out[-1] in "{[":
                out.append(t)
                continue
            ind -= 1
            out.append("\n" + "  " * ind + t)
        elif t == ",":
            out.append(",\n" + "  " * ind)
        elif t == ":":
            out.append(": ")
        else:
            out.append(t)
    return "".join(out)


def _task(cat: str, k: int, rng: random.Random) -> dict:
    w = rng.sample(WORDS, 6)
    if cat == "config":
        svcs = {n: {"host": f"{n}.internal", "port": rng.randint(1024, 65000), "tls": rng.random() < .5} for n in w[:4]}
        t = w[rng.randint(0, 3)]
        raw, q, a = json.dumps({"version": k, "services": svcs}), f'What is the "port" of service "{t}"?', str(svcs[t]["port"])
    elif cat == "api_response":
        items = [{"id": 1000 + i * 7 + k, "name": w[i], "status": rng.choice(["active", "paused", "deleted", "pending"])} for i in range(5)]
        it = rng.choice(items)
        raw, q, a = json.dumps({"data": items, "meta": {"page": 1, "total": 5}}), f'What is the "status" of the item with "id" {it["id"]}?', it["status"]
    elif cat == "nested_records":
        users = [{"name": w[i], "address": {"city": rng.choice(WORDS).title() + "ville", "zip": f"{rng.randint(10000, 99999)}"}} for i in range(4)]
        u = rng.choice(users)
        raw, q, a = json.dumps({"users": users}), f'What is the "city" in the address of user "{u["name"]}"?', u["address"]["city"]
    elif cat == "big_ints":
        accts = [(w[i], str(rng.randint(10**18, 10**22))) for i in range(4)]
        body = ", ".join(f'{{"owner": "{o}", "balance": {b}}}' for o, b in accts)
        raw = '{"accounts": [' + body + ']}'
        o, b = rng.choice(accts)
        q, a = f'What is the exact "balance" of owner "{o}"? Give all digits.', b
    elif cat == "unicode_escapes":
        names = rng.sample(UNI, 4)
        rows = [(esc, dec, f"SKU-{rng.randint(100, 999)}") for esc, dec in names]
        raw = '{"items": [' + ", ".join(f'{{"name": "{e}", "sku": "{s}"}}' for e, _, s in rows) + "]}"
        e, d, s = rng.choice(rows)
        q, a = f'What is the "sku" of the item named "{d}"?', s
    elif cat == "numeric_arrays":
        series = {n: [rng.randint(-500, 500) for _ in range(rng.randint(4, 8))] for n in w[:4]}
        t = rng.choice(w[:4])
        raw, q, a = json.dumps({"series": series}), f'What is the last number in series "{t}"?', str(series[t][-1])
    elif cat == "deep_nesting":
        path = w[:5]
        leaf = f"{rng.choice(WORDS)}-{rng.randint(10, 99)}"
        node: object = {"value": leaf, "decoy": "x"}
        for p in reversed(path):
            node = {p: node, "other": rng.randint(0, 9)}
        raw = json.dumps(node)
        q, a = 'What is the "value" at path ' + ".".join(path) + ".value?", leaf
    else:  # whitespace_in_strings
        rows = [(w[i], "  " + "   ".join(rng.sample(WORDS, 3)) + "  ", f"C{rng.randint(1000, 9999)}") for i in range(4)]
        raw = '{"notes": [' + ", ".join(f'{{"key": "{kk}", "text": "{tx}", "code": "{c}"}}' for kk, tx, c in rows) + "]}"
        kk, _, c = rng.choice(rows)
        q, a = f'What is the "code" of the note with "key" "{kk}"?', c
    return {"task_id": f"{cat}-{k:02d}", "category": cat, "pretty": _pretty(raw), "question": q, "answer": a}


def build_tasks() -> list[dict]:
    rng = random.Random(GEN_SEED)
    return [_task(c, k, rng) for c in CATS for k in range(15)]


def make_prompt(doc: str, q: str) -> str:
    return f"Here is a JSON document:\n```json\n{doc}\n```\nQuestion: {q}\nAnswer with only the value, nothing else."


def oracle(resp: str, expected: str) -> bool:
    line = resp.strip().splitlines()[0] if resp.strip() else ""
    line = line.strip().strip("`").strip().strip('"').strip("'").strip().rstrip(".").strip().strip('"')
    return line == expected


# ---------------------------------------------------------------- canaries (deterministic, no model)
CANARIES = [
    '{"big": 123456789012345678901234567890, "neg": -9007199254740993}',
    '{"a": 1, "a": 2, "a": {"a": 3}}',
    '{"e": "caf\\u00e9 \\ud83d\\ude00 \\"q\\" \\\\ \\/"}',
    '{"raw": "naïve – 日本語 😀"}',
    '{"ws": "  two  spaces\\n\\ttab  ", "k e y": " v "}',
    '{"nl": "line1\\nline2\\r\\n"}',
    '[ ]', '{ }', '{"exp": [1e10, -2.5E-3, 0.0, -0]}',
    '{"t": true, "f": false, "n": null}',
    '[1, [2, [3, [4, [5, {"deep": "x"}]]]]]',
    '{"x": "MUST NOT be changed   (spaces)"}',
]
MALFORMED = ['{"a": 1', '{"a": "x}', '{"a": tru}', '[1]]', '{"a": "\\q"}', '{"a":\x01"b"}']


def run_canaries() -> dict:
    fails = []
    for src in CANARIES:
        doc = make_prompt(_pretty(src), "q")
        r = run_gated(TECHNIQUES["json_minify"], doc)
        nt = lambda s: [x for x in lex_json(s) if x[0] != "ws"]
        if not r.allowed:
            fails.append({"src": src, "why": "gate refused valid doc: " + r.reason})
            continue
        mini = minify_json_text(src)
        if nt(mini) != nt(src):
            fails.append({"src": src, "why": "token stream changed"})
        if mini not in r.output:
            fails.append({"src": src, "why": "gated output differs from direct minify"})
        if src.count('"a"') != mini.count('"a"'):
            fails.append({"src": src, "why": "duplicate key count changed"})
    for bad in MALFORMED:
        try:
            minify_json_text(bad)
            fails.append({"src": bad, "why": "malformed minified instead of refused"})
        except MalformedJSON:
            pass
        g = run_gated(TECHNIQUES["json_minify"], make_prompt(bad, "q"))
        if g.allowed and g.output != make_prompt(bad, "q"):
            fails.append({"src": bad, "why": "gate changed malformed doc"})
    return {"n_valid": len(CANARIES), "n_malformed": len(MALFORMED), "critical_failures": fails}


# ---------------------------------------------------------------- stats
def boot_ci(diffs: list[float], seed=BOOT_SEED, n=BOOT_N) -> tuple[float, float, float]:
    rng = random.Random(seed)
    m = len(diffs)
    means = sorted(sum(diffs[rng.randrange(m)] for _ in range(m)) / m for _ in range(n))
    return sum(diffs) / m, means[int(0.025 * n)], means[int(0.975 * n) - 1]


def mcnemar_exact(b: int, c: int) -> float:
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    p = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * p)


# ---------------------------------------------------------------- runner
def call(host: str, model: str, prompt: str) -> dict:
    body = json.dumps({"model": model, "prompt": prompt, "stream": False, "options": OPTIONS, "keep_alive": "30m"}).encode()
    req = urllib.request.Request(f"http://{host}/api/generate", data=body, headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read())
    d["_wall_ms"] = (time.perf_counter() - t0) * 1000
    return d


def main(out_dir: str, host="127.0.0.1:11435", model="qwen2.5:0.5b") -> dict:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    tasks = build_tasks()
    manifest_hash = hashlib.sha256(json.dumps(tasks, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    (out / "tasks.json").write_text(json.dumps(tasks, indent=1, ensure_ascii=False))
    canary = run_canaries()
    arms = {}
    refusals = []
    for t in tasks:
        ctrl = make_prompt(t["pretty"], t["question"])
        g = run_gated(TECHNIQUES["json_minify"], ctrl)
        if not g.allowed:
            refusals.append({"task": t["task_id"], "reason": g.reason})
        arms[t["task_id"]] = {"control": ctrl, "treatment": g.output if g.allowed else ctrl}
    triples = [(t["task_id"], arm, r) for t in tasks for arm in ("control", "treatment") for r in range(REPEATS)]
    random.Random(ORDER_SEED).shuffle(triples)
    tags = json.loads(urllib.request.urlopen(f"http://{host}/api/tags").read())
    digest = next(m["digest"] for m in tags["models"] if m["name"] == model)
    call(host, model, "warm up")  # not counted
    rows, answers = [], {t["task_id"]: t["answer"] for t in tasks}
    with open(out / "rows.jsonl", "w") as f:
        for i, (tid, arm, rep) in enumerate(triples):
            nonce = f"[call {i:04d}] "  # same width both arms; defeats cross-call KV prefix reuse of the JSON
            d = call(host, model, nonce + arms[tid][arm])
            row = {"i": i, "task": tid, "arm": arm, "rep": rep, "resp": d.get("response", ""),
                   "ok": oracle(d.get("response", ""), answers[tid]), "prompt_tokens": d.get("prompt_eval_count"),
                   "eval_tokens": d.get("eval_count"), "total_ms": d.get("total_duration", 0) / 1e6,
                   "wall_ms": d["_wall_ms"], "chars": len(arms[tid][arm])}
            rows.append(row)
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            if i % 60 == 0:
                print(i, flush=True)
    # aggregate per task
    per = {}
    for r in rows:
        per.setdefault(r["task"], {}).setdefault(r["arm"], []).append(r)
    tok_d, lat_d, ok_d, b, c, both, neither = [], [], [], 0, 0, 0, 0
    cat_stats = {}
    for tid, a in per.items():
        mean = lambda rs, k: sum(x[k] for x in rs) / len(rs)
        tok_d.append(mean(a["treatment"], "prompt_tokens") - mean(a["control"], "prompt_tokens"))
        lat_d.append(mean(a["treatment"], "total_ms") - mean(a["control"], "total_ms"))
        sc = sum(x["ok"] for x in a["control"]) >= 2
        st = sum(x["ok"] for x in a["treatment"]) >= 2
        ok_d.append(int(st) - int(sc))
        b += sc and not st
        c += st and not sc
        both += sc and st
        neither += not sc and not st
        cat = tid.rsplit("-", 1)[0]
        cs = cat_stats.setdefault(cat, {"n": 0, "ctrl_ok": 0, "treat_ok": 0, "tok_ctrl": 0.0, "tok_treat": 0.0})
        cs["n"] += 1; cs["ctrl_ok"] += sc; cs["treat_ok"] += st
        cs["tok_ctrl"] += mean(a["control"], "prompt_tokens"); cs["tok_treat"] += mean(a["treatment"], "prompt_tokens")
    ctrl_tok = sum(r["prompt_tokens"] for r in rows if r["arm"] == "control") / (len(rows) / 2)
    tok = boot_ci(tok_d); lat = boot_ci(lat_d); ni = boot_ci(ok_d)
    p = mcnemar_exact(b, c)
    n = len(per)
    crit = len(canary["critical_failures"])
    if crit or tok[1] >= 0 or ni[2] < NI_MARGIN:
        verdict = "FAIL"
    elif tok[2] < 0 and ni[1] > NI_MARGIN and (p >= 0.05 or c > b):
        verdict = "PASS_WITHIN_TESTED_SCOPE"
    else:
        verdict = "NOT_PROVEN"
    res = {
        "model": model, "model_digest": digest, "options": OPTIONS, "n_tasks": n, "repeats": REPEATS,
        "n_calls": len(rows), "task_manifest_sha256": manifest_hash, "gate_refusals": refusals,
        "canary": canary,
        "prompt_tokens": {"control_mean": ctrl_tok, "diff_mean": tok[0], "ci95": tok[1:], "pct": 100 * tok[0] / ctrl_tok},
        "latency_total_ms": {"control_mean": sum(r["total_ms"] for r in rows if r["arm"] == "control") / (len(rows) / 2),
                             "diff_mean": lat[0], "ci95": lat[1:]},
        "success": {"control_rate": (both + b) / n, "treatment_rate": (both + c) / n, "diff": ni[0], "ci95": ni[1:],
                    "ni_margin": NI_MARGIN, "mcnemar": {"b_ctrl_only": b, "c_treat_only": c, "both": both,
                                                        "neither": neither, "p_exact": p}},
        "per_category": cat_stats, "verdict": verdict,
    }
    (out / "results.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))
    return res


if __name__ == "__main__":
    print(json.dumps(main(sys.argv[1] if len(sys.argv) > 1 else "evidence/egac/e01"), indent=1, ensure_ascii=False))
