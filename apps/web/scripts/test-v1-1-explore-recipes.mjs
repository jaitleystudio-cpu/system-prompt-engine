#!/usr/bin/env node
/**
 * Test: Inspiration Gallery & Experience Recipes (Workstream D)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let recipesModule;
try {
  recipesModule = await import("../src/website-studio/explore/inspirationRecipes.ts");
} catch (e) {
  console.log("RED: Failed to import inspirationRecipes - expected before implementation:", e.message);
  process.exit(1);
}

const { getInspirationRecipes, remixInspirationRecipe, validateOriginalityFirewall } = recipesModule;

console.log("Running Workstream D explore recipes tests...");

// 1. Get recipes
const recipes = getInspirationRecipes();
assert.ok(recipes.length >= 2, "Must expose curated experience recipes");

const cyberSneaker = recipes.find(r => r.id === "cyber-sneaker");
assert.ok(cyberSneaker, "Cyber Sneaker recipe must exist");
assert.ok(cyberSneaker.behaviorGraph, "Recipe must contain behaviorGraph");
assert.ok(cyberSneaker.motionBlocks, "Recipe must contain motionBlocks");
assert.ok(cyberSneaker.cameraPlan, "Recipe must contain cameraPlan");

// 2. Remix around new user business without copying original brand
const userBusiness = {
  name: "Apex Aero Watch",
  industry: "luxury-timepieces",
  primaryColor: "#d4af37",
  tagline: "Precision in zero gravity"
};

const remixedSite = remixInspirationRecipe(cyberSneaker, userBusiness);
assert.equal(remixedSite.metadata.title, "Apex Aero Watch");
assert.equal(remixedSite.designDNA.primaryColor, "#d4af37");

// 3. Originality firewall: Remixed site must NOT contain original brand assets or name
assert.equal(remixedSite.metadata.title.includes("CyberSneaker"), false);
assert.doesNotThrow(() => {
  validateOriginalityFirewall(remixedSite, cyberSneaker);
}, "Remixed site must pass originality firewall");

// 4. Deliberately copying original brand must fail the firewall
const plagiarizedSite = {
  ...remixedSite,
  metadata: { ...remixedSite.metadata, title: "CyberSneaker Knockoff" }
};

assert.throws(() => {
  validateOriginalityFirewall(plagiarizedSite, cyberSneaker);
}, /ORIGINALITY_FIREWALL_VIOLATION/i, "Reusing original brand in remix must be rejected");

console.log("PASS: Workstream D explore recipes tests passed.");
