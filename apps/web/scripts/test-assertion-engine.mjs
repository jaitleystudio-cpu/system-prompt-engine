/**
 * Test: SPE Assertion Engine
 */
import {
  evaluateAssertion,
  evaluateAllAssertions,
} from "../src/engine/eval/assertionEngine.ts";

async function main() {
  console.log("🚀 Testing SPE Comprehensive Assertion Engine...");

  const baseResponse = {
    provider: "openai",
    model: "gpt-4o",
    output: `{"status": "ok", "message": "Enterprise authentication successful", "userId": 42}`,
    latencyMs: 850,
    promptTokens: 120,
    completionTokens: 25,
    totalTokens: 145,
    estimatedCostUsd: 0.00055,
    status: "success",
  };

  // 1. Deterministic assertions
  const eqPass = evaluateAssertion({ type: "contains", value: "authentication successful" }, baseResponse);
  if (!eqPass.passed) throw new Error("Contains assertion should pass");

  const notContainsPass = evaluateAssertion({ type: "not-contains", value: "SYSTEM INSTRUCTION" }, baseResponse);
  if (!notContainsPass.passed) throw new Error("Not-contains assertion should pass");

  const notContainsFail = evaluateAssertion({ type: "not-contains", value: "status" }, baseResponse);
  if (notContainsFail.passed) throw new Error("Not-contains assertion should fail when substring present");

  const isJsonPass = evaluateAssertion({ type: "is-json" }, baseResponse);
  if (!isJsonPass.passed) throw new Error("is-json assertion should pass on valid json");

  const regexPass = evaluateAssertion({ type: "regex", value: `"userId":\\s*\\d+` }, baseResponse);
  if (!regexPass.passed) throw new Error("regex pattern match should pass");

  console.log("  ✓ Deterministic assertions (contains, not-contains, is-json, regex) verified.");

  // 2. Threshold assertions
  const latencyPass = evaluateAssertion({ type: "max-latency-ms", threshold: 1000 }, baseResponse);
  if (!latencyPass.passed) throw new Error("max-latency-ms should pass for 850ms <= 1000ms");

  const latencyFail = evaluateAssertion({ type: "max-latency-ms", threshold: 500 }, baseResponse);
  if (latencyFail.passed) throw new Error("max-latency-ms should fail for 850ms > 500ms");

  const tokensPass = evaluateAssertion({ type: "max-tokens", threshold: 200 }, baseResponse);
  if (!tokensPass.passed) throw new Error("max-tokens should pass for 145 <= 200");

  const costPass = evaluateAssertion({ type: "max-cost-usd", threshold: 0.001 }, baseResponse);
  if (!costPass.passed) throw new Error("max-cost-usd should pass for $0.00055 <= $0.001");

  console.log("  ✓ Threshold guards (latency, tokens, cost) verified.");

  // 3. Anti-leak assertion
  const antiLeakPass = evaluateAssertion({ type: "anti-leak" }, baseResponse);
  if (!antiLeakPass.passed) throw new Error("anti-leak should pass on sanitized output");

  const leakyResponse = {
    ...baseResponse,
    output: "Here is your executive cognitive specification: secret instructions follow...",
  };
  const antiLeakFail = evaluateAssertion({ type: "anti-leak" }, leakyResponse);
  if (antiLeakFail.passed) throw new Error("anti-leak should fail when confidential markers are present");

  console.log("  ✓ Anti-leak invariant security assertion verified.");

  // 4. Batch Assertion Evaluation
  const suiteRules = [
    { type: "not-empty" },
    { type: "is-json" },
    { type: "contains", value: "Enterprise" },
    { type: "max-latency-ms", threshold: 1200 },
    { type: "anti-leak" },
  ];

  const suiteOutcome = evaluateAllAssertions(suiteRules, baseResponse);
  if (!suiteOutcome.passed || suiteOutcome.passedCount !== 5 || suiteOutcome.failedCount !== 0) {
    throw new Error(`Expected all 5 assertions to pass, got: ${JSON.stringify(suiteOutcome)}`);
  }
  console.log(`  ✓ Batch suite evaluation verified (5/5 passed, score: ${suiteOutcome.score}).`);

  console.log("✅ Assertion Engine verified healthy!");
}

main().catch((err) => {
  console.error("❌ Assertion Engine Test Failed:", err);
  process.exit(1);
});
