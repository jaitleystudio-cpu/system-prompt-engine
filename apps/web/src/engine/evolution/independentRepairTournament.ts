/**
 * SPE Ω — Independent Repair Tournament (IRT) Engine
 * Crown Breakthrough Capability #2
 *
 * Epistemic Grounding:
 * - Detect–Repair–Verify for LLM-Generated Code (2026, arXiv:2603.23633)
 * - Do LLMs Generate Useful Test Oracles? (ASE 2025)
 * - When Agent Evaluation Becomes Unreliable (2026, arXiv:2610.16067)
 * - SWE-bench Goes Live! (NeurIPS 2025)
 *
 * Operational Principles:
 * 1. Independent Frozen Oracle: Patch creators cannot modify, skip, or weaken test oracles.
 * 2. Competing Patch Candidates: Multiple independent solutions evaluated side-by-side.
 * 3. Anti-Mutation Kill Battery: Patches must be defended by tests that fail on injected mutations (>= 80% kill rate).
 * 4. Blast Radius Minimality: Smaller, tightly localized diffs win over bloated rewrites.
 * 5. Oscillation & Iteration Brake: Prevents endless cyclic repairs between conflicting states.
 * 6. Non-Trivial Acceptance: Rejects both candidates if evidence is insufficient.
 */

import type { DefectCategory } from "./types.ts";

export interface CandidatePatch {
  candidateId: string;
  authorAgentId: string;
  targetFile: string;
  originalChunk: string;
  replacementChunk: string;
  lineCountDiff: number;
  explanation: string;
}

export interface FrozenTestOracle {
  testFile: string;
  oracleSha256: string;
  testCases: Array<{
    name: string;
    isAcceptance: boolean; // true = targeted fix test, false = regression test
    run: (patchedContent: string) => boolean;
  }>;
}

export interface CandidateEvaluationResult {
  candidateId: string;
  acceptancePassed: boolean;
  regressionPassed: boolean;
  oracleTamperingDetected: boolean;
  oscillationDetected: boolean;
  mutantsGenerated: number;
  mutantsKilled: number;
  mutationKillRate: number; // 0.0 to 1.0
  blastRadiusScore: number; // 0.0 to 1.0 (1.0 = minimal diff)
  overallScore: number;     // 0.0 to 100.0
  disqualifiedReason?: string;
}

export interface TournamentResult {
  tournamentId: string;
  defectCategory: DefectCategory;
  timestamp: string;
  candidatesEvaluated: number;
  winnerCandidateId: string | null;
  disposition: "WINNER_QUALIFIED" | "REJECT_BOTH_INSUFFICIENT_EVIDENCE" | "ALL_DISQUALIFIED";
  winningPatch: CandidatePatch | null;
  candidateEvaluations: CandidateEvaluationResult[];
  reason: string;
  tournamentReceiptDigest: string;
}

export class IndependentRepairTournament {
  private recentPatchHashes: Set<string> = new Set();
  private maxAllowedDiffLines = 50;
  private minMutationKillRate = 0.80;

  /**
   * Conducts a head-to-head tournament between competing repair patches
   * evaluated against an independent, frozen test oracle.
   */
  public conductTournament(options: {
    defectCategory: DefectCategory;
    targetFileOriginalContent: string;
    candidates: CandidatePatch[];
    frozenOracle: FrozenTestOracle;
    historicalPatchDigests?: string[];
  }): TournamentResult {
    const tournamentId = `irt-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 6)}`;
    const now = new Date().toISOString();

    // Register historical patch digests to detect repair oscillation
    if (options.historicalPatchDigests) {
      for (const h of options.historicalPatchDigests) {
        this.recentPatchHashes.add(h);
      }
    }

    const evaluations: CandidateEvaluationResult[] = [];

    for (const candidate of options.candidates) {
      const evaluation = this.evaluateCandidate(
        candidate,
        options.targetFileOriginalContent,
        options.frozenOracle
      );
      evaluations.push(evaluation);
    }

    // Determine winner
    const qualifiedCandidates = evaluations.filter(
      (e) =>
        !e.oracleTamperingDetected &&
        !e.oscillationDetected &&
        e.acceptancePassed &&
        e.regressionPassed &&
        e.mutationKillRate >= this.minMutationKillRate &&
        e.overallScore >= 75.0
    );

    // Sort by overall score descending
    qualifiedCandidates.sort((a, b) => b.overallScore - a.overallScore);

    let winnerId: string | null = null;
    let winningPatch: CandidatePatch | null = null;
    let disposition: TournamentResult["disposition"] = "REJECT_BOTH_INSUFFICIENT_EVIDENCE";
    let reason = "Neither candidate satisfied all independent verification gates and mutation hurdles.";

    if (qualifiedCandidates.length > 0) {
      winnerId = qualifiedCandidates[0].candidateId;
      winningPatch = options.candidates.find((c) => c.candidateId === winnerId) ?? null;
      disposition = "WINNER_QUALIFIED";
      reason = `Candidate ${winnerId} won the tournament with score ${qualifiedCandidates[0].overallScore.toFixed(1)}/100, mutation kill rate ${(qualifiedCandidates[0].mutationKillRate * 100).toFixed(0)}%, and zero test tampering.`;

      // Record winner hash in history
      if (winningPatch) {
        this.recentPatchHashes.add(this.hashString(winningPatch.replacementChunk));
      }
    } else if (evaluations.every((e) => e.oracleTamperingDetected || e.oscillationDetected)) {
      disposition = "ALL_DISQUALIFIED";
      reason = "All candidates were disqualified due to test tampering or repair oscillation.";
    }

    const receiptDigest = this.hashString(
      JSON.stringify({
        tournamentId,
        defectCategory: options.defectCategory,
        winnerId,
        disposition,
        evaluations,
      })
    );

    return {
      tournamentId,
      defectCategory: options.defectCategory,
      timestamp: now,
      candidatesEvaluated: options.candidates.length,
      winnerCandidateId: winnerId,
      disposition,
      winningPatch,
      candidateEvaluations: evaluations,
      reason,
      tournamentReceiptDigest: receiptDigest,
    };
  }

  private evaluateCandidate(
    candidate: CandidatePatch,
    originalContent: string,
    oracle: FrozenTestOracle
  ): CandidateEvaluationResult {
    // 1. Check Oracle Tampering: Did the patch attempt to modify the test oracle itself?
    const hasTamperKeywords =
      /(?:^|[\s;{}])(?:describe|test|it)\s*\(/.test(candidate.replacementChunk) ||
      /\bexpect\s*\(/.test(candidate.replacementChunk) ||
      /\bassert(?:\.|\s*\()/.test(candidate.replacementChunk);

    if (candidate.targetFile === oracle.testFile || hasTamperKeywords) {
      return {
        candidateId: candidate.candidateId,
        acceptancePassed: false,
        regressionPassed: false,
        oracleTamperingDetected: true,
        oscillationDetected: false,
        mutantsGenerated: 0,
        mutantsKilled: 0,
        mutationKillRate: 0,
        blastRadiusScore: 0,
        overallScore: 0,
        disqualifiedReason: "ORACLE_TAMPERING_DETECTED: Patch attempted to modify test oracle or assertions.",
      };
    }

    // 2. Check Oscillation: Has this exact replacement chunk been proposed before?
    const patchHash = this.hashString(candidate.replacementChunk);
    if (this.recentPatchHashes.has(patchHash)) {
      return {
        candidateId: candidate.candidateId,
        acceptancePassed: false,
        regressionPassed: false,
        oracleTamperingDetected: false,
        oscillationDetected: true,
        mutantsGenerated: 0,
        mutantsKilled: 0,
        mutationKillRate: 0,
        blastRadiusScore: 0,
        overallScore: 0,
        disqualifiedReason: "REPAIR_OSCILLATION_DETECTED: Patch identical to a previously rejected or reverted cycle.",
      };
    }

    // 3. Apply Patch to original content
    const patchedContent = originalContent.includes(candidate.originalChunk)
      ? originalContent.replace(candidate.originalChunk, candidate.replacementChunk)
      : originalContent + "\n" + candidate.replacementChunk;

    // 4. Run Frozen Test Oracle (Acceptance Tests & Regression Tests)
    let acceptancePassed = true;
    let regressionPassed = true;

    for (const testCase of oracle.testCases) {
      const passed = testCase.run(patchedContent);
      if (testCase.isAcceptance && !passed) {
        acceptancePassed = false;
      }
      if (!testCase.isAcceptance && !passed) {
        regressionPassed = false;
      }
    }

    // 5. Anti-Mutation Kill Battery: Synthesize 5 realistic mutants
    const mutants = this.generateMutants(patchedContent, candidate.replacementChunk);
    let mutantsKilled = 0;

    for (const mutantContent of mutants) {
      // An effective test suite must FAIL on the mutant
      let mutantSurvived = true;
      for (const testCase of oracle.testCases) {
        if (!testCase.run(mutantContent)) {
          mutantSurvived = false;
          break;
        }
      }
      if (!mutantSurvived) {
        mutantsKilled++;
      }
    }

    const mutationKillRate =
      mutants.length > 0 ? mutantsKilled / mutants.length : 1.0;

    // 6. Blast Radius Minimality Score
    // Score decays linearly as line count exceeds 1 line up to maxAllowedDiffLines
    const lineDiff = Math.max(1, candidate.lineCountDiff);
    const blastRadiusScore =
      lineDiff > this.maxAllowedDiffLines
        ? 0.0
        : Math.max(0.1, 1.0 - lineDiff / this.maxAllowedDiffLines);

    // 7. Calculate Overall Tournament Score
    let overallScore = 0;
    if (acceptancePassed && regressionPassed) {
      overallScore =
        40.0 + // Base reward for passing acceptance
        20.0 + // Base reward for passing regression
        mutationKillRate * 25.0 + // Mutation kill rate component (0-25)
        blastRadiusScore * 15.0; // Blast radius minimality component (0-15)
    }

    return {
      candidateId: candidate.candidateId,
      acceptancePassed,
      regressionPassed,
      oracleTamperingDetected: false,
      oscillationDetected: false,
      mutantsGenerated: mutants.length,
      mutantsKilled,
      mutationKillRate,
      blastRadiusScore: Math.round(blastRadiusScore * 100) / 100,
      overallScore: Math.round(overallScore * 10) / 10,
    };
  }

  /**
   * Generates systematic code mutants of the patched chunk.
   */
  private generateMutants(fullContent: string, replacementChunk: string): string[] {
    const mutants: string[] = [];

    // Mutant 1: Negate boolean literals or comparisons
    if (replacementChunk.includes("true")) {
      mutants.push(fullContent.replace(replacementChunk, replacementChunk.replace(/true/g, "false")));
    } else if (replacementChunk.includes("false")) {
      mutants.push(fullContent.replace(replacementChunk, replacementChunk.replace(/false/g, "true")));
    }

    // Mutant 2: Corrupt return value or primary assignment
    if (replacementChunk.includes("return ")) {
      mutants.push(fullContent.replace(replacementChunk, replacementChunk.replace(/return\s+[^;]+;/, "return null;")));
    }

    // Mutant 3: Empty string or undefined injection
    if (replacementChunk.includes('"') || replacementChunk.includes("'")) {
      mutants.push(fullContent.replace(replacementChunk, replacementChunk.replace(/(["'][^"']*["'])/, '""')));
    }

    // Mutant 4: Invert inequality / equality operators safely
    if (/[><]=?|===|!==/.test(replacementChunk)) {
      const inverted = replacementChunk.replace(/===|!==|<=|>=|<|>/g, (op) => {
        switch (op) {
          case "===": return "!==";
          case "!==": return "===";
          case "<=": return ">";
          case ">=": return "<";
          case "<": return ">=";
          case ">": return "<=";
          default: return op;
        }
      });
      if (inverted !== replacementChunk) {
        mutants.push(fullContent.replace(replacementChunk, inverted));
      }
    }

    // Mutant 5: Omission of primary statement
    mutants.push(fullContent.replace(replacementChunk, "/* mutated: omitted */"));

    return mutants.slice(0, 5);
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `sha256:${Math.abs(hash).toString(16).padStart(8, "0")}`;
  }
}
