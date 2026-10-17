#!/usr/bin/env node
/**
 * Engine fixture against an explicit WASM file.
 *
 * Hashes that file and passes the digest as expectedSha256. Does not read
 * apps/web/public/spe_wasm.sha256.json and does not copy anything.
 *
 *   node tools/wasm_candidate_engine_fixture.mjs <wasm> POS-001|NEG-001
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const wasmPath = process.argv[2];
const fixtureId = process.argv[3] || "POS-001";
const sampleMap = {
  "POS-001": join(repoRoot, "apps/web/src/samples/pos001.json"),
  "NEG-001": join(repoRoot, "apps/web/src/samples/neg001.json"),
};

if (!wasmPath || !sampleMap[fixtureId]) {
  process.stderr.write("usage: wasm_candidate_engine_fixture.mjs <wasm> POS-001|NEG-001\n");
  process.exit(2);
}

const wasmBytes = new Uint8Array(readFileSync(resolve(wasmPath)));
const expectedSha256 = createHash("sha256").update(wasmBytes).digest("hex");
const fixture = JSON.parse(readFileSync(sampleMap[fixtureId], "utf8"));
const hostUrl = pathToFileURL(join(repoRoot, "apps/web/src/engine/wasm-host.mjs")).href;
const { loadAndEvaluate } = await import(hostUrl);
const out = await loadAndEvaluate({
  wasmBytes,
  expectedSha256,
  jsonText: JSON.stringify(fixture),
});
process.stdout.write(
  JSON.stringify({
    error: out.error,
    used_ts_fallback: out.used_ts_fallback,
    imports: out.imports,
    sha256: out.sha256,
    status: out.result && out.result.status,
    disposition: out.result && out.result.disposition,
    reason_code: out.result && out.result.reason_code,
    fixture: fixtureId,
  }) + "\n",
);
process.exit(out.error ? 1 : 0);
