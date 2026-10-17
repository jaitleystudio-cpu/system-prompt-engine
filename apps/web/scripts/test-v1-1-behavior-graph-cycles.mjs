#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — BehaviorGraph Cycles, Replay Bounds & Fallbacks.
 * Validates:
 * - A -> A (direct self cycle)
 * - A -> B -> A (2-node indirect cycle)
 * - A -> B -> C -> A (3-node loop)
 * - Data-binding trigger feedback loop
 * - Cascade replay depth budget limit
 * - Interactive 3D fallback enforcement
 */
import assert from "node:assert/strict";

const {
  validateBehaviorGraphAdvanced,
  detectBehaviorCycles,
  executeBehaviorGraphWithBudget,
} = await import("../src/website-studio/behavior/validateBehaviorGraph.ts");

console.log("================================================================================");
console.log("SPE v1.1 — BEHAVIORGRAPH MULTI-NODE CYCLES & REPLAY BUDGET TEST");
console.log("================================================================================");

// 1. Direct Self-Cycle (A -> A)
const graphSelfCycle = {
  version: "behavior-graph/1",
  rules: [{
    id: "ruleA",
    trigger: { type: "click", targetId: "btn-1" },
    conditions: [],
    actions: [{ type: "timeline-play", targetId: "btn-1", value: "ruleA" }],
    fallback: [{ type: "dom-show", targetId: "info" }],
  }],
};
assert.throws(() => validateBehaviorGraphAdvanced(graphSelfCycle), /BEHAVIOR_CYCLE_REFUSED/);
console.log("✅ 1. Direct self-cycle A -> A killed.");

// 2. Two-Node Cycle (A -> B -> A)
const graphTwoNodeCycle = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "ruleA",
      trigger: { type: "click", targetId: "hero-box" },
      conditions: [],
      actions: [{ type: "scene-rotate", targetId: "secondary-sphere", value: [0, 1, 0] }],
      fallback: [{ type: "dom-show", targetId: "info" }],
    },
    {
      id: "ruleB",
      trigger: { type: "scene", targetId: "secondary-sphere" },
      conditions: [],
      actions: [{ type: "scene-rotate", targetId: "hero-box", value: [1, 0, 0] }],
      fallback: [{ type: "dom-show", targetId: "info" }],
    },
  ],
};
assert.throws(() => validateBehaviorGraphAdvanced(graphTwoNodeCycle), /BEHAVIOR_CYCLE_REFUSED/);
console.log("✅ 2. Two-node indirect cycle A -> B -> A killed.");

// 3. Three-Node Loop (A -> B -> C -> A)
const graphThreeNodeLoop = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "nodeA",
      trigger: { type: "data", targetId: "var1" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "var2", value: 10 }],
      fallback: [],
    },
    {
      id: "nodeB",
      trigger: { type: "data", targetId: "var2" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "var3", value: 20 }],
      fallback: [],
    },
    {
      id: "nodeC",
      trigger: { type: "data", targetId: "var3" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "var1", value: 30 }],
      fallback: [],
    },
  ],
};
assert.throws(() => validateBehaviorGraphAdvanced(graphThreeNodeLoop), /BEHAVIOR_CYCLE_REFUSED/);
const cycleInfo = detectBehaviorCycles(graphThreeNodeLoop);
assert.equal(cycleInfo.hasCycle, true);
assert.ok(cycleInfo.cyclePaths.some((p) => p.includes("nodeA") && p.includes("nodeB") && p.includes("nodeC")));
console.log("✅ 3. Three-node loop A -> B -> C -> A killed with exact cycle path identified.");

// 4. Valid Acyclic BehaviorGraph Passes
const validAcyclicGraph = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "step1",
      trigger: { type: "scroll", targetId: "hero" },
      conditions: [{ type: "prefers-reduced-motion", value: false }],
      actions: [{ type: "scene-rotate", targetId: "hero-model", value: [0, 0.5, 0] }],
    },
    {
      id: "step2",
      trigger: { type: "click", targetId: "cta" },
      conditions: [],
      actions: [{ type: "dom-show", targetId: "modal" }],
    },
  ],
};
assert.doesNotThrow(() => validateBehaviorGraphAdvanced(validAcyclicGraph));
console.log("✅ 4. Valid acyclic graph with proper conditions passes clean.");

// 5. Fallback Required for 3D Motion without Reduced Motion Condition
const missingFallbackGraph = {
  version: "behavior-graph/1",
  rules: [{
    id: "spinningHero",
    trigger: { type: "scroll", targetId: "hero" },
    conditions: [{ type: "viewport-min", value: 1024 }], // lacks prefers-reduced-motion condition!
    actions: [{ type: "scene-rotate", targetId: "model", value: [0, 2, 0] }], // 3D motion action!
    // No fallback provided!
  }],
};
assert.throws(() => validateBehaviorGraphAdvanced(missingFallbackGraph), /BEHAVIOR_FALLBACK_REQUIRED/);
console.log("✅ 5. Missing accessible fallback for interactive 3D motion killed.");

// 6. Bounded Replay Depth Execution
const cascadingRules = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "cascadeA",
      trigger: { type: "data", targetId: "chain-1" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "chain-2", value: 1 }],
    },
    {
      id: "cascadeB",
      trigger: { type: "data", targetId: "chain-2" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "chain-3", value: 2 }],
    },
  ],
};

const dispatched = [];
const result = executeBehaviorGraphWithBudget(
  cascadingRules,
  [{ trigger: { type: "data", targetId: "chain-1" } }],
  (action) => dispatched.push(action),
  { maxReplayDepth: 5 },
);
assert.equal(result.dispatchedCount, 2);
assert.equal(result.replayDepthReached, 2);
assert.equal(dispatched[0].targetId, "chain-2");
assert.equal(dispatched[1].targetId, "chain-3");
console.log("✅ 6. Deterministic cascade execution within budget verified.");

// 7. Bounded Replay Depth Budget Rejection on Infinite Cascade
const infiniteCascadeRules = {
  version: "behavior-graph/1",
  rules: [
    {
      id: "inf1",
      trigger: { type: "data", targetId: "ping" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "pong", value: 1 }],
    },
    {
      id: "inf2",
      trigger: { type: "data", targetId: "pong" },
      conditions: [],
      actions: [{ type: "data-set", targetId: "ping", value: 2 }],
    },
  ],
};
assert.throws(() => {
  executeBehaviorGraphWithBudget(
    infiniteCascadeRules,
    [{ trigger: { type: "data", targetId: "ping" } }],
    () => {},
    { maxReplayDepth: 3 },
  );
}, /BEHAVIOR_REPLAY_DEPTH_EXCEEDED/);
console.log("✅ 7. Replay depth budget exceeded guardrail killed infinite cascade.");

console.log("\nPASS: BehaviorGraph multi-node cycle and replay budget invariants 100% qualified.");
