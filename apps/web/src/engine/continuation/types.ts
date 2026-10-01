/**
 * SPE Research-Grounded Task Continuation Engine — Type Contracts
 *
 * Enforces strict epistemic invariants:
 * - CLAIMED != VERIFIED
 * - SOURCE_PRESENT != EXECUTION_PROVEN
 * - EXIT_0 != ASSERTIONS_OBSERVED
 * - UNKNOWN != PASS
 * - GILDEN_CAN_SELF_GRANT_AUTHORITY = NO
 */

import type { TargetModelId } from "../targetModelConfig";

export type ContinuationAuthority = "REVIEW_ONLY" | "ADVISORY_ONLY";

export type VerificationLevel =
  | "REPORTED"
  | "DIGEST_BOUND"
  | "TRUSTED_EXECUTOR_OBSERVED"
  | "INDEPENDENTLY_REPRODUCED";

export type ClaimType =
  | "IMPLEMENTATION"
  | "EXECUTION"
  | "PERFORMANCE"
  | "SECURITY"
  | "SPECIFICATION";

export type ClaimDisposition =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "UNVERIFIED"
  | "OUT_OF_SCOPE";

export type ReviewVerdict = "PASS" | "HOLD" | "FAIL";

export type EvidenceEdgeRelation =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "PARTIAL"
  | "IRRELEVANT"
  | "UNKNOWN";

export type SourceType =
  | "SPECIFICATION"
  | "OFFICIAL_DOCS"
  | "PEER_REVIEWED_PAPER"
  | "EMPIRICAL_STUDY"
  | "BENCHMARK_PAPER"
  | "PREPRINT"
  | "SECONDARY_SOURCE";

export interface ArtifactRef {
  path: string;
  blobDigest: string; // SHA-256
  mimeType?: string;
  locator?: string;
}

export interface ProofReceipt {
  receiptId: string;
  candidateSha: string;
  patchDigest?: string;
  environmentDigest?: string;
  harnessDigest?: string;
  testSelectionDigest?: string;
  totalSelectedTests: number;
  skippedTests: number;
  failedTests: number;
  argv: string[];
  exitCode: number;
  stdoutRef?: string;
  stderrRef?: string;
  producerIdentity: string;
  verificationLevel: VerificationLevel;
}

export interface ClaimSpan {
  start: number;
  end: number;
  rawText: string;
}

export interface ClaimRecord {
  claimId: string;
  claimText: string;
  claimType: ClaimType;
  claimSpan: ClaimSpan;
  disposition: ClaimDisposition;
  boundReceiptId?: string;
  boundArtifactPath?: string;
  verificationRationale: string;
}

export interface ScholarlySourceRecord {
  sourceId: string;
  sourceType: SourceType;
  identifier: string; // DOI, arXiv ID, RFC number, W3C spec URL
  title: string;
  authors: string[];
  year: number;
  isRetracted: boolean;
  retractionDetails?: string;
  normativeApplicability: EvidenceEdgeRelation;
  keyFinding: string;
  sourceSaysText: string;
  speInferenceText: string;
  evidenceTier: "[PROVEN_SPEC]" | "[EMPIRICAL_BENCHMARK]" | "[HEURISTIC_HYPOTHESIS]";
}

export interface EvidenceEdge {
  edgeId: string;
  claimId: string;
  sourceId: string;
  relation: EvidenceEdgeRelation;
  locator?: string;
  limitations: string[];
}

export interface ContradictionFinding {
  contradictionId: string;
  claimId: string;
  observedText: string;
  conflictingEvidence: string;
  severity: "FATAL" | "WARNING";
}

export interface EvidenceGap {
  gapId: string;
  claimId: string;
  description: string;
  missingProofType: "EXECUTION" | "SPECIFICATION" | "BENCHMARK" | "SAFETY";
}

export interface ReviewedReport {
  taskId: string;
  candidateSha: string;
  verdict: ReviewVerdict;
  materialReportCoverage: number; // Must be 1.0 (100%) for PASS
  totalClaimsCount: number;
  supportedClaimsCount: number;
  unverifiedClaimsCount: number;
  contradictedClaimsCount: number;
  claims: ClaimRecord[];
  proofReceipts: ProofReceipt[];
  contradictions: ContradictionFinding[];
  gaps: EvidenceGap[];
  unknowns: string[];
  formattedReportText: string;
}

export interface ReviewSubmission {
  taskId: string;
  originalTask: string;
  targetAgent: TargetModelId | "cursor" | "grok" | "local_coder" | "generic";
  previousPrompt?: string | null;
  agentReport: string;
  candidateSha: string;
  patchDigest?: string | null;
  artifacts?: ArtifactRef[];
  testReceipts?: ProofReceipt[];
  logs?: string[];
  diffRefs?: string[];
  authority: ContinuationAuthority; // Must be REVIEW_ONLY
  researchConsent?: boolean;
}

export interface ContinuationContract {
  contractId: string;
  taskId: string;
  baselineSha: string;
  targetProfile: string;
  authority: "ADVISORY_ONLY";
  mission: string;
  immutableProtectedIntent: string;
  fileAllowlist: string[];
  exclusions: string[];
  verifiedEvidence: string[];
  unknowns: string[];
  contradictions: string[];
  orderedExecutionSteps: string[];
  requiredTestGates: string[];
  stopConditions: string[];
  nextTaskPrompt: string;
}

export interface ClaimEvidenceGraph {
  claims: Record<string, ClaimRecord>;
  sources: Record<string, ScholarlySourceRecord>;
  edges: EvidenceEdge[];
}
