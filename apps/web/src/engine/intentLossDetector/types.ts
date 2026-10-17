/**
 * SPE Ω — Intent Loss Detector (ILD) Types & Contracts
 * Crown Breakthrough Capability #1
 *
 * Epistemic Grounding:
 * - ST-WebAgentBench (ICLR 2026): Policy compliance vs nominal task completion
 * - Measuring Intent Comprehension in LLMs (2025)
 * - Counterfactual Specification Closure (CSC) & Kleene-3 Lattice
 */

export type RequirementCategory =
  | "NEGATIVE_CONSTRAINT"    // "must not", "never", "do not", "forbidden"
  | "MANDATORY_POSITIVE"    // "must", "shall", "always", "require"
  | "OPTIONAL_PREFERENCE"    // "prefer", "optional", "if possible"
  | "BOUNDARY_CONDITION"     // Token limit, memory budget, latency, offline airgap
  | "FORMAT_CONSTRAINT"      // "JSON only", "Markdown table", "TypeScript"
  | "DOMAIN_ROLE";           // "You are a senior Rust engineer"

export type RequirementCriticality = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type RequirementVerificationState =
  | "PRESERVED"
  | "DROPPED"
  | "WEAKENED"
  | "CONTRADICTED"
  | "UNCERTAIN";

export type LossSeverity =
  | "CRITICAL_INTENT_LOSS"
  | "HIGH_RISK_DROPPED_NEGATIVE_CONSTRAINT"
  | "MODERATE_OPTIONAL_DEGRADATION"
  | "BENIGN_EXPANSION"
  | "ZERO_LOSS";

export interface ExtractedRequirement {
  id: string;
  category: RequirementCategory;
  originalText: string;
  normalizedSubject: string;
  normalizedPredicate: string;
  isNegative: boolean;
  criticality: RequirementCriticality;
  forbiddenKeywords: string[];
  requiredKeywords: string[];
  sourceOrigin: "USER_INPUT" | "INTENT_ATOM" | "WORKSPACE_CONFIRMED" | "SYSTEM_INVARIANT";
}

export interface IntentLossFinding {
  requirementId: string;
  requirement: ExtractedRequirement;
  state: RequirementVerificationState;
  severity: LossSeverity;
  confidence: number;
  evidenceExcerpt: string;
  explanation: string;
  remediationPromptPatch: string;
}

export interface IntentLossReport {
  timestamp: string;
  sourceIntentHash: string;
  synthesizedPromptHash: string;
  totalRequirements: number;
  preservedCount: number;
  droppedCount: number;
  weakenedCount: number;
  contradictedCount: number;
  droppedNegativeConstraints: number;
  fidelityScore: number; // 0.0 to 1.0
  passed: boolean;
  criticalDefectsDetected: boolean;
  findings: IntentLossFinding[];
  restorationSuggestion: {
    recommendedAction: string;
    restoredPrompt: string;
    reconstructedRules: string[];
  };
}
