/**
 * SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1) Web Studio Types
 * October 12, 2026 | Universal & Pro Engine
 */

export const NANOS_PER_USD = 1_000_000_000;

export type InformationClass =
  | "PROTECTED_REQUIREMENTS"
  | "EXACT_BYTE_MATERIAL"
  | "EVIDENCE_BEARING_MATERIAL"
  | "REPLACEABLE_CONTEXT"
  | "VOLATILE_INFORMATION";

export type TechniqueType =
  | "JSON_MINIFICATION"
  | "OUTPUT_TOKEN_BUDGET_2048"
  | "WHITESPACE_NORMALIZATION"
  | "CONTEXT_WINDOW_TRIM"
  | "DUPLICATE_MESSAGE_COLLAPSE"
  | "EXACT_MATCH_RESPONSE_CACHE"
  | "CONCISE_OUTPUT_INSTRUCTION"
  | "SIMPLE_QUERY_MODEL_ROUTING";

export type TechniqueSetting = "FORCE_OFF" | "FORCE_ON" | "AUTO" | "DEFAULT";

export type ExperienceLevel = "IMMEDIATE" | "EXPERT" | "DISCOVERY";

export type ConservationStatus = "CONSERVED" | "DEGRADED" | "VIOLATED" | "UNKNOWN";

export interface InformationNode {
  nodeId: string;
  classification: InformationClass;
  content: string;
  byteHash: string;
  invariants: string[];
  freshnessTimestamp?: number;
  invalidationConditions: string[];
  isValid: boolean;
}

export interface SemanticDiff {
  addedTokens: number;
  removedTokens: number;
  preservedInvariants: string[];
  violatedInvariants: string[];
  informationLossScore: number;
  isConservative: boolean;
  explanation: string;
}

export interface OptimizationCandidate {
  candidateId: string;
  technique: TechniqueType;
  sourceContent: string;
  transformedContent: string;
  diff: SemanticDiff;
  status: ConservationStatus;
  rejectionReason?: string;
}

export interface ComputationalAction {
  actionId: string;
  name: string;
  expectedDeltaQ: number; // in [0, 1]
  expectedCostNanos: number; // in NanoUSD integer
  expectedLatencyMs: number;
  actionType: string;
}

export interface ExecutionStrategy {
  strategyId: string;
  experienceLevel: ExperienceLevel;
  modelName: string;
  reasoningBudget: number;
  techniquesEnabled: Record<TechniqueType, TechniqueSetting>;
  cachePolicy: string;
  contextStrategy: string;
  verificationDepth: string;
  estimatedCostNanos: number;
  estimatedLatencyMs: number;
  predictedSuccessProb: number;
  isFeasible?: boolean;
  infeasibilityReason?: string;
}

export interface CounterfactualScenario {
  scenarioId: string;
  name: string;
  adversarialTest: string;
  testType: string;
  expectedPassed: boolean;
  passed: boolean;
  details: string;
}

export interface VsodMetrics {
  nVerifiedSuccesses: number;
  totalCostNanos: number;
  totalCostUsd: number;
  vsodScore: number;
  tokensSaved: number;
  latencyP95Ms: number;
  criticalFailures: number;
}

export interface EGACE01Task {
  taskId: string;
  taskType: string;
  rawInput: string;
  isCanary: boolean;
}

export interface EGACE01Result {
  experimentName: string;
  nTrials: number;
  controlTokens: number;
  treatmentTokens: number;
  tokenReductionPct: number;
  controlCostNanos: number;
  treatmentCostNanos: number;
  netSavingsNanos: number;
  controlLatencyMs: number;
  treatmentLatencyMs: number;
  jsonParseEqualityRate: number;
  canaryFailures: number;
  passedPromotionGate: boolean;
  pValue: number;
  categoryStats?: Record<
    string,
    {
      trials: number;
      tokenReductionPct: number;
      parseEqualityRate: number;
      canaryFailures: number;
    }
  >;
}

