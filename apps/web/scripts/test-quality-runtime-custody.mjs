#!/usr/bin/env node
/**
 * Task57R runtime custody: caller fields cannot mint ENFORCEMENT_VERIFIED.
 * The trusted quality path is the host-verified WASM session, not generic evaluate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const engine = join(webRoot, "src/engine");

const {
  createVerifiedWasmSession,
  evaluateTrustedQuality,
  loadAndEvaluate,
  resolveQualityRoute,
  sealQualityRequest,
  sha256Hex,
} = await import(join(engine, "wasm-host.mjs"));

const wasmBytes = new Uint8Array(readFileSync(join(webRoot, "public/spe_wasm.wasm")));
const manifestSha = JSON.parse(readFileSync(join(webRoot, "public/spe_wasm.sha256.json"), "utf8")).sha256;
const fakeSha = "ab".repeat(32);
const callerProof = "ENFORCEMENT_VERIFIED";

function callerRequest() {
  return {
    spe_api: "quality",
    op: "mode",
    mode: "VALIDATE_ONLY",
    enforcement: "AVAILABLE",
    wasm_available: true,
    proof_class: callerProof,
    wasm_sha256: fakeSha,
    artifact: {},
  };
}

function proofClass(out) {
  return out?.result?.output?.proof_class ?? out?.result?.proof_class ?? null;
}

const failures = [];
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`);
    })
    .catch((err) => {
      failures.push(`${name}: ${err.message}`);
      console.log(`FAIL ${name}: ${err.message}`);
    });
}

await check("caller wasm_available=true cannot mint verified", async () => {
  const out = await evaluateTrustedQuality({
    wasmBytes,
    expectedSha256: "0".repeat(64),
    request: callerRequest(),
  });
  assert.equal(out.trusted, false);
  assert.equal(out.result, null);
  assert.notEqual(proofClass(out), callerProof);
});

await check("caller proof_class=ENFORCEMENT_VERIFIED is ignored", async () => {
  const session = await createVerifiedWasmSession({
    wasmBytes,
    expectedSha256: manifestSha,
  });
  assert.equal(session.verified, true);
  const sealed = sealQualityRequest(callerRequest(), session);
  assert.equal(Object.hasOwn(sealed, "proof_class"), false);
  assert.notEqual(sealed.wasm_sha256, fakeSha);
  const out = await evaluateTrustedQuality({
    wasmBytes,
    expectedSha256: manifestSha,
    request: callerRequest(),
  });
  assert.equal(out.trusted, true);
  assert.equal(out.sealed.proof_class, undefined);
  assert.notEqual(proofClass(out), callerProof);
});

await check("caller fake wasm_sha256 is ignored", async () => {
  const session = await createVerifiedWasmSession({
    wasmBytes,
    expectedSha256: manifestSha,
  });
  const sealed = sealQualityRequest(callerRequest(), session);
  assert.equal(sealed.wasm_sha256, manifestSha);
  assert.equal(sealed.runtime_evidence.wasm_sha256, manifestSha);
  assert.notEqual(sealed.runtime_evidence.wasm_sha256, fakeSha);
});

await check("generic evaluate with spe_api=quality requires trusted path", () => {
  const route = resolveQualityRoute({
    type: "evaluate",
    jsonText: JSON.stringify(callerRequest()),
  });
  assert.equal(route.trusted, false);
  assert.equal(route.error, "TRUSTED_QUALITY_PATH_REQUIRED");
  const worker = readFileSync(join(engine, "engine.worker.ts"), "utf8");
  const client = readFileSync(join(engine, "client.ts"), "utf8");
  const transport = readFileSync(join(engine, "qualityTransport.ts"), "utf8");
  assert.match(worker, /resolveQualityRoute/);
  assert.match(worker, /type === "quality"/);
  assert.match(client, /compileQuality/);
  assert.match(transport, /compileQuality/);
  assert.doesNotMatch(transport, /client\.compile\(/);
  assert.match(transport, /spe_api: "quality"/);
  assert.doesNotMatch(transport, /VALIDATE_ONLY/);
});

await check("real quality path carries the actual verified WASM hash", async () => {
  const out = await evaluateTrustedQuality({
    wasmBytes,
    expectedSha256: manifestSha,
    request: callerRequest(),
  });
  assert.equal(out.error, null);
  assert.equal(out.sha256, manifestSha);
  assert.equal(out.imports, 0);
  assert.equal(out.sealed.runtime_evidence.integrity_state, "VERIFIED");
  assert.equal(out.sealed.runtime_evidence.runtime_path, "worker-wasm");
  const actual = await sha256Hex(wasmBytes);
  assert.equal(out.sha256, actual);
});

await check("WASM hash mismatch yields no verified receipt", async () => {
  const out = await evaluateTrustedQuality({
    wasmBytes,
    expectedSha256: "11".repeat(32),
    request: callerRequest(),
  });
  assert.equal(out.trusted, false);
  assert.equal(out.result, null);
  assert.equal(out.error.code, "WASM_INTEGRITY_MISMATCH");
  assert.notEqual(proofClass(out), callerProof);
});

await check("WASM import count >0 yields no verified receipt", async () => {
  const imported = new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x02, 0x09,
    0x01, 0x03, 0x65, 0x6e, 0x76, 0x01, 0x78, 0x00, 0x00,
  ]);
  const sha = await sha256Hex(imported);
  const out = await evaluateTrustedQuality({
    wasmBytes: imported,
    expectedSha256: sha,
    request: callerRequest(),
  });
  assert.equal(out.trusted, false);
  assert.equal(out.result, null);
  assert.equal(out.error.code, "WASM_HOST_IMPORTS_FORBIDDEN");
  assert.notEqual(out.imports, 0);
});

await check("loadAndEvaluate remains a compatibility wrapper", async () => {
  const out = await loadAndEvaluate({
    wasmBytes,
    expectedSha256: manifestSha,
    jsonText: JSON.stringify({ spe_api: "quality", op: "mode", mode: "DRY_RUN" }),
  });
  assert.equal(out.used_ts_fallback, false);
  assert.equal(out.sha256, manifestSha);
  assert.equal(out.imports, 0);
  assert.equal(out.error, null);
  assert.equal(out.result.status, "VALID");
});

if (failures.length) {
  console.error(`\n${failures.length} custody check(s) failed`);
  process.exit(1);
}
console.log("\nPASS quality runtime custody");
