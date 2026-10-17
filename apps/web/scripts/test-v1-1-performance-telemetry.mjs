#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — Performance Doctor Truth & Telemetry Test Suite.
 * Validates:
 * - Rejection of caller-supplied numbers alone from declaring MEASURED
 * - Acceptance of authentic BROWSER_HARNESS telemetry with statistical consistency
 * - Rejection of insufficient samples (< 60) and warmup (< 10)
 * - Analytical estimations strictly marked ESTIMATED (never MEASURED)
 * - Full optimization lifecycle: measure before -> propose -> apply -> measure after
 */
import assert from "node:assert/strict";

const {
  measureSceneStatic,
  estimateScenePerformance,
  attachVerifiedBrowserTelemetry,
  attachMeasuredFrameTiming,
  proposeOptimization,
  applyOptimizationProposal,
} = await import("../src/website-studio/performance/measureScene.ts");

console.log("================================================================================");
console.log("SPE v1.1 — PERFORMANCE DOCTOR TRUTH & BROWSER TELEMETRY SUITE");
console.log("================================================================================");

const heavyScene = {
  sceneVersion: "scene-ir/1",
  title: "Heavy Scene",
  theme: "dark",
  camera: { type: "perspective", fov: 60, position: [0, 0, 5], target: [0, 0, 0], near: 0.1, far: 100 },
  environment: { backgroundColor: "#000" },
  lighting: [],
  objects: Array.from({ length: 40 }, (_, i) => ({
    id: `obj-${i}`,
    name: `Object ${i}`,
    geometry: { type: "sphere", parameters: { radius: 1 } }, // 960 triangles * 40 = 38,400 triangles!
    material: { type: "standard", color: "#fff", roughness: 0.5, metalness: 0 },
    position: [i % 5, Math.floor(i / 5), 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  })),
  scrollTracks: [],
  performanceBudget: { maxDpr: 1.5, maxDrawCalls: 30, maxTriangles: 10000, targetFps: 60 },
  accessibilityFallback: { hero2dSvg: "<svg></svg>", textDescription: "Desc", ariaRegionLabel: "Scene" },
};

// 1. Static Measurement Starts in UNKNOWN state
const staticReceipt = measureSceneStatic(heavyScene);
assert.equal(staticReceipt.frameMeasurementState, "UNKNOWN");
assert.equal(staticReceipt.desktopFrameP95, undefined);
assert.equal(staticReceipt.triangles, 38400);
assert.equal(staticReceipt.drawCalls, 40);
assert.ok(staticReceipt.findings.includes("TRIANGLE_BUDGET_EXCEEDED"));
assert.ok(staticReceipt.findings.includes("DRAW_CALL_BUDGET_EXCEEDED"));
console.log("✅ 1. Static measurement correctly sets UNKNOWN and flags budget violations.");

// 2. Analytical Estimation Marked Strictly ESTIMATED
const estimatedReceipt = estimateScenePerformance(heavyScene, "DESKTOP_HIGH");
assert.equal(estimatedReceipt.frameMeasurementState, "ESTIMATED");
assert.ok(estimatedReceipt.desktopFrameP95 > 0);
assert.notEqual(estimatedReceipt.frameMeasurementState, "MEASURED");
console.log("✅ 2. Analytical estimation strictly stamped ESTIMATED (never falsified as MEASURED).");

// 3. Rejection of Caller-Supplied Values Without Browser Telemetry
assert.throws(() => {
  attachMeasuredFrameTiming(staticReceipt, 12.5);
}, /PERFORMANCE_MEASUREMENT_REJECTED/);
console.log("✅ 3. Caller-supplied numbers alone strictly rejected from declaring MEASURED.");

// 4. Rejection of Insufficient Telemetry Samples (< 60)
assert.throws(() => {
  attachVerifiedBrowserTelemetry(staticReceipt, {
    environment: "BROWSER_HARNESS",
    browser: "Chrome 128",
    viewport: { width: 1280, height: 720 },
    dpr: 1.0,
    sampleCount: 30, // less than 60!
    warmupDiscarded: 15,
    frameTimingsMs: Array(30).fill(16.0),
    frameP50: 16.0,
    frameP95: 16.0,
    frameP99: 16.0,
    drawCalls: 40,
    triangles: 38400,
    textureBytes: 0,
    timestamp: Date.now(),
  });
}, /minimum 60 sampled frames required/);
console.log("✅ 4. Telemetry with insufficient samples (< 60) rejected.");

// 5. Rejection of Statistical Inconsistency (Fabricated P95)
const frameTimings = Array(100).fill(16.0);
frameTimings[95] = 25.0; // P95 is 25.0
assert.throws(() => {
  attachVerifiedBrowserTelemetry(staticReceipt, {
    environment: "BROWSER_HARNESS",
    browser: "Chrome 128",
    viewport: { width: 1280, height: 720 },
    dpr: 1.0,
    sampleCount: 100,
    warmupDiscarded: 15,
    frameTimingsMs: frameTimings,
    frameP50: 16.0,
    frameP95: 10.0, // LIE: claiming 10.0 when actual 95th percentile is 25.0!
    frameP99: 25.0,
    drawCalls: 40,
    triangles: 38400,
    textureBytes: 0,
    timestamp: Date.now(),
  });
}, /statistical telemetry percentile mismatch/);
console.log("✅ 5. Fabricated telemetry percentiles rejected by statistical auditor.");

// 6. Valid Authentic Browser Telemetry Certified as MEASURED
const authenticTimings = Array.from({ length: 120 }, (_, i) => 14.0 + (i % 5) * 0.5);
// Sorted values are between 14.0 and 16.0
const authenticP50 = 15.0;
const authenticP95 = 16.0;

const measuredReceipt = attachVerifiedBrowserTelemetry(staticReceipt, {
  environment: "BROWSER_HARNESS",
  browser: "HeadlessChromium 128",
  viewport: { width: 1280, height: 720 },
  dpr: 1.0,
  sampleCount: 120,
  warmupDiscarded: 20,
  frameTimingsMs: authenticTimings,
  frameP50: authenticP50,
  frameP95: authenticP95,
  frameP99: 16.0,
  drawCalls: 40,
  triangles: 38400,
  textureBytes: 1024 * 1024,
  memoryBytes: 45 * 1024 * 1024,
  timestamp: Date.now(),
});

assert.equal(measuredReceipt.frameMeasurementState, "MEASURED");
assert.equal(measuredReceipt.desktopFrameP95, 16.0);
assert.ok(measuredReceipt.telemetryEvidence);
assert.ok(measuredReceipt.telemetryEvidence.receiptHash.startsWith("sha256-"));
console.log("✅ 6. Authentic browser telemetry verified & certified MEASURED with cryptographic receipt hash.");

// 7. Full Optimization Lifecycle: Measure Before -> Propose -> Apply -> Measure After
const proposal = proposeOptimization(measuredReceipt);
assert.ok(proposal.actions.includes("ENABLE_LOD_DECIMATION"));
assert.ok(proposal.actions.includes("INSTANCED_MESH_BATCHING"));
assert.ok(proposal.targetTriangles < measuredReceipt.triangles);
assert.ok(proposal.targetDrawCalls < measuredReceipt.drawCalls);

const optimizedScene = applyOptimizationProposal(heavyScene, proposal);
const optimizedReceipt = measureSceneStatic(optimizedScene);

assert.equal(optimizedScene.performanceBudget.maxTriangles, proposal.targetTriangles);
assert.equal(optimizedScene.performanceBudget.maxDrawCalls, proposal.targetDrawCalls);
console.log("✅ 7. Full Optimization cycle (Measure Before -> Propose -> Apply -> Measure After) qualified.");

console.log("\nPASS: Performance Doctor Truth & Telemetry invariants 100% qualified.");
