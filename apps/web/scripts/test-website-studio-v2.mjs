#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — canonical WebsiteSpecV2 RED/GREEN gate.
 * Run with:
 *   node --experimental-strip-types apps/web/scripts/test-website-studio-v2.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelUrl = pathToFileURL(
  path.join(__dirname, "../src/website-studio/model/websiteSpecV2.ts"),
).href;

const {
  createDefaultWebsiteSpecV2,
  validateWebsiteSpecV2,
  WebsiteSpecV2ValidationError,
} = await import(modelUrl);

const spec = createDefaultWebsiteSpecV2();
assert.equal(spec.spec_version, "website-spec/2");
assert.equal(spec.behaviorGraph.version, "behavior-graph/1");
assert(Array.isArray(spec.motionBlocks));
assert(Array.isArray(spec.dataBindings));
assert(spec.agentPolicy && typeof spec.agentPolicy === "object");
assert.equal(validateWebsiteSpecV2(spec), spec);

const sceneUrl = pathToFileURL(
  path.join(__dirname, "../src/website-studio/model/sceneIR.ts"),
).href;
const { createEmptySceneIR } = await import(sceneUrl);
const canonicalScene = createEmptySceneIR();
assert.equal(canonicalScene.sceneVersion, "scene-ir/1");
assert.ok(Array.isArray(canonicalScene.lighting));
assert.ok(Array.isArray(canonicalScene.scrollTracks));
assert.ok(canonicalScene.accessibilityFallback?.ariaRegionLabel);
spec.scene = canonicalScene;
assert.equal(validateWebsiteSpecV2(spec), spec);

const wildcard = structuredClone(spec);
wildcard.agentPolicy.execute = ["*"];
assert.throws(
  () => validateWebsiteSpecV2(wildcard),
  WebsiteSpecV2ValidationError,
  "wildcard execute authority must be refused",
);

const badMotion = structuredClone(spec);
badMotion.motionBlocks.push({
  id: "bad",
  semanticType: "custom",
  start: 0.8,
  end: 0.2,
  tracks: {},
});
assert.throws(
  () => validateWebsiteSpecV2(badMotion),
  WebsiteSpecV2ValidationError,
  "motion block end < start must be refused",
);

const badShot = structuredClone(spec);
badShot.cameraPlan = {
  shots: [{
    id: "shot-1",
    intent: "bad",
    start: -0.1,
    end: 1.1,
    position: [0, 0, 5],
    target: [0, 0, 0],
    easing: "linear",
  }],
};
assert.throws(
  () => validateWebsiteSpecV2(badShot),
  WebsiteSpecV2ValidationError,
  "camera shots outside normalized timeline must be refused",
);

const badBinding = structuredClone(spec);
badBinding.dataBindings.push({
  id: "inventory",
  source: { type: "LOCAL_CONSTANT", value: true },
  privacyBoundary: "LOCAL",
  variable: "product.available",
  consumers: [],
  transform: { type: "eval", code: "process.exit()" },
});
assert.throws(
  () => validateWebsiteSpecV2(badBinding),
  WebsiteSpecV2ValidationError,
  "executable data transforms must be refused",
);

const badEnhancement = structuredClone(spec);
badEnhancement.enhancement = {
  targetId: "hero",
  kind: "fake-3d",
  truthLabel: "TRUE_3D",
};
assert.throws(
  () => validateWebsiteSpecV2(badEnhancement),
  WebsiteSpecV2ValidationError,
  "unknown enhancement kinds must be refused",
);

console.log("PASS: WebsiteSpecV2 v1.1 canonical model validation.");
