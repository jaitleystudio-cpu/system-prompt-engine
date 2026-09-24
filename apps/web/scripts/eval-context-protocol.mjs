/**
 * Node host for context-protocol compile via the same wasm-host glue as the Worker.
 * Env:
 *   SPE_CONTEXT_PROTOCOL_JSON=...  (required JSON request body)
 *   SPE_WASM_PATH=override path (missing → ENGINE_UNAVAILABLE)
 *   SPE_TAMPER_SHA=1 → force integrity mismatch
 * COST ₹0. No TypeScript semantic fallback. not_a_release=true.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");

function fail(code, message, phases = []) {
  const out = {
    error: { code, message },
    result: null,
    phases,
    used_ts_fallback: false,
    sha256: null,
    imports: null,
  };
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

const raw = process.env.SPE_CONTEXT_PROTOCOL_JSON;
if (!raw) {
  fail("ENGINE_UNAVAILABLE", "SPE_CONTEXT_PROTOCOL_JSON required");
}

let fixture;
try {
  fixture = JSON.parse(raw);
} catch (err) {
  fail("INVALID_JSON", String(err && err.message ? err.message : err));
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
const jsonText = JSON.stringify(fixture);

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

const chronological = ["loading_wasm", ...out.phases.filter((p) => p !== "loading_wasm")];

const result = {
  error: out.error,
  result: out.result,
  phases: chronological,
  used_ts_fallback: false,
  sha256: out.sha256,
  imports: out.imports,
};

process.stdout.write(JSON.stringify(result) + "\n");
process.exit(0);
