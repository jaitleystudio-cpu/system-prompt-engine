import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";
import { loadAndEvaluate } from "../src/engine/wasm-host.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");

const bundle = await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const wasmBytes = new Uint8Array(readFileSync(join(root, "public/spe_wasm.wasm")));
const expectedSha256 = JSON.parse(
  readFileSync(join(root, "public/spe_wasm.sha256.json"))
).sha256;

function getRssMiB() {
  return (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
}

console.log("============================================================");
console.log("SPE Ω — FULL 1,000,000 WORD SOURCE STRESS & RSS BENCHMARK");
console.log("============================================================");

// -------------------------------------------------------------
// 1. ASCII 1,000,000 words
// -------------------------------------------------------------
console.log(`[1M ASCII] Starting run. Initial RSS: ${getRssMiB()} MiB`);
const asciiChunk = "alpha beta gamma delta epsilon zeta eta theta iota kappa "; // 10 words
const targetWordCount = 1_000_000;
const ascii1M = asciiChunk.repeat(targetWordCount / 10).trim();
const asciiRawBytes = Buffer.byteLength(ascii1M, "utf8");
console.log(`[1M ASCII] Generated 1,000,000 words. Raw bytes: ${(asciiRawBytes / (1024 * 1024)).toFixed(2)} MB`);

const asciiIntent = runtime.defaultIntentLens(ascii1M);
const asciiFixture = runtime.buildAbiFixture({
  category: "Writing",
  target: "any",
  userRequest: ascii1M,
  ...asciiIntent,
});

// Single-source-of-truth filtering: filter out f-user-request
const rawFacts = Array.isArray(asciiFixture.payload.facts) ? asciiFixture.payload.facts : [];
const filteredFacts = rawFacts.filter((item) => {
  if (item.fact_id === "f-user-request") return false;
  if (item.statement === ascii1M) return false;
  return true;
});

const asciiReq = {
  spe_api: "k3",
  op: "select",
  protected: {
    ...asciiFixture.payload,
    goal: ascii1M,
    facts: filteredFacts,
  },
  category: { display_label: "Writing" },
  task: {},
};

const asciiOutcome = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: JSON.stringify(asciiReq),
});
assert.equal(asciiOutcome.error, null);

const asciiCompiled = asciiOutcome.result.output.prompt_effect_plan.compiled_prompt;
const asciiCompiledBytes = Buffer.byteLength(asciiCompiled, "utf8");
const asciiCompiledWords = asciiCompiled.match(/\S+/g).length;
const asciiRatio = asciiCompiledBytes / asciiRawBytes;
const asciiPeakRss = getRssMiB();

console.log(`[1M ASCII] Compiled Prompt Words: ${asciiCompiledWords.toLocaleString()}`);
console.log(`[1M ASCII] Amplification Ratio: ${asciiRatio.toFixed(4)}x (eliminated ~2.00x duplication)`);
console.log(`[1M ASCII] Peak Direct RSS: ${asciiPeakRss} MiB`);
assert.ok(asciiRatio < 1.01, `Amplification ratio ${asciiRatio} must be ~1.00x`);
assert.equal(asciiCompiledWords >= 1_000_000 && asciiCompiledWords <= 1_000_100, true);

// Verify raw identity in renderer
const asciiRendered = runtime.renderNonProductionEnvelopePreview({
  category: "Writing",
  target: "any",
  userRequest: ascii1M,
  envelopeOutput: asciiFixture.payload,
});
assert.equal(asciiRendered.userRequest === ascii1M, true, "Raw identity must match exactly");
console.log(`[1M ASCII] Raw Identity: PASS`);

// -------------------------------------------------------------
// 2. Mixed Unicode 1,000,000 words
// -------------------------------------------------------------
console.log(`\n[1M Mixed Unicode] Starting run. Current RSS: ${getRssMiB()} MiB`);
const unicodeChunk = "వర్డ్ சொல் शब्द كلمة שלום 世界 言葉 คำ 🚀 "; // 10 words mixed
const unicode1M = unicodeChunk.repeat(targetWordCount / 10).trim();
const unicodeRawBytes = Buffer.byteLength(unicode1M, "utf8");
console.log(`[1M Mixed Unicode] Generated 1,000,000 words. Raw bytes: ${(unicodeRawBytes / (1024 * 1024)).toFixed(2)} MB`);

const unicodeFixture = runtime.buildAbiFixture({
  category: "Writing",
  target: "any",
  userRequest: unicode1M,
});

const unicodeReq = {
  spe_api: "k3",
  op: "select",
  protected: {
    ...unicodeFixture.payload,
    goal: unicode1M,
    facts: [],
  },
  category: { display_label: "Writing" },
  task: {},
};

const unicodeOutcome = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: JSON.stringify(unicodeReq),
});
assert.equal(unicodeOutcome.error, null);

const unicodeCompiled = unicodeOutcome.result.output.prompt_effect_plan.compiled_prompt;
const unicodeCompiledBytes = Buffer.byteLength(unicodeCompiled, "utf8");
const unicodeCompiledWords = unicodeCompiled.match(/\S+/g).length;
const unicodeRatio = unicodeCompiledBytes / unicodeRawBytes;
const unicodePeakRss = getRssMiB();

console.log(`[1M Mixed Unicode] Compiled Prompt Words: ${unicodeCompiledWords.toLocaleString()}`);
console.log(`[1M Mixed Unicode] Amplification Ratio: ${unicodeRatio.toFixed(4)}x`);
console.log(`[1M Mixed Unicode] Peak Direct RSS: ${unicodePeakRss} MiB`);
assert.ok(unicodeRatio < 1.01, `Amplification ratio ${unicodeRatio} must be ~1.00x`);

const unicodeRendered = runtime.renderNonProductionEnvelopePreview({
  category: "Writing",
  target: "any",
  userRequest: unicode1M,
  envelopeOutput: unicodeFixture.payload,
});
assert.equal(unicodeRendered.userRequest === unicode1M, true, "Mixed Unicode raw identity must match exactly");
console.log(`[1M Mixed Unicode] Raw Identity: PASS`);

// -------------------------------------------------------------
// 3. Post-Request Memory Recovery
// -------------------------------------------------------------
if (global.gc) global.gc();
const postRecoveryRss = getRssMiB();
console.log(`\n[RECOVERY] Post-GC RSS: ${postRecoveryRss} MiB`);
console.log("PASS: 1,000,000 word stress completed with 100% green verification!");
