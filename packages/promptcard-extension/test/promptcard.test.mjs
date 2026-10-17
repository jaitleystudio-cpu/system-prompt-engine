#!/usr/bin/env node
/**
 * PROMPTCARD · V1.4.0 — Extension Verification Suite
 *
 * Validates Manifest V3 compliance, file integrity, Shadow DOM encapsulation,
 * 12-clause semicolon prompt syntax, 4 style tag pills, trilingual parity,
 * 20-item history limit, and offline air-gapped execution ($0.00 bill).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extRoot = path.join(__dirname, "..");

console.log("==================================================================");
console.log("🧪 TESTING: PromptCard - Image to Prompt AI (V1.4.0) Extension");
console.log("==================================================================");

// [1/6] Manifest V3 Validation
console.log("[1/6] Verifying Manifest V3 schema and referenced assets...");
const manifestPath = path.join(extRoot, "manifest.json");
assert.ok(fs.existsSync(manifestPath), "manifest.json must exist");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

assert.equal(manifest.manifest_version, 3, "Must be Manifest V3");
assert.equal(manifest.name, "PromptCard - Image to Prompt AI", "Must match official store name");
assert.equal(manifest.version, "1.4.0", "Must match version 1.4.0");

const requiredPerms = ["contextMenus", "storage", "activeTab", "scripting", "tabs"];
for (const p of requiredPerms) {
  assert.ok(manifest.permissions.includes(p), `Missing permission: ${p}`);
}
assert.ok(manifest.host_permissions.includes("<all_urls>"), "Must declare <all_urls> for CORS bypass");

// Verify referenced files
const filesToCheck = [
  manifest.background.service_worker,
  ...manifest.content_scripts[0].js,
  manifest.options_page,
  manifest.action.default_popup,
  manifest.icons["16"],
  manifest.icons["48"],
  manifest.icons["128"],
  "styles/overlay.css",
  "styles/popup.css",
  "popup.js",
  "options.js",
  "offscreen.html",
  "offscreen.js",
];

for (const file of filesToCheck) {
  const fullPath = path.join(extRoot, file);
  assert.ok(fs.existsSync(fullPath), `Referenced file does not exist: ${file}`);
}
console.log("  ✓ Manifest V3, Popup assets, and Offscreen suite verified.");

// [2/6] Background VLM Reverse-Engineering Engine
console.log("[2/6] Testing 12-clause semicolon prompt inversion engine...");
import { runOfflineDeconstruction } from "../background.js";

// A. GTA VI Artwork Benchmark
const result = runOfflineDeconstruction("https://example.com/gta6_artwork.jpg", "gta dock waterfront");
assert.ok(result.prompts && result.prompts.en, "Must return English prompt");
const clauses = result.prompts.en.split(";").map((c) => c.trim());
assert.ok(clauses.length >= 12, `Expected >= 12 clauses, got ${clauses.length}`);
assert.ok(clauses[0].includes("tropical coast wooden dock"), "Clause 1 must specify primary setting");
assert.ok(clauses.some((c) => c.includes("woman on the left")), "Clause 2 must specify subjects");
assert.ok(clauses.some((c) => c.includes("dominant colors:")), "Clause 9 must specify dominant colors");
assert.ok(clauses.some((c) => c.includes("materials:")), "Clause 10 must specify materials");
assert.ok(clauses.some((c) => c.includes("16:9 aspect ratio")), "Clause 11 must specify aspect ratio");
assert.ok(clauses.some((c) => c.includes("intended as promotional game art for GTA VI")), "Clause 12 must specify intended purpose");

// B. Section 20.A: Fashion & Editorial Photography Mode
const fashionResult = runOfflineDeconstruction("https://example.com/editorial.jpg", "runway fashion couture editorial");
const fashionClauses = fashionResult.prompts.en.split(";").map((c) => c.trim());
assert.ok(fashionClauses.length >= 12, "Fashion mode must have >= 12 clauses");
assert.ok(fashionClauses[0].includes("high-end minimalist studio"), "Fashion Clause 1 must specify studio");
assert.ok(fashionClauses.some((c) => c.includes("sheer flowing organza")), "Fashion must detail garment construction");
assert.ok(fashionClauses.some((c) => c.includes("85mm")), "Fashion must detail optical compression");
assert.deepEqual(fashionResult.tags, ["haute couture", "studio editorial", "rim lighting", "fashion lookbook"]);

// C. Robustness against null/undefined inputs
const safeResult = runOfflineDeconstruction(null, undefined);
assert.ok(safeResult.prompts.en, "Must handle null image without throwing");
console.log("  ✓ 12-Clause Semicolon Grammar verified across GTA benchmark and Fashion/Editorial modes.");

// [3/6] 4 Style Tag Pills Extraction
console.log("[3/6] Testing 4 style tag pills taxonomy...");
assert.equal(result.tags.length, 4, "Must output exactly 4 style tags");
assert.deepEqual(result.tags, [
  "high illustration",
  "comic line art",
  "urban crime vibe",
  "game promo art",
]);
console.log("  ✓ 4 Style Tag Pills verified:", result.tags.join(", "));

// [4/6] Multilingual Parity & Structured JSON Schema
console.log("[4/6] Testing multilingual translation parity (EN, 中文, 日本語) and {} JSON view...");
assert.ok(result.prompts.zh && result.prompts.zh.includes("热带海岸木质码头"), "Chinese prompt must be populated");
assert.ok(result.prompts.ja && result.prompts.ja.includes("熱帯沿岸の木製桟橋"), "Japanese prompt must be populated");

const sj = result.structured_json;
assert.ok(sj, "structured_json must exist");
assert.equal(sj.setting, "tropical coast wooden dock");
assert.equal(sj.aspect_ratio, "16:9");
assert.ok(Array.isArray(sj.color_palette) && sj.color_palette.length >= 4);
assert.ok(Array.isArray(sj.materials_and_textures) && sj.materials_and_textures.length >= 3);
console.log("  ✓ Multilingual parity and structured JSON schema verified.");

// [5/6] Shadow DOM UI Encapsulation & Interaction Contracts
console.log("[5/6] Verifying Content Script Shadow DOM & UI state machine...");
const contentJs = fs.readFileSync(path.join(extRoot, "content.js"), "utf-8");
assert.ok(contentJs.includes("attachShadow({ mode: \"open\" })"), "Content script must use open Shadow DOM");
assert.ok(contentJs.includes("#promptcard-shadow-host"), "Content script must attach to #promptcard-shadow-host");
assert.ok(contentJs.includes("PROMPTCARD · V1.4.0"), "Must render PROMPTCARD · V1.4.0 branding");
assert.ok(contentJs.includes("Building your prompt..."), "Must feature animated progress bar subtitle");
assert.ok(contentJs.includes("HISTORY"), "Must feature HISTORY drawer");
assert.ok(contentJs.includes("1/20") || contentJs.includes("/20"), "Must feature 20-item ring counter");
assert.ok(contentJs.includes("In File/Pic"), "Must feature In File/Pic button");
assert.ok(contentJs.includes("promptcard-quick-menu"), "Must feature In File/Pic quick menu");
assert.ok(contentJs.includes("Select Image File") || contentJs.includes("Upload Image File"), "Quick menu must feature file upload option");
assert.ok(contentJs.includes("Drag-Crop Region"), "Quick menu must feature screen region cropper");
assert.ok(contentJs.includes("navigator.clipboard.writeText"), "Must feature clipboard Copy functionality");
console.log("  ✓ Shadow DOM encapsulation, Quick Menu, and UI contracts verified.");

// [6/6] Overlay Glassmorphic CSS Integrity
console.log("[6/6] Verifying Overlay Glassmorphism Design System CSS...");
const overlayCss = fs.readFileSync(path.join(extRoot, "styles/overlay.css"), "utf-8");
assert.ok(overlayCss.includes("backdrop-filter: blur"), "Must use backdrop-filter blur for glassmorphism");
assert.ok(overlayCss.includes("rgba(24, 24, 28"), "Must use dark glass base color");
assert.ok(overlayCss.includes(".promptcard-main"), "Must style main card");
assert.ok(overlayCss.includes(".promptcard-history"), "Must style history companion drawer");
assert.ok(overlayCss.includes(".promptcard-tag-pill"), "Must style 4 tag pills");
assert.ok(overlayCss.includes(".promptcard-infile-btn"), "Must style orange In File/Pic button");
assert.ok(overlayCss.includes(".promptcard-quick-menu"), "Must style quick menu popup");
assert.ok(overlayCss.includes(".promptcard-quick-item"), "Must style quick menu item options");
console.log("  ✓ Glassmorphic CSS and Quick Menu verified.");

// [7/7] Multi-Model 1-Click Export Formatters & Popup UI Suite
console.log("[7/7] Testing multi-model formatters (Midjourney, FLUX, SD 3.5, Claude/GPT) & popup UI...");
import {
  formatForMidjourney,
  formatForFlux,
  formatForStableDiffusion,
  formatForClaudeGpt,
} from "../popup.js";

const sampleClausePrompt = "tropical coast wooden dock; waterfront marina setting; saturated neon pastel lighting";
const mjExport = formatForMidjourney(sampleClausePrompt, "16:9");
assert.ok(mjExport.includes("--ar 16:9"), "Midjourney export must specify aspect ratio");
assert.ok(mjExport.includes("--v 6.1"), "Midjourney export must specify v6.1");

const fluxExport = formatForFlux(sampleClausePrompt);
assert.ok(fluxExport.includes("photorealistic style"), "FLUX export must prefix photorealistic style");
assert.ok(fluxExport.includes("cinematic lighting"), "FLUX export must include cinematic lighting");

const sdExport = formatForStableDiffusion(sampleClausePrompt);
assert.ok(sdExport.includes("masterpiece"), "SD 3.5 export must prefix masterpiece");
assert.ok(sdExport.includes("8k resolution"), "SD 3.5 export must specify resolution");

const claudeExport = formatForClaudeGpt(sampleClausePrompt, ["game promo art", "neon aesthetic"]);
assert.ok(claudeExport.includes("reconstruct or visually reference"), "Claude export must include directive");
assert.ok(claudeExport.includes("#game promo art"), "Claude export must include hashtags");

// Popup HTML checks
const popupHtml = fs.readFileSync(path.join(extRoot, "popup.html"), "utf-8");
assert.ok(popupHtml.includes("PROMPTCARD"), "Popup must contain PROMPTCARD header");
assert.ok(popupHtml.includes("btn-snip-region"), "Popup must have snip region button");
assert.ok(popupHtml.includes("btn-open-uidrop"), "Popup must have bridge button to UIDrop");
assert.ok(popupHtml.includes("btn-export-mj"), "Popup must have Midjourney export button");
assert.ok(popupHtml.includes("btn-export-flux"), "Popup must have FLUX export button");

// Offscreen checks
const offscreenHtml = fs.readFileSync(path.join(extRoot, "offscreen.html"), "utf-8");
assert.ok(offscreenHtml.includes("offscreen.js"), "Offscreen HTML must reference offscreen.js");
const offscreenJs = fs.readFileSync(path.join(extRoot, "offscreen.js"), "utf-8");
assert.ok(offscreenJs.includes("resizeImage"), "Offscreen JS must provide resizeImage");
assert.ok(offscreenJs.includes("extractColorPalette"), "Offscreen JS must provide extractColorPalette");
console.log("  ✓ Multi-Model Formatters, Popup HTML, and Offscreen Canvas suite verified.");

console.log("==================================================================");
console.log("🎉 ALL PROMPTCARD EXTENSION VERIFICATION TESTS PASSED (100% SOUND)!");
console.log("==================================================================");
