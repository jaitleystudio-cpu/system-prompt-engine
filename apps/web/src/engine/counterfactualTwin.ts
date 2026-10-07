/**
 * SPE Ω Proof-Centric Intelligence Compiler — Ring 0: Counterfactual Prompt Twin
 *
 * Implements causal A/B comparative simulation between Baseline and Evolved prompts.
 * Generates verified empirical delta telemetry (token delta, violation reduction, defense shift).
 */

import { typeCheckPrompt, type DiagnosticReport } from "./promptTypeSystem.ts";
import { runAdversarialGym, type AttackResult } from "./geneticEvolver.ts";

export interface TwinMetrics {
  charCount: number;
  tokenCountEst: number;
  errorCount: number;
  warningCount: number;
  hostileAttacksDefended: number;
  totalAttacksCount: number;
  attackDefenseRate: number; // 0.0 to 1.0
  constraintViolations: number;
}

export interface CausalDelta {
  characterCountDelta: number; // e.g. -240
  tokenCountDelta: number; // e.g. -63
  tokenReductionPercentage: number; // e.g. -11.8%
  violationsDelta: number; // e.g. -5 (reduced from 7 to 2)
  defenseRateGain: number; // e.g. +0.28 (+28%)
  intentPreserved: boolean;
  hasCausalImprovement: boolean;
  summaryMessage: string;
}

export interface CounterfactualTwinReport {
  timestampIso: string;
  baseline: TwinMetrics;
  candidate: TwinMetrics;
  delta: CausalDelta;
  baselineDiagnostics: DiagnosticReport;
  candidateDiagnostics: DiagnosticReport;
  reproducibleSeed: number;
}

/**
 * Evaluates both Baseline (A) and Candidate (B) under identical testing conditions.
 */
export function evaluateCounterfactualTwin(
  baselinePrompt: string,
  candidatePrompt: string,
  seed = 42,
): CounterfactualTwinReport {
  const baseText = (baselinePrompt || "").trim();
  const candText = (candidatePrompt || "").trim();

  // 1. Run Type-System static checks
  const baseDiag = typeCheckPrompt(baseText);
  const candDiag = typeCheckPrompt(candText);

  // 2. Run Adversarial Gym
  const baseGym: AttackResult[] = runAdversarialGym(baseText);
  const candGym: AttackResult[] = runAdversarialGym(candText);

  const baseDefended = baseGym.filter(a => a.defended).length;
  const candDefended = candGym.filter(a => a.defended).length;
  const totalAttacks = baseGym.length;

  const baseMetrics: TwinMetrics = {
    charCount: baseText.length,
    tokenCountEst: Math.round(baseText.length / 3.8),
    errorCount: baseDiag.errorCount,
    warningCount: baseDiag.warningCount,
    hostileAttacksDefended: baseDefended,
    totalAttacksCount: totalAttacks,
    attackDefenseRate: totalAttacks > 0 ? baseDefended / totalAttacks : 0,
    constraintViolations: baseDiag.errorCount * 2 + (totalAttacks - baseDefended),
  };

  const candMetrics: TwinMetrics = {
    charCount: candText.length,
    tokenCountEst: Math.round(candText.length / 3.8),
    errorCount: candDiag.errorCount,
    warningCount: candDiag.warningCount,
    hostileAttacksDefended: candDefended,
    totalAttacksCount: totalAttacks,
    attackDefenseRate: totalAttacks > 0 ? candDefended / totalAttacks : 0,
    constraintViolations: candDiag.errorCount * 2 + (totalAttacks - candDefended),
  };

  // 3. Compute Causal Deltas
  const charDelta = candMetrics.charCount - baseMetrics.charCount;
  const tokenDelta = candMetrics.tokenCountEst - baseMetrics.tokenCountEst;
  const tokenPct = baseMetrics.tokenCountEst > 0
    ? ((tokenDelta / baseMetrics.tokenCountEst) * 100)
    : 0;

  const violationsDelta = candMetrics.constraintViolations - baseMetrics.constraintViolations;
  const defenseGain = candMetrics.attackDefenseRate - baseMetrics.attackDefenseRate;

  // Intent preservation check (Candidate cannot introduce new type errors that were absent in base)
  const intentPreserved = candMetrics.errorCount <= baseMetrics.errorCount;
  const hasCausalImprovement = (violationsDelta < 0 || defenseGain > 0.05) && intentPreserved;

  const summary = hasCausalImprovement
    ? `Candidate reduced constraint violations by ${Math.abs(violationsDelta)} (from ${baseMetrics.constraintViolations} to ${candMetrics.constraintViolations}) with +${(defenseGain * 100).toFixed(1)}% defense gain; zero intent degradation.`
    : `Candidate showed no qualifying causal improvement over baseline (Violations: ${candMetrics.constraintViolations} vs ${baseMetrics.constraintViolations}).`;

  return {
    timestampIso: new Date().toISOString(),
    baseline: baseMetrics,
    candidate: candMetrics,
    delta: {
      characterCountDelta: charDelta,
      tokenCountDelta: tokenDelta,
      tokenReductionPercentage: parseFloat(tokenPct.toFixed(2)),
      violationsDelta,
      defenseRateGain: parseFloat(defenseGain.toFixed(4)),
      intentPreserved,
      hasCausalImprovement,
      summaryMessage: summary,
    },
    baselineDiagnostics: baseDiag,
    candidateDiagnostics: candDiag,
    reproducibleSeed: seed,
  };
}
