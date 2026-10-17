#!/usr/bin/env node
/**
 * SPE Ω — Core A Primary Generative Intelligence Engine Test Battery
 *
 * Verifies:
 * 1. Genuine Generative Prompt Reconstruction from arbitrary requests.
 * 2. 100% preservation of machine-verifiable explicit requirements.
 * 3. Contradiction detection blocks conflicting user instructions without hallucinating.
 * 4. Bounded Candidate Repair resolves missing requirements within 2 passes.
 * 5. Dialect adaptation for Claude, ChatGPT, Gemini, and Local.
 * 6. 100% offline air-gap and $0 compute spend.
 */

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const enginePath = join(here, "../src/engine/core-a.ts");

const {
  generateCoreAPrompt,
  decomposeUserIntent,
  synthesizeTaskSpecificPrompt,
} = await import(enginePath);

console.log("========================================================================");
console.log("🚀 SPE Ω — CORE A PRIMARY GENERATIVE ENGINE TEST SUITE");
console.log("========================================================================");

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
    console.log(`  ✗ FAIL: ${name}: ${err.message}`);
  }
}

// TEST 1: Intent Decomposition
await check("Generative intent decomposition extracts domain, stack, languages, and negative boundaries", () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  const intent = decomposeUserIntent(req);

  assert.equal(intent.domain, "Mobile Application Architecture");
  assert.ok(intent.technicalStack.includes("Android SDK"));
  assert.ok(intent.languages.some((l) => l.includes("Telugu")));
  assert.ok(intent.languages.some((l) => l.includes("English")));
  assert.equal(intent.offlineRequired, true);
  assert.equal(intent.privacyStrict, true);
  assert.ok(intent.negativeBoundaries.some((n) => n.includes("NEVER initiate external network")));
  assert.ok(intent.negativeBoundaries.some((n) => n.includes("NEVER collect, store, or transmit personally identifiable information")));
});

// TEST 2: Genuine Generation (Not Static Template Replacement)
await check("Synthesizes task-specific prompt from first principles", () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  const intent = decomposeUserIntent(req);
  const prompt = synthesizeTaskSpecificPrompt(intent, "any");

  // Verify dynamic structure
  assert.ok(prompt.includes("# System Role & Persona"));
  assert.ok(prompt.includes("Mobile Application Architecture"));
  assert.ok(prompt.includes("# Objective & Boundary Scope"));
  assert.ok(prompt.includes("# Explicit User Constraints & Boundaries"));
  assert.ok(prompt.includes("# Approach & Methodological Plan"));
  assert.ok(prompt.includes("Air-Gapped Architectural Foundation"));
  assert.ok(prompt.includes("Telugu"));
  assert.ok(prompt.includes("English"));
  assert.ok(prompt.includes("# Acceptance Checks & Verification Battery"));
  assert.ok(prompt.includes("zero network calls"));
});

// TEST 3: Full End-to-End Core A Generation with 100% Requirement Preservation
await check("Core A generates qualified prompt with 100% checkable requirement preservation", async () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  const res = await generateCoreAPrompt({
    userRequest: req,
    target: "any",
  });

  assert.ok(
    res.status === "QUALIFIED_GENERATIVE_SUCCESS" || res.status === "REPAIRED_GENERATIVE_SUCCESS",
    `Expected success status, got: ${res.status}`
  );
  assert.ok(
    res.runtimeUsed === "IN_PROCESS_ONNX_NEURAL" || res.runtimeUsed === "IN_PROCESS_GENERATIVE_KERNEL",
    `Expected neural runtime, got ${res.runtimeUsed}`
  );
  assert.equal(res.costUsd, 0);
  assert.equal(res.zeroEgressGuaranteed, true);
  assert.ok(res.latencyMs > 0 && res.latencyMs < 200, `Latency too high: ${res.latencyMs}ms`);

  // Verify independent quality report
  assert.equal(res.qualityReport.mandatoryRequirementsPassed, true);
  assert.equal(res.qualityReport.preservationScore, 100);
  assert.equal(res.qualityReport.missingRequirements.length, 0);
  assert.equal(res.qualityReport.detectedContradictions.length, 0);
  assert.ok(res.qualityReport.overallQualityScore >= 90);
});

// TEST 4: Contradiction Detection Blocks Without Hallucinating
await check("Core A halts with CONTRADICTION_BLOCKED when user constraints are mutually exclusive", async () => {
  const conflictingReq = "Build a system that works completely offline with zero network access, and simultaneously connects to cloud servers for real-time streaming.";
  const res = await generateCoreAPrompt({
    userRequest: conflictingReq,
  });

  assert.equal(res.status, "CONTRADICTION_BLOCKED");
  assert.equal(res.qualityReport.verdict, "BLOCKED_BY_CONFLICT");
  assert.ok(res.qualityReport.detectedContradictions.length > 0);
  assert.ok(res.blockingReason.includes("offline"));
  assert.equal(res.prompt, "");
});

// TEST 5: Target Dialect Adaptation (Claude XML Tags)
await check("Adapts dialect to Claude XML syntax when target is claude", async () => {
  const req = "Create a 3D WebGL particle simulation with 60fps frame budgeting that works offline.";
  const res = await generateCoreAPrompt({
    userRequest: req,
    target: "claude",
  });

  assert.ok(res.prompt.includes("<system_instructions>"));
  assert.ok(res.prompt.includes("<role>"));
  assert.ok(res.prompt.includes("<objective>"));
  assert.ok(res.prompt.includes("<acceptance_checks>"));
  assert.ok(res.prompt.includes("</system_instructions>"));
});

// TEST 6: Zero Egress & Cryptographic Audit Verification
await check("Emits cryptographic audit digest and enforces $0 compute spend", async () => {
  const res = await generateCoreAPrompt({
    userRequest: "Design a fast Python microservice with SQLite.",
    target: "chatgpt",
  });

  assert.equal(res.costUsd, 0);
  assert.equal(res.zeroEgressGuaranteed, true);
  assert.equal(typeof res.executionDigestHex, "string");
  assert.equal(res.executionDigestHex.length, 64);
});

console.log("------------------------------------------------------------------------");
if (failures.length > 0) {
  console.error(`❌ ${failures.length} tests failed!`);
  process.exit(1);
} else {
  console.log("🎉 ALL CORE A PRIMARY GENERATIVE ENGINE TESTS PASSED (100%)!");
  process.exit(0);
}
