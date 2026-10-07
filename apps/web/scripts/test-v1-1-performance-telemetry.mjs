#!/usr/bin/env node
/**
 * SPE Free 3D — Performance Doctor truth & telemetry.
 * Rejects fake MEASURED / caller-supplied CWV. Desktop and mobile frame
 * receipts are independent: mobile is never derived from desktop.
 * COST ₹0. not_a_release=true.
 *
 * SPE_PERF_MODULE_PATH lets the mutation gate run this exact suite against a
 * mutated temporary copy of measureScene.ts.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const modulePath = process.env.SPE_PERF_MODULE_PATH
  ? pathToFileURL(process.env.SPE_PERF_MODULE_PATH).href
  : "../src/website-studio/performance/measureScene.ts";
const {
  measureSceneStatic,
  estimateScenePerformance,
  attachVerifiedBrowserTelemetry,
  attachMeasuredFrameTiming,
  validateScenePerformanceReceipt,
  validateFieldCwv,
  fieldCwvUnknown,
  computePercentile,
  proposeOptimization,
  applyOptimizationProposal,
} = await import(modulePath);

console.log("SPE v1.1 — PERFORMANCE DOCTOR TRUTH & BROWSER TELEMETRY");

const heavyScene = {
  sceneVersion: "scene-ir/1",
  title: "Heavy Scene",
  theme: "dark",
  camera: {
    type: "perspective",
    fov: 60,
    position: [0, 0, 5],
    target: [0, 0, 0],
    near: 0.1,
    far: 100,
  },
  environment: { backgroundColor: "#000" },
  lighting: [],
  objects: Array.from({ length: 40 }, (_, i) => ({
    id: `obj-${i}`,
    name: `Object ${i}`,
    geometry: { type: "sphere", parameters: { radius: 1 } },
    material: { type: "standard", color: "#fff", roughness: 0.5, metalness: 0 },
    position: [i % 5, Math.floor(i / 5), 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  })),
  scrollTracks: [],
  performanceBudget: {
    maxDpr: 1.5,
    maxDrawCalls: 30,
    maxTriangles: 10000,
    targetFps: 60,
  },
  accessibilityFallback: {
    hero2dSvg: "<svg></svg>",
    textDescription: "Desc",
    ariaRegionLabel: "Scene",
  },
};

const staticReceipt = measureSceneStatic(heavyScene);
assert.equal(staticReceipt.frameMeasurementState, "UNKNOWN");
assert.equal(staticReceipt.desktopFrameP95, undefined);
assert.equal(staticReceipt.mobileFrameP95, undefined);
assert.equal(staticReceipt.frameEnvironments.desktop.state, "UNKNOWN");
assert.equal(staticReceipt.frameEnvironments.mobile.state, "UNKNOWN");
assert.equal(staticReceipt.triangles, 38400);
assert.equal(staticReceipt.drawCalls, 40);
assert.ok(staticReceipt.findings.includes("TRIANGLE_BUDGET_EXCEEDED"));
assert.ok(staticReceipt.findings.includes("DRAW_CALL_BUDGET_EXCEEDED"));
assert.equal(validateScenePerformanceReceipt(staticReceipt).valid, true);
console.log("1. Static UNKNOWN + budget findings");

const estimatedReceipt = estimateScenePerformance(heavyScene, "DESKTOP_HIGH");
assert.equal(estimatedReceipt.frameMeasurementState, "ESTIMATED");
assert.ok(estimatedReceipt.desktopFrameP95 > 0);
assert.notEqual(estimatedReceipt.frameMeasurementState, "MEASURED");
assert.equal(estimatedReceipt.frameEnvironments.mobile.state, "ESTIMATED");
assert.equal(estimatedReceipt.frameEnvironments.mobile.source, "ANALYTICAL_ESTIMATE");
assert.notEqual(estimatedReceipt.frameEnvironments.mobile.state, "MEASURED");
console.log("2. Estimate stamped ESTIMATED (never MEASURED), per environment");

assert.throws(() => {
  attachMeasuredFrameTiming(staticReceipt, 12.5);
}, /PERFORMANCE_MEASUREMENT_REJECTED/);
assert.throws(() => {
  attachMeasuredFrameTiming(staticReceipt, 12.5, 16.25);
}, /PERFORMANCE_MEASUREMENT_REJECTED/);
console.log("3. Caller numbers alone rejected");

// Deterministic pseudo-random frame intervals (no Math.random: reproducible).
function series(seed, length, base, spread) {
  let x = seed;
  return Array.from({ length }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return Number((base + (x / 2147483648) * spread).toFixed(3));
  });
}

function telemetryFor(environmentClass, samples, overrides = {}) {
  const viewport =
    environmentClass === "MOBILE" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  return {
    environment: "BROWSER_HARNESS",
    environmentClass,
    browser: "HeadlessChrome/128.0",
    userAgent: `Mozilla/5.0 (${environmentClass}) HeadlessChrome/128.0`,
    viewport,
    dpr: environmentClass === "MOBILE" ? 3 : 1,
    isMobile: environmentClass === "MOBILE",
    hasTouch: environmentClass === "MOBILE",
    sampleCount: samples.length,
    warmupDiscarded: 15,
    frameTimingsMs: samples,
    frameP50: computePercentile(samples, 50),
    frameP95: computePercentile(samples, 95),
    frameP99: computePercentile(samples, 99),
    drawCalls: 40,
    triangles: 38400,
    textureBytes: 0,
    timestamp: environmentClass === "MOBILE" ? 1_800_000_000_500 : 1_800_000_000_000,
    sceneFixtureId: "fixture",
    ...overrides,
  };
}

assert.throws(() => {
  attachVerifiedBrowserTelemetry(
    staticReceipt,
    telemetryFor("DESKTOP", Array(30).fill(16.0)),
  );
}, /minimum 60 sampled frames required/);
console.log("4. <60 samples rejected");

const fabricated = Array(100).fill(16.0);
fabricated[95] = 25.0;
assert.throws(() => {
  attachVerifiedBrowserTelemetry(
    staticReceipt,
    telemetryFor("DESKTOP", fabricated, { frameP95: 10.0 }),
  );
}, /statistical telemetry percentile mismatch/);
console.log("5. Fabricated P95 rejected");

const desktopSamples = series(7, 120, 14.0, 4.0);
const mobileSamples = series(911, 120, 18.0, 9.0);
const desktopOnly = attachVerifiedBrowserTelemetry(
  staticReceipt,
  telemetryFor("DESKTOP", desktopSamples, { memoryBytes: 45 * 1024 * 1024 }),
);
assert.equal(desktopOnly.frameEnvironments.desktop.state, "MEASURED");
assert.equal(desktopOnly.desktopFrameP95, computePercentile(desktopSamples, 95));
assert.equal(desktopOnly.mobileFrameP95, undefined, "desktop telemetry must not produce a mobile value");
assert.equal(desktopOnly.frameEnvironments.mobile.state, "UNKNOWN");
assert.notEqual(desktopOnly.frameMeasurementState, "MEASURED");
assert.ok(desktopOnly.telemetryEvidence?.receiptHash.startsWith("sha256-"));
assert.equal(validateScenePerformanceReceipt(desktopOnly).valid, true);

const measuredReceipt = attachVerifiedBrowserTelemetry(
  desktopOnly,
  telemetryFor("MOBILE", mobileSamples),
);
assert.equal(measuredReceipt.frameMeasurementState, "MEASURED");
assert.equal(measuredReceipt.mobileFrameP95, computePercentile(mobileSamples, 95));
assert.deepEqual(measuredReceipt.frameEnvironments.mobile.viewport, { width: 390, height: 844 });
assert.equal(measuredReceipt.frameEnvironments.mobile.dpr, 3);
assert.equal(measuredReceipt.frameEnvironments.mobile.sampleCount, 120);
assert.equal(measuredReceipt.frameEnvironments.mobile.warmupDiscarded, 15);
assert.ok(measuredReceipt.frameEnvironments.mobile.userAgent);
assert.deepEqual(validateScenePerformanceReceipt(measuredReceipt), { valid: true, reasons: [] });
console.log("6. Independent desktop + mobile harness telemetry → MEASURED");

const proposal = proposeOptimization(measuredReceipt);
assert.ok(proposal.actions.includes("ENABLE_LOD_DECIMATION"));
assert.ok(proposal.actions.includes("INSTANCED_MESH_BATCHING"));
const optimizedScene = applyOptimizationProposal(heavyScene, proposal);
assert.equal(optimizedScene.performanceBudget.maxTriangles, proposal.targetTriangles);
assert.equal(optimizedScene.performanceBudget.maxDrawCalls, proposal.targetDrawCalls);
console.log("7. Optimization lifecycle");

// ---------------------------------------------------------------------------
// 8. Adversarial receipt mutations. Every one MUST be rejected.
// ---------------------------------------------------------------------------
const killed = [];
function mustKill(name, fn) {
  let rejected = false;
  try {
    const out = fn();
    rejected = out === "REJECTED";
  } catch (error) {
    rejected = /PERFORMANCE_MEASUREMENT_(UNVERIFIED|REJECTED)/.test(String(error?.message));
    if (!rejected) throw error;
  }
  assert.ok(rejected, `mutation survived: ${name}`);
  killed.push(name);
}
const invalid = (receipt, reason) => {
  const result = validateScenePerformanceReceipt(receipt);
  assert.equal(result.valid, false, `expected invalid (${reason})`);
  assert.ok(result.reasons.includes(reason), `expected ${reason}, got ${result.reasons.join(",")}`);
  return "REJECTED";
};

mustKill("M1 desktop timing copied into mobile", () => {
  attachVerifiedBrowserTelemetry(desktopOnly, telemetryFor("MOBILE", [...desktopSamples]));
});
mustKill("M1b desktop timing copied into mobile (hand-built receipt)", () => {
  const forged = structuredClone(measuredReceipt);
  forged.frameEnvironments.mobile = {
    ...structuredClone(forged.frameEnvironments.desktop),
    environmentClass: "MOBILE",
    viewport: { width: 390, height: 844 },
  };
  forged.mobileFrameP95 = forged.frameEnvironments.mobile.frameP95;
  return invalid(forged, "MOBILE_SAMPLES_COPIED_FROM_DESKTOP");
});
mustKill("M2 mobile timing multiplied from desktop", () => {
  const scaled = desktopSamples.map((value) => Number((value * 1.3).toFixed(6)));
  attachVerifiedBrowserTelemetry(desktopOnly, telemetryFor("MOBILE", scaled));
});
mustKill("M2b mobile p95 = desktop p95 × 1.3 without mobile samples", () => {
  const forged = structuredClone(desktopOnly);
  forged.mobileFrameP95 = Number((forged.desktopFrameP95 * 1.3).toFixed(2));
  forged.frameMeasurementState = "MEASURED";
  return invalid(forged, "MOBILE_MIRROR_DISAGREES_WITH_ENVIRONMENT");
});
mustKill("M3 mobile receipt missing frame samples", () => {
  attachVerifiedBrowserTelemetry(
    desktopOnly,
    telemetryFor("MOBILE", [], { sampleCount: 120, frameP50: 18, frameP95: 26, frameP99: 27 }),
  );
});
mustKill("M3b MEASURED mobile environment without frame samples (hand-built)", () => {
  const forged = structuredClone(measuredReceipt);
  delete forged.frameEnvironments.mobile.frameTimingsMs;
  return invalid(forged, "MOBILE_MISSING_FRAME_SAMPLES");
});
mustKill("M4 caller sets MEASURED without browser telemetry", () => {
  const forged = structuredClone(staticReceipt);
  forged.frameMeasurementState = "MEASURED";
  forged.frameEnvironments.mobile = {
    environmentClass: "MOBILE",
    state: "MEASURED",
    source: "NONE",
    sampleCount: 0,
    warmupDiscarded: 0,
    frameP95: 21.71,
  };
  forged.mobileFrameP95 = 21.71;
  return invalid(forged, "MOBILE_MEASURED_WITHOUT_BROWSER_TELEMETRY");
});
mustKill("M4b telemetry not from BROWSER_HARNESS", () => {
  attachVerifiedBrowserTelemetry(staticReceipt, telemetryFor("MOBILE", mobileSamples, { environment: "CALLER" }));
});
mustKill("M5 p95 inconsistent with samples", () => {
  attachVerifiedBrowserTelemetry(
    staticReceipt,
    telemetryFor("MOBILE", mobileSamples, { frameP95: computePercentile(mobileSamples, 95) - 3 }),
  );
});
mustKill("M5b p95 edited after measurement (hand-built)", () => {
  const forged = structuredClone(measuredReceipt);
  forged.frameEnvironments.mobile.frameP95 -= 3;
  forged.mobileFrameP95 = forged.frameEnvironments.mobile.frameP95;
  return invalid(forged, "MOBILE_P95_INCONSISTENT_WITH_SAMPLES");
});
mustKill("M6 insufficient sample count", () => {
  attachVerifiedBrowserTelemetry(staticReceipt, telemetryFor("MOBILE", mobileSamples.slice(0, 59)));
});
mustKill("M6b sampleCount claims more than recorded", () => {
  attachVerifiedBrowserTelemetry(
    staticReceipt,
    telemetryFor("MOBILE", mobileSamples.slice(0, 60), { sampleCount: 120 }),
  );
});
mustKill("M7 insufficient warmup", () => {
  attachVerifiedBrowserTelemetry(staticReceipt, telemetryFor("MOBILE", mobileSamples, { warmupDiscarded: 9 }));
});
mustKill("M7b warmup removed from hand-built receipt", () => {
  const forged = structuredClone(measuredReceipt);
  forged.frameEnvironments.mobile.warmupDiscarded = 0;
  return invalid(forged, "MOBILE_INSUFFICIENT_WARMUP");
});
mustKill("M8 viewport missing", () => {
  attachVerifiedBrowserTelemetry(staticReceipt, telemetryFor("MOBILE", mobileSamples, { viewport: undefined }));
});
mustKill("M8b mobile receipt measured at desktop viewport", () => {
  attachVerifiedBrowserTelemetry(
    staticReceipt,
    telemetryFor("MOBILE", mobileSamples, { viewport: { width: 1280, height: 800 } }),
  );
});
mustKill("M8c viewport stripped from hand-built receipt", () => {
  const forged = structuredClone(measuredReceipt);
  delete forged.frameEnvironments.mobile.viewport;
  return invalid(forged, "MOBILE_VIEWPORT_MISSING");
});
mustKill("M9 field CWV UNKNOWN→PASS without field evidence", () => {
  const forged = { ...fieldCwvUnknown(), status: "MEASURED_FIELD", pass: true };
  const result = validateFieldCwv(forged);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("FIELD_PASS_WITHOUT_FIELD_EVIDENCE"));
  return "REJECTED";
});
mustKill("M9b lab frame p95 offered as field LCP", () => {
  const forged = { ...fieldCwvUnknown(), lcp: measuredReceipt.desktopFrameP95 };
  const result = validateFieldCwv(forged);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes("FIELD_METRIC_WITHOUT_FIELD_EVIDENCE"));
  return "REJECTED";
});

assert.deepEqual(validateFieldCwv(fieldCwvUnknown()), { valid: true, reasons: [] });
assert.equal(fieldCwvUnknown().pass, false);
assert.equal(fieldCwvUnknown().lcp, "UNKNOWN");
console.log(`8. Adversarial receipt mutations killed: ${killed.length}`);
for (const name of killed) console.log(`   KILLED: ${name}`);

console.log("\nPASS: Performance Doctor truth & telemetry invariants.");
