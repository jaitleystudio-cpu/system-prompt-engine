#!/usr/bin/env node
/**
 * Core B is degraded delivery only. It must not become a semantic engine.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "../src/engine/core-b.mjs");
const source = readFileSync(sourcePath, "utf8");
const { createRawRequestCustody, renderSafeFallbackPrompt } = await import(sourcePath);

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`FAIL ${name}: ${err.message}`);
  }
}

const raw = "Keep this exact request.\nLine 2 — café";

await check("raw request preserved byte-for-byte", async () => {
  const custody = await createRawRequestCustody({ rawRequest: raw });
  const artifact = renderSafeFallbackPrompt(custody, "ENGINE_UNAVAILABLE");
  assert.equal(artifact.prompt.includes(raw), true);
  assert.equal(artifact.raw_request, raw);
});

await check("target preserved only if explicit", async () => {
  const absent = renderSafeFallbackPrompt(await createRawRequestCustody({ rawRequest: raw }), "ENGINE_UNAVAILABLE");
  assert.equal(absent.prompt.includes("Target:"), false);
  const present = renderSafeFallbackPrompt(
    await createRawRequestCustody({ rawRequest: raw, target: "a local note" }),
    "ENGINE_UNAVAILABLE",
  );
  assert.equal(present.prompt.includes("a local note"), true);
});

await check("explicit constraints preserved only if supplied", async () => {
  const absent = renderSafeFallbackPrompt(await createRawRequestCustody({ rawRequest: raw }), "ENGINE_UNAVAILABLE");
  assert.equal(absent.prompt.includes("Do not invent facts"), false);
  const present = renderSafeFallbackPrompt(
    await createRawRequestCustody({ rawRequest: raw, explicitConstraints: ["Do not invent facts"] }),
    "ENGINE_UNAVAILABLE",
  );
  assert.equal(present.prompt.includes("Do not invent facts"), true);
});

await check("no invented constraint", async () => {
  const artifact = renderSafeFallbackPrompt(await createRawRequestCustody({ rawRequest: raw }), "ENGINE_UNAVAILABLE");
  assert.deepEqual(artifact.explicit_constraints, []);
});

await check("no VERIFIED wording or state", async () => {
  const artifact = renderSafeFallbackPrompt(await createRawRequestCustody({ rawRequest: raw }), "ENGINE_UNAVAILABLE");
  assert.equal(artifact.verified, false);
  assert.equal(artifact.quality_verified, false);
  assert.equal(/verified/i.test(artifact.prompt), false);
});

await check("no canonical flag", () => {
  const artifact = renderSafeFallbackPrompt(
    { raw_request: raw, target: null, explicit_constraints: [], custody_id: "x" },
    "ENGINE_UNAVAILABLE",
  );
  assert.equal(artifact.canonical, false);
  assert.equal(artifact.artifact_type, "SAFE_FALLBACK_PROMPT");
});

await check("no network, engine, k3, quality, or self import", () => {
  assert.equal(/from\s+["'].*(client|k3Transport|qualityTransport|wasm-host|core-b)/.test(source), false);
  assert.equal(/\b(fetch|WebSocket|XMLHttpRequest|http:|https:)\b/.test(source), false);
  assert.equal(source.includes("EngineClient"), false);
  assert.equal(source.includes("k3Transport"), false);
  assert.equal(source.includes("qualityTransport"), false);
});

await check("deterministic same input = same prompt", async () => {
  const input = { rawRequest: raw, target: "note", explicitConstraints: ["stay exact"] };
  const left = renderSafeFallbackPrompt(await createRawRequestCustody(input), "ENGINE_UNAVAILABLE");
  const right = renderSafeFallbackPrompt(await createRawRequestCustody(input), "ENGINE_UNAVAILABLE");
  assert.equal(left.prompt, right.prompt);
  assert.equal(left.custody_id, right.custody_id);
});

await check("fallback never recurses", () => {
  assert.equal(/renderSafeFallbackPrompt\(/.test(source.replace("export function renderSafeFallbackPrompt", "")), false);
  const artifact = renderSafeFallbackPrompt(
    { raw_request: raw, target: null, explicit_constraints: [], custody_id: "once" },
    "ENGINE_UNAVAILABLE",
  );
  assert.equal(artifact.semantic_engine_used, false);
  assert.equal(artifact.execution_authorized, false);
  assert.equal(artifact.external_effect, false);
  assert.equal(artifact.status, "DEGRADED_DELIVERY");
});

if (failures.length) {
  console.error(`\n${failures.length} Core B check(s) failed`);
  process.exit(1);
}
console.log("\nPASS core-b fallback");
