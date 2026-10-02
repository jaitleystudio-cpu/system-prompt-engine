/**
 * SPE Research-Grounded Task Continuation Engine — Unified API
 *
 * Orchestrates:
 * - Wave RT-A: Report Verifier & Proof Binding
 * - Wave RT-B: Scholarly Research Retrieval Fabric
 * - Wave RT-C: Claim-Evidence Graph & Contradiction / Gap Mapper
 * - Wave RT-D: Continuation Compiler & Target Model Export
 * - Wave RT-E: Gilden Boundary & Loop Controller
 */

export * from "./types";
export * from "./reportVerifier";
export * from "./researchFabric";
export * from "./liveScholarlyFabric";
export * from "./livePromotionGate";
export { mayPromoteLiveIndex, mayPromoteLiveRetraction } from "./liveScholarlyFabric";
export * from "./evidenceGraph";
export * from "./continuationCompiler";
export * from "./gildenBoundary";
export * from "./oracleGuards";

import type { ReviewSubmission } from "./types";
import { verifyTaskReport } from "./reportVerifier";
import { evaluateEvidenceNeed, acquireScholarlyEvidence } from "./researchFabric";
import { buildClaimEvidenceGraph, mapContradictionsAndGaps } from "./evidenceGraph";
import { compileContinuationContract } from "./continuationCompiler";
import { processGildenReview, type GildenReviewOutput } from "./gildenBoundary";

export interface TaskContinuationPipelineResult {
  gildenReview: GildenReviewOutput;
  evidenceNeed: ReturnType<typeof evaluateEvidenceNeed>;
  researchAcquisition: ReturnType<typeof acquireScholarlyEvidence>;
  claimEvidenceGraph: ReturnType<typeof buildClaimEvidenceGraph>;
  graphSummary: ReturnType<typeof mapContradictionsAndGaps>;
}

/**
 * End-to-end execution pipeline for research-grounded task review and continuation.
 */
export function runTaskContinuationPipeline(
  submission: ReviewSubmission,
  cycleCount: number = 1
): TaskContinuationPipelineResult {
  const review = verifyTaskReport(submission);

  const evidenceNeed = evaluateEvidenceNeed(submission.originalTask, review.claims);
  const researchAcquisition = acquireScholarlyEvidence(
    evidenceNeed,
    submission.researchConsent === true,
    {
      sourceMode: submission.sourceMode,
    },
  );

  const claimEvidenceGraph = buildClaimEvidenceGraph(
    review.claims,
    researchAcquisition.sources
  );
  const graphSummary = mapContradictionsAndGaps(claimEvidenceGraph);

  for (const ctrd of graphSummary.contradictions) {
    if (!review.contradictions.some((c) => c.contradictionId === ctrd.contradictionId)) {
      review.contradictions.push(ctrd);
    }
  }

  const continuationContract = compileContinuationContract(
    submission,
    review,
    claimEvidenceGraph
  );

  const gildenReview = processGildenReview(
    submission,
    review,
    continuationContract,
    cycleCount
  );

  return {
    gildenReview,
    evidenceNeed,
    researchAcquisition,
    claimEvidenceGraph,
    graphSummary,
  };
}
