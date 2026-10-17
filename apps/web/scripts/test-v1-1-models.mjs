#!/usr/bin/env node
/**
 * Test: Canonical v1.1 Models and Validation (Workstream A)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let models;
try {
  models = await import("../src/website-studio/model/websiteSpecV2.ts");
} catch (e) {
  console.log("RED: Failed to import websiteSpecV2 model - expected before implementation:", e.message);
  process.exit(1);
}

const { validateWebsiteSpecV2, validateBehaviorGraph, validateCameraPlan, validateAgentPolicy } = models;

console.log("Running Workstream A validation tests...");

// 1. Valid minimal spec passes
const validSpec = {
  spec_version: "website-spec/2",
  metadata: { title: "Test 3D Site", description: "Minimal test spec", locale: "en-US" },
  designDNA: { primaryColor: "#111111", accentColor: "#ff4400", typography: "Cinematic Sans", surfaceMaterial: "brushed-metal" },
  pages: [{ id: "home", path: "/", sections: [{ id: "hero", type: "3d-stage", content: "Welcome" }] }],
  scene: {
    objects: [{ id: "shoe", type: "mesh", geometry: "sneaker.glb", position: [0, 0, 0] }],
    lights: [{ id: "key", type: "directional", intensity: 1.5, position: [5, 5, 5] }]
  },
  behaviorGraph: {
    version: "behavior-graph/1",
    rules: [{
      id: "rule-1",
      trigger: { type: "scroll", targetSection: "hero", threshold: 0.5 },
      conditions: [{ type: "viewport-width", operator: ">=", value: 768 }],
      actions: [{ type: "rotate-object", targetId: "shoe", angle: 120, axis: "y" }],
      fallback: [{ type: "dom-fade", targetId: "hero", opacity: 1 }]
    }]
  },
  motion: { durationMs: 5000, fps: 60 },
  motionBlocks: [{
    id: "block-1",
    semanticType: "product-reveal",
    start: 0,
    end: 2000,
    tracks: {
      camera: { keyframes: [{ time: 0, pos: [0, 2, 5] }, { time: 2000, pos: [0, 1, 3] }] }
    }
  }],
  cameraPlan: {
    shots: [{
      id: "shot-1",
      intent: "hero-reveal",
      start: 0,
      end: 2000,
      position: [0, 2, 5],
      target: [0, 0, 0],
      fov: 45
    }]
  },
  dataBindings: [{
    id: "bind-1",
    source: "LOCAL_PROJECT_DATA",
    privacyBoundary: "LOCAL",
    variable: "product.isSoldOut",
    consumers: [{ targetType: "scene", targetId: "shoe", property: "visible" }]
  }],
  responsive: { breakpoints: { mobile: 480, tablet: 768, desktop: 1200 }, mobileDprCap: 1.5 },
  accessibility: { reducedMotionEquivalence: true, highContrastSupport: true, ariaTreeVersion: "1.0" },
  performanceBudget: { maxDrawCalls: 100, maxTriangles: 300000, maxTextureMb: 25, targetFpsDesktop: 60, targetFpsMobile: 30 },
  agentPolicy: {
    read: ["websiteSpec", "scene", "behaviorGraph", "performanceReceipt"],
    propose: ["SitePatch"],
    execute: ["applyApprovedPatch"],
    export: true,
    network: false
  },
  assets: { models: [], textures: [], audio: [] },
  provenance: { creator: "user", timestamp: 1775462400, editHash: "hash-001" }
};

assert.doesNotThrow(() => validateWebsiteSpecV2(validSpec), "Valid spec should pass validation");

// 2. Unsafe wildcard agent policy must throw
assert.throws(() => {
  validateAgentPolicy({
    read: ["*"],
    propose: ["*"],
    execute: ["*"],
    export: true,
    network: true
  });
}, /wildcard.*not allowed/i, "Unsafe wildcard agent authority must fail validation");

// 3. Motion block end < start must throw
assert.throws(() => {
  validateWebsiteSpecV2({
    ...validSpec,
    motionBlocks: [{
      id: "bad-block",
      semanticType: "product-reveal",
      start: 3000,
      end: 1000,
      tracks: {}
    }]
  });
}, /invalid.*range/i, "Motion block end < start must fail validation");

// 4. Camera shot invalid FOV or range must throw
assert.throws(() => {
  validateCameraPlan({
    shots: [{
      id: "bad-shot",
      intent: "fail",
      start: 0,
      end: 1000,
      position: [0, 0, 0],
      target: [0, 0, 0],
      fov: 190 // FOV > 180 invalid
    }]
  });
}, /invalid.*fov/i, "Camera shot with FOV > 180 must fail validation");

// 5. Bad DataBinding boundary must throw
assert.throws(() => {
  validateWebsiteSpecV2({
    ...validSpec,
    dataBindings: [{
      id: "bad-bind",
      source: "ILLEGAL_SOURCE",
      privacyBoundary: "UNKNOWN_BOUNDARY",
      variable: "x",
      consumers: []
    }]
  });
}, /invalid.*data.*binding/i, "Bad data binding source or boundary must fail validation");

// 6. Unknown EnhancementKind must throw
assert.throws(() => {
  validateWebsiteSpecV2({
    ...validSpec,
    enhancement: {
      kind: "FABRICATED_KIND",
      truthLabel: "TRUE_3D"
    }
  });
}, /invalid.*enhancement/i, "Unknown enhancement kind must fail validation");

console.log("PASS: Workstream A validation tests passed.");
