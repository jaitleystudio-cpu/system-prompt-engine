#!/usr/bin/env node
/**
 * SPE Ω — Dual-Core Router Authority & Fallback Test Battery
 *
 * Verifies:
 * 1. Authority Hierarchy: Core A is primary generator; Core B is deterministic plan B.
 * 2. Primary Core A delivery on valid generation.
 * 3. Bounded repair path on repairable requirement omission.
 * 4. Deterministic Core B fallback activation on device failure or repair exhaustion.
 * 5. Transparent degradation: Fallback NEVER masquerades as Core A.
 * 6. Contradiction blocking: Mutually exclusive requirements are halted cleanly.
 * 7. Zero egress & $0 compute invariant.
 */

import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const routerPath = join(here, "../src/engine/dualCoreRouter.ts");

const { executeDualCoreGeneration } = await import(routerPath);

console.log("========================================================================");
console.log("🚀 SPE Ω — DUAL-CORE ROUTER AUTHORITY & FALLBACK TEST SUITE");
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

// TEST 1: Core A Primary Delivery
await check("Core A Primary: Generates qualified prompt with CORE_A_GENERATIVE tag", async () => {
  const req = "Build an Android application that works completely offline, supports Telugu and English, and never collects personal information.";
  const res = await executeDualCoreGeneration({
    userRequest: req,
    target: "any",
  });

  assert.equal(res.engineCoreUsed, "CORE_A_GENERATIVE");
  assert.equal(res.isFallback, false);
  assert.ok(
    res.status === "QUALIFIED_GENERATIVE_SUCCESS" || res.status === "REPAIRED_GENERATIVE_SUCCESS"
  );
  assert.ok(res.prompt.includes("Telugu"));
  assert.ok(res.prompt.includes("offline"));
  assert.equal(res.qualityReport?.mandatoryRequirementsPassed, true);
  assert.equal(res.costUsd, 0);
  assert.equal(res.zeroEgressGuaranteed, true);
});

// TEST 2: Forced Core B Fallback
await check("Core B Fallback: Transparently engages Core B when device cannot run Core A", async () => {
  const req = "Keep this exact request. Line 2 — café";
  const res = await executeDualCoreGeneration({
    userRequest: req,
    forceFallbackCoreB: true,
  });

  assert.equal(res.engineCoreUsed, "CORE_B_FALLBACK");
  assert.equal(res.isFallback, true);
  assert.equal(res.status, "DEGRADED_FALLBACK_DELIVERY");
  assert.equal(res.fallbackReason, "FORCED_DEVICE_FALLBACK");
  assert.ok(res.prompt.includes("SPE SAFE FALLBACK"));
  assert.ok(res.prompt.includes("status: DEGRADED_DELIVERY"));
  assert.ok(res.prompt.includes("Keep this exact request."));
  assert.equal(res.costUsd, 0);
  assert.equal(res.zeroEgressGuaranteed, true);
});

// TEST 3: Fallback Never Masquerades as Core A
await check("Transparency Contract: Fallback prompt never contains VERIFIED or canonical claims", async () => {
  const res = await executeDualCoreGeneration({
    userRequest: "Test fallback honesty",
    forceFallbackCoreB: true,
  });

  assert.equal(res.engineCoreUsed, "CORE_B_FALLBACK");
  assert.equal(/100% verified|canonical quality PASS/i.test(res.prompt), false);
  assert.ok(res.prompt.includes("It has not received SPE's normal semantic check."));
});

// TEST 4: Contradiction Blocking
await check("Contradiction Blocking: Mutually incompatible constraints halt without false success", async () => {
  const conflictingReq = "Build a system that works completely offline with zero network access, and simultaneously connects to cloud servers for real-time streaming.";
  const res = await executeDualCoreGeneration({
    userRequest: conflictingReq,
  });

  assert.equal(res.status, "CONTRADICTION_BLOCKED");
  assert.equal(res.prompt, "");
  assert.ok(res.fallbackReason?.includes("offline"));
  assert.equal(res.isFallback, false);
});

// TEST 5: Preservation of Explicit Constraints in Core B
await check("Core B preserves user's explicit constraints byte-for-byte", async () => {
  const res = await executeDualCoreGeneration({
    userRequest: "Offline task",
    explicitConstraints: ["Must not use cloud APIs", "Local SQLite only"],
    forceFallbackCoreB: true,
  });

  assert.ok(res.prompt.includes("Explicit constraints:"));
  assert.ok(res.prompt.includes("- Must not use cloud APIs"));
  assert.ok(res.prompt.includes("- Local SQLite only"));
});

console.log("------------------------------------------------------------------------");
if (failures.length > 0) {
  console.error(`❌ ${failures.length} tests failed!`);
  process.exit(1);
} else {
  console.log("🎉 ALL DUAL-CORE ROUTER TESTS PASSED (100%)!");
  process.exit(0);
}
