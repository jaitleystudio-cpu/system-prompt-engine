#!/usr/bin/env node
/**
 * Test: Quality & Automatic Repair Loop (Workstream L)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let repairEngine;
try {
  repairEngine = await import("../src/website-studio/repair/qualityRepairLoop.ts");
} catch (e) {
  console.log("RED: Failed to import qualityRepairLoop - expected before implementation:", e.message);
  process.exit(1);
}

const { auditQualityDefects, proposeRepairPatch, applyRepairPatch } = repairEngine;

console.log("Running Workstream L quality repair loop tests...");

// 1. Create a spec with known defect classes:
// - Missing mobile motion fallback
// - Missing reduced-motion variant in camera shot
const defectiveSpec = {
  spec_version: "website-spec/2",
  metadata: { title: "Defective Spec", description: "Test", locale: "en-US" },
  designDNA: { primaryColor: "#111", accentColor: "#f00", typography: "Inter", surfaceMaterial: "matte" },
  pages: [{ id: "home", path: "/", sections: [{ id: "hero", type: "stage", content: "Hero" }] }],
  behaviorGraph: {
    version: "behavior-graph/1",
    rules: [
      {
        id: "r1",
        trigger: { type: "scroll", targetSection: "hero" },
        actions: [{ type: "rotate-object", targetId: "model", angle: 90, axis: "y" }]
        // Defect: Missing fallback for mobile!
      }
    ]
  },
  motion: { durationMs: 2000, fps: 60 },
  motionBlocks: [],
  cameraPlan: {
    shots: [
      {
        id: "shot-1",
        intent: "hero",
        start: 0,
        end: 2000,
        position: [0, 2, 5],
        target: [0, 0, 0],
        fov: 45
        // Defect: Missing reducedMotionVariant!
      }
    ]
  },
  dataBindings: [],
  responsive: { breakpoints: { mobile: 480, tablet: 768, desktop: 1200 }, mobileDprCap: 1.5 },
  accessibility: { reducedMotionEquivalence: true, highContrastSupport: true, ariaTreeVersion: "1.0" },
  performanceBudget: { maxDrawCalls: 80, maxTriangles: 100000, maxTextureMb: 15, targetFpsDesktop: 60, targetFpsMobile: 30 },
  agentPolicy: { read: ["all"], propose: ["SitePatch"], execute: ["applyApprovedPatch"], export: true, network: false },
  assets: { models: [], textures: [], audio: [] },
  provenance: { creator: "user", timestamp: 1775462400, editHash: "def-001" }
};

// Audit defects
const defects = auditQualityDefects(defectiveSpec);
assert.ok(defects.length >= 2, "Must detect missing mobile fallback and missing reduced-motion variant");
assert.ok(defects.some(d => d.defectClass === "MISSING_MOBILE_FALLBACK"));
assert.ok(defects.some(d => d.defectClass === "MISSING_REDUCED_MOTION_VARIANT"));

// Propose repair patch
const repairPatch = proposeRepairPatch(defects, defectiveSpec);
assert.ok(repairPatch.operations.length >= 2, "Repair patch must provide operations for both defects");

// Apply repair patch
const repairedSpec = applyRepairPatch(defectiveSpec, repairPatch);

// Re-audit repaired spec: Must have 0 defects!
const remainingDefects = auditQualityDefects(repairedSpec);
assert.equal(remainingDefects.length, 0, "Repaired spec must have zero remaining quality defects");

console.log("PASS: Workstream L quality repair loop tests passed.");
