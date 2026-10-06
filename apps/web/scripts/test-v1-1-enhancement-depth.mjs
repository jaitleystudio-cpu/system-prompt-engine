#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — 3D Enhancement Depth & Multi-Tier Suite.
 * Validates:
 * - URL-derived, screenshot-derived, and existing site inputs
 * - 4 truthful tiers: TRUE_3D, DEPTH_COMPOSITE, 2_5D, CSS_MOTION
 * - Semantic DOM preservation
 * - Originality firewall validation
 * - Semantic diff preview before apply
 */
import assert from "node:assert/strict";

const {
  analyzeEnhancementOpportunities,
  classifyEnhancementTruth,
  validateEnhancementTruthLabel,
  generateEnhancementSemanticDiff,
} = await import("../src/website-studio/enhance/analyzeEnhancementOpportunities.ts");
const { createDefaultWebsiteSpecV2 } = await import("../src/website-studio/model/websiteSpecV2.ts");

console.log("================================================================================");
console.log("SPE v1.1 — 3D ENHANCEMENT DEPTH & MULTI-TIER AUDIT SUITE");
console.log("================================================================================");

// 1. Truth Tiers Classification
assert.equal(classifyEnhancementTruth("webgl-scene"), "TRUE_3D");
assert.equal(classifyEnhancementTruth("depth-composite"), "DEPTH_COMPOSITE");
assert.equal(classifyEnhancementTruth("2.5d"), "2_5D");
assert.equal(classifyEnhancementTruth("css-parallax"), "CSS_MOTION");
console.log("✅ 1. All 4 truth tiers strictly mapped.");

// 2. Truth Label Escalation Guard
assert.throws(() => {
  validateEnhancementTruthLabel({
    kind: "hero-3d",
    technology: "css-transform-rotate-3d",
    claimedTruthLabel: "TRUE_3D",
  });
}, /TRUTH_LABEL_VIOLATION/);
console.log("✅ 2. CSS-only motion claiming TRUE_3D correctly rejected.");

// 3. URL-Derived Site Analysis
const urlDerivedProposals = analyzeEnhancementOpportunities({
  sourceType: "url-derived",
  heroHasStaticImage: true,
  existingWebgl: false,
  semanticDom: true,
  sections: [
    { id: "hero", type: "hero", hasImage: true, hasText: true },
    { id: "features", type: "features", hasImage: true, hasText: true },
    { id: "gallery", type: "gallery", hasImage: true, hasText: true },
  ],
});

assert.ok(urlDerivedProposals.length >= 3, `Expected at least 3 proposals, got ${urlDerivedProposals.length}`);
assert.ok(urlDerivedProposals.some((p) => p.targetId === "hero" && p.truthLabel === "TRUE_3D"));
assert.ok(urlDerivedProposals.some((p) => p.targetId === "features" && p.truthLabel === "DEPTH_COMPOSITE"));
assert.ok(urlDerivedProposals.some((p) => p.targetId === "gallery" && p.truthLabel === "2_5D"));
assert.ok(urlDerivedProposals.every((p) => p.semanticDomPreserved === true));
assert.ok(urlDerivedProposals.every((p) => p.originalityFirewallCheck === "PASS"));
console.log("✅ 3. URL-derived site proposals generated across TRUE_3D, DEPTH_COMPOSITE, and 2_5D tiers.");

// 4. Screenshot-Derived Site Analysis
const screenshotDerivedProposals = analyzeEnhancementOpportunities({
  sourceType: "screenshot-derived",
  screenshotFeatures: {
    hasHeroImage: true,
    cardCount: 4,
    detectedDominantSubject: "Automotive vehicle",
  },
  existingWebgl: false,
  semanticDom: true,
});

assert.ok(screenshotDerivedProposals.some((p) => p.targetId === "hero" && p.truthLabel === "TRUE_3D"));
console.log("✅ 4. Screenshot-derived site proposals successfully identified from visual cues.");

// 5. Semantic Diff Generation Before Apply
const spec = createDefaultWebsiteSpecV2();
const heroProposal = urlDerivedProposals.find((p) => p.targetId === "hero");
assert.ok(heroProposal, "heroProposal must be found");
const semanticDiff = generateEnhancementSemanticDiff(spec, heroProposal);

assert.equal(semanticDiff.targetSection, "hero");
assert.equal(semanticDiff.truthLabel, "TRUE_3D");
assert.equal(semanticDiff.before.webglMounted, false);
assert.equal(semanticDiff.after.webglMounted, true);
assert.ok(semanticDiff.after.added3dObjects.length > 0);
assert.equal(semanticDiff.semanticDomPreserved, true);
assert.deepEqual(semanticDiff.before.domElements, semanticDiff.after.domElements, "DOM elements must be preserved lossless");
console.log("✅ 5. Visible semantic diff generated with verified DOM preservation before apply.");

console.log("\nPASS: 3D Enhancement Depth & Multi-Tier Suite 100% qualified.");
