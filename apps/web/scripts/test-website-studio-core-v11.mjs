#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — remaining core capability gate.
 * Exercises C, F, G, H, I, K, L, and M as pure deterministic contracts.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "../src/website-studio");

async function load(rel) {
  return import(pathToFileURL(path.join(src, rel)).href);
}

const required = {
  extract: "reference/extractDesignDNAFromHtml.ts",
  originality: "reference/originalityPolicy.ts",
  enhance: "enhance/analyzeEnhancementOpportunities.ts",
  blend: "reference/blendReferences.ts",
  motion: "motion/expandMotionBlock.ts",
  camera: "camera/cameraDirector.ts",
  behavior: "behavior/validateBehaviorGraph.ts",
  performance: "performance/measureScene.ts",
  data: "data/evaluateBinding.ts",
  history: "history/sitePatch.ts",
  project: "export/projectPackage.ts",
  quality: "quality/inspectSite.ts",
  agent: "agent/commandRegistry.ts",
};

const modules = {};
const missing = [];
for (const [key, rel] of Object.entries(required)) {
  try {
    modules[key] = await load(rel);
  } catch (error) {
    missing.push(rel + ": " + (error?.code || error?.message || String(error)));
  }
}
assert.deepEqual(missing, [], "v1.1 core modules missing:\n" + missing.join("\n"));

const dna = modules.extract.extractDesignDNAFromHtml(
  '<!doctype html><html><head><meta name="theme-color" content="#101218"></head><body style="background:#101218;color:#f6f7fb"><h1>Reference</h1></body></html>',
);
assert.equal(dna.colors.background.toLowerCase(), "#101218");
assert.equal(dna.provenanceState, "OBSERVED");

const safeRef = modules.originality.sanitizeReferenceIdentity({
  logo: "Source Brand",
  bodyCopy: "Protected marketing copy",
  designDNA: dna,
});
assert.equal("logo" in safeRef, false);
assert.equal("bodyCopy" in safeRef, false);
assert.equal(safeRef.designDNA.colors.background, dna.colors.background);

assert.equal(modules.enhance.classifyEnhancementTruth("css-parallax"), "CSS_MOTION");
assert.equal(modules.enhance.classifyEnhancementTruth("webgl-scene"), "TRUE_3D");
const proposals = modules.enhance.analyzeEnhancementOpportunities({
  heroHasStaticImage: true,
  existingWebgl: false,
  semanticDom: true,
});
assert.ok(proposals.some((p) => p.kind === "hero-3d" && p.truthLabel === "TRUE_3D"));

const blended = modules.blend.blendReferences({
  sources: [
    { referenceId: "a", weight: 0.5, dimensions: ["typography", "layout"] },
    { referenceId: "b", weight: 0.5, dimensions: ["motion", "camera"] },
  ],
});
assert.equal(blended.totalWeight, 1);
assert.equal(blended.dimensionOwners.camera, "b");

const block = {
  id: "reveal",
  semanticType: "product-reveal",
  start: 0.2,
  end: 0.6,
  tracks: { camera: [{ targetId: "camera", property: "position.z" }] },
};
const tracks = modules.motion.expandMotionBlock(block);
assert.equal(tracks.length, 1);
assert.deepEqual(tracks[0].keyframes.map((k) => k.at), [0.2, 0.6]);

const camera = modules.camera.createCameraPlanFromPreset("Luxury Orbit");
assert.ok(camera.shots.length >= 2);
assert.ok(camera.shots.every((s) => s.reducedMotionVariant));

const cyclic = {
  version: "behavior-graph/1",
  rules: [{
    id: "self",
    trigger: { type: "scene", targetId: "self" },
    conditions: [],
    actions: [{ type: "timeline-play", targetId: "self", value: "self" }],
  }],
};
assert.throws(() => modules.behavior.validateBehaviorGraphAdvanced(cyclic), /cycle/i);

const scene = {
  sceneVersion: "scene-ir/1",
  title: "Measured",
  theme: "dark",
  camera: { type: "perspective", fov: 60, position: [0,0,5], target: [0,0,0], near: 0.1, far: 100 },
  environment: { backgroundColor: "#000000" },
  lighting: [{ id: "a", type: "ambient", color: "#ffffff", intensity: 1 }],
  objects: [{
    id: "sphere", name: "Sphere",
    geometry: { type: "sphere", parameters: { radius: 1 } },
    material: { type: "standard", color: "#ffffff", roughness: 0.5, metalness: 0 },
    position: [0,0,0], rotation: [0,0,0], scale: [1,1,1],
  }],
  scrollTracks: [],
  performanceBudget: { maxDpr: 1.5, maxDrawCalls: 50, maxTriangles: 10000, targetFps: 60 },
  accessibilityFallback: { hero2dSvg: "<svg></svg>", textDescription: "Sphere", ariaRegionLabel: "Scene" },
};
const receipt = modules.performance.measureSceneStatic(scene);
assert.ok(receipt.triangles > 0);
assert.equal(receipt.frameMeasurementState, "UNKNOWN");
assert.equal(receipt.desktopFrameP95, undefined);

const value = modules.data.evaluateBinding(
  {
    id: "scale",
    source: { type: "LOCAL_CONSTANT", value: 4 },
    privacyBoundary: "LOCAL",
    variable: "value",
    transform: { type: "number-scale", factor: 2 },
    consumers: [],
  },
  {},
);
assert.equal(value, 8);

const state = { title: "Before", count: 1 };
const patch = modules.history.createSitePatch(
  state,
  [{ op: "set", path: ["title"], value: "After" }],
  "USER_UI",
);
const applied = modules.history.applySitePatch(state, patch);
assert.equal(applied.title, "After");
assert.throws(
  () => modules.history.applySitePatch({ title: "Other", count: 1 }, patch),
  /PATCH_CONFLICT/,
);

const specModule = await load("model/websiteSpecV2.ts");
const spec = specModule.createDefaultWebsiteSpecV2();
const packed = await modules.project.serializeProjectPackage(spec);
const restored = await modules.project.deserializeProjectPackage(packed);
assert.deepEqual(restored.websiteSpec, spec);
assert.equal(restored.integrityVerified, true);

const findings = modules.quality.inspectSite({
  hasSemanticDom: true,
  hasReducedMotion: false,
  webglContexts: 2,
  activeAnimationLoops: 2,
});
assert.ok(findings.some((f) => f.code === "REDUCED_MOTION_MISSING"));
assert.ok(findings.some((f) => f.code === "WEBGL_CONTEXT_LEAK_RISK"));

const policy = {
  read: ["getWebsiteSpec"],
  propose: ["proposePatch"],
  execute: ["applyApprovedPatch"],
  export: false,
  network: false,
};
const registry = modules.agent.createCommandRegistry();
const read = registry.execute(
  { name: "getWebsiteSpec", args: {} },
  { policy, websiteSpec: spec, currentHash: modules.history.hashCanonicalState(spec) },
);
assert.equal(read.ok, true);
const denied = registry.execute(
  { name: "exportSite", args: {} },
  { policy, websiteSpec: spec, currentHash: modules.history.hashCanonicalState(spec) },
);
assert.equal(denied.ok, false);
assert.equal(denied.code, "CAPABILITY_DENIED");

console.log("PASS: SPE Free 3D Websites v1.1 core contracts.");
