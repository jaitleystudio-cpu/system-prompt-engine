/**
 * SPE AGI BRAIN Ω — Frontier-Science Core Data Models & Types
 * October 12, 2026 | Web Studio Core
 */

export const NANOS_PER_USD = 1_000_000_000;

export type DomainType =
  | "MATHEMATICS"
  | "PHYSICS"
  | "COMPUTER_SCIENCE"
  | "CHEMISTRY"
  | "BIOLOGY"
  | "ELECTRONICS"
  | "MATERIALS_SCIENCE"
  | "ECONOMICS";

export type InventionStrategy =
  | "CONTRADICTION_DRIVEN"
  | "CROSS_DOMAIN_TRANSFER"
  | "INVERSE_DESIGN"
  | "FIRST_PRINCIPLES"
  | "EVOLUTIONARY_PROGRAM_SEARCH"
  | "NEURO_SYMBOLIC_SYNTHESIS"
  | "CAUSAL_INTERVENTION"
  | "CONSTRAINT_RELAXATION"
  | "BOUNDARY_CONDITION_SEARCH"
  | "REPRESENTATION_DISCOVERY"
  | "COMPOSITIONAL_INVENTION"
  | "COUNTEREXAMPLE_GUIDED";

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "UNKNOWN"
  | "REJECTED";

export type ProvenanceType =
  | "VERIFIED_EXPERIMENTAL"
  | "CITED_PEER_REVIEWED"
  | "PROPOSED_UNEXECUTED"
  | "THEORETICAL_DERIVATION"
  | "SPECULATIVE_HYPOTHESIS";

export interface ScientificObjective {
  objectiveId: string;
  description: string;
  domain: DomainType;
  frozenIntent: string;
  hardConstraints: string[];
}

export interface KnowledgeState {
  theoreticalAssumptions: string[];
  definitions: Record<string, string>;
  boundaryConditions: string[];
  directEvidenceClaims: string[];
  citationChainClaims: string[];
  divergentPredictions: Array<{
    theoryA: string;
    theoryB: string;
    divergencePoint: string;
  }>;
  unresolvedGaps: string[];
}

export interface WorldModelInstance {
  modelId: string;
  domain: DomainType;
  executableRepresentation: string;
  simulatedPredictions: Record<string, unknown>;
  independentObservations: Record<string, unknown>;
  formalLeanStatement?: string;
  isFalsified: boolean;
}

export interface InventionCandidate {
  candidateId: string;
  strategy: InventionStrategy;
  hypothesisStatement: string;
  mechanism: string;
  feasibilityScore: number; // 0.0 to 1.0
  noveltyScore: number;     // 0.0 to 1.0
  testabilityScore: number; // 0.0 to 1.0
  priorArtOverlap: number;  // 0.0 to 1.0
}

export interface VerificationResult {
  resultId: string;
  candidateId: string;
  status: VerificationStatus;
  formalProofVerified: boolean;
  propertyTestsPassed: number;
  propertyTestsTotal: number;
  statisticalPValue?: number;
  reasons: string[];
  receiptHash: string;
}

export interface ClaimEvidenceLink {
  claimId: string;
  statement: string;
  provenance: ProvenanceType;
  evidenceRef: string;
}

export interface SectionNode {
  sectionId: string;
  title: string;
  targetWords: number;
  dependencies: string[];
  claims: ClaimEvidenceLink[];
  content: string;
}

export interface ChapterNode {
  chapterId: string;
  title: string;
  sections: SectionNode[];
}

export interface DocumentSpecification {
  docId: string;
  title: string;
  targetWordCount: number;
  chapters: ChapterNode[];
  isConsistent: boolean;
  actualWordCount: number;
}

export interface GildenMaintenanceEvent {
  eventId: string;
  category: string;
  diagnostic: string;
  proposedPatch: string;
  isAuthorized: boolean;
  costNanoUsd: number;
  isReversible: boolean;
  auditReceipt: string;
  timestamp: string;
}

export interface ScientificPromptContract {
  originalObjective: string;
  optimizedSpecification: string;
  executionRecord: string;
  materialImprovementRationale: string;
  finalDeliverable: string;
  verificationStatus: VerificationStatus;
}

export interface DiscoveryUtilityMetrics {
  deltaKVerified: number;
  deltaTTransfer: number;
  lambdaTransfer: number;
  costComputeNanos: number;
  costMeasurementNanos: number;
  costHumanNanos: number;
  falseAcceptancePenalty: number;
  utilityScore: number;
}
