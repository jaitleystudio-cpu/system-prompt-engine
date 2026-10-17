/**
 * Verification test for Programmatic SEO Dynamic Routes & Model Atlas Sync Engine
 */

import assert from "node:assert";
import { resolveRoute } from "../src/routing.ts";
import { getArsenalAssetById } from "../src/engine/arsenal/arsenalHydrator.ts";
import { transcompilePromptForPlatform } from "../src/engine/arsenal/modelTranscompiler.ts";
import { getAllModels, getModelById } from "../src/engine/modelAtlas/modelAtlasService.ts";
import { execSync } from "node:child_process";

console.log("Running Programmatic Route & Model Atlas Sync Verification Suite...\n");

// 1. Programmatic Route Resolution for Googlebot & Users
console.log("1. Testing Programmatic Route Resolution for /prompts/:id...");
const route1 = resolveRoute("/prompts/SPE-ARSENAL-00001");
assert.strictEqual(route1.kind, "view", "Route 00001 must resolve to view");
if (route1.kind === "view") {
  assert.strictEqual(route1.view, "prompts");
  assert.strictEqual(route1.canonicalPath, "/prompts/SPE-ARSENAL-00001");
}

const route10k = resolveRoute("/prompts/SPE-ARSENAL-10000");
assert.strictEqual(route10k.kind, "view", "Route 10000 must resolve to view");
if (route10k.kind === "view") {
  assert.strictEqual(route10k.view, "prompts");
  assert.strictEqual(route10k.canonicalPath, "/prompts/SPE-ARSENAL-10000");
}

const routeCatalog = resolveRoute("/prompts");
assert.strictEqual(routeCatalog.kind, "view");
if (routeCatalog.kind === "view") {
  assert.strictEqual(routeCatalog.view, "prompts");
  assert.strictEqual(routeCatalog.canonicalPath, "/prompts");
}
console.log("✓ Route resolution for programmatic prompt paths passed!");

// 2. Deep-Linked Asset Hydration & Transcompilation
console.log("\n2. Testing Deep-Linked Prompt Asset Hydration...");
const asset = getArsenalAssetById("SPE-ARSENAL-00042");
assert.ok(asset, "Asset SPE-ARSENAL-00042 must be hydratable on demand");
assert.ok(asset.title.length > 5, "Asset must have descriptive title");
assert.ok(asset.domain.length > 0, "Asset must have domain");
assert.ok(asset.subdomain.length > 0, "Asset must have subdomain");
assert.ok(asset.canonicalPrompt.length > 50, "Asset must have structured canonical prompt");

const claudeCompiled = transcompilePromptForPlatform(asset, "claude", {}, { tier: "free" });
assert.ok(claudeCompiled.includes("<operational_constraints>"), "Must compile to Claude XML format");

const localCompiled = transcompilePromptForPlatform(asset, "local", {}, { tier: "free" });
assert.ok(localCompiled.includes("<|im_start|>system"), "Must compile to ChatML for local Ollama/vLLM");
console.log(`✓ Hydrated asset [${asset.id}]: "${asset.title}" and verified transcompilation!`);

// 3. Model Atlas Service & Capabilities
console.log("\n3. Testing Model Atlas Service Integrity...");
const activeModels = getAllModels();
assert.strictEqual(activeModels.length, 18, "Model Atlas must contain strictly 18 active 2026 frontier models");
const allModels = getAllModels({ includeLegacy: true });
assert.strictEqual(allModels.length, 44, "Model Atlas must contain 44 total models with audit history");

const claude45 = getModelById("claude-4-5-sonnet");
assert.ok(claude45, "Claude 4.5 Sonnet must exist in Model Atlas");
assert.strictEqual(claude45.capabilities.supportsThinking, true, "Claude 4.5 Sonnet must support reasoning/thinking");
assert.strictEqual(claude45.contextWindow, 262144, "Claude 4.5 Sonnet must have 256k context window");

const upgradedClaude = getModelById("claude-3-7-sonnet");
assert.ok(upgradedClaude, "Claude 3.7 Sonnet must resolve via auto-upgrade");
assert.strictEqual(upgradedClaude.id, "claude-4-5-sonnet", "Claude 3.7 must auto-upgrade to Claude 4.5 Sonnet");

const deepseekR2 = getModelById("deepseek-r2");
assert.ok(deepseekR2, "DeepSeek-R2 must exist in Model Atlas");
assert.strictEqual(deepseekR2.capabilities.supportsThinking, true, "DeepSeek-R2 must support reasoning");

const llama4 = getModelById("llama-4-70b");
assert.ok(llama4, "Llama 4 70B must exist in Model Atlas");
assert.strictEqual(llama4.requiredTier, "free", "Llama 4 70B must be accessible on free tier");
console.log("✓ Model Atlas query service verified across all providers and tiers!");

// 4. Automated Model Atlas Sync & Checksum Verification
console.log("\n4. Testing Automated CLI Model Atlas Sync & Bit-for-Bit Checksum...");
const checkOutput = execSync(`${process.execPath} tools/spe_cli.mjs atlas check`, { encoding: "utf-8" });
assert.ok(checkOutput.includes("VERIFIED (Bit-for-bit SHA-256 match)"), "Integrity status must be verified");
assert.ok(checkOutput.includes("models compliant with SATSS v1"), "All models must be compliant with SATSS v1");
console.log("✓ CLI atlas check passed bit-for-bit validation!");

console.log("\n========================================================");
console.log("🎉 ALL PROGRAMMATIC ROUTE & MODEL ATLAS TESTS PASSED!");
console.log("========================================================\n");
