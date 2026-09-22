#!/usr/bin/env node
/**
 * Node host for the same wasm-host glue used by the Web Worker.
 * Env:
 *   SPE_FIXTURE_ID=POS-001|NEG-001
 *   SPE_WASM_PATH=override path (missing → ENGINE_UNAVAILABLE)
 *   SPE_TAMPER_SHA=1 → force integrity mismatch
 *   SPE_PROOF_EGRESS=1 → count fetch/WebSocket during evaluate
 * COST ₹0. No TypeScript semantic fallback. not_a_release=true.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const fixtureId = process.env.SPE_FIXTURE_ID || "POS-001";

const sampleMap = {
  "POS-001": join(webRoot, "src/samples/pos001.json"),
  "NEG-001": join(webRoot, "src/samples/neg001.json"),
};

function fail(code, message, phases = []) {
  const out = {
    error: { code, message },
    result: null,
    phases,
    used_ts_fallback: false,
    sha256: null,
    imports: null,
  };
  if (process.env.SPE_PROOF_EGRESS === "1") {
    out.egress = { fetch_during_evaluate: 0, websocket_during_evaluate: 0 };
  }
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

const samplePath = sampleMap[fixtureId];
if (!samplePath || !existsSync(samplePath)) {
  fail("ENGINE_UNAVAILABLE", `unknown or missing fixture ${fixtureId}`);
}

const wasmPath = process.env.SPE_WASM_PATH
  ? resolve(process.env.SPE_WASM_PATH)
  : join(webRoot, "public/spe_wasm.wasm");
const metaPath = join(webRoot, "public/spe_wasm.sha256.json");

if (!existsSync(wasmPath)) {
  fail("ENGINE_UNAVAILABLE", `WASM missing at ${wasmPath}`, ["loading_wasm", "unavailable"]);
}

const phases = ["loading_wasm"];
let expectedSha = null;
if (existsSync(metaPath)) {
  expectedSha = JSON.parse(readFileSync(metaPath, "utf8")).sha256;
}
if (process.env.SPE_TAMPER_SHA === "1") {
  expectedSha = "0".repeat(64);
}

const wasmBytes = new Uint8Array(readFileSync(wasmPath));
const fixture = JSON.parse(readFileSync(samplePath, "utf8"));
const jsonText = JSON.stringify(fixture);

let fetchCount = 0;
let wsCount = 0;
const origFetch = globalThis.fetch;
if (process.env.SPE_PROOF_EGRESS === "1") {
  globalThis.fetch = async (...args) => {
    fetchCount += 1;
    if (typeof origFetch === "function") return origFetch(...args);
    throw new Error("fetch blocked during SPE_PROOF_EGRESS");
  };
  class CountingWebSocket {
    constructor() {
      wsCount += 1;
      throw new Error("WebSocket blocked during SPE_PROOF_EGRESS");
    }
  }
  globalThis.WebSocket = CountingWebSocket;
}

const hostUrl = pathToFileURL(join(webRoot, "src/engine/wasm-host.mjs")).href;
const { loadAndEvaluate } = await import(hostUrl);

const out = await loadAndEvaluate({
  wasmBytes,
  expectedSha256: expectedSha,
  jsonText,
  onPhase: (p) => {
    phases.push(p);
  },
});

const mergedPhases = [...new Set(["loading_wasm", ...out.phases, ...phases])];
// Preserve chronological order from host, prefixed with loading_wasm
const chronological = ["loading_wasm", ...out.phases.filter((p) => p !== "loading_wasm")];

const result = {
  error: out.error,
  result: out.result,
  phases: chronological.length > 1 ? chronological : mergedPhases,
  used_ts_fallback: false,
  sha256: out.sha256,
  imports: out.imports,
};

if (process.env.SPE_PROOF_EGRESS === "1") {
  result.egress = {
    fetch_during_evaluate: fetchCount,
    websocket_during_evaluate: wsCount,
  };
}

process.stdout.write(JSON.stringify(result) + "\n");
process.exit(0);
