#!/usr/bin/env node
/**
 * Lane A11-S / R2-WEB-W: Static Website Builder UI Qualification Harness
 * Enforces:
 * - website-spec/1 local TS compiler (NOT false G13 package binding)
 * - Visible disclosure of the 4 mandatory boundaries
 * - Viewport switcher (Desktop/Tablet/Mobile 360px)
 * - CSS touch targets (>= 44px) & focus rings
 * - Route isolation (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)
 * - SCENE_3D truth labels (isometric 2D Canvas, not WebGL marketing)
 * - Delegates to compiler safety harness (must invoke compiler)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");

console.log("Checking Lane A11-S file existence...");
const requiredFiles = [
  path.join(webRoot, "src/builder/websiteSpecModel.ts"),
  path.join(webRoot, "src/builder/static-builder.css"),
  path.join(webRoot, "src/builder/StaticWebsiteBuilder.tsx"),
];

for (const f of requiredFiles) {
  assert(fs.existsSync(f), `Missing required file: ${f}`);
}

console.log("Checking website-spec/1 schema invariants + truth binding...");
const modelText = fs.readFileSync(path.join(webRoot, "src/builder/websiteSpecModel.ts"), "utf8");
assert(modelText.includes('spec_version: "website-spec/1"'), "Must specify spec_version website-spec/1");
assert(modelText.includes('"hero"'), "Must support hero section kind");
assert(modelText.includes('"prose"'), "Must support prose section kind");
assert(modelText.includes('"list"'), "Must support list section kind");
assert(modelText.includes('"cta"'), "Must support cta section kind");
assert(modelText.includes('COMPILER_BINDING = "LOCAL_TS_WEBSITE_SPEC_1"'), "Must declare LOCAL_TS binding");
assert(modelText.includes("G13_PACKAGE_BOUND = false"), "Must declare G13_PACKAGE_BOUND=false");
assert(modelText.includes("function escapeHtml"), "Must define escapeHtml");
assert(modelText.includes("SAFE_HREF"), "Must define SAFE_HREF");
assert(modelText.includes("PAGE_PATH"), "Must define PAGE_PATH");
assert(modelText.includes("toStandaloneDocument"), "Must define toStandaloneDocument");
assert(!modelText.includes("Strictly maps to G13 WebsiteSpec"), "Must not claim false G13 binding");

console.log("Checking 4 mandatory restriction states...");
assert(modelText.includes('AI_GENERATION = "NOT_AVAILABLE"'), "Must export AI_GENERATION=NOT_AVAILABLE");
assert(modelText.includes('SCENE_3D = "NOT_AVAILABLE"'), "Must export SCENE_3D=NOT_AVAILABLE");
assert(modelText.includes('SANDBOX = "UNSUPPORTED"'), "Must export SANDBOX=UNSUPPORTED");
assert(modelText.includes('HOSTED_PUBLISH = "HOLD"'), "Must export HOSTED_PUBLISH=HOLD");

const viewText = fs.readFileSync(path.join(webRoot, "src/builder/StaticWebsiteBuilder.tsx"), "utf8");
assert(viewText.includes("AI generation:"), "UI must visibly display AI generation status");
assert(viewText.includes("3D graphics:"), "UI must visibly display 3D graphics status");
assert(viewText.includes("Sandbox execution:"), "UI must visibly display Sandbox status");
assert(viewText.includes("Hosted publish:"), "UI must visibly display Hosted publish status");
assert(viewText.includes("website-spec/1 local TS compiler"), "UI title must not claim false G13 Spec Compiler");
assert(!viewText.includes("G13 Spec Compiler"), "UI must not claim G13 Spec Compiler");
assert(viewText.includes("toStandaloneDocument"), "Export/preview must use toStandaloneDocument");
assert(viewText.includes("downloadFileNameForPagePath"), "Download name must use PAGE_PATH helper");

console.log("Checking viewport controls...");
assert(viewText.includes('"desktop"'), "Must support desktop viewport");
assert(viewText.includes('"tablet"'), "Must support tablet viewport");
assert(viewText.includes('"mobile"'), "Must support mobile viewport");
assert(viewText.includes('"360px"'), "Must support 360px viewport mode");

console.log("Checking CSS accessibility standards...");
const cssText = fs.readFileSync(path.join(webRoot, "src/builder/static-builder.css"), "utf8");
assert(cssText.includes(":focus-visible"), "CSS must specify :focus-visible rules");
assert(cssText.includes("prefers-reduced-motion: reduce"), "CSS must support prefers-reduced-motion");
assert(cssText.includes("min-height: 44px"), "CSS must enforce 44px touch targets");
assert(cssText.includes("@media (max-width: 360px)"), "CSS must reflow down to 360px");

console.log("Checking isometric 2D layout preview truth (SCENE_3D=NOT_AVAILABLE)...");
assert(viewText.includes("WireframeCanvasPreview"), "StaticWebsiteBuilder must define WireframeCanvasPreview");
assert(viewText.includes("Isometric 2D Layout Preview"), "Must offer Isometric 2D Layout Preview toggle");
assert(viewText.includes("Canvas 2D isometric layout preview"), "Must disclose Canvas 2D isometric preview");
assert(viewText.includes("WebGL NOT_AVAILABLE"), "Must disclose WebGL NOT_AVAILABLE");
assert(!viewText.includes("3D Wireframe Fallback"), "Must not market 3D Wireframe Fallback");
assert(!viewText.includes("Canvas / WebGL fallback"), "Must not market WebGL fallback");
assert(viewText.includes('"isometric_2d"'), "ViewMode must use isometric_2d");
assert(cssText.includes(".bld-wireframe-container"), "static-builder.css must style .bld-wireframe-container");
assert(cssText.includes(".bld-wireframe-canvas"), "static-builder.css must style .bld-wireframe-canvas");

console.log("Checking Route Mount isolation...");
assert(modelText.includes('ROUTE_MOUNT_STATUS = "NOT_INTEGRATED"'), "ROUTE_MOUNT_STATUS must be NOT_INTEGRATED");
const appTsx = fs.readFileSync(path.join(webRoot, "src/App.tsx"), "utf8");
assert(!appTsx.includes("StaticWebsiteBuilder"), "StaticWebsiteBuilder must not be eagerly mounted in App.tsx");

console.log("Invoking compiler safety harness (must call compileWebsiteSpecToStaticHtml)...");
const compilerHarness = path.join(__dirname, "test-static-website-compiler.mjs");
assert(fs.existsSync(compilerHarness), "Missing compiler harness");
const res = spawnSync(process.execPath, ["--experimental-strip-types", compilerHarness], {
  cwd: webRoot,
  encoding: "utf8",
});
assert.equal(res.status, 0, `Compiler harness failed:\n${res.stderr}\n${res.stdout}`);
assert(res.stdout.includes("PASS: compiler safety"), "Compiler harness must report PASS");
assert(res.stdout.includes("Invoking compileWebsiteSpecToStaticHtml"), "Compiler harness must invoke compiler");
// Surface child receipt on parent stdout for pytest oracles
console.log("PASS: compiler safety (delegated harness invoked compileWebsiteSpecToStaticHtml).");

console.log("PASS: Lane A11-S Static Website Builder contract verified.");
