// After `vite build`: proves the browser bundle does not ship Pro engine code (it lives on the server).
// Exit 1 if any marker string from server-only modules appears in any built JS chunk.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const dir = new URL("../dist/assets/", import.meta.url).pathname;
if (!existsSync(dir)) { console.error("NOT_RUN: dist/assets missing; run vite build first."); process.exit(2); }
const MARKERS = [
  ["living compiler section", "## Fixes from earlier attempts"],
  ["builder id", "spe-living-builder/1"],
  ["runtime repair text", "unless you declare and initialise it first"],
  ["Pro scanner rule", "(?:AKIA|ASIA)[0-9A-Z]{16}"],
  ["Pro scanner label", "OpenAI-style API key"],
  ["Pro provider allowlist", "api.groq.com/openai/v1/chat/completions"],
  ["certificate format", "spe.proof-certificate/1"],
  ["Pro templates", "TEMPLATES"],
  ["mock demo script", "demo:crash-then-fix\\]"],
  ["release signer", "SIGNING_NOT_CONFIGURED\":"],
  ["sandbox harness", "node-vm-worker"],
];
// The rest of SPE (free tools) has its own, separate scanner/provider code; only Pro Studio chunks are in scope:
// chunks that talk to /api/pro or that are Pro Studio views.
const all = readdirSync(dir).filter((f) => f.endsWith(".js"));
const files = all.filter((f) => readFileSync(join(dir, f), "utf8").includes("/api/pro") || /^(ProStudioApp|CoWorkiePanel|CommandPalette|Living|Blind|Portability|PromptStudio|Blueprint|Regression|Releases|CodeExport|Batch|Brand|Formats|Cost|Scanner|Audit|Library|Report|Frame)-/.test(f));
console.log(`Pro Studio chunks in scope: ${files.join(", ")}`);
let bad = 0;
for (const [label, m] of MARKERS) {
  const hits = files.filter((f) => readFileSync(join(dir, f), "utf8").includes(m));
  console.log(`${hits.length ? "FAIL" : "ok  "} ${label}: ${hits.length ? hits.join(", ") : "absent"}`);
  bad += hits.length ? 1 : 0;
}
console.log(`${files.length} JS chunks scanned, ${MARKERS.length} markers, ${bad} found.`);
process.exit(bad ? 1 : 0);
