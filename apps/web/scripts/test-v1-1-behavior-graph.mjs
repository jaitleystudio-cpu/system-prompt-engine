#!/usr/bin/env node
/**
 * Test: BehaviorGraph Engine & Cycle Prevention (Workstream G)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let behaviorEngine;
try {
  behaviorEngine = await import("../src/website-studio/behavior/validateBehaviorGraph.ts");
} catch (e) {
  console.log("RED: Failed to import validateBehaviorGraph - expected before implementation:", e.message);
  process.exit(1);
}

const { validateBehaviorGraphSafety } = behaviorEngine;
const { executeBehaviorGraph } = await import("../src/website-studio/behavior/executeBehaviorGraph.ts");

console.log("Running Workstream G BehaviorGraph tests...");

// 1. Valid linear behavior graph executes correctly
const validGraph = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "rule-scroll-product",
      trigger: { type: "scroll", targetSection: "product" },
      conditions: [{ type: "viewport-width", operator: ">=", value: 768 }],
      actions: [{ type: "rotate-object", targetId: "product-shoe", angle: 90, axis: "y" }],
      fallback: [{ type: "dom-fade", targetId: "product-card", opacity: 1 }]
    }
  ]
};

assert.doesNotThrow(() => validateBehaviorGraphSafety(validGraph));

// Mock Execution Context
const mockContext = {
  viewportWidth: 1024,
  reducedMotion: false,
  scene: {
    objects: new Map([["product-shoe", { id: "product-shoe", rotation: [0, 0, 0], scale: [1, 1, 1], visible: true }]])
  },
  dom: new Map([["product-card", { opacity: 0 }]])
};

// Fire trigger
executeBehaviorGraph(validGraph, { type: "scroll", targetSection: "product" }, mockContext);
assert.equal(mockContext.scene.objects.get("product-shoe").rotation[1], 90, "Rotate action must be dispatched on desktop");

// 2. Mobile fallback execution when condition fails (viewport < 768)
mockContext.viewportWidth = 375; // Mobile viewport
executeBehaviorGraph(validGraph, { type: "scroll", targetSection: "product" }, mockContext);
assert.equal(mockContext.dom.get("product-card").opacity, 1, "Fallback dom-fade must be dispatched on mobile");

// 3. Cycle Detection: A triggers B triggers A must throw BEHAVIOR_CYCLE_REFUSED
const cyclicGraph = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "rule-1",
      trigger: { type: "data", variable: "state.counter" },
      actions: [{ type: "set-variable", variable: "state.counter", value: 1 }]
    }
  ]
};

assert.throws(() => {
  validateBehaviorGraphSafety(cyclicGraph);
}, /BEHAVIOR_CYCLE_REFUSED/i, "Direct recursive variable/event mutation cycle must be refused");

console.log("PASS: Workstream G BehaviorGraph tests passed.");
