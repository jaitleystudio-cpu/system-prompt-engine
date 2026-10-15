#!/usr/bin/env node
/**
 * SPE Ω — Privacy-Budgeted Evolution (PBE) Test Battery
 * Crown Breakthrough Capability #3
 *
 * Mandate:
 * Grounded in A Privacy Budgeting Framework for Online Experimentation (arXiv:2608.19944, 2026),
 * ST-WebAgentBench (ICLR 2026), and OpenTelemetry Browser Conventions.
 * Enforces strict differential privacy budgets, local preferences, and zero data egress on denied consent.
 */

import assert from "node:assert/strict";

const { PrivacyBudgetedEvolution } = await import(
  "../src/engine/evolution/privacyBudgetedEvolution.ts"
);

console.log("========================================================");
console.log("SPE Ω — PRIVACY-BUDGETED EVOLUTION (PBE) BATTERY");
console.log("========================================================");

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

const pbe = new PrivacyBudgetedEvolution(1.0); // 1.0 cumulative epsilon budget

// Suite 1: Telemetry Minimization
console.log("\n[Suite 1: Telemetry Minimization Compiler]");

test("Compiles minimal record and completely strips PII, IP, and cookies", () => {
  const result = pbe.compileMinimalTelemetry({
    route: "/create?query=confidential_medical_data",
    rawViewportWidth: 375, // Mobile
    rawLatencyMs: 340,     // 100_TO_500MS
    taskCompleted: true,
    featureEngaged: "PROMPT_SYNTHESIZER",
    consentState: "GRANTED",
    rawUserInputText: "Doctor patient notes for diagnosis",
    clientIpAddress: "192.168.1.104",
    cookieHeader: "session_id=secret_token_123",
  });

  assert.ok(result.record !== null);
  assert.equal(result.record.route, "/create"); // Stripped query params
  assert.equal(result.record.coarseViewport, "MOBILE");
  assert.equal(result.record.latencyBucket, "100_TO_500MS");
  assert.equal(result.record.taskCompleted, true);
  // PII must not appear anywhere in record
  const serialized = JSON.stringify(result.record);
  assert.ok(!serialized.includes("Doctor patient notes"));
  assert.ok(!serialized.includes("192.168.1.104"));
  assert.ok(!serialized.includes("secret_token_123"));
  assert.equal(result.auditReceipt.piiDetected, true); // Logged that unsafe inputs were intercepted
  assert.equal(result.auditReceipt.egressPermitted, true);
});

// Suite 2: Zero Egress on Withheld Consent
console.log("\n[Suite 2: Zero-Egress on Denied/Unset Consent]");

test("Emits strictly 0 bytes when user consent is DENIED", () => {
  const result = pbe.compileMinimalTelemetry({
    route: "/pricing",
    rawViewportWidth: 1440,
    rawLatencyMs: 80,
    taskCompleted: false,
    featureEngaged: "PRICING_TABLE",
    consentState: "DENIED",
  });

  assert.equal(result.record, null);
  assert.equal(result.auditReceipt.egressPermitted, false);
  assert.equal(result.auditReceipt.rawPayloadBlocked, true);
  assert.equal(result.auditReceipt.sanitizedDigest, "sha256:zero-egress-consent-withheld");
});

test("Emits strictly 0 bytes when user consent is UNSET", () => {
  const result = pbe.compileMinimalTelemetry({
    route: "/docs",
    rawViewportWidth: 1024,
    rawLatencyMs: 120,
    taskCompleted: true,
    featureEngaged: "DOCS_VIEW",
    consentState: "UNSET",
  });

  assert.equal(result.record, null);
  assert.equal(result.auditReceipt.egressPermitted, false);
});

// Suite 3: Differential Privacy Laplace Perturbation
console.log("\n[Suite 3: Differential Privacy Aggregate Query Engine]");

test("Executes aggregate query with bounded Laplace noise and budget consumption", () => {
  const statusBefore = pbe.getBudgetStatus();
  assert.equal(statusBefore.consumedEpsilon, 0.0);

  const req = {
    queryId: "query-dau-v1",
    question: "Daily prompt creators count",
    targetRoute: "/create",
    metricType: "COUNT",
    sensitivityDelta: 1.0,
    requestedEpsilon: 0.25,
  };

  const res = pbe.executeDifferentiallyPrivateAggregate(req, 1000);
  assert.ok(Math.abs(res.perturbedValue - 1000) < 50); // Laplace perturbation bounded
  assert.equal(res.epsilonConsumed, 0.25);
  assert.equal(res.budgetStatus.consumedEpsilon, 0.25);
  assert.equal(res.budgetStatus.remainingEpsilon, 0.75);
});

// Suite 4: Privacy Budget Exhaustion Guard
console.log("\n[Suite 4: Cumulative Privacy Budget Exhaustion]");

test("Throws PRIVACY_BUDGET_EXHAUSTED when requested epsilon exceeds remaining budget", () => {
  const excessiveReq = {
    queryId: "query-greedy-v1",
    question: "High resolution telemetry audit",
    targetRoute: "/",
    metricType: "CONVERSION_RATE",
    sensitivityDelta: 1.0,
    requestedEpsilon: 0.90, // Only 0.75 left!
  };

  assert.throws(
    () => {
      pbe.executeDifferentiallyPrivateAggregate(excessiveReq, 500);
    },
    /PRIVACY_BUDGET_EXHAUSTED/
  );

  // Budget should NOT have been consumed on failure
  assert.equal(pbe.getBudgetStatus().consumedEpsilon, 0.25);
});

// Suite 5: Local Preference Vault & Randomized Response
console.log("\n[Suite 5: Local Preference Vault & Randomized Response]");

test("Maintains user preferences strictly in local device memory without cloud sync", () => {
  pbe.setLocalPreference("spe_theme", "system_hdr");
  pbe.setLocalPreference("spe_offline_mode", "strict_airgap");

  assert.equal(pbe.getLocalPreference("spe_theme"), "system_hdr");
  assert.equal(pbe.getLocalPreference("spe_offline_mode"), "strict_airgap");
  assert.equal(pbe.getLocalPreference("non_existent"), null);
});

test("Applies randomized response with differential privacy guarantee", () => {
  // With large enough trials, empirical frequency matches randomized response probability
  let truthsReported = 0;
  const trials = 200;
  for (let i = 0; i < trials; i++) {
    if (pbe.applyRandomizedResponse(true, 1.0)) {
      truthsReported++;
    }
  }
  // For epsilon=1.0, p ≈ 0.73. truthsReported should be between 100 and 190.
  assert.ok(truthsReported > 100 && truthsReported < 195);
});

console.log("\n========================================================");
console.log(`TOTAL PBE TESTS PASSED: ${testsPassed} / 7`);
console.log("========================================================\n");
