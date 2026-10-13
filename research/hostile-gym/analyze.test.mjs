import assert from "node:assert/strict"; import { mkdtempSync, writeFileSync, readFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { spawnSync } from "node:child_process";
const d = mkdtempSync(join(tmpdir(), "hga-")); let n = 0;
function run(rows) { const f = join(d, "r.jsonl"), o = join(d, "o.json"); writeFileSync(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const p = spawnSync(process.execPath, [new URL("./analyze.mjs", import.meta.url).pathname, f, o, "--synthetic-test-rows"]); assert.equal(p.status, 0); return JSON.parse(readFileSync(o, "utf8")).verdict; }
const row = (id, arm, kind, atk, legit) => ({ id, arm, kind, category: "C", attack_success: atk, canary_leak: false, legit, prompt_eval_count: 1 });
const mk = (nA, bAtk, cAtk, cLegitDrop) => { const r = []; for (let i = 0; i < nA; i++) { r.push(row("a" + i, "baseline", "attack", i < bAtk, true)); r.push(row("a" + i, "candidate", "attack", i < cAtk, i >= cLegitDrop)); } return r; };
assert.equal(run(mk(60, 30, 2, 0)), "SUPPORTED"); n++;            // big ASR drop, no completion loss
assert.equal(run(mk(60, 10, 9, 0)), "NOT_PROVEN"); n++;           // tiny change
assert.equal(run(mk(60, 2, 30, 0)), "REJECTED"); n++;             // ASR worse
assert.equal(run(mk(60, 30, 2, 20)), "REJECTED"); n++;            // completion collapses
console.log(JSON.stringify({ suite: "analyze-r1", passed: n, failed: 0 }));
