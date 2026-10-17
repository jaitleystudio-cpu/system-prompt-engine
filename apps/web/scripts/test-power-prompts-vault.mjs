#!/usr/bin/env node
/**
 * Test Suite: SPE Power Prompts Vault & 1-Click Compilation
 * Verifies that all power prompts in the vault compile cleanly,
 * preserve invariants, bind all dynamic variables, and support target frontier models.
 */

import assert from "node:assert/strict";
import {
  POWER_PROMPTS_VAULT,
  compilePowerPrompt,
} from "../src/engine/powerPromptsCatalog.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Power Prompts Vault & 1-Click Compilation Suite");
console.log("==================================================================");

// 1. Verify Catalog Integrity
console.log(`\n[1/3] Verifying power prompts catalog (${POWER_PROMPTS_VAULT.length} prompts)...`);
assert(POWER_PROMPTS_VAULT.length >= 8, "Must contain at least 8 power prompts");

const categories = new Set(POWER_PROMPTS_VAULT.map((p) => p.category));
assert(categories.has("SEO"), "Must contain SEO category");
assert(categories.has("Marketing"), "Must contain Marketing category");
assert(categories.has("Coding"), "Must contain Coding category");
assert(categories.has("Business"), "Must contain Business category");
assert(categories.has("Writing"), "Must contain Writing category");
console.log(`✓ Verified ${POWER_PROMPTS_VAULT.length} prompts across ${categories.size} categories.`);

// 2. Test Variable Compilation & Template Substitution
console.log("\n[2/3] Testing template compilation and variable replacement...");
for (const prompt of POWER_PROMPTS_VAULT) {
  assert(prompt.id, "Prompt must have ID");
  assert(prompt.title, "Prompt must have title");
  assert(prompt.tagline, "Prompt must have tagline");
  assert(prompt.outcome, "Prompt must define human outcome");
  assert(prompt.targetModels.length > 0, "Prompt must target at least one frontier model");

  // Compile with default values
  const compiledDefault = compilePowerPrompt(prompt, {});
  assert(compiledDefault.length > 50, "Compiled prompt must have content");

  // Compile with custom values
  const customVars = {};
  for (const v of prompt.variables) {
    customVars[v.name] = `CUSTOM_${v.name.toUpperCase()}`;
  }
  const compiledCustom = compilePowerPrompt(prompt, customVars);

  for (const v of prompt.variables) {
    assert(
      compiledCustom.includes(`CUSTOM_${v.name.toUpperCase()}`),
      `Compiled prompt ${prompt.id} must contain replaced value for ${v.name}`
    );
    assert(
      !compiledCustom.includes(`{${v.name}}`),
      `Compiled prompt ${prompt.id} must not leave raw variable token {${v.name}}`
    );
  }

  console.log(`  ✓ [${prompt.id}] Target models: ${prompt.targetModels.join(", ")} | Vars: ${prompt.variables.length}`);
}

// 3. Test Invariant & Ban Words Enforcement
console.log("\n[3/3] Testing AI Fluff Bans and Invariant Directives...");
const humanizer = POWER_PROMPTS_VAULT.find((p) => p.id === "write-100-percent-humanizer");
assert(humanizer, "Must include 100% humanizer prompt");
assert(humanizer.template.includes("delve"), "Humanizer must ban 'delve'");
assert(humanizer.template.includes("tapestry"), "Humanizer must ban 'tapestry'");
console.log("✓ Invariant Fluff-Purge rules confirmed.");

console.log("\n🎉 ALL POWER PROMPTS VAULT TESTS PASSED!\n");
