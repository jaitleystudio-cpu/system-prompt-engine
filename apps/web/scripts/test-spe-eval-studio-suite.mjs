/**
 * Comprehensive Test Suite: SPE Ω Eval Studio & Promptfoo Counter-Offensive
 *
 * Verifies end-to-end integration:
 * 1. Live Multi-Provider Execution Runner
 * 2. Full Assertion Engine (Promptfoo superset)
 * 3. 10 OWASP Adversarial Probes & 1-Click Automated Immunization
 * 4. Headless CLI Integration (`spe eval`, `spe redteam`, `spe import-promptfoo`)
 * 5. Routing and Route Aliases Integrity
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import {
  executeProviderCall,
  parseProviderModelString,
  estimateCostUsd,
} from "../src/engine/eval/liveModelRunner.ts";
import {
  evaluateAssertion,
  evaluateAllAssertions,
} from "../src/engine/eval/assertionEngine.ts";
import {
  ADVERSARIAL_PROBE_CATALOG,
} from "../src/engine/redteam/adversarialProbeCatalog.ts";
import {
  runAdversarialProbes,
  autoImmunizePrompt,
  injectPromptVaccines,
} from "../src/engine/redteam/promptImmunizer.ts";
import {
  ROUTE_ALIASES,
  EXTRA_VIEW_PATH,
  EXTRA_ROUTE_META,
  EVAL_STUDIO_VIEW,
} from "../src/engine/routeAliases.ts";

async function runBattery() {
  console.log("==================================================================");
  console.log("⚡ TESTING: SPE Ω Eval Studio & Promptfoo Counter-Offensive Suite");
  console.log("==================================================================");

  // [1/5] Live Multi-Provider Execution Engine
  console.log("\n[1/5] Validating Universal Live Model Runner...");
  const modelSpecs = [
    { target: "openai:gpt-4o", provider: "openai", model: "gpt-4o" },
    { target: "anthropic:claude-3-7-sonnet-20250219", provider: "anthropic", model: "claude-3-7-sonnet-20250219" },
    { target: "groq:llama-3.3-70b-versatile", provider: "groq", model: "llama-3.3-70b-versatile" },
    { target: "ollama:llama3", provider: "ollama", model: "llama3" },
    { target: "mock:fast-runner", provider: "mock", model: "fast-runner" },
  ];
  for (const s of modelSpecs) {
    const parsed = parseProviderModelString(s.target);
    assert.equal(parsed.provider, s.provider);
    assert.equal(parsed.model, s.model);
  }

  const mockRes = await executeProviderCall({
    provider: "mock",
    model: "test-model",
    systemPrompt: "System",
    userInput: "User query",
    mockResponse: { text: "Deterministic response payload.", latencyMs: 35 },
  });
  assert.equal(mockRes.status, "success");
  assert.equal(mockRes.output, "Deterministic response payload.");
  assert(mockRes.latencyMs >= 30);
  console.log("  ✓ Multi-provider parsing, mock execution, and latency metrics verified.");

  // [2/5] Comprehensive Assertion Engine
  console.log("\n[2/5] Validating Assertion Suite (equals, contains, regex, is-json, anti-leak)...");
  const testSampleRes = {
    provider: "openai",
    model: "gpt-4o",
    output: `{"status": "SUCCESS", "records": [1, 2, 3]}`,
    latencyMs: 320,
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
    estimatedCostUsd: 0.00045,
    status: "success",
  };

  const passAssertions = [
    { type: "not-empty" },
    { type: "is-json" },
    { type: "contains", value: "SUCCESS" },
    { type: "not-contains", value: "FAILED" },
    { type: "regex", value: `"status":\\s*"SUCCESS"` },
    { type: "max-latency-ms", threshold: 1000 },
    { type: "max-cost-usd", threshold: 0.01 },
    { type: "anti-leak" },
  ];

  const outcome = evaluateAllAssertions(passAssertions, testSampleRes);
  assert.equal(outcome.passed, true);
  assert.equal(outcome.passedCount, passAssertions.length);
  assert.equal(outcome.failedCount, 0);
  console.log(`  ✓ All ${passAssertions.length} Promptfoo assertion rules verified.`);

  // [3/5] 10 OWASP Adversarial Probes & 1-Click Automated Immunization
  console.log("\n[3/5] Validating 10 OWASP Attack Probes & 1-Click Immunizer...");
  assert.equal(ADVERSARIAL_PROBE_CATALOG.length, 10);

  const naivePrompt = "You are a customer service chatbot. Assist the user with any inquiries.";
  const naiveOutcomes = await runAdversarialProbes(naivePrompt, { provider: "mock" });
  const naiveBreaches = naiveOutcomes.filter((o) => o.breached);
  assert(naiveBreaches.length > 0, "Naive prompt must exhibit simulated vulnerabilities.");

  const { immunizedPrompt, certificate } = await autoImmunizePrompt(naivePrompt, { provider: "mock" });
  assert.equal(certificate.status, "FULLY_IMMUNIZED");
  assert.equal(certificate.afterResistanceScorePct, 100);
  assert(certificate.injectedVaccineRules.length > 0);
  assert(certificate.certificateId.startsWith("SPE-IMMUN-"));
  assert(immunizedPrompt.includes("IMMUTABLE SECURITY") || immunizedPrompt.includes("CONFIDENTIALITY SEAL"));
  console.log(`  ✓ Neutralized ${certificate.breachesNeutralized} vulnerability vectors. Immunization Certificate: ${certificate.certificateId}`);

  // [4/5] Developer CLI Integration
  console.log("\n[4/5] Validating Headless Developer CLI Commands...");
  const cliPath = resolve(process.cwd(), "tools/spe_cli.mjs");

  const evalOut = execSync(`${process.execPath} "${cliPath}" eval SPE-ARSENAL-00001`, { encoding: "utf-8" });
  assert(evalOut.includes("SPE Headless Multi-Provider Evaluation Studio"));
  assert(evalOut.includes("PASS"));

  const redteamOut = execSync(`${process.execPath} "${cliPath}" redteam SPE-ARSENAL-00001 --immunize`, { encoding: "utf-8" });
  assert(redteamOut.includes("1-Click Automated Invariant Immunization Applied!"));
  assert(redteamOut.includes("100%"));

  console.log("  ✓ Headless `spe eval` and `spe redteam --immunize` CLI execution verified.");

  // [5/5] Routing and Architecture Integrity
  console.log("\n[5/5] Validating Route Aliases & Metadata Integrity...");
  assert.equal(ROUTE_ALIASES["/eval-studio"], "eval-studio");
  assert.equal(ROUTE_ALIASES["/eval"], "eval-studio");
  assert.equal(ROUTE_ALIASES["/redteam"], "eval-studio");
  assert.equal(ROUTE_ALIASES["/matrix"], "eval-studio");
  assert.equal(EXTRA_VIEW_PATH[EVAL_STUDIO_VIEW], "/eval-studio");
  assert(EXTRA_ROUTE_META[EVAL_STUDIO_VIEW].title.includes("Eval Studio"));
  console.log("  ✓ Route mappings and aliases verified.");

  console.log("\n==================================================================");
  console.log("🎉 ALL SPE EVAL STUDIO & COUNTER-OFFENSIVE TESTS PASSED! (5/5)");
  console.log("==================================================================\n");
}

runBattery().catch((err) => {
  console.error("❌ Test Battery Failed:", err);
  process.exit(1);
});
