/**
 * Test Battery: SPE Prompt Performance Studio & Multimodal Prompt Arsenal
 * Verifies the 4 new multimodal prompt assets (Photography, 3D WebGL, SaaS Bento Grid, Video Motion),
 * multi-model transcompilation, variable substitution, and deterministic social proof telemetry.
 */

import assert from "node:assert/strict";
import { ARSENAL_CATALOG_ASSETS } from "../src/engine/arsenal/arsenalCatalogData.ts";
import { transcompilePromptForPlatform } from "../src/engine/arsenal/modelTranscompiler.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Prompt Performance Studio & Multimodal Arsenal");
console.log("==================================================================");

// [1/4] Verify Multimodal Assets in Catalog
console.log("\n[1/4] Verifying multimodal and visual prompt assets...");
const photoAsset = ARSENAL_CATALOG_ASSETS.find((a) => a.id === "SPE-ARSENAL-PHOTO-01");
const threeAsset = ARSENAL_CATALOG_ASSETS.find((a) => a.id === "SPE-ARSENAL-3D-01");
const uiAsset = ARSENAL_CATALOG_ASSETS.find((a) => a.id === "SPE-ARSENAL-UI-01");
const videoAsset = ARSENAL_CATALOG_ASSETS.find((a) => a.id === "SPE-ARSENAL-VIDEO-01");

assert.ok(photoAsset, "SPE-ARSENAL-PHOTO-01 must exist in catalog");
assert.equal(photoAsset.domain, "Image Generation");
assert.equal(photoAsset.modality, "image");
assert.ok(photoAsset.variables.length >= 4, "Photo asset must have at least 4 variables");

assert.ok(threeAsset, "SPE-ARSENAL-3D-01 must exist in catalog");
assert.equal(threeAsset.domain, "UI/UX & Web Design");
assert.equal(threeAsset.modality, "code");
assert.ok(threeAsset.variables.length >= 3, "3D asset must have at least 3 variables");

assert.ok(uiAsset, "SPE-ARSENAL-UI-01 must exist in catalog");
assert.equal(uiAsset.domain, "UI/UX & Web Design");
assert.equal(uiAsset.modality, "code");

assert.ok(videoAsset, "SPE-ARSENAL-VIDEO-01 must exist in catalog");
assert.equal(videoAsset.domain, "Video & Motion");
assert.equal(videoAsset.modality, "video");
console.log("  ✓ Verified 4 new multimodal assets (Photo, 3D WebGL, SaaS UI, Video Motion).");
console.log(`  ✓ Total assets in Universal Arsenal: ${ARSENAL_CATALOG_ASSETS.length}`);

// [2/4] Testing Dynamic Variable Substitution & Live Parameter Tuning
console.log("\n[2/4] Testing dynamic variable substitution in Performance Studio...");
const customVars = {
  subject: "Artisanal Japanese ceramic matcha bowl",
  material: "coarse black stoneware and gold kintsugi lacquer",
  lighting_mood: "single softbox top-down spotlight",
  color_palette: "deep charcoal with glistening metallic gold veins",
};

const compiledPhoto = transcompilePromptForPlatform(photoAsset, "midjourney", customVars);
assert.ok(compiledPhoto.includes("Artisanal Japanese ceramic matcha bowl"), "Substituted subject must appear in compiled output");
assert.ok(compiledPhoto.includes("gold kintsugi lacquer"), "Substituted material must appear in compiled output");
assert.ok(compiledPhoto.includes("--ar 9:16"), "Midjourney aspect ratio --ar 9:16 must be present");
assert.ok(compiledPhoto.includes("--v 6.1"), "Midjourney version --v 6.1 must be present");
console.log("  ✓ Photo asset variable substitution verified for Midjourney.");

const customThreeVars = {
  geometry_type: "Procedural mobius strip with dynamic geodesic subdivision",
  particle_count: "50000",
  color_scheme: "spectral iridescent neon violet to solar amber",
};
const compiledThree = transcompilePromptForPlatform(threeAsset, "cursor", customThreeVars, {
  wireframe: true,
  shaderType: "Physical PBR",
});
assert.ok(compiledThree.includes("Procedural mobius strip"), "Substituted 3D geometry must appear in Cursor rules");
assert.ok(compiledThree.includes("50000"), "Substituted particle count must appear in Cursor rules");
assert.ok(compiledThree.includes("globs: *"), "Must format as modern Cursor .mdc rule with YAML frontmatter");
assert.ok(compiledThree.includes("AGENTS.md Standard"), "Must reference AGENTS.md Standard");
assert.ok(compiledThree.includes("Wireframe mesh with Physical PBR shader"), "3D shader and wireframe controls must appear in compiled output");
console.log("  ✓ 3D WebGL asset variable substitution & live shader controls verified for Cursor.");

// [3/4] Testing Multi-Dialect Transcompilation Matrix
console.log("\n[3/4] Testing multi-dialect transcompilation across platforms...");
const claudeTrans = transcompilePromptForPlatform(photoAsset, "claude", customVars);
assert.ok(claudeTrans.includes("<purpose>"), "Claude dialect must include <purpose> tag");
assert.ok(claudeTrans.includes("<instructions>"), "Claude dialect must include <instructions> tag");
assert.ok(claudeTrans.includes("<verification_criteria>"), "Claude dialect must include <verification_criteria> tag");
console.log("  ✓ Claude XML dialect verified.");

const gptTrans = transcompilePromptForPlatform(photoAsset, "chatgpt", customVars);
assert.ok(gptTrans.includes("# System Role:"), "ChatGPT dialect must include # System Role");
assert.ok(gptTrans.includes("## Negative Constraints"), "ChatGPT dialect must include Negative Constraints");
console.log("  ✓ ChatGPT markdown dialect verified.");

const fluxTrans = transcompilePromptForPlatform(photoAsset, "flux", customVars, {
  aspectRatio: "16:9",
  aperture: "f/1.4",
  iso: "ISO 800",
});
assert.ok(fluxTrans.includes("Photo prompt:"), "FLUX dialect must format as photo prompt");
assert.ok(fluxTrans.includes("ultra-sharp, photorealistic"), "FLUX dialect must include sharpness tags");
assert.ok(fluxTrans.includes("aspect ratio 16:9"), "FLUX dialect must reflect live aspect ratio control");
assert.ok(fluxTrans.includes("f/1.4"), "FLUX dialect must reflect live aperture control");
assert.ok(fluxTrans.includes("ISO 800"), "FLUX dialect must reflect live ISO control");
console.log("  ✓ FLUX.2 pro dialect verified with live camera controls.");

const runwayTrans = transcompilePromptForPlatform(videoAsset, "runway", {}, {
  aspectRatio: "9:16",
  cameraMotion: "Dynamic orbiting crane motion with rising vertical push",
});
assert.ok(runwayTrans.includes("[Runway Gen-3 Alpha Video Motion Directive]"), "Runway dialect must include video header");
assert.ok(runwayTrans.includes("TEMPORAL DYNAMICS:"), "Runway dialect must include temporal dynamics");
assert.ok(runwayTrans.includes("FRAME RATIO: 9:16"), "Runway dialect must include live frame ratio");
assert.ok(runwayTrans.includes("Dynamic orbiting crane motion"), "Runway dialect must include live camera motion");
console.log("  ✓ Runway video motion directive verified with live aspect and trajectory controls.");

// [4/4] Validating Entitlement Gating, Quality Status Invariants & Zero Synthetic Telemetry
console.log("\n[4/4] Validating entitlement gating, quality status invariants & honest telemetry...");

// Test Entitlement Gating in Compiler
const freeTrans = transcompilePromptForPlatform(photoAsset, "claude", {}, {
  tier: "free",
  isWatermarkSuppressed: false,
});
assert.ok(freeTrans.includes("License: Community Free"), "Free tier compilation must include community license notice");
assert.ok(freeTrans.includes("Upgrade to SPE Pro"), "Free tier compilation must include viral upgrade link");

const proTrans = transcompilePromptForPlatform(photoAsset, "claude", {}, {
  tier: "pro",
  isWatermarkSuppressed: true,
});
assert.ok(!proTrans.includes("License: Community Free"), "Pro tier compilation must NOT include watermark footer");
assert.ok(!proTrans.includes("Upgrade to SPE Pro"), "Pro tier compilation must NOT include upgrade CTA");
console.log("  ✓ Entitlement gating verified: Free tier receives community watermark, Pro tier output is clean.");

// Verify Honest Quality Statuses Across Entire Arsenal
for (const asset of ARSENAL_CATALOG_ASSETS) {
  assert.equal(asset.qualityStatus, "STRUCTURE_VALIDATED", `Asset ${asset.id} must be honestly labeled as STRUCTURE_VALIDATED`);
  assert.ok(!asset.verificationCriteria.some((v) => v.includes("100% photorealism")), `Asset ${asset.id} must not claim unexecuted 100% photorealism`);
}
console.log(`  ✓ All ${ARSENAL_CATALOG_ASSETS.length} assets verified with honest STRUCTURE_VALIDATED engineering classification.`);

// Verify Live Optics Controls on Midjourney v6.1
const mjControlled = transcompilePromptForPlatform(photoAsset, "midjourney", customVars, {
  aspectRatio: "1:1",
  aperture: "f/1.8",
  iso: "ISO 400",
});
assert.ok(mjControlled.includes("--ar 1:1"), "Midjourney must reflect live aspect ratio 1:1");
assert.ok(mjControlled.includes("aperture f/1.8"), "Midjourney must reflect live aperture f/1.8");
assert.ok(mjControlled.includes("ISO 400"), "Midjourney must reflect live ISO 400");
assert.ok(mjControlled.includes("--v 6.1"), "Midjourney must consistently emit --v 6.1 matching studio platform");
console.log("  ✓ Midjourney v6.1 verified with live aperture, ISO, and aspect ratio controls.");

console.log("\n==================================================================");
console.log("🎉 ALL PROMPT PERFORMANCE STUDIO & MULTIMODAL TESTS PASSED!");
console.log("==================================================================");
