#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — Camera Director Safety Test Suite.
 * Validates:
 * - 8 built-in cinematography presets pass all safety constraints
 * - Mesh collision detection (camera-inside-mesh)
 * - Near/far frustum clipping
 * - Linear acceleration & angular velocity speed guards
 * - Mobile responsive framing & reduced-motion equivalence
 */
import assert from "node:assert/strict";

const {
  createCameraPlanFromPreset,
  validateCameraSafety,
} = await import("../src/website-studio/camera/cameraDirector.ts");

console.log("================================================================================");
console.log("SPE v1.1 — CAMERA DIRECTOR ADVANCED SAFETY & COLLISION SUITE");
console.log("================================================================================");

const referenceScene = {
  sceneVersion: "scene-ir/1",
  title: "Safety Test Scene",
  theme: "dark",
  camera: { type: "perspective", fov: 60, position: [0, 1.2, 7], target: [0, 0, 0], near: 0.1, far: 100 },
  environment: { backgroundColor: "#000" },
  lighting: [],
  objects: [
    {
      id: "product-hero",
      name: "Hero Sphere",
      geometry: { type: "sphere", parameters: { radius: 1.2 } },
      material: { type: "standard", color: "#fff", roughness: 0.5, metalness: 0 },
      position: [0, 0.4, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ],
  scrollTracks: [],
  performanceBudget: { maxDpr: 1.5, maxDrawCalls: 50, maxTriangles: 10000, targetFps: 60 },
  accessibilityFallback: { hero2dSvg: "<svg></svg>", textDescription: "Desc", ariaRegionLabel: "Scene" },
};

// 1. Verify All 8 Presets Pass Safety Analysis
const presets = [
  "Hero Reveal",
  "Luxury Orbit",
  "Product Inspection",
  "Dramatic Push-In",
  "Architectural Flythrough",
  "Macro Detail",
  "Exploded Assembly",
  "Story Journey",
];

for (const p of presets) {
  const plan = createCameraPlanFromPreset(p);
  const report = validateCameraSafety(plan, referenceScene);
  assert.equal(report.safe, true, `Preset "${p}" must pass safety audit without findings: ${JSON.stringify(report.findings)}`);
  assert.equal(report.score, 1.0, `Preset "${p}" must score 1.0`);
  assert.equal(report.measuredMetrics.mobileCoverage, 1.0, `Preset "${p}" must have 100% mobile coverage`);
  assert.equal(report.measuredMetrics.reducedMotionCoverage, 1.0, `Preset "${p}" must have 100% reduced motion coverage`);
}
console.log(`✅ 1. All ${presets.length}/8 camera presets certified 100% safe (Score 1.0).`);

// 2. Camera Inside Mesh Collision
const insideMeshPlan = {
  shots: [{
    id: "penetrating-shot",
    intent: "Illegal penetration",
    start: 0,
    end: 1,
    position: [0, 0.4, 0.2], // distance 0.2 is inside radius 1.2!
    target: [0, 0, 0],
    fov: 50,
    easing: "cinematic",
    responsiveVariant: { position: [0, 0.4, 6], target: [0, 0, 0] },
    reducedMotionVariant: { position: [0, 0.4, 6], target: [0, 0, 0] },
  }],
};
const insideReport = validateCameraSafety(insideMeshPlan, referenceScene);
assert.equal(insideReport.safe, false);
assert.ok(insideReport.findings.some((f) => f.code === "CAMERA_INSIDE_MESH"));
console.log("✅ 2. Camera inside mesh collision correctly detected & rejected.");

// 3. Near-Plane Frustum Clipping
const nearClippingPlan = {
  shots: [{
    id: "clipping-near",
    intent: "Too close to target",
    start: 0,
    end: 1,
    position: [0, 0, 0.15], // target is [0,0,0], near plane is 0.1, 0.15 <= near * 2
    target: [0, 0, 0],
    fov: 50,
    easing: "cinematic",
    responsiveVariant: { position: [0, 1, 6], target: [0, 0, 0] },
    reducedMotionVariant: { position: [0, 1, 6], target: [0, 0, 0] },
  }],
};
const nearReport = validateCameraSafety(nearClippingPlan, referenceScene);
assert.equal(nearReport.safe, false);
assert.ok(nearReport.findings.some((f) => f.code === "CAMERA_CLIPPING_NEAR"));
console.log("✅ 3. Near-plane clipping correctly detected & rejected.");

// 4. Excessive Linear Acceleration
const superFastPlan = {
  shots: [
    {
      id: "shot1",
      intent: "Start point",
      start: 0,
      end: 0.1,
      position: [-50, 0, 10],
      target: [0, 0, 0],
      fov: 50,
      easing: "cinematic",
      responsiveVariant: { position: [0, 1, 6], target: [0, 0, 0] },
      reducedMotionVariant: { position: [0, 1, 6], target: [0, 0, 0] },
    },
    {
      id: "shot2",
      intent: "Violent transition",
      start: 0.1,
      end: 0.2,
      position: [50, 0, 10], // 100 units in 0.1 seconds = 1000 units/s!
      target: [0, 0, 0],
      fov: 50,
      easing: "cinematic",
      responsiveVariant: { position: [0, 1, 6], target: [0, 0, 0] },
      reducedMotionVariant: { position: [0, 1, 6], target: [0, 0, 0] },
    },
  ],
};
const speedReport = validateCameraSafety(superFastPlan, referenceScene);
assert.equal(speedReport.safe, false);
assert.ok(speedReport.findings.some((f) => f.code === "EXCESSIVE_LINEAR_ACCELERATION"));
console.log("✅ 4. Excessive linear acceleration correctly detected & rejected.");

// 5. Excessive Angular Disorientation
const violentSpinPlan = {
  shots: [
    {
      id: "spin1",
      intent: "North vantage",
      start: 0,
      end: 0.1,
      position: [0, 0, 5],
      target: [0, 0, 0],
      fov: 50,
      easing: "cinematic",
      responsiveVariant: { position: [0, 1, 6], target: [0, 0, 0] },
      reducedMotionVariant: { position: [0, 1, 6], target: [0, 0, 0] },
    },
    {
      id: "spin2",
      intent: "180-deg reversal in 0.05s",
      start: 0.1,
      end: 0.15,
      position: [0, 0, -5], // 180 deg in 0.1s = 1800 deg/s!
      target: [0, 0, 0],
      fov: 50,
      easing: "cinematic",
      responsiveVariant: { position: [0, 1, 6], target: [0, 0, 0] },
      reducedMotionVariant: { position: [0, 1, 6], target: [0, 0, 0] },
    },
  ],
};
const spinReport = validateCameraSafety(violentSpinPlan, referenceScene);
assert.equal(spinReport.safe, false);
assert.ok(spinReport.findings.some((f) => f.code === "EXCESSIVE_ANGULAR_VELOCITY"));
console.log("✅ 5. Excessive angular disorientation velocity correctly detected & rejected.");

// 6. Missing Reduced Motion Equivalence
const missingReducedMotionPlan = {
  shots: [{
    id: "no-reduced-motion",
    intent: "Unsafe shot",
    start: 0,
    end: 1,
    position: [0, 1, 6],
    target: [0, 0, 0],
    fov: 50,
    easing: "cinematic",
    responsiveVariant: { position: [0, 1, 7], target: [0, 0, 0] },
    // missing reducedMotionVariant!
  }],
};
const rmReport = validateCameraSafety(missingReducedMotionPlan, referenceScene);
assert.equal(rmReport.safe, false);
assert.ok(rmReport.findings.some((f) => f.code === "REDUCED_MOTION_EQUIVALENCE_MISSING"));
console.log("✅ 6. Missing reduced motion variant correctly detected & rejected.");

console.log("\nPASS: Camera Director Safety & Collision Suite 100% qualified.");
