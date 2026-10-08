#!/usr/bin/env node
/**
 * Test: Structured Agent Protocol & Governance (Workstream M)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let agentProtocol;
try {
  agentProtocol = await import("../src/website-studio/agent/executeAgentCommand.ts");
} catch (e) {
  console.log("RED: Failed to import executeAgentCommand - expected before implementation:", e.message);
  process.exit(1);
}

const { executeAgentCommand } = agentProtocol;
const { validateAgentCapability } = await import("../src/website-studio/agent/validateAgentCommand.ts");

console.log("Running Workstream M agent protocol tests...");

const mockSpec = {
  spec_version: "website-spec/2",
  metadata: { title: "Agent Protocol Test", description: "Test", locale: "en-US" },
  designDNA: { primaryColor: "#000", accentColor: "#f00", typography: "Inter", surfaceMaterial: "matte" },
  pages: [{ id: "home", path: "/", sections: [{ id: "hero", type: "stage", content: "Hero" }] }],
  behaviorGraph: { version: "behavior-graph/1", rules: [] },
  motion: { durationMs: 1000, fps: 60 },
  motionBlocks: [],
  dataBindings: [],
  responsive: { breakpoints: { mobile: 480, tablet: 768, desktop: 1200 }, mobileDprCap: 1.5 },
  accessibility: { reducedMotionEquivalence: true, highContrastSupport: true, ariaTreeVersion: "1.0" },
  performanceBudget: { maxDrawCalls: 80, maxTriangles: 100000, maxTextureMb: 15, targetFpsDesktop: 60, targetFpsMobile: 30 },
  agentPolicy: { read: ["getWebsiteSpec"], propose: ["proposePatch"], execute: [], export: false, network: false },
  assets: { models: [], textures: [], audio: [] },
  provenance: { creator: "user", timestamp: 1775462400, editHash: "hash-alpha" }
};

const activeSession = {
  agentId: "claude-subagent-1",
  capabilities: {
    read: ["getWebsiteSpec", "getBehaviorGraph"],
    propose: ["proposePatch"],
    execute: ["applyApprovedPatch"],
    export: true,
    network: false
  }
};

// 1. Authorized read command succeeds and returns receipt
const readCmd = { command: "getWebsiteSpec" };
const readReceipt = executeAgentCommand(readCmd, activeSession, mockSpec);
assert.equal(readReceipt.status, "SUCCESS");
assert.equal(readReceipt.agentId, "claude-subagent-1");
assert.ok(readReceipt.result, "Read receipt must return requested spec");

// 2. Unauthorized command (not in capability) must throw UNAUTHORIZED_AGENT_ACTION
const unauthorizedCmd = { command: "exportProject" };
assert.throws(() => {
  validateAgentCapability(unauthorizedCmd, { ...activeSession.capabilities, export: false });
}, /UNAUTHORIZED_AGENT_ACTION/i, "Action not in capability policy must be rejected");

// 3. Stale hash conflict detection: mismatch beforeHash must throw PATCH_CONFLICT
const conflictingPatchCmd = {
  command: "applyApprovedPatch",
  beforeHash: "stale-hash-999", // Mismatch against "hash-alpha"
  patch: { operations: [{ type: "update-title", payload: { title: "Conflict" } }] }
};

assert.throws(() => {
  executeAgentCommand(conflictingPatchCmd, activeSession, mockSpec);
}, /PATCH_CONFLICT/i, "Mismatched beforeHash must throw PATCH_CONFLICT");

// 4. Canonical state bypass attempt (e.g. raw writeFile) must be rejected
const bypassCmd = {
  command: "writeFile",
  path: "/src/App.tsx",
  content: "console.log('pwned')"
};

assert.throws(() => {
  executeAgentCommand(bypassCmd, activeSession, mockSpec);
}, /UNKNOWN_COMMAND|CANONICAL_BYPASS/i, "Raw filesystem command must be refused by agent protocol");

console.log("PASS: Workstream M agent protocol tests passed.");
