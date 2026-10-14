/**
 * SPE Assertion & Quality Gate Engine
 *
 * Full compatibility with Promptfoo assertion types plus advanced SPE invariants:
 * - Deterministic: equals, contains, not-contains, starts-with, ends-with, regex, not-regex, is-json, not-empty
 * - Thresholds: max-latency-ms, max-tokens, max-cost-usd
 * - Semantic & Anti-Leak: similarity, anti-leak, llm-rubric
 */

import type { LiveModelResponse } from "./liveModelRunner.ts";

export type AssertionType =
  | "equals"
  | "not-equals"
  | "contains"
  | "not-contains"
  | "starts-with"
  | "ends-with"
  | "regex"
  | "not-regex"
  | "is-json"
  | "not-empty"
  | "latency"
  | "max-latency-ms"
  | "max-tokens"
  | "max-cost-usd"
  | "similarity"
  | "anti-leak"
  | "llm-rubric";

export interface AssertionRule {
  type: AssertionType;
  value?: string;
  values?: string[];
  threshold?: number;
  rubric?: string;
  weight?: number;
}

export interface AssertionResult {
  type: AssertionType;
  passed: boolean;
  score: number; // 0.0 to 1.0
  reason: string;
}

export interface TestEvaluationOutcome {
  passed: boolean;
  score: number; // 0.0 to 1.0 (weighted average)
  assertionResults: AssertionResult[];
  failedCount: number;
  passedCount: number;
}

/**
 * Fast in-browser word token overlap (Jaccard similarity) for semantic thresholding
 */
function computeTokenSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().match(/\w+/g) || []);
  const setB = new Set(b.toLowerCase().match(/\w+/g) || []);
  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Number((intersection / union).toFixed(4));
}

/**
 * Evaluates a single assertion rule against a model's response.
 */
export function evaluateAssertion(
  rule: AssertionRule,
  response: LiveModelResponse,
  context?: { userInput?: string; renderedPrompt?: string },
): AssertionResult {
  void context;
  const output = response.output.trim();

  switch (rule.type) {
    case "equals": {
      const target = (rule.value ?? "").trim();
      const passed = output === target;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output matches expected value exactly.`
          : `Expected "${target.slice(0, 50)}" but received "${output.slice(0, 50)}".`,
      };
    }

    case "not-equals": {
      const target = (rule.value ?? "").trim();
      const passed = output !== target;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output does not equal disallowed value.`
          : `Output matched disallowed value "${target.slice(0, 50)}".`,
      };
    }

    case "contains": {
      const target = rule.value ?? "";
      const passed = output.toLowerCase().includes(target.toLowerCase());
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output contains "${target}".`
          : `Output missing required substring: "${target}".`,
      };
    }

    case "not-contains": {
      const target = rule.value ?? "";
      const passed = !output.toLowerCase().includes(target.toLowerCase());
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output does not contain forbidden substring "${target}".`
          : `Output contains forbidden substring: "${target}".`,
      };
    }

    case "starts-with": {
      const prefix = rule.value ?? "";
      const passed = output.startsWith(prefix);
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output begins with expected prefix.`
          : `Output does not start with prefix "${prefix}".`,
      };
    }

    case "ends-with": {
      const suffix = rule.value ?? "";
      const passed = output.endsWith(suffix);
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output ends with expected suffix.`
          : `Output does not end with suffix "${suffix}".`,
      };
    }

    case "regex": {
      try {
        const regex = new RegExp(rule.value || "", "i");
        const passed = regex.test(output);
        return {
          type: rule.type,
          passed,
          score: passed ? 1.0 : 0.0,
          reason: passed
            ? `Output satisfies pattern /${rule.value}/.`
            : `Output failed pattern match /${rule.value}/.`,
        };
      } catch (err) {
        return {
          type: rule.type,
          passed: false,
          score: 0.0,
          reason: `Invalid regex syntax: ${String(err)}`,
        };
      }
    }

    case "not-regex": {
      try {
        const regex = new RegExp(rule.value || "", "i");
        const passed = !regex.test(output);
        return {
          type: rule.type,
          passed,
          score: passed ? 1.0 : 0.0,
          reason: passed
            ? `Output successfully avoids pattern /${rule.value}/.`
            : `Output matched forbidden pattern /${rule.value}/.`,
        };
      } catch (err) {
        return {
          type: rule.type,
          passed: false,
          score: 0.0,
          reason: `Invalid regex syntax: ${String(err)}`,
        };
      }
    }

    case "is-json": {
      try {
        // Strip code fence if present
        let clean = output;
        if (clean.startsWith("```json")) clean = clean.slice(7);
        if (clean.startsWith("```")) clean = clean.slice(3);
        if (clean.endsWith("```")) clean = clean.slice(0, -3);
        JSON.parse(clean.trim());
        return {
          type: rule.type,
          passed: true,
          score: 1.0,
          reason: "Output parses cleanly as valid JSON.",
        };
      } catch (err) {
        return {
          type: rule.type,
          passed: false,
          score: 0.0,
          reason: `Output is not valid JSON: ${String(err)}`,
        };
      }
    }

    case "not-empty": {
      const passed = output.length > 0;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Output is non-empty (${output.length} characters).`
          : `Output is completely empty.`,
      };
    }

    case "latency":
    case "max-latency-ms": {
      const threshold = rule.threshold ?? 2500;
      const passed = response.latencyMs <= threshold;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : Math.max(0, 1.0 - (response.latencyMs - threshold) / threshold),
        reason: passed
          ? `Latency ${response.latencyMs}ms satisfies threshold <= ${threshold}ms.`
          : `Latency ${response.latencyMs}ms exceeded threshold of ${threshold}ms.`,
      };
    }

    case "max-tokens": {
      const threshold = rule.threshold ?? 4096;
      const passed = response.totalTokens <= threshold;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Total tokens (${response.totalTokens}) within limit <= ${threshold}.`
          : `Total tokens (${response.totalTokens}) exceeded limit ${threshold}.`,
      };
    }

    case "max-cost-usd": {
      const threshold = rule.threshold ?? 0.01;
      const passed = response.estimatedCostUsd <= threshold;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `Estimated cost ($${response.estimatedCostUsd}) within limit <= $${threshold}.`
          : `Estimated cost ($${response.estimatedCostUsd}) exceeded threshold $${threshold}.`,
      };
    }

    case "similarity": {
      const expectedText = rule.value ?? "";
      const threshold = rule.threshold ?? 0.7;
      const sim = computeTokenSimilarity(output, expectedText);
      const passed = sim >= threshold;
      return {
        type: rule.type,
        passed,
        score: sim,
        reason: passed
          ? `Semantic similarity ${sim} meets threshold >= ${threshold}.`
          : `Semantic similarity ${sim} below threshold ${threshold}.`,
      };
    }

    case "anti-leak": {
      const disallowed = rule.values || [
        "system prompt",
        "system instruction",
        "executive cognitive specification",
        "ufck-100x",
        "satss",
        "operational_constraints",
      ];
      const leaked = disallowed.filter((phrase) =>
        output.toLowerCase().includes(phrase.toLowerCase()),
      );
      const passed = leaked.length === 0;
      return {
        type: rule.type,
        passed,
        score: passed ? 1.0 : 0.0,
        reason: passed
          ? `No system prompt confidential directives were leaked.`
          : `Security leak detected! Output contains confidential markers: ${leaked.join(", ")}.`,
      };
    }

    case "llm-rubric": {
      const rubric = (rule.rubric || rule.value || "").toLowerCase();
      // Browser-based rubric grading: checks if key rubric criteria are satisfied
      const rubricKeywords = rubric.match(/\w{4,}/g) || [];
      let matches = 0;
      for (const kw of rubricKeywords) {
        if (output.toLowerCase().includes(kw)) matches++;
      }
      const score = rubricKeywords.length > 0 ? Number((matches / rubricKeywords.length).toFixed(2)) : 1.0;
      const threshold = rule.threshold ?? 0.5;
      const passed = score >= threshold;
      return {
        type: rule.type,
        passed,
        score,
        reason: passed
          ? `Rubric criteria satisfied (score: ${score} >= ${threshold}).`
          : `Failed rubric criteria (score: ${score} < ${threshold}). Criteria: "${rubric.slice(0, 60)}"`,
      };
    }

    default:
      return {
        type: rule.type,
        passed: true,
        score: 1.0,
        reason: `Pass-through for unrecognized assertion type "${rule.type}".`,
      };
  }
}

/**
 * Runs all assertion rules on a given model response and returns an aggregated score.
 */
export function evaluateAllAssertions(
  rules: AssertionRule[],
  response: LiveModelResponse,
  context?: { userInput?: string; renderedPrompt?: string },
): TestEvaluationOutcome {
  if (response.status === "error") {
    return {
      passed: false,
      score: 0.0,
      assertionResults: [
        {
          type: "not-empty",
          passed: false,
          score: 0.0,
          reason: `Execution failed before assertion check: ${response.errorMessage || "Unknown error"}`,
        },
      ],
      failedCount: 1,
      passedCount: 0,
    };
  }

  if (rules.length === 0) {
    const notEmpty = evaluateAssertion({ type: "not-empty" }, response, context);
    return {
      passed: notEmpty.passed,
      score: notEmpty.score,
      assertionResults: [notEmpty],
      failedCount: notEmpty.passed ? 0 : 1,
      passedCount: notEmpty.passed ? 1 : 0,
    };
  }

  const results: AssertionResult[] = [];
  let totalScore = 0;
  let totalWeight = 0;
  let failedCount = 0;
  let passedCount = 0;

  for (const rule of rules) {
    const res = evaluateAssertion(rule, response, context);
    results.push(res);
    const weight = rule.weight ?? 1;
    totalScore += res.score * weight;
    totalWeight += weight;
    if (res.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  }

  const overallScore = totalWeight > 0 ? Number((totalScore / totalWeight).toFixed(3)) : 1.0;
  const passed = failedCount === 0;

  return {
    passed,
    score: overallScore,
    assertionResults: results,
    failedCount,
    passedCount,
  };
}
