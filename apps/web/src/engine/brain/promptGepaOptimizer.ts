/**
 * SPE Ω — Budgeted Prompt-Only Optimization Experiment (GEPA / Recurrent Evolution Kernel)
 * Prompt Strategy Optimization — Layer 03
 *
 * Epistemic Foundations:
 * - DSPy GEPA (Generative Prompt Optimization): Using diagnostics from failures on training splits
 *   to generate candidate instructions, validated on selection validation, and qualified on protected holdout.
 * - Darwin Gödel Machine (DGM v3, arXiv:2505.22954): Empirical candidate search with frozen models & sandboxing.
 * - PACEvolve (arXiv:2601.10657): Context pruning, diversity preservation, and backtracking on stagnation.
 * - Non-negotiable Invariant:
 *   NO QUALIFIED IMPROVEMENT TODAY IS A SUCCESSFUL RUN.
 *   The engine must never promote an unproven or regressive candidate merely to increment a version number.
 *   Retaining the working champion when no candidate beats it on independent evaluation is the correct outcome.
 */

import { computeSha256 } from "../hashUtils.ts";
import type {
  MultilingualTestCase,
  MultilingualEvaluationReceipt,
  ProtectedEvaluationAuthority,
} from "./multilingualEvaluationContract.ts";
import { evaluateTestCaseSemantics } from "./multilingualEvaluationContract.ts";

export interface PromptTemplateStrategy {
  readonly strategyId: string;
  readonly name: string;
  readonly basePrompt: string;
  readonly instructionPatches: readonly string[];
  readonly systemPreamble: string;
  readonly budgetCapTokens: number;
}

export interface CandidateEvaluationResult {
  readonly strategyId: string;
  readonly isChampion: boolean;
  readonly isNoopBaseline: boolean;
  readonly validationScore: number;
  readonly failureFeedbackList: readonly string[];
  readonly evaluationReceipt?: MultilingualEvaluationReceipt;
  readonly qualifiedForPromotion: boolean;
}

export interface GepaExperimentBudget {
  readonly maxCandidates: number; // e.g. 3 to 5
  readonly maxIterations: number;
  readonly costCeilingUsd: number; // 0 for air-gap / local
  readonly minImprovementDelta: number; // e.g. +0.02 (2% gain required)
}

export interface GepaExperimentOutcome {
  readonly experimentId: string;
  readonly timestampIso: string;
  readonly decision: "PROMOTED_NEW_CHAMPION" | "NO_QUALIFIED_IMPROVEMENT";
  readonly selectedStrategy: PromptTemplateStrategy;
  readonly previousChampion: PromptTemplateStrategy;
  readonly candidateResults: readonly CandidateEvaluationResult[];
  readonly searchStagnated: boolean;
  readonly backtrackCount: number;
  readonly totalCandidatesEvaluated: number;
  readonly spendUsd: number;
  readonly experimentDigest: string;
}

/**
 * Diagnostic analyzer: extracts actionable failure modes from training set evaluations.
 */
export function extractFailureDiagnostics(
  failures: Array<{ testCase: MultilingualTestCase; reasons: string[] }>
): string[] {
  const diagnostics: string[] = [];
  for (const { testCase, reasons } of failures) {
    for (const r of reasons) {
      if (r.includes("Missing mandatory concept")) {
        diagnostics.push(`REQUIREMENT_OMISSION: Explicitly instruct model to preserve ${r}`);
      } else if (r.includes("Telugu")) {
        diagnostics.push(`SCRIPT_INTEGRITY_TELUGU: Reinforce Telugu script preservation and offline rules`);
      } else if (r.includes("Arabic") || r.includes("RTL")) {
        diagnostics.push(`SCRIPT_INTEGRITY_RTL: Enforce bidirectional isolation and Arabic right-to-left layout`);
      } else if (r.includes("JSON")) {
        diagnostics.push(`FORMAT_INTEGRITY_JSON: Enforce strict JSON object serialization without conversational markdown`);
      } else if (r.includes("forbidden")) {
        diagnostics.push(`POLICY_LEAKAGE: Explicitly forbid leaked patterns or telemetry`);
      } else {
        diagnostics.push(`GENERAL_FAILURE: ${r} for case ${testCase.caseId}`);
      }
    }
  }
  return [...new Set(diagnostics)];
}

/**
 * Generates bounded candidate prompt variations using failure feedback (GEPA pattern).
 */
export function generateCandidateStrategies(
  champion: PromptTemplateStrategy,
  diagnostics: string[],
  maxCandidates: number
): PromptTemplateStrategy[] {
  const candidates: PromptTemplateStrategy[] = [];

  // Strategy 1: Targeted Constraint-Preservation Mutation
  if (diagnostics.some((d) => d.startsWith("REQUIREMENT_OMISSION"))) {
    candidates.push({
      strategyId: `${champion.strategyId}_cand_req_preservation_${Date.now()}`,
      name: `${champion.name} + Strict Requirement Invariants`,
      basePrompt: champion.basePrompt,
      systemPreamble: `${champion.systemPreamble}\nCRITICAL INVARIANT: You must preserve 100% of explicit user constraints without dropping terms or translating proper technical entities.`,
      instructionPatches: [...champion.instructionPatches, "Verify all named requirements appear in the final output."],
      budgetCapTokens: champion.budgetCapTokens,
    });
  }

  // Strategy 2: Multilingual & Script Protection Mutation
  if (diagnostics.some((d) => d.includes("SCRIPT_INTEGRITY"))) {
    candidates.push({
      strategyId: `${champion.strategyId}_cand_multilingual_${Date.now()}`,
      name: `${champion.name} + Script & RTL Hardening`,
      basePrompt: champion.basePrompt,
      systemPreamble: `${champion.systemPreamble}\nSCRIPT INTEGRITY: When user specifies Telugu, Arabic, Hindi, or Japanese, render natively in the exact script. For RTL languages (Arabic), maintain bidirectional layout safety.`,
      instructionPatches: [...champion.instructionPatches, "Preserve target locale script and Unicode NFC normalization."],
      budgetCapTokens: champion.budgetCapTokens,
    });
  }

  // Strategy 3: Format & Structural Serialization Mutation
  if (diagnostics.some((d) => d.includes("FORMAT_INTEGRITY_JSON"))) {
    candidates.push({
      strategyId: `${champion.strategyId}_cand_schema_${Date.now()}`,
      name: `${champion.name} + Structured JSON Guard`,
      basePrompt: champion.basePrompt,
      systemPreamble: `${champion.systemPreamble}\nOUTPUT FORMAT: When JSON is requested, output strictly valid, parseable JSON with zero conversational wrapper.`,
      instructionPatches: [...champion.instructionPatches, "Validate JSON syntax before concluding response."],
      budgetCapTokens: champion.budgetCapTokens,
    });
  }

  // Fallback candidate if no specific diagnostic matched
  if (candidates.length === 0) {
    candidates.push({
      strategyId: `${champion.strategyId}_cand_concise_clarity_${Date.now()}`,
      name: `${champion.name} + Concise Execution Invariant`,
      basePrompt: champion.basePrompt,
      systemPreamble: `${champion.systemPreamble}\nProvide precise, robust, and verified specifications.`,
      instructionPatches: [...champion.instructionPatches, "Keep output directly actionable."],
      budgetCapTokens: champion.budgetCapTokens,
    });
  }

  return candidates.slice(0, maxCandidates);
}

/**
 * Simulates rendering output with a prompt strategy against a test case.
 */
export function renderStrategyOutput(
  strategy: PromptTemplateStrategy,
  testCase: MultilingualTestCase
): string {
  // Deterministic mock synthesis reflecting the prompt strategy instructions
  let text = `[SPE Generated Output for ${testCase.caseId}]\n`;
  text += `Domain: ${testCase.domain}\n`;
  text += `System: ${strategy.systemPreamble}\n`;
  text += `Task: ${testCase.userRequest}\n`;

  // Render required concepts
  for (const concept of testCase.requiredConcepts) {
    text += `Preserved requirement: ${concept}\n`;
  }

  // If script required, include native text snippet
  if (testCase.requiredScript === "Telugu") {
    text += `స్థానిక తెలుగు ప్రాసెసింగ్ (Local Telugu Offline Processing)\n`;
  } else if (testCase.requiredScript === "Devanagari") {
    text += `स्थानीय हिंदी प्रसंस्करण (Local Hindi Processing)\n`;
  } else if (testCase.requiredScript === "Arabic") {
    text += `معالجة باللغة العربية مع اتجاه من اليمين إلى اليسار (Arabic RTL Processing)\n`;
  } else if (testCase.requiredScript === "JapaneseCJK") {
    text += `日本語の仕様書と検証 (Japanese Specification and Verification)\n`;
  }

  // If JSON requested
  if (testCase.expectedJsonFormat) {
    text += `\n{\n  "status": "success",\n  "caseId": "${testCase.caseId}",\n  "verified": true\n}\n`;
  }

  return text.normalize("NFC");
}

/**
 * Executes a bounded prompt-only optimization experiment (GEPA / PACEvolve).
 */
export async function runPromptGepaExperiment(
  champion: PromptTemplateStrategy,
  oracle: ProtectedEvaluationAuthority,
  budget: GepaExperimentBudget = {
    maxCandidates: 3,
    maxIterations: 2,
    costCeilingUsd: 0,
    minImprovementDelta: 0.02,
  }
): Promise<GepaExperimentOutcome> {
  const timestampIso = new Date().toISOString();
  const experimentId = `gepa_exp_${timestampIso.replace(/[-:T]/g, "").slice(0, 8)}_${champion.strategyId}`;

  // 1. Inspect Training Failures to Extract Diagnostics (Evaluator Partition 1)
  const trainFailures = oracle.getTrainingFailures();
  const failureDiagnosticsList: Array<{ testCase: MultilingualTestCase; reasons: string[] }> = [];

  for (const c of trainFailures) {
    const rendered = renderStrategyOutput(champion, c);
    const evalResult = evaluateTestCaseSemantics(c, rendered);
    if (!evalResult.passed) {
      failureDiagnosticsList.push({ testCase: c, reasons: evalResult.reasons });
    }
  }

  const diagnostics = extractFailureDiagnostics(failureDiagnosticsList);

  // 2. Formulate Candidate Set:
  // - Current Champion
  // - No-Op Baseline (base prompt with zero patches)
  // - Up to maxCandidates evolved variations
  const noopBaseline: PromptTemplateStrategy = {
    strategyId: `${champion.strategyId}_noop_baseline`,
    name: `${champion.name} (No-Op Baseline)`,
    basePrompt: champion.basePrompt,
    instructionPatches: [],
    systemPreamble: champion.systemPreamble,
    budgetCapTokens: champion.budgetCapTokens,
  };

  const candidatePool = generateCandidateStrategies(champion, diagnostics, budget.maxCandidates);
  const allStrategies = [champion, noopBaseline, ...candidatePool];

  // 3. Selection Validation Scoring (Evaluator Partition 2)
  const validationCases = oracle.getSelectionValidationCases();
  const candidateResults: CandidateEvaluationResult[] = [];

  let bestCandidate: PromptTemplateStrategy = champion;
  let bestScore = -1;
  let backtrackCount = 0;

  for (const strategy of allStrategies) {
    let passedCount = 0;
    const failures: string[] = [];

    for (const vc of validationCases) {
      const output = renderStrategyOutput(strategy, vc);
      const outcome = evaluateTestCaseSemantics(vc, output);
      if (outcome.passed) {
        passedCount++;
      } else {
        failures.push(`[${vc.caseId}] ${outcome.reasons.join(", ")}`);
      }
    }

    const validationScore = validationCases.length > 0 ? Number((passedCount / validationCases.length).toFixed(4)) : 1.0;
    const isChampion = strategy.strategyId === champion.strategyId;
    const isNoop = strategy.strategyId === noopBaseline.strategyId;

    candidateResults.push({
      strategyId: strategy.strategyId,
      isChampion,
      isNoopBaseline: isNoop,
      validationScore,
      failureFeedbackList: failures,
      qualifiedForPromotion: false,
    });

    if (validationScore > bestScore + budget.minImprovementDelta && !isNoop) {
      bestScore = validationScore;
      bestCandidate = strategy;
    }
  }

  // 4. Stagnation & Backtracking Check (PACEvolve Invariant)
  let searchStagnated = false;
  if (bestCandidate.strategyId === champion.strategyId) {
    searchStagnated = true;
    backtrackCount++;
  }

  // 5. Final Qualification on Protected Holdout (Evaluator Partition 3 & 4)
  let decision: "PROMOTED_NEW_CHAMPION" | "NO_QUALIFIED_IMPROVEMENT" = "NO_QUALIFIED_IMPROVEMENT";
  let finalSelectedStrategy = champion;

  // Evaluate candidate on protected holdout via ProtectedEvaluationAuthority
  const finalReceipt = await oracle.evaluateCandidateProtected(
    bestCandidate.strategyId,
    async (tc) => renderStrategyOutput(bestCandidate, tc)
  );

  const championReceipt = await oracle.evaluateCandidateProtected(
    champion.strategyId,
    async (tc) => renderStrategyOutput(champion, tc)
  );

  // Qualification condition:
  // Must beat champion on independent audit, pass permanent regressions, and preserve all slice floors!
  const strictlyBetter = finalReceipt.overallScore > championReceipt.overallScore;
  const passedAllFloors = finalReceipt.overallVerdict === "QUALIFIED";

  if (bestCandidate.strategyId !== champion.strategyId && strictlyBetter && passedAllFloors) {
    decision = "PROMOTED_NEW_CHAMPION";
    finalSelectedStrategy = bestCandidate;
  } else {
    decision = "NO_QUALIFIED_IMPROVEMENT";
    finalSelectedStrategy = champion;
  }

  const experimentPayload = {
    experimentId,
    timestampIso,
    decision,
    selectedStrategyId: finalSelectedStrategy.strategyId,
    previousChampionId: champion.strategyId,
    bestCandidateId: bestCandidate.strategyId,
    searchStagnated,
    backtrackCount,
    spendUsd: 0,
  };

  const experimentDigest = computeSha256(JSON.stringify(experimentPayload));

  return Object.freeze({
    experimentId,
    timestampIso,
    decision,
    selectedStrategy: finalSelectedStrategy,
    previousChampion: champion,
    candidateResults: Object.freeze(candidateResults),
    searchStagnated,
    backtrackCount,
    totalCandidatesEvaluated: allStrategies.length,
    spendUsd: 0,
    experimentDigest,
  });
}
