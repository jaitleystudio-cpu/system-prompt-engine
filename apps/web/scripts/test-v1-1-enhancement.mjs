#!/usr/bin/env node
/**
 * Test: Reference Intelligence & 3D Enhancement Planning (Workstream C)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let enhancer;
try {
  enhancer = await import("../src/website-studio/enhance/analyzeEnhancementOpportunities.ts");
} catch (e) {
  console.log("RED: Failed to import analyzeEnhancementOpportunities - expected before implementation:", e.message);
  process.exit(1);
}

const { analyzeEnhancementOpportunities, validateEnhancementTruthLabel } = enhancer;

console.log("Running Workstream C enhancement tests...");

// 1. Analyze an ordinary 2D page spec and propose truthful enhancements
const sampleSite = {
  spec_version: "website-spec/2",
  pages: [{
    id: "home",
    path: "/",
    sections: [
      { id: "hero", type: "static-hero", content: "Static 2D hero image" },
      { id: "features", type: "card-grid", content: "Flat cards" },
      { id: "parallax-banner", type: "css-parallax", content: "Parallax scroll layer" }
    ]
  }]
};

const proposals = analyzeEnhancementOpportunities(sampleSite);
assert.ok(proposals.length >= 2, "Must identify enhancement opportunities for static 2D sections");

const heroProposal = proposals.find(p => p.targetId === "hero");
assert.ok(heroProposal, "Must propose hero enhancement");
assert.equal(heroProposal.kind, "hero-3d");
assert.equal(heroProposal.truthLabel, "TRUE_3D");

// 2. Truth label gate: CSS parallax must NEVER be labeled as TRUE_3D
const parallaxProposal = proposals.find(p => p.targetId === "parallax-banner");
if (parallaxProposal) {
  assert.notEqual(parallaxProposal.truthLabel, "TRUE_3D", "CSS Parallax must NEVER be labeled TRUE_3D");
  assert.equal(parallaxProposal.truthLabel, "CSS_MOTION");
}

// 3. Validation function strictly rejects false truth labeling
assert.throws(() => {
  validateEnhancementTruthLabel({
    kind: "motion-system",
    technology: "css-transform",
    claimedTruthLabel: "TRUE_3D"
  });
}, /TRUTH_LABEL_VIOLATION/i, "Falsely labeling CSS transform as TRUE_3D must throw TRUTH_LABEL_VIOLATION");

console.log("PASS: Workstream C enhancement tests passed.");
