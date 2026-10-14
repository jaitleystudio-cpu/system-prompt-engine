#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("==================================================================");
console.log("👁️ [Web Runtime] Testing PromptCard VLM Reverse-Engineering Engine...");
console.log("==================================================================");

// Build bundle for promptcardVlmEngine.ts
const bundle = await build({
  entryPoints: [join(root, "src/engine/promptcardVlmEngine.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const engine = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 1. Verify Entitlement Gating
console.log("[1/4] Verifying Entitlement Gating (FREE vs Paid Tiers)...");
assert.equal(engine.canAccessPromptcardVlm("FREE"), false, "FREE tier must not have access");
assert.equal(engine.canAccessPromptcardVlm("PRO"), true, "PRO tier must have access");
assert.equal(engine.canAccessPromptcardVlm("TEAM"), true, "TEAM tier must have access");
assert.equal(engine.canAccessPromptcardVlm("ENTERPRISE"), true, "ENTERPRISE tier must have access");
assert.equal(engine.canAccessPromptcardVlm("FREE", "SPE_LIC_PRO_AIRGAP_VALID"), true, "Valid license key unlocks access");

assert.throws(
  () => {
    engine.deconstructImageOffline({ customerTier: "FREE" });
  },
  {
    message: /PromptCard VLM reverse-engineering requires an active PRO, TEAM, or ENTERPRISE subscription/,
  },
  "FREE tier must throw entitlement error"
);
console.log("  ✓ Entitlement gating and license enforcement verified.");

// 2. Verify 12-Clause Semicolon Inversion
console.log("[2/4] Testing 12-Clause Semicolon Inversion on GTA VI benchmark...");
const start = Date.now();
const item = engine.deconstructImageOffline({
  customerTier: "PRO",
  contextHint: "gta waterfront dock",
  aspectRatio: "16:9",
});
const elapsedMs = Date.now() - start;

assert.equal(item.status, "completed");
assert.equal(item.mode, "OFFLINE_DETERMINISTIC");
assert.equal(item.inferenceCostUsd, 0.0, "$0.00 cloud inference bill requirement satisfied");

const clauses = item.prompts.en.split(";").map((c) => c.trim());
assert.ok(clauses.length >= 12, `Expected >= 12 clauses, got ${clauses.length}`);
assert.ok(clauses[0].includes("tropical coast wooden dock"), "Clause 1 must specify ground plane");
assert.ok(clauses.some((c) => c.includes("woman on the left")), "Clause 2 must specify subjects");
assert.ok(clauses.some((c) => c.includes("dominant colors:")), "Clause 9 must specify colors");
assert.ok(clauses.some((c) => c.includes("materials:")), "Clause 10 must specify materials");
assert.ok(clauses.some((c) => c.includes("16:9 aspect ratio")), "Clause 11 must specify aspect ratio");
assert.ok(clauses.some((c) => c.includes("intended as promotional game art for GTA VI")), "Clause 12 must specify purpose");
console.log(`  ✓ 12-Clause Semicolon Inversion verified (took ${elapsedMs}ms).`);

// 3. Verify 4 Style Tag Pills
console.log("[3/4] Testing 4 Style Tag Pills...");
assert.equal(item.tags.length, 4, "Must return exactly 4 style tags");
assert.deepEqual(item.tags, [
  "high illustration",
  "comic line art",
  "urban crime vibe",
  "game promo art",
]);
console.log("  ✓ 4 Style Tag Pills verified:", item.tags.join(", "));

// 4. Verify Multilingual Parity & Structured JSON
console.log("[4/5] Testing Multilingual Parity & Structured JSON Schema...");
assert.ok(item.prompts.zh && item.prompts.zh.includes("热带海岸木质码头"));
assert.ok(item.prompts.ja && item.prompts.ja.includes("熱帯沿岸の木製桟橋"));

const sj = item.structured_json;
assert.ok(sj);
assert.equal(sj.setting, "tropical coast wooden dock");
assert.equal(sj.aspect_ratio, "16:9");
assert.ok(Array.isArray(sj.color_palette) && sj.color_palette.length >= 4);
assert.ok(Array.isArray(sj.materials_and_textures) && sj.materials_and_textures.length >= 4);
console.log("  ✓ Multilingual translations and JSON schema verified.");

// 5. Verify Section 20.A Fashion & Editorial Photography Mode
console.log("[5/5] Testing Section 20.A Fashion & Editorial Photography Mode...");
const fashionItem = engine.deconstructImageOffline({
  customerTier: "PRO",
  contextHint: "runway fashion couture editorial",
  aspectRatio: "4:5",
});
assert.equal(fashionItem.status, "completed");
const fClauses = fashionItem.prompts.en.split(";").map((c) => c.trim());
assert.ok(fClauses.length >= 12, "Must contain >= 12 clauses");
assert.ok(fClauses[0].includes("high-end minimalist studio"));
assert.ok(fClauses.some((c) => c.includes("sheer flowing organza")));
assert.ok(fClauses.some((c) => c.includes("85mm")));
assert.deepEqual(fashionItem.tags, ["haute couture", "studio editorial", "rim lighting", "fashion lookbook"]);
assert.ok(fashionItem.prompts.zh.includes("极简高端摄影棚"));
assert.ok(fashionItem.prompts.ja.includes("白ホリゾント"));
console.log("  ✓ Fashion & Editorial Photography mode verified.");

assert.ok(elapsedMs < 100, `Execution must be fast (<100ms), took ${elapsedMs}ms`);

console.log("==================================================================");
console.log("✅ Web Runtime PromptCard VLM Engine PASSED (100% SOUND)!");
console.log("==================================================================");
