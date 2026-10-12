import assert from "node:assert/strict"; import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { append, verify } from "./journal.mjs";
const p = join(mkdtempSync(join(tmpdir(), "hgj-")), "j.jsonl"); let n = 0;
append(p, "HYPOTHESIS_PREREGISTERED", "h1", { a: 1 }); append(p, "EVALUATED", "h1", { b: 2 }); append(p, "NOT_PROVEN", "h1");
assert.deepEqual(verify(p), { ok: true, entries: 3 }); n++;
assert.throws(() => append(p, "BOGUS", "x")); n++;
const lines = readFileSync(p, "utf8").trim().split("\n");
writeFileSync(p + ".edit", lines.map((l, i) => i === 1 ? l.replace('"b":2', '"b":3') : l).join("\n") + "\n"); assert.equal(verify(p + ".edit").ok, false); n++;
writeFileSync(p + ".swap", [lines[0], lines[2], lines[1]].join("\n") + "\n"); assert.equal(verify(p + ".swap").ok, false); n++;
writeFileSync(p + ".drop", [lines[0], lines[2]].join("\n") + "\n"); assert.equal(verify(p + ".drop").ok, false); n++;
writeFileSync(p + ".kind", lines.map((l, i) => i === 2 ? l.replace("NOT_PROVEN", "ACCEPTED") : l).join("\n") + "\n"); assert.equal(verify(p + ".kind").ok, false); n++;
// forged-but-rehashed entries: isolate CHAIN and SEQ checks (found by mutation run 1: both survived)
import { createHash } from "node:crypto";
const canon = (v) => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
const reh = (o) => { const { entry_hash, ...b } = o; return canon({ ...b, entry_hash: createHash("sha256").update(canon(b)).digest("hex") }); };
const recs = lines.map((l) => JSON.parse(l));
writeFileSync(p + ".chain", [lines[0], reh({ ...recs[1], prev_hash: "f".repeat(64) }), lines[2]].join("\n") + "\n"); assert.equal(verify(p + ".chain").why, "CHAIN"); n++;
writeFileSync(p + ".seq", [lines[0], lines[1], reh({ ...recs[2], seq: 7 })].join("\n") + "\n"); assert.equal(verify(p + ".seq").why, "SEQ"); n++;
console.log(JSON.stringify({ suite: "journal-r1", passed: n, failed: 0 }));
