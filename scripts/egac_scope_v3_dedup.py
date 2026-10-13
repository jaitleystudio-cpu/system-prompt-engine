#!/usr/bin/env python3
"""EGAC round 8: deduplicated re-analysis of the FROZEN SCOPE_BOUNDARY_v3 corpus (docs/egac/scope_v3/
scope_v3_corpus.jsonl, read-only). Bro (round 7) found only 597 of 920 rows unique, so the v3 Wilson CIs were too
tight. A row's identity is (text, deleted, expect); the first occurrence is kept. Two analyses are reported:
  * frozen_gate: the gate decision recorded in the v3 corpus (f5dcaa56) -- same decisions as the v3 numbers;
  * current_gate: the same unique rows re-scored with THIS checkout's gate (round 8 Greek fold).
The v3 files are never written. Usage: egac_scope_v3_dedup.py [OUT_DIR]  (deterministic)."""
import hashlib, json, math, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from spe_runtime.egac.conservation import InfoClass, Technique, run_gated  # noqa: E402

SRC = ROOT / "docs/egac/scope_v3/scope_v3_corpus.jsonl"
raw = SRC.read_bytes()
rows = [json.loads(l) for l in raw.decode("utf-8").splitlines() if l.strip()]
seen, uniq = set(), []
for r in rows:
    k = (r["text"], r["deleted"], r["expect"])
    if k not in seen:
        seen.add(k)
        uniq.append(r)
conflicts = len({(r["text"], r["deleted"]) for r in rows}) != len({(r["text"], r["deleted"], r["expect"]) for r in rows})


def wilson(k, n):
    if not n:
        return [0.0, 1.0]
    z = 1.959963984540054
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [round(max(0.0, c - h), 4), round(min(1.0, c + h), 4)]


def stat(rs, key):
    k = sum(r[key] for r in rs)
    return {"n": len(rs), "errors": k, "rate": round(k / len(rs), 4) if rs else 0.0, "wilson95": wilson(k, len(rs))}


R = InfoClass.REPLACEABLE
for r in uniq:
    d = r["deleted"]
    ok = run_gated(Technique("t", frozenset({R}), "text", lambda t, _d=d, **k: t.replace(_d, "", 1)), r["text"]).allowed
    r["err_frozen"] = r["error"]
    r["err_current"] = ("allowed" if ok else "refused") != r["expect"]


def block(key):
    o = {"classes": {c: stat([r for r in uniq if r["cls"] == c], key) for c in dict.fromkeys(r["cls"] for r in uniq)}}
    atk = [r for r in uniq if r["cls"].startswith("E")]
    o["miss_rate_all_attacks"] = stat(atk, key)
    o["miss_rate_generated_attacks"] = stat([r for r in atk if r["src"].startswith("gen")], key)
    o["overblock_rate_benign_prose"] = stat([r for r in uniq if r["cls"] in ("B1b_bro_r6_contexts_allowlisted_deletion", "B2_benign_prose")], key)
    o["overblock_rate_plain_control"] = o["classes"].get("C0_plain_control")
    return o


out = {
    "source_corpus": "docs/egac/scope_v3/scope_v3_corpus.jsonl",
    "source_corpus_sha256": hashlib.sha256(raw).hexdigest(),
    "dedup_key": "(text, deleted, expect); first occurrence kept",
    "rows_total": len(rows), "rows_unique": len(uniq), "rows_duplicate": len(rows) - len(uniq),
    "conflicting_expectations": conflicts,
    "rows_per_class_total": {c: sum(r["cls"] == c for r in rows) for c in dict.fromkeys(r["cls"] for r in rows)},
    "frozen_gate_f5dcaa56": block("err_frozen"),
    "current_gate_round8": block("err_current"),
    "rows_changed_by_round8": [{"cls": r["cls"], "src": r["src"], "text": r["text"]} for r in uniq if r["err_frozen"] != r["err_current"]],
}
s = json.dumps(out, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
if len(sys.argv) > 1:
    d = pathlib.Path(sys.argv[1]); d.mkdir(parents=True, exist_ok=True)
    (d / "scope_v3_dedup_rates.json").write_text(s, encoding="utf-8")
print(s)
