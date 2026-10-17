#!/usr/bin/env node
/**
 * Test: Narrative Motion Blocks & Camera Director (Workstream F)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let motionEngine;
try {
  motionEngine = await import("../src/website-studio/motion/expandMotionBlock.ts");
} catch (e) {
  console.log("RED: Failed to import expandMotionBlock - expected before implementation:", e.message);
  process.exit(1);
}

const { expandMotionBlock } = motionEngine;
const { reconcileMotionBlocks } = await import("../src/website-studio/motion/reconcileMotionBlocks.ts");
const { CAMERA_PRESETS, getCameraPreset } = await import("../src/website-studio/camera/cameraPresets.ts");
const { validateCameraPlanDetailed } = await import("../src/website-studio/camera/validateCameraPlan.ts");

console.log("Running Workstream F motion and camera director tests...");

// 1. Expand Narrative Motion Block to multi-track keyframes
const block = {
  id: "hero-block",
  semanticType: "product-reveal",
  start: 0,
  end: 2000,
  tracks: {}
};

const expanded = expandMotionBlock(block, { targetObjectId: "sneaker-model" });
assert.ok(expanded.tracks.camera, "Must generate camera track keyframes");
assert.ok(expanded.tracks.objects && expanded.tracks.objects.length > 0, "Must generate object track keyframes");
assert.ok(expanded.tracks.lighting, "Must generate light intensity keyframes");

// 2. Reconcile Motion Blocks with low-level manual edits
const modifiedTracks = {
  ...expanded.tracks,
  camera: {
    keyframes: [
      { time: 0, pos: [0, 2, 8] },
      { time: 2500, pos: [0, 1, 3] } // extended time
    ]
  }
};

const reconciled = reconcileMotionBlocks([block], modifiedTracks);
assert.equal(reconciled[0].end, 2500, "Block duration must synchronize with extended keyframe track");

// 3. Camera Presets: All 8 required presets exist
const requiredPresets = [
  "Hero Reveal",
  "Luxury Orbit",
  "Product Inspection",
  "Dramatic Push-In",
  "Architectural Flythrough",
  "Macro Detail",
  "Exploded Assembly",
  "Story Journey"
];

for (const presetName of requiredPresets) {
  const preset = getCameraPreset(presetName);
  assert.ok(preset, `Preset "${presetName}" must exist in cameraPresets`);
  assert.ok(preset.shots.length > 0, `Preset "${presetName}" must contain valid shots`);
}

// 4. Camera Safety & Collision Guards
// Valid camera plan passes
const validPlan = {
  shots: [
    {
      id: "shot-1",
      intent: "hero",
      start: 0,
      end: 2000,
      position: [0, 2, 5],
      target: [0, 0, 0],
      fov: 45
    }
  ]
};
assert.doesNotThrow(() => validateCameraPlanDetailed(validPlan));

// Camera colliding with mesh bounding box must be flagged
const meshCollisionPlan = {
  shots: [
    {
      id: "shot-inside-mesh",
      intent: "inside",
      start: 0,
      end: 2000,
      position: [0, 0.1, 0.1], // inside target bounds [ -1 to 1 ]
      target: [0, 0, 0],
      fov: 45
    }
  ]
};

const boundingBoxes = [{ min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] }];
assert.throws(() => {
  validateCameraPlanDetailed(meshCollisionPlan, { meshBounds: boundingBoxes });
}, /CAMERA_INSIDE_MESH/i, "Camera intersecting mesh bounding box must fail validation");

// Excessive velocity camera move must be flagged
const supersonicPlan = {
  shots: [
    {
      id: "shot-fast",
      intent: "hyperspeed",
      start: 0,
      end: 50, // 50ms to move 1000 units
      position: [1000, 1000, 1000],
      target: [0, 0, 0],
      fov: 45
    }
  ]
};

assert.throws(() => {
  validateCameraPlanDetailed(supersonicPlan);
}, /EXCESSIVE_VELOCITY/i, "Unsafe high-velocity camera jump must fail validation");

console.log("PASS: Workstream F motion and camera director tests passed.");
