#!/usr/bin/env node
/**
 * Test: Portable .spe-site Package Export & Roundtrip (Workstream I)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let exporter;
try {
  exporter = await import("../src/website-studio/export/exportSpeSite.ts");
} catch (e) {
  console.log("RED: Failed to import exportSpeSite - expected before implementation:", e.message);
  process.exit(1);
}

const { exportSpeSite, importSpeSite, exportStandaloneHtml } = exporter;

console.log("Running Workstream I export and roundtrip tests...");

const originalSpec = {
  spec_version: "website-spec/2",
  metadata: { title: "Roundtrip Test Site", description: "Portable .spe-site test", locale: "en-US" },
  designDNA: { primaryColor: "#0f172a", accentColor: "#38bdf8", typography: "Inter", surfaceMaterial: "glass" },
  pages: [{
    id: "home",
    path: "/",
    sections: [
      { id: "hero", type: "3d-stage", content: "Revolutionary 3D Experience" }
    ]
  }],
  scene: {
    objects: [{ id: "hero-obj", type: "mesh", position: [0, 0, 0] }],
    lights: [{ id: "sun", type: "directional", intensity: 1.2 }]
  },
  behaviorGraph: {
    version: "behavior-graph/1",
    rules: [{
      id: "r1",
      trigger: { type: "scroll", targetSection: "hero" },
      actions: [{ type: "rotate-object", targetId: "hero-obj", angle: 45, axis: "y" }]
    }]
  },
  motion: { durationMs: 3000, fps: 60 },
  motionBlocks: [{
    id: "mb1",
    semanticType: "hero-arrival",
    start: 0,
    end: 1500,
    tracks: {}
  }],
  cameraPlan: {
    shots: [{
      id: "cs1",
      intent: "hero-reveal",
      start: 0,
      end: 1500,
      position: [0, 2, 5],
      target: [0, 0, 0],
      fov: 45
    }]
  },
  dataBindings: [{
    id: "db1",
    source: "LOCAL_CONSTANT",
    privacyBoundary: "LOCAL",
    variable: "site.theme",
    consumers: []
  }],
  responsive: { breakpoints: { mobile: 480, tablet: 768, desktop: 1200 }, mobileDprCap: 1.5 },
  accessibility: { reducedMotionEquivalence: true, highContrastSupport: true, ariaTreeVersion: "1.0" },
  performanceBudget: { maxDrawCalls: 80, maxTriangles: 100000, maxTextureMb: 15, targetFpsDesktop: 60, targetFpsMobile: 30 },
  agentPolicy: { read: ["all"], propose: ["SitePatch"], execute: ["applyApprovedPatch"], export: true, network: false },
  assets: { models: [], textures: [], audio: [] },
  provenance: { creator: "user", timestamp: 1775462400, editHash: "export-test-hash" }
};

// 1. Export package bundle
const bundle = exportSpeSite(originalSpec);
assert.ok(bundle["project.json"], "Bundle must contain project.json");
assert.ok(bundle["website-spec.json"], "Bundle must contain website-spec.json");
assert.ok(bundle["behavior-graph.json"], "Bundle must contain behavior-graph.json");
assert.ok(bundle["motion-blocks.json"], "Bundle must contain motion-blocks.json");
assert.ok(bundle["camera-plan.json"], "Bundle must contain camera-plan.json");
assert.ok(bundle["data-bindings.json"], "Bundle must contain data-bindings.json");

// 2. Offline import and roundtrip equality
const importedSpec = importSpeSite(bundle);
assert.deepEqual(importedSpec.behaviorGraph, originalSpec.behaviorGraph, "BehaviorGraph must survive roundtrip exactly");
assert.deepEqual(importedSpec.cameraPlan, originalSpec.cameraPlan, "CameraPlan must survive roundtrip exactly");
assert.deepEqual(importedSpec.motionBlocks, originalSpec.motionBlocks, "MotionBlocks must survive roundtrip exactly");
assert.deepEqual(importedSpec.dataBindings, originalSpec.dataBindings, "DataBindings must survive roundtrip exactly");

// 3. Standalone HTML Export (SEO & Crawlability Guarantee)
const html = exportStandaloneHtml(originalSpec);
assert.ok(html.includes("<!DOCTYPE html>"), "Must be valid HTML5 document");
assert.ok(html.includes("<title>Roundtrip Test Site</title>"), "Must include meta title");
assert.ok(html.includes("application/ld+json"), "Must include Schema.org JSON-LD");
assert.ok(html.includes("Revolutionary 3D Experience"), "Must include crawlable semantic DOM content");

console.log("PASS: Workstream I export and roundtrip tests passed.");
