#!/usr/bin/env node
/**
 * Lane A11-S: Static Website Builder UI Qualification Harness
 * Enforces:
 * - Consumption of G13 WebsiteSpec (website-spec/1)
 * - Visible disclosure of the 4 mandatory boundaries:
 *   AI generation = NOT AVAILABLE
 *   3D = NOT AVAILABLE
 *   sandbox = UNSUPPORTED
 *   hosted publish = HOLD
 * - Viewport switcher (Desktop/Tablet/Mobile 360px)
 * - CSS touch targets (>= 44px) & focus rings
 * - Route isolation (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

console.log("Checking website-spec/1 schema invariants...");
const modelText = fs.readFileSync(path.join(webRoot, "src/builder/websiteSpecModel.ts"), "utf8");
assert(modelText.includes('spec_version: "website-spec/1"'), "Must specify spec_version website-spec/1");
assert(modelText.includes('"hero"'), "Must support hero section kind");
assert(modelText.includes('"prose"'), "Must support prose section kind");
assert(modelText.includes('"list"'), "Must support list section kind");
assert(modelText.includes('"cta"'), "Must support cta section kind");

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

console.log("Checking 3D Wireframe Emulation and Fallback...");
assert(viewText.includes("WireframeCanvasPreview"), "StaticWebsiteBuilder must define WireframeCanvasPreview");
assert(viewText.includes("3D Wireframe Fallback"), "StaticWebsiteBuilder must offer 3D Wireframe Fallback toggle");
assert(viewText.includes("2D Wireframe Preview rendered via Canvas / WebGL fallback"), "StaticWebsiteBuilder must disclose 2D wireframe canvas fallback");
assert(cssText.includes(".bld-wireframe-container"), "static-builder.css must style .bld-wireframe-container");
assert(cssText.includes(".bld-wireframe-canvas"), "static-builder.css must style .bld-wireframe-canvas");

console.log("Checking Route Mount isolation...");
assert(modelText.includes('ROUTE_MOUNT_STATUS = "NOT_INTEGRATED"'), "ROUTE_MOUNT_STATUS must be NOT_INTEGRATED");
const appTsx = fs.readFileSync(path.join(webRoot, "src/App.tsx"), "utf8");
assert(!appTsx.includes("StaticWebsiteBuilder"), "StaticWebsiteBuilder must not be eagerly mounted in App.tsx");

console.log("PASS: Lane A11-S Static Website Builder contract verified.");

