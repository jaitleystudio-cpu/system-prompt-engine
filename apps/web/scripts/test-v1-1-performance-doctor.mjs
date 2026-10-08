#!/usr/bin/env node
/**
 * Test: Scene Performance Doctor & Quality Gate (Workstream H)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let perfDoctor;
try {
  perfDoctor = await import("../src/website-studio/performance/measureScene.ts");
} catch (e) {
  console.log("RED: Failed to import measureScene - expected before implementation:", e.message);
  process.exit(1);
}

const { measureScene } = perfDoctor;
const { diagnosePerformance } = await import("../src/website-studio/performance/diagnosePerformance.ts");
const { proposeOptimization, validateOptimizationSafety } = await import("../src/website-studio/performance/proposeOptimization.ts");

console.log("Running Workstream H performance doctor tests...");

// 1. Measure Scene
const mockHeavyScene = {
  objects: [
    { id: "mesh-1", type: "mesh", triangles: 150000, drawCalls: 45 },
    { id: "mesh-2", type: "mesh", triangles: 150000, drawCalls: 50 }
  ],
  textures: [
    { id: "tex-4k", bytes: 20 * 1024 * 1024 } // 20 MB
  ],
  lights: [{ id: "l1", type: "directional" }, { id: "l2", type: "point" }],
  particles: 15000
};

const receipt = measureScene(mockHeavyScene);
assert.equal(receipt.triangles, 300000);
assert.equal(receipt.drawCalls, 95);
assert.equal(receipt.textureBytes, 20 * 1024 * 1024);
assert.equal(receipt.measurementState, "MEASURED");

// 2. Diagnose Performance
const diagnosis = diagnosePerformance(receipt);
assert.ok(diagnosis.findings.length >= 2, "Must flag excessive draw calls and texture memory");
assert.equal(diagnosis.tier, "TIER_C", "Heavy scene must be graded Tier C or below");

// 3. Propose Optimization
const proposal = proposeOptimization(receipt);
assert.ok(proposal.operations.length >= 2, "Must generate optimization operations");
assert.equal(proposal.visualRisk, "LOW", "Standard non-destructive optimizations must be LOW risk");
assert.ok(proposal.estimatedAfter, "Must include estimated post-optimization projection");

// 4. Mutation Gate: Optimization MUST NOT delete essential semantic content to boost FPS
const destructivePatch = {
  operations: [
    { type: "delete-section", targetId: "hero" } // ILLEGAL
  ]
};

assert.throws(() => {
  validateOptimizationSafety(destructivePatch, ["hero"]);
}, /ESSENTIAL_CONTENT_DELETED/i, "Optimization deleting essential semantic content must fail safety gate");

console.log("PASS: Workstream H performance doctor tests passed.");
