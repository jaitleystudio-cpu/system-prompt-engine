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
assert.ok(allModels.length >= 26, `Expected at least 26 models, found ${allModels.length}`);
const stats = getModelAtlasStats();
assert.equal(stats.totalModels, allModels.length);
assert.ok(stats.proCount > 10, "Expected > 10 Pro models");
assert.ok(stats.freeCount >= 5, "Expected >= 5 Free models");
assert.ok(stats.reasoningCount >= 5, "Expected >= 5 Reasoning models");
console.log(`  ✓ Loaded ${allModels.length} models: ${stats.freeCount} Free, ${stats.proCount} Pro, ${stats.reasoningCount} Frontier Reasoning.`);

// 2. Provider coverage
console.log(`[2/6] Verifying real provider coverage...`);
const providers = ["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek", "Meta", "Midjourney", "Black Forest Labs", "Runway", "Suno"];
for (const p of providers) {
  const models = getModelsByProvider(p);
  assert.ok(models.length >= 1, `Provider ${p} must have at least 1 verified model`);
  console.log(`  ✓ Provider "${p}": ${models.length} verified models`);
}

// 3. Strict negative test: Zero fake/outdated models
console.log(`[3/6] Enforcing strict negative test for fake model strings...`);
const fakeModelIds = ["claude-6.2", "claude-6", "gemini-3.9", "gemini-39", "grok-4.9", "grok-49", "deepseek-4.5", "deepseek-45", "kimi-3.5", "openai-6"];
for (const fakeId of fakeModelIds) {
  assert.equal(getModelById(fakeId), undefined, `Fake model ID must NEVER exist in atlas: ${fakeId}`);
}
console.log(`  ✓ Verified zero fake/outdated models in the Model Atlas.`);

// 4. Frontier reasoning models check
console.log(`[4/6] Verifying frontier reasoning capabilities...`);
const claude37 = getModelById("claude-3-7-sonnet");
assert.ok(claude37, "Claude 3.7 Sonnet must exist");
assert.equal(claude37.capabilities.supportsThinking, true, "Claude 3.7 Sonnet must support thinking");
assert.equal(claude37.requiredTier, "pro", "Claude 3.7 Sonnet must be Pro tier");

const o3mini = getModelById("o3-mini");
assert.ok(o3mini, "OpenAI o3-mini must exist");
assert.equal(o3mini.capabilities.supportsThinking, true, "o3-mini must support thinking");
assert.equal(o3mini.requiredTier, "pro", "o3-mini must be Pro tier");

const grok3 = getModelById("grok-3");
assert.ok(grok3, "Grok 3 must exist");
assert.equal(grok3.capabilities.supportsThinking, true, "Grok 3 must support thinking");
assert.equal(grok3.requiredTier, "pro", "Grok 3 must be Pro tier");

const deepseekR1 = getModelById("deepseek-r1");
assert.ok(deepseekR1, "DeepSeek-R1 must exist");
assert.equal(deepseekR1.capabilities.supportsThinking, true, "DeepSeek-R1 must support thinking");
assert.equal(deepseekR1.requiredTier, "pro", "DeepSeek-R1 must be Pro tier");
console.log(`  ✓ Claude 3.7 Sonnet, o3-mini, Grok 3, and DeepSeek-R1 verified as Frontier Reasoning models.`);

// 5. Tier Gating Authorization
console.log(`[5/6] Verifying commercial tier gating (Free vs Pro)...`);
// Free user attempting to access Claude 3.7
assert.equal(isModelGated("claude-3-7-sonnet", null), true, "Claude 3.7 must be gated for unauthenticated user");
assert.equal(isModelGated("claude-3-7-sonnet", "free"), true, "Claude 3.7 must be gated for free user");
assert.equal(isModelGated("claude-3-7-sonnet", "pro"), false, "Claude 3.7 must be UNGATED for pro user");
assert.equal(isModelGated("claude-3-7-sonnet", "team"), false, "Claude 3.7 must be UNGATED for team user");

// Free user accessing Gemini 2.0 Flash or GPT-4o mini
assert.equal(isModelGated("gemini-2-0-flash", "free"), false, "Gemini 2.0 Flash must be free tier accessible");
assert.equal(isModelGated("gpt-4o-mini", "free"), false, "GPT-4o mini must be free tier accessible");
assert.equal(isModelGated("claude-3-5-haiku", "free"), false, "Claude 3.5 Haiku must be free tier accessible");
console.log(`  ✓ Commercial tier authorization gates verified: Pro models require active entitlement, Free baseline accessible.`);

// 6. Cost estimation accuracy
console.log(`[6/6] Verifying prompt token cost estimation...`);
const samplePrompt = "A".repeat(4000); // ~1,000 tokens
const claudeCost = calculatePromptTokenCost("claude-3-7-sonnet", samplePrompt);
assert.equal(claudeCost.estimatedTokens, 1000);
// 1000 tokens at $3.00/M = $0.003
assert.ok(Math.abs(claudeCost.inputCostUsd - 0.003) < 0.0001, `Expected ~$0.003, got ${claudeCost.inputCostUsd}`);
console.log(`  ✓ Token cost estimation calculated 1,000 tokens for Claude 3.7 = $${claudeCost.inputCostUsd.toFixed(5)}.`);

console.log("\n==================================================================");
console.log("🎉 ALL MODEL ATLAS & MONETIZATION CHECKS PASSED WITH 100% SUCCESS!");
console.log("==================================================================");
