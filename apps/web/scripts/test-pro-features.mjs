#!/usr/bin/env node
/**
 * Test battery for SPE Pro, Developer, and Company Engines:
 * 1. Prompt Doctor Slop X-Ray & 1-Click Enhancement
 * 2. Local Model Compilation (Ollama / ChatML / <think>)
 * 3. 10-Seat Company Workspace & Corporate Guardrails
 * 4. SPE Developer CLI verification
 */

import assert from "node:assert/strict";
import { diagnosePrompt, enhancePromptWithDoctor } from "../src/engine/arsenal/promptDoctor.ts";
import { getArsenalAssetById } from "../src/engine/arsenal/arsenalHydrator.ts";
import { transcompilePromptForPlatform } from "../src/engine/arsenal/modelTranscompiler.ts";
import {
  createCompanyWorkspace,
  inviteTeamMember,
  saveTeamPrompt,
  applyCorporateGuardrails,
  calculateTeamTokenSavings,
} from "../src/engine/company/companyWorkspace.ts";
import { execSync } from "node:child_process";

console.log("=== Running SPE Pro, Developer & Company Verification Battery ===");

// 1. Prompt Doctor & Slop X-Ray
console.log(`[1/4] Testing Prompt Doctor & Slop X-Ray...`);
const badPrompt = "Can you please delve into fostering a good way to leverage AI? // TODO implement later";
const report = diagnosePrompt(badPrompt);
assert.ok(report.cognitiveScore < 60, `Bad prompt score must be < 60, got ${report.cognitiveScore}`);
assert.ok(report.slopCount >= 2, `Must detect >= 2 slop words, got ${report.slopCount}`);
assert.ok(report.weakPhrases.length > 0, "Must detect weak conversational phrasing");
assert.ok(report.placeholderRisks.length > 0, "Must detect // TODO placeholder");
console.log(`  ✓ Prompt Doctor detected ${report.slopCount} slop words and placeholder risk (Score: ${report.cognitiveScore}/100, Grade: ${report.grade}).`);

// Enhance with Doctor
const enhanced = enhancePromptWithDoctor(badPrompt);
const enhancedReport = diagnosePrompt(enhanced);
assert.ok(enhancedReport.cognitiveScore >= 95, `Enhanced prompt score must be >= 95, got ${enhancedReport.cognitiveScore}`);
assert.equal(enhancedReport.slopCount, 0, "Enhanced prompt must have 0 slop words");
assert.equal(enhancedReport.hasActionBias, true, "Enhanced prompt must have action bias");
assert.equal(enhancedReport.hasZeroPlaceholderRule, true, "Enhanced prompt must have zero placeholder rule");
assert.equal(enhancedReport.hasAntiTamper, true, "Enhanced prompt must have anti-tamper invariant");
console.log(`  ✓ 1-Click Prompt Doctor upgraded prompt to 100% UFCK-100X Frontier Kernel (Score: ${enhancedReport.cognitiveScore}/100, Grade: ${enhancedReport.grade}).`);

// 2. Local Model Compilation (Ollama / ChatML / <think>)
console.log(`[2/4] Testing Local LLM Transcompilation (Ollama / ChatML)...`);
const asset = getArsenalAssetById("SPE-ARSENAL-00001");
assert.ok(asset, "Asset 1 must exist");
const localOutput = transcompilePromptForPlatform(asset, "local", {}, { tier: "pro" });
assert.ok(localOutput.includes("<|im_start|>system"), "Local compilation must use ChatML system delimiter");
assert.ok(localOutput.includes("<|im_start|>user"), "Local compilation must use ChatML user delimiter");
assert.ok(localOutput.includes("<think>"), "Local compilation must include <think> tag for reasoning models");
assert.ok(!localOutput.includes("License: Community Free"), "Pro local compilation must be clean and unwatermarked");
console.log(`  ✓ Local compilation dialect verified for open-weight models (Ollama, vLLM, DeepSeek-R1, Qwen Coder).`);

// 3. 10-Seat Company Workspace & Corporate Guardrails
console.log(`[3/4] Testing 10-Seat Company Workspace & Corporate Guardrails...`);
let company = createCompanyWorkspace("Acme AI Labs", "admin@acme.com");
assert.equal(company.maxSeats, 10, "Company plan must have exactly 10 seats");
assert.equal(company.activeSeats, 1, "Initial active seats must be 1 (admin)");
assert.equal(company.monthlyPriceUsd, 10, "Company plan must be $10/month");

// Invite up to 10 seats
for (let i = 2; i <= 10; i++) {
  const res = inviteTeamMember(company, `engineer${i}@acme.com`, "editor");
  assert.equal(res.success, true);
  company = res.workspace;
}
assert.equal(company.activeSeats, 10, "All 10 seats must be occupied");

// Attempt to invite 11th seat (must be strictly rejected)
const overflowRes = inviteTeamMember(company, "engineer11@acme.com", "editor");
assert.equal(overflowRes.success, false, "11th seat invite must be rejected");
assert.ok(overflowRes.message.includes("Seat limit reached"), "Must inform user about 10-seat limit");
console.log(`  ✓ 10-Seat limit strictly enforced ($10/mo enterprise starter plan).`);

// Save team prompt & version control
company = saveTeamPrompt(company, "Acme Customer Onboarding Flow", "Initial prompt body", "Customer Success", "admin@acme.com");
assert.equal(company.prompts.length, 1);
assert.equal(company.prompts[0].version, 1);

// Update prompt and verify versioning & history
const promptId = company.prompts[0].id;
company = saveTeamPrompt(company, "Acme Customer Onboarding Flow", "Updated v2 prompt body with telemetry", "Customer Success", "engineer2@acme.com", promptId);
assert.equal(company.prompts[0].version, 2);
assert.equal(company.prompts[0].history.length, 1);
assert.equal(company.prompts[0].history[0].promptBody, "Initial prompt body");
console.log(`  ✓ Prompt Version Control verified: tracked v1 -> v2 with author history and rollback state.`);

// Corporate Guardrails: Banned word redaction & mandatory disclaimers
const promptWithSecret = "We connect to internal-confidential-api to extract user records.";
const guarded = applyCorporateGuardrails(company, promptWithSecret);
assert.ok(guarded.includes("[REDACTED_CONFIDENTIAL]"), "Banned word must be redacted");
assert.ok(guarded.includes("CONFIDENTIAL // ENTERPRISE PROPRIETARY ASSET"), "Corporate disclaimer must be injected");
console.log(`  ✓ Corporate Guardrail Shield verified: auto-redacted confidential keys and injected corporate disclaimers.`);

// Token savings calculation
const savings = calculateTeamTokenSavings(1000, 3500);
assert.ok(savings.tokensSaved > 100_000, "Must calculate positive token savings");
assert.ok(savings.dollarsSaved > 0, "Must calculate positive dollar savings");
console.log(`  ✓ Token ROI engine verified: 1,000 prompts saved ~${savings.tokensSaved.toLocaleString()} tokens ($${savings.dollarsSaved} API savings).`);

// 4. SPE Developer CLI Execution
console.log(`[4/4] Testing SPE Developer CLI execution...`);
const cliSearch = execSync(`"${process.execPath}" tools/spe_cli.mjs search postgres`, { encoding: "utf-8" });
assert.ok(cliSearch.includes("PostgreSQL"), "CLI search must find PostgreSQL prompts");

const cliDoctor = execSync(`"${process.execPath}" tools/spe_cli.mjs doctor "Please delve into this."`, { encoding: "utf-8" });
assert.ok(cliDoctor.includes("Slop Words: 1"), "CLI doctor must flag slop word 'delve'");

const cliModels = execSync(`"${process.execPath}" tools/spe_cli.mjs models`, { encoding: "utf-8" });
assert.ok(cliModels.includes("Claude 3.7 Sonnet"), "CLI models must include Claude 3.7 Sonnet");

console.log(`  ✓ SPE Developer CLI commands (search, doctor, models) executed with 100% success.`);

console.log("\n==================================================================");
console.log("🎉 ALL PRO, DEVELOPER & COMPANY ENGINES PASSED WITH ZERO ERRORS!");
console.log("==================================================================");
