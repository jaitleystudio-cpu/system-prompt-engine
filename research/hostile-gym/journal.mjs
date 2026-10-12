// Package H: evolution journal. Append-only JSONL, sort_keys-style canonical lines like spe_runtime/storage/journal.py
// ({kind, operation_id, data}), plus a SHA-256 hash chain (prev_hash, entry_hash) so edits/reorders are detectable.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
export const KINDS = new Set(["HYPOTHESIS_PREREGISTERED", "MUTATION_PROPOSED", "EVALUATED", "ACCEPTED", "REJECTED", "NOT_PROVEN", "ROLLED_BACK", "DEVIATION"]);
export function read(path) { return existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; }
export function append(path, kind, operation_id, data = {}) {
  if (!KINDS.has(kind)) throw new Error("JOURNAL_BAD_KIND " + kind);
  const recs = read(path); const prev_hash = recs.length ? recs[recs.length - 1].entry_hash : "0".repeat(64);
  const body = { data, kind, operation_id, prev_hash, seq: recs.length };
  const rec = { ...body, entry_hash: createHash("sha256").update(canon(body)).digest("hex") };
  appendFileSync(path, canon(rec) + "\n"); return rec;
}
export function verify(path) {
  let prev = "0".repeat(64); const recs = read(path);
  for (let i = 0; i < recs.length; i++) { const { entry_hash, ...body } = recs[i];
    if (body.seq !== i) return { ok: false, at: i, why: "SEQ" };
    if (body.prev_hash !== prev) return { ok: false, at: i, why: "CHAIN" };
    if (createHash("sha256").update(canon(body)).digest("hex") !== entry_hash) return { ok: false, at: i, why: "HASH" };
    if (!KINDS.has(body.kind)) return { ok: false, at: i, why: "KIND" };
    prev = entry_hash; }
  return { ok: true, entries: recs.length };
}
