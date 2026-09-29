#!/usr/bin/env node
/**
 * No-dead-end delivery. Terminal states are explicit. Blank success is refused.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideDelivery } from "../src/engine/delivery-policy.mjs";
import { createRawRequestCustody, renderSafeFallbackPrompt } from "../src/engine/core-b.mjs";
import { evaluateTrustedQuality, sha256Hex } from "../src/engine/wasm-host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const coreSource = readFileSync(join(webRoot, "src/engine/core-b.mjs"), "utf8");
const appSource = readFileSync(join(webRoot, "src/App.tsx"), "utf8");
const wasmBytes = new Uint8Array(readFileSync(join(webRoot, "public/spe_wasm.wasm")));
const manifestSha = JSON.parse(readFileSync(join(webRoot, "public/spe_wasm.sha256.json"), "utf8")).sha256;
const raw = "Keep the original request intact.";

function assertTerminal(name, decision) {
  const allowed = new Set([
    "CANONICAL_PROMPT",
    "RECONSTRUCTED_PROMPT",
    "SAFE_FALLBACK_PROMPT",
    "CLARIFICATION_REQUIRED",
    "UNSUPPORTED",
    "REFUSED",
  ]);
  assert.equal(allowed.has(decision.terminal), true, name);
  if (decision.terminal === "SAFE_FALLBACK_PROMPT") assert.equal(decision.fallback, true);
  if (decision.terminal !== "SAFE_FALLBACK_PROMPT") assert.equal(decision.fallback, false);
}

const scenarios = [
  ["WASM missing / engine unavailable", { kind: "engine_unavailable", hasCanonical: false }],
  ["K3 unavailable", { kind: "k3_unavailable", hasCanonical: false }],
  ["quality unavailable after canonical", { kind: "quality_unavailable", hasCanonical: true }],
  ["reconstruction unresolved stays canonical", { kind: "quality_receipt", hasCanonical: true, receipt: { receipt: { verdict: "FAIL" }, reconstruction: { kept: "original", plan: { disposition: "UNRESOLVED" } } } }],
  ["reconstruction regressed stays canonical", { kind: "quality_receipt", hasCanonical: true, receipt: { receipt: { verdict: "FAIL" }, reconstruction: { kept: "original", plan: { disposition: "REGRESSED" } } } }],
  ["clarification", { kind: "prompt_brief", hasCanonical: false }],
  ["conflict", { kind: "conflict", hasCanonical: false }],
  ["unsupported", { kind: "unsupported", hasCanonical: false }],
  ["refused", { kind: "refused", hasCanonical: false }],
];

for (const [name, event] of scenarios) {
  const decision = decideDelivery(event);
  assertTerminal(name, decision);
  assert.notEqual(decision.terminal, "");
}
assert.equal(decideDelivery({ kind: "engine_unavailable", hasCanonical: false }).terminal, "SAFE_FALLBACK_PROMPT");
assert.equal(decideDelivery({ kind: "quality_unavailable", hasCanonical: true }).validation, "UNKNOWN");
assert.equal(decideDelivery({ kind: "refused", hasCanonical: false }).fallback, false);
assert.equal(decideDelivery({ kind: "prompt_brief", hasCanonical: false }).fallback, false);

const mismatch = await evaluateTrustedQuality({
  wasmBytes,
  expectedSha256: "00".repeat(32),
  request: { spe_api: "quality", op: "mode", proof_class: "ENFORCEMENT_VERIFIED", wasm_available: true },
});
assert.equal(mismatch.trusted, false);
assert.equal(mismatch.result, null);

const imported = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x02, 0x09, 0x01,
  0x03, 0x65, 0x6e, 0x76, 0x01, 0x78, 0x00, 0x00,
]);
const importSha = await sha256Hex(imported);
const blockedImport = await evaluateTrustedQuality({
  wasmBytes: imported,
  expectedSha256: importSha,
  request: { spe_api: "quality", op: "mode" },
});
assert.equal(blockedImport.result, null);
assert.equal(blockedImport.error.code, "WASM_HOST_IMPORTS_FORBIDDEN");

const custody = await createRawRequestCustody({ rawRequest: raw, target: "local note", explicitConstraints: ["stay exact"] });
const fallback = renderSafeFallbackPrompt(custody, "ENGINE_UNAVAILABLE");
assert.equal(fallback.prompt.includes(raw), true);
assert.notEqual(fallback.prompt.trim(), "");
assert.equal(fallback.verified, false);
assert.equal(fallback.canonical, false);
assert.equal(fallback.explicit_constraints[0], "stay exact");
assert.equal(fallback.prompt.includes("local note"), true);
assert.equal(coreSource.includes("k3Transport"), false);
assert.equal(coreSource.includes("qualityTransport"), false);
assert.equal(/\bfetch\b/.test(coreSource), false);
assert.match(appSource, /disabled=\{!artifact\}/);
assert.equal(decideDelivery({ kind: "quality_unavailable", hasCanonical: true }).terminal, "CANONICAL_PROMPT");

const real = await evaluateTrustedQuality({
  wasmBytes,
  expectedSha256: manifestSha,
  request: { spe_api: "quality", op: "mode", mode: "DRY_RUN" },
});
assert.equal(real.sha256, manifestSha);
assert.equal(real.imports, 0);

console.log("PASS no-dead-end delivery");
