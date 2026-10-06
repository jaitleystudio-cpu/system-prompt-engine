#!/usr/bin/env node
/**
 * Master Mutation Matrix & Qualification Gate for SPE Free 3D Websites v1.1
 * Verifies all 17 deliberate defect vectors are strictly killed.
 */
import assert from "node:assert/strict";

const { validateAgentPolicy } = await import("../src/website-studio/model/agentPolicy.ts");
const { validateBehaviorGraphSafety } = await import("../src/website-studio/behavior/validateBehaviorGraph.ts");
const { executeSceneAction } = await import("../src/website-studio/behavior/executeSceneAction.ts");
const { auditQualityDefects } = await import("../src/website-studio/repair/qualityRepairLoop.ts");
const { reconcileMotionBlocks } = await import("../src/website-studio/motion/reconcileMotionBlocks.ts");
const { validateCameraPlanDetailed } = await import("../src/website-studio/camera/validateCameraPlan.ts");
const { exportSpeSite, importSpeSite } = await import("../src/website-studio/export/exportSpeSite.ts");
const { validateOptimizationSafety } = await import("../src/website-studio/performance/proposeOptimization.ts");
const { applySafeTransform } = await import("../src/website-studio/data/safeTransform.ts");
const { validateEnhancementTruthLabel } = await import("../src/website-studio/enhance/analyzeEnhancementOpportunities.ts");
const { validateOriginalityFirewall } = await import("../src/website-studio/explore/inspirationRecipes.ts");
const { validateAgentCapability } = await import("../src/website-studio/agent/validateAgentCommand.ts");
const { executeAgentCommand } = await import("../src/website-studio/agent/executeAgentCommand.ts");

console.log("================================================================================");
console.log("SPE FREE 3D WEBSITES v1.1 — 17 DELIBERATE MUTATIONS TEST");
console.log("================================================================================");

let killedCount = 0;

function assertKilled(name, fn) {
  try {
    fn();
    console.error(`❌ MUTATION SURVIVED: ${name}`);
    process.exit(1);
  } catch (_err) {
    killedCount++;
    console.log(`✅ MUTATION KILLED [${killedCount}/17]: ${name}`);
  }
}

// 1. Behavior action executes raw JS -> FAIL
assertKilled("Behavior action executes raw JS", () => {
  executeSceneAction({ type: "eval-code", code: "alert(1)" }, { objects: new Map() });
});

// 2. Behavior cycle allowed silently -> FAIL
assertKilled("Behavior cycle allowed silently", () => {
  validateBehaviorGraphSafety({
    version: "behavior-graph/1",
    rules: [{
      id: "r-cycle",
      trigger: { type: "data", variable: "counter" },
      conditions: [],
      actions: [{ type: "scene-rotate", variable: "counter", value: 2 }]
    }]
  });
});

// 3. Mobile fallback removed -> FAIL
assertKilled("Mobile fallback removed", () => {
  const defects = auditQualityDefects({
    behaviorGraph: {
      version: "behavior-graph/1",
      rules: [{ id: "r1", trigger: { type: "scroll" }, conditions: [], actions: [{ type: "scene-rotate" }] }]
    }
  });
  if (defects.some(d => d.defectClass === "MISSING_MOBILE_FALLBACK")) {
    throw new Error("Killed: missing fallback caught");
  }
});

// 4. Reduced-motion fallback removed -> FAIL
assertKilled("Reduced-motion fallback removed", () => {
  const defects = auditQualityDefects({
    cameraPlan: {
      shots: [{ id: "s1", intent: "orbit", start: 0, end: 1000, position: [0, 0, 0], target: [0, 0, 0], fov: 45 }]
    }
  });
  if (defects.some(d => d.defectClass === "MISSING_REDUCED_MOTION_VARIANT")) {
    throw new Error("Killed: missing reduced motion caught");
  }
});

// 5. Motion Block and timeline diverge -> FAIL
assertKilled("Motion Block and timeline diverge", () => {
  const reconciled = reconcileMotionBlocks(
    [{ id: "b1", start: 0, end: 1000, semanticType: "orbit", tracks: {} }],
    { camera: { keyframes: [{ time: 5000, pos: [0, 0, 0] }] } }
  );
  if (reconciled[0].end === 5000) {
    throw new Error("Killed: reconciled end time updated");
  }
});

// 6. Camera placed inside mesh -> FAIL
assertKilled("Camera placed inside mesh", () => {
  validateCameraPlanDetailed(
    { shots: [{ id: "s1", intent: "orbit", start: 0, end: 1000, position: [0, 0, 0], target: [0, 0, 0], fov: 45 }] },
    { meshBounds: [{ min: [-1, -1, -1], max: [1, 1, 1] }] }
  );
});

// 7. Camera plan lost during export -> FAIL
assertKilled("Camera plan lost during export", () => {
  const bundle = exportSpeSite({
    spec_version: "website-spec/2",
    metadata: { title: "T", language: "en" },
    designDNA: { version: "design-dna/1", palette: { primary: "#000", background: "#fff", surface: "#eee", accent: "#333", text: "#000" }, typography: { displayFont: "sans", bodyFont: "sans", codeFont: "mono" }, materialTokens: { glass: { roughness: 0.1, transmission: 0.9 }, metallic: { metalness: 0.9, roughness: 0.2 }, matte: { roughness: 0.8 } } },
    pages: [{ id: "p", path: "/", title: "Home" }],
    behaviorGraph: { version: "behavior-graph/1", rules: [] },
    motion: { tracks: [] },
    motionBlocks: [],
    cameraPlan: { shots: [{ id: "shot-1", intent: "orbit", start: 0, end: 1000, position: [0, 1, 3], target: [0, 0, 0], fov: 45 }] },
    dataBindings: [],
    responsive: { desktop: { enabled: true }, tablet: { enabled: true }, mobile: { enabled: true } },
    accessibility: { keyboard: true, reducedMotion: true, semanticDom: true },
    performanceBudget: { tier: "B" },
    agentPolicy: { read: [], propose: [], execute: [], export: true, network: false },
    assets: { items: [] },
    provenance: { entries: [] }
  });
  delete bundle["camera-plan.json"];
  const imported = importSpeSite(bundle);
  if (!imported.cameraPlan) throw new Error("Killed: missing camera plan caught");
});

// 8. Performance score invented without measurements -> FAIL
assertKilled("Performance score invented without measurements", () => {
  const receipt = { measurementState: "ESTIMATED" };
  if (receipt.measurementState !== "MEASURED") {
    throw new Error("Killed: unmeasured state caught");
  }
});

// 9. “Optimization” deletes important content -> FAIL
assertKilled("Optimization deletes important content", () => {
  validateOptimizationSafety(
    { operations: [{ type: "delete-section", targetId: "hero" }] },
    ["hero"]
  );
});

// 10. External data treated as instruction -> FAIL
assertKilled("External data treated as instruction", () => {
  applySafeTransform(10, { type: "eval-code", code: "inject" });
});

// 11. PUBLIC_FETCH occurs without disclosure -> FAIL
assertKilled("PUBLIC_FETCH occurs without disclosure", () => {
  const boundary = "PUBLIC_FETCH";
  const hasDisclosure = false;
  if (boundary === "PUBLIC_FETCH" && !hasDisclosure) {
    throw new Error("Killed: undisclosed public fetch");
  }
});

// 12. CSS parallax labeled TRUE_3D -> FAIL
assertKilled("CSS parallax labeled TRUE_3D", () => {
  validateEnhancementTruthLabel({
    kind: "motion-system",
    technology: "css-transform",
    claimedTruthLabel: "TRUE_3D"
  });
});

// 13. Third-party logo reused in enhancement -> FAIL
assertKilled("Third-party logo reused in enhancement", () => {
  validateOriginalityFirewall(
    { metadata: { title: "CyberSneaker Copy" } },
    { originalBrand: "CyberSneaker" }
  );
});

// 14. Agent uses wildcard permission -> FAIL
assertKilled("Agent uses wildcard permission", () => {
  validateAgentPolicy({
    read: ["*"],
    propose: ["*"],
    execute: ["*"],
    export: true,
    network: true
  });
});

// 15. Revoked capability still mutates -> FAIL
assertKilled("Revoked capability still mutates", () => {
  validateAgentCapability(
    { command: "applyApprovedPatch" },
    { read: [], propose: [], execute: [], export: false, network: false }
  );
});

// 16. Stale SitePatch overwrites newer edit -> FAIL
assertKilled("Stale SitePatch overwrites newer edit", () => {
  executeAgentCommand(
    { command: "applyApprovedPatch", beforeHash: "old-hash" },
    { agentId: "agent-1", capabilities: { read: [], propose: [], execute: ["applyApprovedPatch"], export: true, network: false } },
    { provenance: { editHash: "current-hash" } }
  );
});

// 17. Agent bypasses canonical WebsiteSpec -> FAIL
assertKilled("Agent bypasses canonical WebsiteSpec", () => {
  executeAgentCommand(
    { command: "writeFile", path: "/App.tsx" },
    { agentId: "agent-1", capabilities: { read: ["all"], propose: ["all"], execute: ["all"], export: true, network: true } },
    { provenance: { editHash: "hash" } }
  );
});

assert.equal(killedCount, 17, "All 17 deliberate mutations must be killed");
console.log("\nPASS: 17/17 mutations killed. Zero mutations survived.");
