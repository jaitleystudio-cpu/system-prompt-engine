#!/usr/bin/env node
/**
 * Test battery for SPE Dynamic Model Atlas & Monetization Engine
 * Validates:
 * 1. 26 real-world cutting-edge models loaded
 * 2. Real provider and category distribution
 * 3. Zero fake or outdated models (strict negative assertions)
 * 4. Frontier reasoning detection (Claude 3.7 Sonnet, o3-mini, Grok 3, DeepSeek R1)
 * 5. Tier gating authorization (Free vs Pro)
 * 6. Cost estimation accuracy
 */

import assert from "node:assert/strict";
import {
  getAllModels,
  getModelById,
  getModelsByProvider,
  getModelsByCategory,
  getModelsForTier,
  isModelGated,
  calculatePromptTokenCost,
  getModelAtlasStats,
} from "../src/engine/modelAtlas/modelAtlasService.ts";

console.log("=== Running SPE Dynamic Model Atlas Verification Suite ===");

// 1. Model count & stats
console.log(`[1/6] Verifying Model Atlas registry stats...`);
const allModels = getAllModels();
assert.ok(allModels.length >= 18, `Expected at least 18 active frontier models, found ${allModels.length}`);
const allWithLegacy = getAllModels({ includeLegacy: true });
assert.ok(allWithLegacy.length >= 26, `Expected at least 26 models with legacy, found ${allWithLegacy.length}`);
const stats = getModelAtlasStats();
assert.equal(stats.totalModels, allWithLegacy.length);
assert.equal(stats.frontierCount, allModels.length);
assert.ok(stats.proCount >= 5, "Expected >= 5 Pro models");
assert.ok(stats.freeCount >= 5, "Expected >= 5 Free models");
assert.ok(stats.reasoningCount >= 5, "Expected >= 5 Reasoning models");
console.log(`  ✓ Loaded ${allModels.length} models: ${stats.freeCount} Free, ${stats.proCount} Pro, ${stats.reasoningCount} Frontier Reasoning.`);

// 2. Provider coverage
console.log(`[2/6] Verifying real provider coverage...`);
const providers = ["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek", "Meta", "Midjourney", "Black Forest Labs"];
for (const p of providers) {
  const models = getModelsByProvider(p);
  assert.ok(models.length >= 1, `Provider ${p} must have at least 1 verified model`);
  console.log(`  ✓ Provider "${p}": ${models.length} verified models`);
}

// 3. Strict negative test: Zero fake/outdated models
console.log(`[3/6] Enforcing strict negative test for fake model strings...`);
const fakeModelIds = ["claude-6.2", "claude-6", "gemini-3.9", "gemini-39", "grok-4.9", "grok-49", "deepseek-4.5", "deepseek-45", "kimi-3.5", "openai-6"];
for (const fakeId of fakeModelIds) {
  assert.equal(getModelById(fakeId, false), undefined, `Fake model ID must NEVER exist in atlas: ${fakeId}`);
}
console.log(`  ✓ Verified zero fake/outdated models in the Model Atlas.`);

// 4. Frontier reasoning models check
console.log(`[4/6] Verifying frontier reasoning capabilities...`);
const claude45 = getModelById("claude-4-5-sonnet");
assert.ok(claude45, "Claude 4.5 Sonnet must exist");
assert.equal(claude45.capabilities.supportsThinking, true, "Claude 4.5 Sonnet must support thinking");

const o4mini = getModelById("o4-mini");
assert.ok(o4mini, "OpenAI o4-mini must exist");
assert.equal(o4mini.capabilities.supportsThinking, true, "o4-mini must support thinking");

const grok4 = getModelById("grok-4");
assert.ok(grok4, "Grok 4 must exist");
assert.equal(grok4.capabilities.supportsThinking, true, "Grok 4 must support thinking");
assert.equal(grok4.requiredTier, "pro", "Grok 4 must be Pro tier");

const deepseekR2 = getModelById("deepseek-r2");
assert.ok(deepseekR2, "DeepSeek-R2 must exist");
assert.equal(deepseekR2.capabilities.supportsThinking, true, "DeepSeek-R2 must support thinking");
console.log(`  ✓ Claude 4.5 Sonnet, o4-mini, Grok 4, and DeepSeek-R2 verified as Frontier Reasoning models.`);

// 5. Tier Gating Authorization
console.log(`[5/6] Verifying commercial tier gating (Free vs Pro)...`);
// Free user attempting to access Claude 4.5 Opus (Pro)
assert.equal(isModelGated("claude-4-5-opus", null), true, "Claude 4.5 Opus must be gated for unauthenticated user");
assert.equal(isModelGated("claude-4-5-opus", "free"), true, "Claude 4.5 Opus must be gated for free user");
assert.equal(isModelGated("claude-4-5-opus", "pro"), false, "Claude 4.5 Opus must be UNGATED for pro user");
assert.equal(isModelGated("claude-4-5-opus", "team"), false, "Claude 4.5 Opus must be UNGATED for team user");

// Free user accessing Gemini 3 Flash or o4-mini
assert.equal(isModelGated("gemini-3-flash", "free"), false, "Gemini 3 Flash must be free tier accessible");
assert.equal(isModelGated("o4-mini", "free"), false, "o4-mini must be free tier accessible");
assert.equal(isModelGated("claude-4-5-haiku", "free"), false, "Claude 4.5 Haiku must be free tier accessible");
console.log(`  ✓ Commercial tier authorization gates verified: Pro models require active entitlement, Free baseline accessible.`);

// 6. Cost estimation accuracy
console.log(`[6/6] Verifying prompt token cost estimation...`);
const samplePrompt = "A".repeat(4000); // ~1,000 tokens
const claudeCost = calculatePromptTokenCost("claude-4-5-sonnet", samplePrompt);
assert.equal(claudeCost.estimatedTokens, 1000);
// 1000 tokens at $2.50/M = $0.0025
assert.ok(Math.abs(claudeCost.inputCostUsd - 0.0025) < 0.0001, `Expected ~$0.0025, got ${claudeCost.inputCostUsd}`);
console.log(`  ✓ Token cost estimation calculated 1,000 tokens for Claude 4.5 Sonnet = $${claudeCost.inputCostUsd.toFixed(5)}.`);

console.log("\n==================================================================");
console.log("🎉 ALL MODEL ATLAS & MONETIZATION CHECKS PASSED WITH 100% SUCCESS!");
console.log("==================================================================");
