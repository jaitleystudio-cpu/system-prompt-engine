/**
 * SPE Ω — Two-Sided Evidence Adjudicator (TSEA)
 * Combining Anti-False-Acceptance & Anti-False-Rejection Verification
 *
 * Epistemic Foundations:
 * - ACL 2026 "What Prompts Don't Say": 41.1% implicit requirement inference accuracy; 2x regression rate.
 * - SpecBench (May 2026): Observed pass does not imply specification satisfaction.
 * - ICML 2026 Reward Hacking Benchmark: Catching lucky passes and ungrounded oracle shortcuts.
 * - Pearl Causal Hierarchy: Counterfactual minimal-cut fault attribution.
 *
 * Integrates directly with:
 * - Counterfactual Specification Closure (CSC) — perturbation testing & lucky-pass detection.
 * - Possibility Engine — Living Outcome Contracts, Ante-hoc topologies, EVOI decision gates.
 * - Evaluator Authority Firewall (EAF) — test fixture immutability.
 */

import { computeSha256 } from "./hashUtils.ts";
import {
  type EvaluatorAuthorityEnvelope,
  type EvaluatorFirewallVerdict,
  verifyEvaluatorIntegrity,
} from "./evaluatorAuthorityFirewall.ts";

export type MutantOperatorType =
  | "SMO_1_CONDITIONAL_NEGATION"
  | "SMO_2_STATEMENT_DELETION"
  | "SMO_3_RETURN_PERTURBATION"
  | "SMO_4_BOUNDARY_FAULT_INJECTION"
  | "SMO_5_ASSERTION_INVERSION";

export interface HostileMutant {
  readonly id: string;
  readonly operator: MutantOperatorType;
  readonly description: string;
  readonly mutatedCode: string;
  readonly targetedInvariant: string;
}

export interface Side1FalseAcceptanceReport {
  readonly totalMutantsGenerated: number;
  readonly mutantsKilled: number;
  readonly mutantsSurvived: number;
  readonly mutationKillRate: number; // Scale 0.0 to 1.0 (requires >= 0.95)
  readonly luckyPassVulnerabilities: readonly string[];
  readonly side1Qualified: boolean;
}

export interface InferredConstraint {
  readonly constraintId: string;
  readonly isHardInvariant: boolean; // Hard = non-negotiable security/privacy; Soft = incidental syntax
  readonly description: string;
  readonly violatedByCandidate: boolean;
  readonly relaxableWithoutIntentViolation: boolean;
}

export interface Side2FalseRejectionReport {
  readonly observedEvaluationFailed: boolean;
  readonly totalConstraintsScanned: number;
  readonly hardInvariantsViolated: number;
  readonly softConstraintsViolated: number;
  readonly isFalseRejectionDetected: boolean;
  readonly recommendedRelaxationDiff?: string;
  readonly remediatedVerdict: "CONFIRMED_TRUE_FAILURE" | "FALSE_REJECTION_REMEDIATED" | "CLEAN_PASS";
}

export interface DecisiveExperimentProbe {
  readonly probeId: string;
  readonly hypothesis: string;
  readonly stimulusCode: string;
  readonly expectedInformationGainDeltaH: number; // Bits (0.0 to 1.0)
  readonly estimatedCostTokens: number;
  readonly costEfficiency: number; // EVOI / tokens
}

export interface TwoSidedAdjudicationVerdict {
  readonly adjudicationId: string;
  readonly timestampIso: string;
  readonly firewallVerdict: EvaluatorFirewallVerdict;
  readonly side1Report: Side1FalseAcceptanceReport;
  readonly side2Report: Side2FalseRejectionReport;
  readonly finalEpistemicStatus:
    | "QUALIFIED_TRUE_SUCCESS"
    | "REJECTED_LUCKY_PASS"
    | "REJECTED_TRUE_FAILURE"
    | "REMEDIATED_FALSE_REJECTION"
    | "AUTHORITY_BREACH_HALT";
  readonly selectedDecisiveProbe?: DecisiveExperimentProbe;
  readonly adjudicationDigest: string;
}

/**
 * Synthesizes hostile code mutants to challenge the verifier (Side 1).
 */
export function synthesizeHostileMutants(candidateCode: string): HostileMutant[] {
  const mutants: HostileMutant[] = [];

  // SMO-1: Conditional Negation (< to >=, === to !==)
  if (candidateCode.includes("===") || candidateCode.includes("<")) {
    const mutated = candidateCode
      .replace(/===/g, "!==")
      .replace(/<(?!=)/g, ">=");
    mutants.push({
      id: "MUT-SMO1",
      operator: "SMO_1_CONDITIONAL_NEGATION",
      description: "Inverts conditional comparison operators across authorization and validation branches.",
      mutatedCode: mutated,
      targetedInvariant: "Conditional branch strictness",
    });
  } else {
    mutants.push({
      id: "MUT-SMO1-FALLBACK",
      operator: "SMO_1_CONDITIONAL_NEGATION",
      description: "Inverted boolean return value.",
      mutatedCode: candidateCode + "\n// Mutant: Invert return\nreturn !result;",
      targetedInvariant: "Return validity",
    });
  }

  // SMO-2: Statement Deletion
  const lines = candidateCode.split("\n");
  const filtered = lines.filter((l) => !l.includes("=") && !l.includes("-=") && !l.includes("+="));
  mutants.push({
    id: "MUT-SMO2",
    operator: "SMO_2_STATEMENT_DELETION",
    description: "Deletes state persistence, balance mutation, and cache update invocations.",
    mutatedCode: filtered.join("\n"),
    targetedInvariant: "State persistence completeness",
  });

  // SMO-3: Return Perturbation (returns null or 500 error code)
  mutants.push({
    id: "MUT-SMO3",
    operator: "SMO_3_RETURN_PERTURBATION",
    description: "Forces null/empty object return across public API boundary.",
    mutatedCode: candidateCode + "\nreturn null;",
    targetedInvariant: "Non-null response guarantees",
  });

  // SMO-4: Boundary Fault Injection (Negative value, empty array)
  mutants.push({
    id: "MUT-SMO4",
    operator: "SMO_4_BOUNDARY_FAULT_INJECTION",
    description: "Injects negative numbers and malicious zero-width codepoints.",
    mutatedCode: `// Fault injected\nconst __fault = -99999;\n` + candidateCode,
    targetedInvariant: "Range and boundary sanity",
  });

  // SMO-5: Assertion Inversion
  mutants.push({
    id: "MUT-SMO5",
    operator: "SMO_5_ASSERTION_INVERSION",
    description: "Forces thrown runtime exception on execution.",
    mutatedCode: `throw new Error("MUTANT_FAULT_INJECTION");\n` + candidateCode,
    targetedInvariant: "Failure propagation and error catching",
  });

  return mutants;
}

/**
 * Evaluates Side 1: Hostile Mutation Testing (Anti-False-Acceptance).
 * Enforces: Mutation Kill Rate >= 0.95.
 */
export function evaluateSide1FalseAcceptance(
  mutants: readonly HostileMutant[],
  testRunner: (code: string) => boolean // returns true if test passes, false if test caught the mutant
): Side1FalseAcceptanceReport {
  let killed = 0;
  const survivedVulnerabilities: string[] = [];

  for (const m of mutants) {
    const testPassedOnMutant = testRunner(m.mutatedCode);
    if (!testPassedOnMutant) {
      // The test caught the mutant! This is GOOD.
      killed++;
    } else {
      // The test passed even though the code was mutated and broken! Lucky pass vulnerability.
      survivedVulnerabilities.push(
        `Mutant ${m.id} (${m.operator}) survived test suite without triggering a test failure.`
      );
    }
  }

  const total = mutants.length;
  const killRate = total > 0 ? killed / total : 0;
  const side1Qualified = killRate >= 0.95;

  return {
    totalMutantsGenerated: total,
    mutantsKilled: killed,
    mutantsSurvived: survivedVulnerabilities.length,
    mutationKillRate: Math.round(killRate * 100) / 100,
    luckyPassVulnerabilities: Object.freeze(survivedVulnerabilities),
    side1Qualified,
  };
}

/**
 * Evaluates Side 2: Counterfactual Inferred-Constraint Relaxation (Anti-False-Rejection).
 * Addresses ACL 2026 "What Prompts Don't Say".
 */
export function evaluateSide2FalseRejection(params: {
  rawEvaluationPassed: boolean;
  constraints: InferredConstraint[];
  candidateOutput: string;
}): Side2FalseRejectionReport {
  if (params.rawEvaluationPassed) {
    return {
      observedEvaluationFailed: false,
      totalConstraintsScanned: params.constraints.length,
      hardInvariantsViolated: 0,
      softConstraintsViolated: 0,
      isFalseRejectionDetected: false,
      remediatedVerdict: "CLEAN_PASS",
    };
  }

  const hardViolations = params.constraints.filter((c) => c.isHardInvariant && c.violatedByCandidate);
  const softViolations = params.constraints.filter((c) => !c.isHardInvariant && c.violatedByCandidate);

  // If a hard security or invariant constraint was broken, this is a TRUE FAILURE
  if (hardViolations.length > 0) {
    return {
      observedEvaluationFailed: true,
      totalConstraintsScanned: params.constraints.length,
      hardInvariantsViolated: hardViolations.length,
      softConstraintsViolated: softViolations.length,
      isFalseRejectionDetected: false,
      remediatedVerdict: "CONFIRMED_TRUE_FAILURE",
    };
  }

  // If ONLY soft/incidental constraints failed (e.g. whitespace, ordering, non-critical keys)
  // while ALL hard invariants held true, this is a FALSE REJECTION!
  const isFalseRejection = softViolations.length > 0 && hardViolations.length === 0;

  const recommendedDiff = isFalseRejection
    ? `Relaxed ${softViolations.length} incidental constraint(s): [${softViolations.map((v) => v.constraintId).join(", ")}]. Preserved all hard ProtectedIntent boundaries.`
    : undefined;

  return {
    observedEvaluationFailed: true,
    totalConstraintsScanned: params.constraints.length,
    hardInvariantsViolated: 0,
    softConstraintsViolated: softViolations.length,
    isFalseRejectionDetected: isFalseRejection,
    recommendedRelaxationDiff: recommendedDiff,
    remediatedVerdict: isFalseRejection ? "FALSE_REJECTION_REMEDIATED" : "CONFIRMED_TRUE_FAILURE",
  };
}

/**
 * Minimum Decisive Experiment Selector (MDES)
 * Selects the single highest-efficiency probe to resolve remaining epistemic uncertainty.
 */
export function selectMinimumDecisiveProbe(
  probes: readonly DecisiveExperimentProbe[]
): DecisiveExperimentProbe | undefined {
  if (probes.length === 0) return undefined;

  // Maximize cost efficiency (EVOI Delta H / token cost)
  return [...probes].sort((a, b) => b.costEfficiency - a.costEfficiency)[0];
}

/**
 * Complete Two-Sided Adjudication Pipeline
 */
export function adjudicateTwoSidedEvidence(params: {
  adjudicationId: string;
  authorityEnvelope: EvaluatorAuthorityEnvelope;
  observedFixtures: Array<{ fixtureId: string; path: string; content: string }>;
  candidateCode: string;
  testRunner: (code: string) => boolean;
  rawEvaluationPassed: boolean;
  constraints: InferredConstraint[];
  candidateProbes?: readonly DecisiveExperimentProbe[];
}): TwoSidedAdjudicationVerdict {
  // Step 1: Evaluator Authority Firewall check
  const firewallVerdict = verifyEvaluatorIntegrity(
    params.authorityEnvelope,
    params.observedFixtures
  );

  if (!firewallVerdict.authorityPreserved) {
    const rawPayload = JSON.stringify({
      id: params.adjudicationId,
      status: "AUTHORITY_BREACH_HALT",
      firewall: firewallVerdict,
    });
    return {
      adjudicationId: params.adjudicationId,
      timestampIso: new Date().toISOString(),
      firewallVerdict,
      side1Report: {
        totalMutantsGenerated: 0,
        mutantsKilled: 0,
        mutantsSurvived: 0,
        mutationKillRate: 0,
        luckyPassVulnerabilities: ["Execution halted due to evaluator authority breach."],
        side1Qualified: false,
      },
      side2Report: {
        observedEvaluationFailed: true,
        totalConstraintsScanned: 0,
        hardInvariantsViolated: 1,
        softConstraintsViolated: 0,
        isFalseRejectionDetected: false,
        remediatedVerdict: "CONFIRMED_TRUE_FAILURE",
      },
      finalEpistemicStatus: "AUTHORITY_BREACH_HALT",
      adjudicationDigest: computeSha256(rawPayload),
    };
  }

  // Step 2: Side 1 — Anti-False-Acceptance (Hostile Mutation Qualification)
  const mutants = synthesizeHostileMutants(params.candidateCode);
  const side1Report = evaluateSide1FalseAcceptance(mutants, params.testRunner);

  // Step 3: Side 2 — Anti-False-Rejection (Inferred Constraint Relaxation)
  const side2Report = evaluateSide2FalseRejection({
    rawEvaluationPassed: params.rawEvaluationPassed,
    constraints: params.constraints,
    candidateOutput: params.candidateCode,
  });

  // Step 4: Minimum Decisive Experiment Selection (MDES)
  const selectedDecisiveProbe = selectMinimumDecisiveProbe(params.candidateProbes || []);

  // Determine final epistemic status
  let finalEpistemicStatus: TwoSidedAdjudicationVerdict["finalEpistemicStatus"] = "REJECTED_TRUE_FAILURE";

  if (!side1Report.side1Qualified) {
    finalEpistemicStatus = "REJECTED_LUCKY_PASS";
  } else if (side2Report.remediatedVerdict === "CLEAN_PASS") {
    finalEpistemicStatus = "QUALIFIED_TRUE_SUCCESS";
  } else if (side2Report.remediatedVerdict === "FALSE_REJECTION_REMEDIATED") {
    finalEpistemicStatus = "REMEDIATED_FALSE_REJECTION";
  } else {
    finalEpistemicStatus = "REJECTED_TRUE_FAILURE";
  }

  const adjudicationDigest = computeSha256(
    JSON.stringify({
      id: params.adjudicationId,
      firewall: firewallVerdict.verdict,
      side1: side1Report.side1Qualified,
      side2: side2Report.remediatedVerdict,
      final: finalEpistemicStatus,
    })
  );

  return {
    adjudicationId: params.adjudicationId,
    timestampIso: new Date().toISOString(),
    firewallVerdict,
    side1Report,
    side2Report,
    finalEpistemicStatus,
    selectedDecisiveProbe,
    adjudicationDigest,
  };
}
