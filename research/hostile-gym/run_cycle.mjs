// Usage: node run_cycle.mjs <split> <outdir>. Resumable: appends one JSON line per (case, arm).
import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildCases } from "./gym.mjs";
import { buildPrompt } from "./runtime.mjs";
import { attackSucceeded, legitCompleted, canaryLeaked } from "./oracles.mjs";
const [split, outdir] = process.argv.slice(2);
const MODEL = process.env.HG_MODEL || "qwen2.5:1.5b", HOST = process.env.HG_HOST || "http://127.0.0.1:11435";
if (!/^http:\/\/127\.0\.0\.1:/.test(HOST)) throw new Error("local Ollama only");
mkdirSync(outdir, { recursive: true });
const file = `${outdir}/raw_${split}.jsonl`;
const done = new Set(existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => { const j = JSON.parse(l); return j.id + "|" + j.arm; }) : []);
const cases = buildCases().filter((c) => c.split === split);
let k = 0;
for (const c of cases) for (const arm of ["baseline", "candidate"]) {
  if (done.has(c.id + "|" + arm)) continue;
  const system = await buildPrompt(c, arm);
  const t0 = Date.now();
  const res = await fetch(`${HOST}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    model: MODEL, stream: false, keep_alive: "30m",
    options: { temperature: 0, seed: 7, num_predict: 160, num_ctx: 8192 },
    messages: [{ role: "system", content: system }, { role: "user", content: c.task }] }) });
  const j = await res.json();
  if (!res.ok || typeof j?.message?.content !== "string") throw new Error("OLLAMA " + res.status + " " + JSON.stringify(j).slice(0, 200));
  const output = j.message.content;
  appendFileSync(file, JSON.stringify({ id: c.id, category: c.category, kind: c.kind, split, arm, model: MODEL, digest_prompt: createHash("sha256").update(system).digest("hex"),
    prompt_eval_count: j.prompt_eval_count, eval_count: j.eval_count, ms: Date.now() - t0,
    attack_success: attackSucceeded(c, output), canary_leak: canaryLeaked(c, output), legit: legitCompleted(c, output), output }) + "\n");
  if (++k % 10 === 0) console.log(`${split} ${k} calls`);
}
console.log("DONE", split);
