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

export type GepaEvaluationMethodology =
  | "GEPA-INSPIRED_PROMPT_EXPERIMENT_HARNESS"
  | "INDEPENDENT_REAL_MODEL_EVALUATION";

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
  readonly evaluationMethodology: GepaEvaluationMethodology;
  readonly provenanceDisclosure: string;
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
 * [PROVENANCE: GEPA-INSPIRED_PROMPT_EXPERIMENT_HARNESS]
 *
 * NOTE: This default simulated renderer operates as a GEPA-INSPIRED_PROMPT_EXPERIMENT_HARNESS
 * for isolated offline/air-gapped CI test verification ($0 cloud spend invariant).
 * It evaluates whether candidate prompt strategies systematically incorporate required
 * instructions, script invariants, and schema formatting guards.
 *
 * Epistemic boundary (BRAIN-P0-01):
 * This default simulator does NOT establish independent real-world empirical proof on live
 * external frontier models. For live production qualification, callers must provide a customRenderer
 * executing matched live model runs against frozen holdout benchmarks with blinded adjudication.
 */
export function renderStrategyOutput(
  strategy: PromptTemplateStrategy,
  testCase: MultilingualTestCase
): string {
  const strategyText = `${strategy.systemPreamble}\n${strategy.basePrompt}\n${strategy.instructionPatches.join("\n")}`.toLowerCase();

  let text = `[SPE Generated Output for ${testCase.caseId}]\n`;
  text += `Domain: ${testCase.domain}\n`;
  text += `System: ${strategy.systemPreamble}\n`;
  text += `Task: ${testCase.userRequest}\n`;

  // Render required concepts:
  // If prompt explicitly instructs strict requirement preservation or invariants, preserve all.
  // Otherwise, if strategy is an unpatched baseline and there are > 2 concepts, omit the last concept
  // to reflect real-world LLM concept omission failure on unconstrained prompts.
  const hasRequirementGuard =
    strategyText.includes("requirement") ||
    strategyText.includes("invariant") ||
    strategyText.includes("preserve") ||
    strategyText.includes("constraint");

  const conceptsToRender = hasRequirementGuard || testCase.requiredConcepts.length <= 2
    ? testCase.requiredConcepts
    : testCase.requiredConcepts.slice(0, -1);

  for (const concept of conceptsToRender) {
    text += `Preserved requirement: ${concept}\n`;
  }

  // Script preservation:
  // If strategy has explicit script or native language instructions, render natively;
  // otherwise, unpatched prompt falls back to English translation.
  const hasScriptGuard =
    strategyText.includes("script") ||
    strategyText.includes("native") ||
    strategyText.includes("locale");

  if (testCase.requiredScript === "Telugu") {
    if (hasScriptGuard || strategyText.includes("telugu")) {
      text += `స్థానిక తెలుగు ప్రాసెసింగ్ (Local Telugu Offline Processing)\n`;
    } else {
      text += `Local Telugu Offline Processing (English translation fallback)\n`;
    }
  } else if (testCase.requiredScript === "Devanagari") {
    if (hasScriptGuard || strategyText.includes("hindi") || strategyText.includes("devanagari")) {
      text += `स्थानीय हिंदी प्रसंस्करण (Local Hindi Processing)\n`;
    } else {
      text += `Local Hindi Processing (English translation fallback)\n`;
    }
  } else if (testCase.requiredScript === "Arabic") {
    if (hasScriptGuard || strategyText.includes("arabic") || strategyText.includes("rtl")) {
      text += `معالجة باللغة العربية مع اتجاه من اليمين إلى اليسار (Arabic RTL Processing)\n`;
    } else {
      text += `Arabic RTL Processing (English translation fallback)\n`;
    }
  } else if (testCase.requiredScript === "JapaneseCJK") {
    if (hasScriptGuard || strategyText.includes("japanese") || strategyText.includes("cjk")) {
      text += `日本語の仕様書と検証 (Japanese Specification and Verification)\n`;
    } else {
      text += `Japanese Specification and Verification (English translation fallback)\n`;
    }
  } else if (testCase.requiredScript === "Latin") {
    text += `Standard Latin instructions\n`;
  }

  // RTL Directionality check:
  if (testCase.requiresRtl) {
    if (strategyText.includes("rtl") || strategyText.includes("bidirectional") || strategyText.includes("right-to-left")) {
      text += `\u200F(RTL bidirectional formatting active)\u200F\n`;
    }
  }

  // Code-switching support:
  if (testCase.requiresCodeSwitching) {
    text += `[Code-switch term: Android offline execution]\n`;
  }

  // Local formats support:
  if (testCase.expectedLocalFormats) {
    for (const fmt of testCase.expectedLocalFormats) {
      text += `Local format active: ${fmt}\n`;
    }
  }

  // Accessibility cues:
  if (testCase.requiresAccessibilityCues) {
    if (strategyText.includes("accessibility") || strategyText.includes("a11y") || strategyText.includes("aria") || strategyText.includes("contrast")) {
      text += `Accessibility compliance: WCAG 2.1 AA high contrast, aria-live status, and full keyboard navigation focus.\n`;
    }
  }

  // JSON format check:
  // If expectedJsonFormat, only render valid JSON if strategy explicitly includes JSON/schema instructions.
  // Otherwise render conversational markdown list.
  if (testCase.expectedJsonFormat) {
    const hasJsonGuard =
      strategyText.includes("json") ||
      strategyText.includes("schema") ||
      strategyText.includes("format");
    if (hasJsonGuard) {
      text += `\n{\n  "status": "success",\n  "caseId": "${testCase.caseId}",\n  "verified": true\n}\n`;
    } else {
      text += `\nHere is your specification in conversational markdown:\n- status: success\n- caseId: ${testCase.caseId}\n`;
    }
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
  },
  customRenderer?: (strategy: PromptTemplateStrategy, testCase: MultilingualTestCase) => Promise<string> | string
): Promise<GepaExperimentOutcome> {
  const timestampIso = new Date().toISOString();
  const experimentId = `gepa_exp_${timestampIso.replace(/[-:T]/g, "").slice(0, 8)}_${champion.strategyId}`;
  const render = customRenderer || renderStrategyOutput;

  // 1. Inspect Training Failures to Extract Diagnostics (Evaluator Partition 1)
  const trainFailures = oracle.getTrainingFailures();
  const failureDiagnosticsList: Array<{ testCase: MultilingualTestCase; reasons: string[] }> = [];

  for (const c of trainFailures) {
    const rendered = await render(champion, c);
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
  let championScore = 0;
  let bestScore = -1;
  let backtrackCount = 0;

  for (const strategy of allStrategies) {
    let passedCount = 0;
    const failures: string[] = [];

    for (const vc of validationCases) {
      const output = await render(strategy, vc);
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

    if (isChampion) {
      championScore = validationScore;
      bestScore = validationScore;
    }

    candidateResults.push({
      strategyId: strategy.strategyId,
      isChampion,
      isNoopBaseline: isNoop,
      validationScore,
      failureFeedbackList: failures,
      qualifiedForPromotion: false,
    });

    if (!isChampion && !isNoop && validationScore >= championScore + budget.minImprovementDelta && validationScore > bestScore) {
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
    async (tc) => render(bestCandidate, tc)
  );

  const championReceipt = await oracle.evaluateCandidateProtected(
    champion.strategyId,
    async (tc) => render(champion, tc)
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

  const evaluationMethodology: GepaEvaluationMethodology = customRenderer
    ? "INDEPENDENT_REAL_MODEL_EVALUATION"
    : "GEPA-INSPIRED_PROMPT_EXPERIMENT_HARNESS";

  const provenanceDisclosure = customRenderer
    ? "Evaluated via custom independent real-model renderer on held-out tasks."
    : "Evaluated via GEPA-INSPIRED_PROMPT_EXPERIMENT_HARNESS simulation. Does not constitute real-model proof.";

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
    evaluationMethodology,
    provenanceDisclosure,
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
    evaluationMethodology,
    provenanceDisclosure,
  });
}
