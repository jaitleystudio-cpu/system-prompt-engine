#!/usr/bin/env node
/**
 * Separate cold integrity from warm WASM evaluation. Do not mix the two.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createVerifiedWasmSession } from "../src/engine/wasm-host.mjs";
import { createRawRequestCustody, renderSafeFallbackPrompt } from "../src/engine/core-b.mjs";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmBytes = new Uint8Array(readFileSync(join(webRoot, "public/spe_wasm.wasm")));
const expectedSha256 = JSON.parse(readFileSync(join(webRoot, "public/spe_wasm.sha256.json"), "utf8")).sha256;
const payload = JSON.stringify({ spe_api: "quality", op: "mode", mode: "DRY_RUN" });
const N = 100;

function percentile(samples, p) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

const coldStart = performance.now();
const session = await createVerifiedWasmSession({ wasmBytes, expectedSha256 });
const coldMs = performance.now() - coldStart;
if (!session.verified) throw new Error(session.error?.message || "session unverified");

const warm = [];
for (let i = 0; i < N; i += 1) {
  const start = performance.now();
  await session.evaluate(payload);
  warm.push(performance.now() - start);
}

const core = [];
for (let i = 0; i < N; i += 1) {
  const start = performance.now();
  const custody = await createRawRequestCustody({ rawRequest: "bench request", target: "note" });
  renderSafeFallbackPrompt(custody, "ENGINE_UNAVAILABLE");
  core.push(performance.now() - start);
}

console.log(
  JSON.stringify(
    {
      integrity_cold_ms: coldMs,
      wasm_warm: { n: N, median_ms: percentile(warm, 0.5), p95_ms: percentile(warm, 0.95), max_ms: Math.max(...warm) },
      core_b: { n: N, median_ms: percentile(core, 0.5), p95_ms: percentile(core, 0.95), max_ms: Math.max(...core) },
      sha256: session.sha256,
      imports: session.imports,
    },
    null,
    2,
  ),
);
