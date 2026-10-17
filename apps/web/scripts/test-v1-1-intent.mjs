#!/usr/bin/env node
/**
 * Test: Intent Compilation (Workstream B)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let compiler;
try {
  compiler = await import("../src/website-studio/intent/compileBehaviorIntent.ts");
} catch (e) {
  console.log("RED: Failed to import compileBehaviorIntent - expected before implementation:", e.message);
  process.exit(1);
}

const { compileBehaviorIntent } = compiler;
const { compileCameraIntent } = await import("../src/website-studio/intent/compileCameraIntent.ts");
const { compileDataIntent } = await import("../src/website-studio/intent/compileDataIntent.ts");

console.log("Running Workstream B intent compilation tests...");

// 1. Natural language scroll behavior intent
const scrollIntent = "When visitors reach the product section, rotate the motorcycle and reveal specs. On mobile use lightweight fade.";
const compiledBehavior = compileBehaviorIntent(scrollIntent, { defaultTargetId: "motorcycle", sectionId: "product" });

assert.equal(compiledBehavior.version, "behavior-graph/1");
assert.equal(compiledBehavior.rules.length, 1);
assert.equal(compiledBehavior.rules[0].trigger.type, "scroll");
assert.equal(compiledBehavior.rules[0].actions.some(a => a.type === "rotate-object"), true);
assert.ok(compiledBehavior.rules[0].fallback, "Mobile fallback action must be generated");
assert.equal(compiledBehavior.rules[0].fallback[0].type, "dom-fade");

// 2. Hover intent
const hoverIntent = "When I hover the buy button, scale the shoe up.";
const hoverBehavior = compileBehaviorIntent(hoverIntent, { defaultTargetId: "shoe" });
assert.equal(hoverBehavior.rules[0].trigger.type, "hover");
assert.equal(hoverBehavior.rules[0].actions[0].type, "scale-object");

// 3. Cinematic camera intent
const cameraIntent = "Give this hero a premium automotive camera sequence with luxury orbit.";
const cameraPlan = compileCameraIntent(cameraIntent, { sceneDurationMs: 4000 });
assert.ok(cameraPlan.shots.length >= 2, "Automotive camera sequence must generate multi-shot plan");
assert.equal(cameraPlan.shots.some(s => s.intent.includes("orbit")), true);

// 4. Data binding intent
const dataIntent = "If inventory reaches zero, show Sold Out and stop rotation.";
const dataBinding = compileDataIntent(dataIntent, { targetId: "product-model" });
assert.equal(dataBinding.variable, "inventory");
assert.equal(dataBinding.privacyBoundary, "LOCAL");
assert.equal(dataBinding.consumers.length >= 1, true);

// 5. Conflicting instructions must produce INTENT_CONFLICT, not arbitrary choice
assert.throws(() => {
  compileBehaviorIntent("Always rotate left at 50rpm and rotate right at 50rpm simultaneously.", { defaultTargetId: "obj" });
}, /INTENT_CONFLICT/i, "Directly contradictory intent must throw INTENT_CONFLICT");

console.log("PASS: Workstream B intent compilation tests passed.");
