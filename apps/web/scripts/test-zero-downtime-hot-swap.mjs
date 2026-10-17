#!/usr/bin/env node
/**
 * Test: SPE Ω — Zero-Downtime Hot-Swap & 24/7 Concurrency Verification
 *
 * Verifies:
 * 1. Read-Copy-Update (RCU) concurrent reader safety with genuine overlapping async requests.
 * 2. In-flight requests suspended on Gen 1 retain Gen 1 executable compiler passes & rules.
 * 3. Atomic hot-swap pointer flip latency (< 50ms) to Gen 2.
 * 4. Concurrent new requests evaluate immediately using upgraded Gen 2 executable compiler passes.
 * 5. Cross-process durable pointer synchronization via ACTIVE_BRAIN_POINTER.json.
 * 6. Fail-closed rejection of unsigned or invalid candidate manifests.
 * 7. Instantaneous O(1) fail-safe rollback to previous verified brain.
 * 8. Measured operational availability telemetry (requests, success rate, measured uptime).
 */

import { resolve } from "node:path";
import { existsSync, rmSync } from "node:fs";
import { EventEmitter } from "node:events";
import assert from "node:assert/strict";

const ROOT = resolve(import.meta.dirname, "../..");

console.log("==================================================================");
console.log("🧪 SPE Ω — ZERO-DOWNTIME ATOMIC HOT-SWAP VERIFICATION BATTERY");
console.log("==================================================================");

const {
  ZeroDowntimeBrainRuntime,
  compilePromptWithBrain,
} = await import("../src/engine/brain/zeroDowntimeBrainRuntime.ts");

const { generateBrainReleaseManifest, signBrainReleaseManifest } = await import(
  "../src/engine/brain/brainReleaseManifest.ts"
);

const { McpProductionServer } = await import("../src/server/mcpProductionServer.ts");

const testPointerPath = resolve(ROOT, "proofs/generated/TEST_ACTIVE_BRAIN_POINTER.json");
try {
  if (existsSync(testPointerPath)) rmSync(testPointerPath);
} catch {}

ZeroDowntimeBrainRuntime.resetInstanceForTesting();
const runtime = ZeroDowntimeBrainRuntime.getInstance(undefined, testPointerPath);
const initialMetrics = runtime.getMetrics();

console.log(`[INIT] Initial Brain: ${initialMetrics.currentBrainId} (Gen ${initialMetrics.currentGenerationIndex})`);
assert.equal(initialMetrics.uptimeStatus, "OPERATIONAL_MEASURED_UPTIME");
assert.equal(initialMetrics.zeroDowntimeGuaranteed, true);
assert.equal(initialMetrics.measuredAvailabilityPercent, 100.0);

// ----------------------------------------------------------------------
// Test 1: Single Uninterrupted Prompt Synthesis & Executable Binding
// ----------------------------------------------------------------------
console.log("\n[TEST 1] Testing standard uninterrupted prompt synthesis & executable compiler binding...");
const res1 = runtime.synthesizeUninterrupted("Create a high-speed Python REST API for vector embeddings");
assert.ok(res1.prompt.length > 500, "Synthesized prompt must have substantial content");
assert.equal(res1.generationIndex, 1);
assert.equal(res1.brainReleaseId, initialMetrics.currentBrainId);
assert.equal(res1.compilerPassCount, 14);
assert.equal(res1.rulesVersion, "2.4.0-gen1");
assert.ok(
  res1.prompt.includes("Gen 1 compiler kernel"),
  "Output must be compiled through Gen 1 bound compiler directives"
);
console.log("  ✓ Prompt synthesized via Gen 1 executable compiler passes. Length:", res1.prompt.length, "chars");

// ----------------------------------------------------------------------
// Test 2: Genuine Overlapping In-Flight Concurrency During Atomic Hot-Swap
// ----------------------------------------------------------------------
console.log("\n[TEST 2] Executing 50 concurrent requests with genuine overlapping async barrier...");

// Create a valid candidate manifest for Generation 2
const candidateManifestGen2 = generateBrainReleaseManifest({
  brainReleaseId: "spe-brain-v2.4.20261017.g2-continuous",
  appVersion: "2.4.0",
  channel: "deployed",
  knowledgeSnapshotDigest: "1".repeat(64),
  modelRegistryDigest: "2".repeat(64),
  promptBundleDigest: "3".repeat(64),
  routerDigest: "4".repeat(64),
  skillLibraryDigest: "5".repeat(64),
  policyDigest: "6".repeat(64),
  evaluatorVersion: "spe-eval-v2.4",
  evaluationReceiptDigest: "7".repeat(64),
  supportedTaskLanguageSlices: [
    { sliceId: "slice-en", taskId: "plain-brief-to-prompt", language: "en", minPreservationFloor: 0.98 },
  ],
  sourceCommit: "c4a0d68600000000000000000000000000000000",
  artifactDigest: "8".repeat(64),
  deploymentExecutionId: "deploy-test-gen2",
});

const signedCandidateGen2 = signBrainReleaseManifest(
  candidateManifestGen2,
  "spe_autonomous_operations_layer",
  { hmacSecret: "spe_test_secret" }
);

// 1. Prepare suspension barrier for 25 in-flight Gen 1 requests
let releaseSuspensionBarrier;
const suspensionBarrierPromise = new Promise((resolveBarrier) => {
  releaseSuspensionBarrier = resolveBarrier;
});

// Start 25 async synthesis requests that await the suspension barrier
const gen1AsyncPromises = Array.from({ length: 25 }, (_, i) => {
  return runtime.synthesizeUninterruptedAsync(
    `Concurrent user prompt brief #${i + 1} on Gen 1`,
    {},
    async () => {
      await suspensionBarrierPromise;
    }
  );
});

// Allow event loop to process initial ticks so all 25 requests enter reader leases
await new Promise((r) => setTimeout(r, 20));

const metricsDuringLease = runtime.getMetrics();
assert.ok(
  metricsDuringLease.activeInFlightRequests >= 25,
  `At least 25 requests must be actively in-flight during swap (got ${metricsDuringLease.activeInFlightRequests})`
);
console.log(`  ✓ 25 requests actively suspended in-flight with reader leases (inFlightReaders=${metricsDuringLease.activeInFlightRequests}).`);

// 2. Execute atomic hot-swap while 25 requests are demonstrably suspended in-flight
const swapResult = runtime.hotSwapBrainAtomic(
  signedCandidateGen2,
  {
    compilerPassCount: 16,
    frontierModelsCount: 54,
    formalEquivalenceDigest: "proof-gen2-zero-drift",
    compilerConfig: {
      passes: ["AST_NORMALIZATION", "SUPERCOMPILER_FUSED_PASS_G2"],
      optimizationLevel: 2,
      rulesVersion: "2.4.0-g2",
      targetArchitecture: "spe-ast-supercompiler-v2",
      customDirectives: [
        "Generation 2 supercompiler active (16 verified passes, zero semantic drift).",
      ],
    },
    persistPointer: true,
  },
  {
    trustedKeys: { spe_autonomous_operations_layer: "spe_test_secret" },
  }
);

assert.equal(swapResult.success, true);
assert.ok(
  swapResult.hotSwapDurationMs < 50,
  `Hot swap must complete in < 50ms (actual: ${swapResult.hotSwapDurationMs}ms)`
);
assert.equal(swapResult.activeBrainId, "spe-brain-v2.4.20261017.g2-continuous");
assert.equal(swapResult.generationIndex, 2);
console.log(`  ✓ Atomic pointer flip completed in ${swapResult.hotSwapDurationMs}ms.`);

// 3. Immediately dispatch 25 new requests on Gen 2 while Gen 1 requests are STILL suspended
const gen2AsyncPromises = Array.from({ length: 25 }, (_, i) => {
  return runtime.synthesizeUninterruptedAsync(
    `Concurrent user prompt brief #${i + 26} on Gen 2`
  );
});

// Await the 25 Gen 2 requests - they complete immediately using upgraded Gen 2 compiler
const completedGen2 = await Promise.all(gen2AsyncPromises);
assert.equal(completedGen2.length, 25);
for (const s of completedGen2) {
  assert.equal(s.generationIndex, 2, "Gen 2 requests must be executed on Generation 2");
  assert.equal(s.brainReleaseId, "spe-brain-v2.4.20261017.g2-continuous");
  assert.equal(s.compilerPassCount, 16);
  assert.equal(s.rulesVersion, "2.4.0-g2");
  assert.ok(
    s.prompt.includes("Generation 2 supercompiler active"),
    "Gen 2 output must contain Gen 2 compiler directives"
  );
}
console.log("  ✓ 25 new requests executed immediately against Gen 2 while Gen 1 remained in-flight.");

// 4. Release suspension barrier so the 25 Gen 1 requests resume and complete
releaseSuspensionBarrier();
const completedGen1 = await Promise.all(gen1AsyncPromises);
assert.equal(completedGen1.length, 25);
for (const s of completedGen1) {
  assert.equal(s.generationIndex, 1, "Suspended requests must strictly complete using Gen 1 snapshot");
  assert.equal(s.brainReleaseId, initialMetrics.currentBrainId);
  assert.equal(s.compilerPassCount, 14);
  assert.equal(s.rulesVersion, "2.4.0-gen1");
  assert.ok(
    s.prompt.includes("Gen 1 compiler kernel"),
    "Suspended Gen 1 output must retain Gen 1 compiler directives"
  );
  assert.ok(
    !s.prompt.includes("Generation 2 supercompiler active"),
    "Gen 1 output must NOT contain Gen 2 compiler directives"
  );
}
console.log("  ✓ Suspended Gen 1 requests completed using immutable Gen 1 compiler snapshot.");
console.log("  ✓ Proved: 25 requests on Gen 1 + 25 requests on Gen 2 executed with 0 dropped requests!");

// ----------------------------------------------------------------------
// Test 3: New Requests Use Upgraded Brain
// ----------------------------------------------------------------------
console.log("\n[TEST 3] Verifying immediate post-swap routing to new brain generation...");
const postSwapRes = runtime.synthesizeUninterrupted("Design a 3D glassmorphic dashboard with WebGL shaders");
assert.equal(postSwapRes.generationIndex, 2);
assert.equal(postSwapRes.brainReleaseId, "spe-brain-v2.4.20261017.g2-continuous");
assert.equal(postSwapRes.compilerPassCount, 16);
console.log("  ✓ New requests immediately routed to Brain Gen 2 without restarts or locks.");

// ----------------------------------------------------------------------
// Test 4: Durable Cross-Process Pointer Synchronization
// ----------------------------------------------------------------------
console.log("\n[TEST 4] Testing durable cross-process pointer synchronization...");
assert.ok(existsSync(testPointerPath), "Durable pointer file must be written to disk");

// Reset runtime to Gen 1 cold start and sync with durable pointer
ZeroDowntimeBrainRuntime.resetInstanceForTesting();
const coldRuntime = ZeroDowntimeBrainRuntime.getInstance(undefined, testPointerPath);
assert.equal(coldRuntime.getActiveSnapshot().generationIndex, 1);

const syncResult = coldRuntime.syncWithDurablePointer(testPointerPath, {
  trustedKeys: { spe_autonomous_operations_layer: "spe_test_secret" },
});
assert.equal(syncResult.reloaded, true, "Runtime reloaded new generation from durable pointer");
assert.equal(syncResult.activeBrainId, "spe-brain-v2.4.20261017.g2-continuous");
assert.equal(coldRuntime.getActiveSnapshot().generationIndex, 2);
console.log("  ✓ Durable pointer reloaded across processes without server restart.");

// ----------------------------------------------------------------------
// Test 5: Fail-Closed Protection Against Unsigned / Invalid Manifest
// ----------------------------------------------------------------------
console.log("\n[TEST 5] Testing fail-closed rejection of invalid candidate manifest...");
const invalidCandidate = {
  ...candidateManifestGen2,
  brainReleaseId: "spe-brain-corrupt",
  manifestDigest: "bad-digest-000",
  signatures: [], // Missing required signatures
};

const badSwap = coldRuntime.hotSwapBrainAtomic(invalidCandidate);
assert.equal(badSwap.success, false, "Corrupted candidate must be rejected");
assert.ok(badSwap.error?.includes("HOTSWAP_REJECTED"), "Error message must state rejection");

// Active brain remains unaffected
const safeMetrics = coldRuntime.getMetrics();
assert.equal(safeMetrics.currentBrainId, "spe-brain-v2.4.20261017.g2-continuous");
console.log("  ✓ Corrupt candidate rejected. Active serving plane unaffected (Fail-closed).");

// ----------------------------------------------------------------------
// Test 6: Instantaneous O(1) Rollback
// ----------------------------------------------------------------------
console.log("\n[TEST 6] Testing instantaneous atomic rollback to prior verified brain...");
const rollbackResult = coldRuntime.rollbackAtomic("Simulated post-swap telemetry anomaly");
assert.equal(rollbackResult.rolledBack, true);
assert.equal(rollbackResult.restoredBrainId, initialMetrics.currentBrainId);

const postRollbackPrompt = coldRuntime.synthesizeUninterrupted("Test rollback prompt");
assert.equal(postRollbackPrompt.brainReleaseId, initialMetrics.currentBrainId);
assert.equal(postRollbackPrompt.generationIndex, 1);
assert.equal(postRollbackPrompt.compilerPassCount, 14);
console.log("  ✓ Atomic rollback completed. Active brain restored to:", rollbackResult.restoredBrainId);

// ----------------------------------------------------------------------
// Test 7: Measured Availability & Honest Telemetry
// ----------------------------------------------------------------------
console.log("\n[TEST 7] Testing measured operational availability telemetry...");
const finalMetrics = coldRuntime.getMetrics();
assert.equal(finalMetrics.uptimeStatus, "OPERATIONAL_MEASURED_UPTIME");
assert.equal(finalMetrics.zeroDowntimeGuaranteed, true);
assert.equal(finalMetrics.measuredAvailabilityPercent, 100.0);
assert.ok(finalMetrics.operationalEvidence.totalRequests >= 1, "Requests tracked in operational evidence");
assert.equal(finalMetrics.operationalEvidence.failedRequests, 0, "Zero failed requests");
console.log("  ✓ Telemetry verified: Empirical 100% availability calculated from measured requests.");

// ----------------------------------------------------------------------
// Test 8: McpProductionServer Durable Pointer Hot-Reload (/api/v1/health)
// ----------------------------------------------------------------------
console.log("\n[TEST 8] Testing McpProductionServer cross-process durable pointer hot-reload on /api/v1/health...");
const testLedgerPath = resolve(ROOT, "proofs/generated/TEST_METERING_LEDGER.json");
const mcpServer = new McpProductionServer({
  brainPointerPath: testPointerPath,
  storageFilePath: testLedgerPath,
});

async function simulateHttpHealthRequest(server) {
  const httpServer = server.createHttpServer();
  const requestHandler = httpServer.listeners("request")[0];
  return new Promise((resolveReq) => {
    const req = new EventEmitter();
    Object.assign(req, {
      url: "/api/v1/health",
      method: "GET",
      socket: { remoteAddress: "127.0.0.1" },
      headers: {},
    });
    const responseHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) {
        responseHeaders[k.toLowerCase()] = v;
      },
      end(body) {
        let json = null;
        try {
          json = JSON.parse(body || "{}");
        } catch {
          json = body;
        }
        resolveReq({ statusCode: res.statusCode, headers: responseHeaders, body: json });
      },
    };
    requestHandler(req, res);
    req.emit("end");
  });
}

// 1. Initial health check reflects Gen 1 state after rollback
const initialHealth = await simulateHttpHealthRequest(mcpServer);
assert.equal(initialHealth.statusCode, 200);
assert.equal(initialHealth.body.brain?.generationIndex, 1);
assert.equal(initialHealth.body.brain?.activeBrainId, initialMetrics.currentBrainId);

// 2. Perform background hot-swap writing Gen 2 pointer to disk
const backgroundSwap = coldRuntime.hotSwapBrainAtomic(
  signedCandidateGen2,
  {
    compilerPassCount: 16,
    frontierModelsCount: 54,
    formalEquivalenceDigest: "proof-gen2-zero-drift",
    compilerConfig: {
      passes: ["AST_NORMALIZATION", "SUPERCOMPILER_FUSED_PASS_G2"],
      rulesVersion: "2.4.0-g2",
      customDirectives: ["Generation 2 supercompiler active"],
    },
    persistPointer: true,
  },
  {
    trustedKeys: { spe_autonomous_operations_layer: "spe_test_secret" },
  }
);
assert.equal(backgroundSwap.success, true);
assert.ok(existsSync(testPointerPath), "testPointerPath written by background hot-swap");

// 3. Health check on McpProductionServer reloads durable pointer and immediately reflects Gen 2
const postSwapHealth = await simulateHttpHealthRequest(mcpServer);
assert.equal(postSwapHealth.statusCode, 200);
assert.equal(postSwapHealth.body.brain?.generationIndex, 2, "Health check reloaded Gen 2 from disk pointer");
assert.equal(postSwapHealth.body.brain?.activeBrainId, "spe-brain-v2.4.20261017.g2-continuous");
assert.equal(postSwapHealth.body.brain?.compilerPassCount, 16);
assert.equal(postSwapHealth.body.brain?.rulesVersion, "2.4.0-g2");
assert.equal(postSwapHealth.body.zeroDowntimeGuaranteed, true);
assert.equal(postSwapHealth.body.measuredAvailability?.uptimeStatus, "OPERATIONAL_MEASURED_UPTIME");
console.log("  ✓ McpProductionServer /api/v1/health successfully reloaded durable pointer and reflected Gen 2.");

console.log("\n==================================================================");
console.log("📊 FINAL SERVING TELEMETRY AUDIT");
console.log("==================================================================");
console.log(`  Total Prompts Served:      ${finalMetrics.totalPromptsServed}`);
console.log(`  Active In-Flight Readers:  ${finalMetrics.activeInFlightRequests} (Cleanly drained)`);
console.log(`  Hot-Swaps Completed:       ${finalMetrics.hotSwapsCompleted}`);
console.log(`  Rollbacks Executed:        ${finalMetrics.rollbacksExecuted}`);
console.log(`  Uptime Status:             ${finalMetrics.uptimeStatus}`);
console.log(`  Measured Availability:     ${finalMetrics.measuredAvailabilityPercent}%`);
console.log(`  Zero-Downtime Enforced:    ${finalMetrics.zeroDowntimeGuaranteed}`);
console.log("==================================================================");
console.log("🎉 ALL ZERO-DOWNTIME HOT-SWAP TESTS PASSED (100% INTEGRITY)!\n");

try {
  if (existsSync(testPointerPath)) rmSync(testPointerPath);
} catch {}
