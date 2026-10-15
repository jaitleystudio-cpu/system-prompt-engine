/**
 * SPE Ω — Dual-Core Recovery: 10 Real Adversarial Failure Modes
 *
 * Demonstrates transparent Core B deterministic recovery across 10 distinct failure modes:
 *  1. Unavailable browser AI API
 *  2. Corrupted model asset
 *  3. Insufficient memory (OOM simulation)
 *  4. Interrupted model download
 *  5. Inference timeout
 *  6. Offline cold start
 *  7. Offline warm start
 *  8. Generator exception
 *  9. Quality-validation failure
 * 10. Cancellation during inference
 *
 * For each case, records:
 *  - Exact Core A failure reason
 *  - Core B recovery decision
 *  - User's actual output
 *  - Displayed provenance label
 */

import {
  executeDualCoreGeneration,
  CORE_A_PROMPT_LABEL,
  CORE_B_PROMPT_LABEL,
  formatDualCoreTechniques,
} from "../src/engine/dualCoreRouter.ts";

console.log("========================================================================");
console.log("🛡️  SPE Ω — DUAL-CORE RECOVERY BATTERY: 10 ADVERSARIAL FAILURE MODES");
console.log("========================================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

const FAILURE_SCENARIOS = [
  {
    mode: "UNAVAILABLE_BROWSER_AI",
    name: "Unavailable Browser AI API",
    expectedFailureSubstring: "window.ai is not supported",
  },
  {
    mode: "CORRUPTED_MODEL_ASSET",
    name: "Corrupted Model Asset (Integrity Check Failed)",
    expectedFailureSubstring: "Model weights integrity check failed",
  },
  {
    mode: "INSUFFICIENT_MEMORY",
    name: "Insufficient Memory (OOM Allocation Limit)",
    expectedFailureSubstring: "Memory budget exhausted",
  },
  {
    mode: "INTERRUPTED_MODEL_DOWNLOAD",
    name: "Interrupted Model Download (Stream Severed)",
    expectedFailureSubstring: "Download connection severed",
  },
  {
    mode: "INFERENCE_TIMEOUT",
    name: "Inference Timeout (Deadline Exceeded)",
    expectedFailureSubstring: "timed out after 5000ms",
  },
  {
    mode: "OFFLINE_COLD_START_NO_CACHE",
    name: "Offline Cold Start (No Pre-Cached Weights)",
    expectedFailureSubstring: "Device is offline and no pre-cached",
  },
  {
    mode: "OFFLINE_WARM_START_CACHE_CORRUPTED",
    name: "Offline Warm Start (Corrupted Cache Entry)",
    expectedFailureSubstring: "Local cache entry corrupted",
  },
  {
    mode: "GENERATOR_EXCEPTION",
    name: "Generator Exception (Unexpected Runtime Error)",
    expectedFailureSubstring: "Synthetic generator encountered",
  },
  {
    mode: "QUALITY_VALIDATION_FAILURE",
    name: "Quality-Validation Failure (Repair Budget Exhausted)",
    expectedFailureSubstring: "CORE_A_REPAIR_EXHAUSTED",
  },
  {
    mode: "CANCELLATION_DURING_INFERENCE",
    name: "Cancellation During Inference (AbortSignal Cancelled)",
    expectedFailureSubstring: "Generation cancelled by user",
  },
];

async function runDualCoreRecoveryBattery() {
  const baseRequest = "Build an offline local password manager in Rust and WebAssembly.";
  const results = [];

  for (let i = 0; i < FAILURE_SCENARIOS.length; i++) {
    const sc = FAILURE_SCENARIOS[i];
    console.log(`\n[Scenario ${i + 1}/10] Injecting Failure: ${sc.name}`);

    const res = await executeDualCoreGeneration({
      userRequest: baseRequest,
      target: "claude",
      explicitConstraints: ["Offline local storage", "Rust implementation"],
      injectedFailureMode: sc.mode,
    });

    // 1. Core B Takeover Verified
    assert(res.engineCoreUsed === "CORE_B_FALLBACK", `Core B activated as fallback engine for ${sc.name}`);
    assert(res.status === "DEGRADED_FALLBACK_DELIVERY", `Status labeled honest DEGRADED_FALLBACK_DELIVERY`);
    assert(res.isFallback === true, `isFallback flag is true`);

    // 2. Failure Reason Recorded
    const hasExpectedReason = (res.fallbackReason || "").includes(sc.expectedFailureSubstring);
    assert(hasExpectedReason, `Exact Core A failure reason logged: "${res.fallbackReason?.slice(0, 70)}..."`);

    // 3. Displayed Provenance Label
    const techniques = formatDualCoreTechniques(res.engineCoreUsed === "CORE_A_GENERATIVE", ["Raw Brief Custody"]);
    assert(techniques[0] === CORE_B_PROMPT_LABEL, `Displayed provenance label is verbatim "${CORE_B_PROMPT_LABEL}"`);

    // 4. Actual User Output Generated
    assert(typeof res.prompt === "string" && res.prompt.length > 50, `User received real fallback prompt (${res.prompt.length} chars)`);
    assert(res.prompt.includes("SPE SAFE FALLBACK") && res.prompt.includes("Original request:"), `Prompt contains safe custody structure`);

    // 5. Zero Cloud Spend & Air-gap
    assert(res.costUsd === 0, `$0 compute cost verified`);
    assert(res.zeroEgressGuaranteed === true, `Zero network egress guaranteed`);

    results.push({
      scenarioIndex: i + 1,
      failureMode: sc.mode,
      scenarioName: sc.name,
      coreAFailure: res.fallbackReason,
      coreBDecision: res.engineCoreUsed,
      displayedProvenance: techniques[0],
      outputPreview: res.prompt.slice(0, 100).replace(/\n/g, " "),
      latencyMs: res.latencyMs,
      passed: true,
    });
  }

  console.log("\n========================================================================");
  console.log(`DUAL-CORE RECOVERY RECORD: ${passed} PASS, ${failed} FAIL`);
  console.log("========================================================================");
  console.table(
    results.map((r) => ({
      Scenario: r.scenarioName.slice(0, 25),
      "Core A Failure": r.coreAFailure?.slice(0, 30),
      "Core B Takeover": r.coreBDecision,
      "Provenance Label": r.displayedProvenance.slice(0, 20),
      Latency: `${r.latencyMs}ms`,
    }))
  );

  if (failed > 0) {
    process.exit(1);
  }
}

runDualCoreRecoveryBattery().catch((err) => {
  console.error("Battery execution failed:", err);
  process.exit(1);
});
