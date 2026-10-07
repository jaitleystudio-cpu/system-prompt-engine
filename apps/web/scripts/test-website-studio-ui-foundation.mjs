#!/usr/bin/env node
/**
 * SPE Free 3D Websites v1.1 — UI foundation gate.
 * Workstream N: Studio is routed at /studio (private/noindex).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/website-studio/Studio.tsx",
  "src/website-studio/studio.css",
  "src/website-studio/explore/StudioExplore.tsx",
  "src/website-studio/explore/InspirationCard.tsx",
  "src/website-studio/behavior/BehaviorGraphEditor.tsx",
  "src/website-studio/motion/MotionBlockEditor.tsx",
  "src/website-studio/camera/CameraDirectorPanel.tsx",
  "src/website-studio/performance/PerformanceDoctor.tsx",
  "src/website-studio/data/DataBindingInspector.tsx",
  "src/website-studio/render/WebsiteRenderer.tsx",
];

const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
assert.deepEqual(missing, [], "Studio UI files missing:\n" + missing.join("\n"));

const studio = readFileSync(path.join(root, "src/website-studio/Studio.tsx"), "utf8");
const css = readFileSync(path.join(root, "src/website-studio/studio.css"), "utf8");
const dataInspector = readFileSync(
  path.join(root, "src/website-studio/data/DataBindingInspector.tsx"),
  "utf8",
);
const app = readFileSync(path.join(root, "src/App.tsx"), "utf8");
const routing = readFileSync(path.join(root, "src/routing.ts"), "utf8");

for (const label of ["STRUCTURE", "LIVE WEBSITE", "INTELLIGENCE", "COPILOT"]) {
  assert.match(studio, new RegExp(label, "i"));
}
for (const boundary of ["LOCAL", "PUBLIC WEB FETCH", "EXTERNAL PROVIDER"]) {
  assert.match(dataInspector, new RegExp(boundary.replaceAll(" ", "\\s+"), "i"));
}

assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /44px/);
assert.match(css, /@media\s*\(max-width:/);
assert.match(css, /minmax\(/);

assert.match(app, /website-studio\/Studio/);
assert.match(app, /view === "studio"/);
assert.match(routing, /studio:\s*"\/studio"/);
assert.doesNotMatch(routing, /studio-test|free-3d-studio/i);
assert.doesNotMatch(studio, /world(?:wide)?\s*(?:number\s*1|#1)/i);
assert.doesNotMatch(studio, /Spline|Norrly/i);

console.log("PASS: Website Studio v1.1 UI foundation routed at /studio and accessible.");
