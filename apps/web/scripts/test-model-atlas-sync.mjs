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
const allModels = getAllModels();
assert.strictEqual(allModels.length, 26, "Model Atlas must contain all 26 verified models");

const claude37 = getModelById("claude-3-7-sonnet");
assert.ok(claude37, "Claude 3.7 Sonnet must exist in Model Atlas");
assert.strictEqual(claude37.capabilities.supportsThinking, true, "Claude 3.7 Sonnet must support reasoning/thinking");
assert.strictEqual(claude37.contextWindow, 200000, "Claude 3.7 Sonnet must have 200k context window");

const deepseekR1 = getModelById("deepseek-r1");
assert.ok(deepseekR1, "DeepSeek-R1 must exist in Model Atlas");
assert.strictEqual(deepseekR1.capabilities.supportsThinking, true, "DeepSeek-R1 must support reasoning");

const llama = getModelById("llama-3-3-70b");
assert.ok(llama, "Llama 3.3 70B must exist in Model Atlas");
assert.strictEqual(llama.requiredTier, "free", "Llama 3.3 70B must be accessible on free tier");
console.log("✓ Model Atlas query service verified across all providers and tiers!");

// 4. Automated Model Atlas Sync & Checksum Verification
console.log("\n4. Testing Automated CLI Model Atlas Sync & Bit-for-Bit Checksum...");
const checkOutput = execSync(`${process.execPath} tools/spe_cli.mjs atlas check`, { encoding: "utf-8" });
assert.ok(checkOutput.includes("VERIFIED (Bit-for-bit SHA-256 match)"), "Integrity status must be verified");
assert.ok(checkOutput.includes("26/26 models compliant with SATSS v1"), "All models must be compliant with SATSS v1");
console.log("✓ CLI atlas check passed bit-for-bit validation!");

console.log("\n========================================================");
console.log("🎉 ALL PROGRAMMATIC ROUTE & MODEL ATLAS TESTS PASSED!");
console.log("========================================================\n");
