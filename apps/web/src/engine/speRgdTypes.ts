/**
 * SPE Ω PRO — Scientific Discovery Engine (RGD-1) Types
 * October 12, 2026 | Universal & Pro Engine
 */

export const NANOS_PER_USD = 1_000_000_000;

export type EvidenceAccessLevel = "METADATA" | "ABSTRACT" | "FULL_TEXT";

export type EvidenceRelationship = "SUPPORT" | "CONTRADICTION" | "UNKNOWN";

export type ResearchVerificationStatus =
  | "SUPPORTED_WITHIN_TESTED_SCOPE"
  | "CONTRADICTED"
  | "INCONCLUSIVE"
  | "NOT_VERIFIED";

export type ResponseSpeedClass =
  | "INSTANT_DISCOVERY"
  | "EVIDENCE_ANSWER"
  | "DEEP_DISCOVERY";

export type ReproductionStatus = "REPRODUCED" | "UNTESTED" | "FAILED";

export interface ResearchMission {
  missionId: string;
  objective: string;
  targetDomain: string;
  measurableConstraints: string[];
  unresolvedAssumptions: string[];
  compiledPrompt: string;
  executionPlan: string[];
  speedClass: ResponseSpeedClass;
  createdAt: number;
  budgetNanos: number;
}

export interface ScholarlyRecord {
  recordId: string;
  title: string;
  authors: string[];
  year: number;
  doi: string;
  venue: string;
  corpusType: string; // "curated_core", "expansion", "preprint", "dataset", "withdrawn"
  accessLevel: EvidenceAccessLevel;
  abstract?: string;
  fullTextSnippet?: string;
  citationCount: number;
  isRetracted: boolean;
  qualityScore: number; // 0.0 to 1.0
  domain?: string;
}

/**
 * 11-field standardized evidence structure extracted from scholarly manuscripts
 */
export interface StructuredEvidence {
  evidenceId: string;
  recordId: string;
  researchQuestion: string;
  hypothesis: string;
  method: string;
  populationOrMaterial: string;
  interventionOrMechanism: string;
  results: string;
  statisticalEvidence: string;
  limitations: string;
  reproducibility: string;
  provenance: string;
  scientificRelationship: EvidenceRelationship;
  accessLevel: EvidenceAccessLevel;
}

export interface EvidenceEdge {
  sourceId: string;
  targetId: string;
  note: string;
}

export interface EvidenceGraph {
  graphId: string;
  nodes: Record<string, StructuredEvidence>;
  supportEdges: EvidenceEdge[];
  contradictionEdges: EvidenceEdge[];
  unknownEdges: EvidenceEdge[];
  unresolvedUncertainties: string[];
}

export interface CompetingTheory {
  theoryId: string;
  name: string;
  statement: string;
  mechanism: string;
  priorProbability: number;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
}

export interface DiscriminatingExperiment {
  experimentId: string;
  name: string;
  hypothesisAddressed: string;
  proposedProtocol: string;
  expectedDeltaR: number; // in [0.0, 1.0]
  expectedCostNanos: number; // in exact NanoUSD
  expectedTimeSec: number;
  voiScore: number; // U(e) = Delta R / (C(e) + lambda * T(e))
  simulatedOutcomes: Record<string, number>;
}

export interface ResearchVerificationCertificate {
  certificateId: string;
  claim: string;
  sourceIdentity: string;
  evidenceLocation: string;
  evidenceRelationship: EvidenceRelationship;
  methodologyCheck: boolean;
  statisticalCheck: boolean;
  reproductionState: ReproductionStatus;
  contradictions: string[];
  freshnessState: string;
  qualification: ResearchVerificationStatus;
  sha256Seal: string;
  timestamp: number;
}

export interface CompoundingProcedure {
  procedureId: string;
  domain: string;
  name: string;
  qualificationVerdict: string;
  testedTasksCount: number;
  assumptions: string[];
  isValid: boolean;
  invalidationReason?: string;
  costSavingsPct: number;
  sha256Seal: string;
}

export interface DeepResearchSection {
  sectionId: string;
  chapterIndex: number;
  title: string;
  targetWordCount: number;
  generatedWordCount: number;
  content: string;
  registeredSymbols: string[];
  registeredDois: string[];
  isCheckpointed: boolean;
}

export interface DeepResearchJob {
  jobId: string;
  missionId: string;
  title: string;
  targetTotalWords: number;
  sections: DeepResearchSection[];
  globalSymbolRegistry: Record<string, string>;
  globalReferenceRegistry: string[];
  isCompleted: boolean;
  finalWordCount: number;
  consistencyVerified: boolean;
}

export interface Rgd1Result {
  resultId: string;
  mission: ResearchMission;
  recordsScanned: number;
  structuredEvidences: StructuredEvidence[];
  evidenceGraph: EvidenceGraph;
  competingTheories: CompetingTheory[];
  selectedExperiments: DiscriminatingExperiment[];
  certificates: ResearchVerificationCertificate[];
  compoundingProcedureId?: string;
  speedClassAchieved: ResponseSpeedClass;
  elapsedMs: number;
  totalCostNanos: number;
}
