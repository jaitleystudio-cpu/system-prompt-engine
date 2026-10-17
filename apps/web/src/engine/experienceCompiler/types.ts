/**
 * SPE Ω — Intent-to-Experience Compiler Types
 *
 * Mandate:
 * Grounded in Denotational Semantics and Kleene-3 Monotone Lattices.
 * Represents verified software capabilities and their deterministic projections
 * across Human, Search, and Agent surfaces.
 */

export type ParameterType = "string" | "number" | "boolean" | "array" | "object";

export interface CapabilityParameter {
  name: string;
  type: ParameterType;
  description: string;
  required: boolean;
  defaultValue?: unknown;
  validationPattern?: string;
  min?: number;
  max?: number;
  allowedValues?: string[];
  humanLabel: string;
  placeholder?: string;
}

export interface CapabilityReturnSpec {
  type: ParameterType;
  description: string;
  schema?: Record<string, unknown>;
}

export interface VerifiedCapabilityContract {
  key: string;
  title: string;
  description: string;
  category: "COMPILER" | "AUDIT" | "GOVERNANCE" | "SECURITY" | "WORKFLOW";
  parameters: CapabilityParameter[];
  returns: CapabilityReturnSpec;
  verificationProof: {
    ruleVerifier: string;
    canonicalHash: string;
    offlineWasmRunnable: boolean;
  };
  requiresElevation: boolean;
  allowedScopes: string[];
}

export interface HumanFormField {
  id: string;
  paramName: string;
  label: string;
  helpText: string;
  widgetType: "text" | "textarea" | "number" | "select" | "toggle";
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
  validationErrorText: string;
}

export interface HumanExperienceContract {
  formId: string;
  title: string;
  subtitle: string;
  fields: HumanFormField[];
  submitButtonText: string;
  loadingStateText: string;
  successAnnouncementText: string;
  keyboardShortcut: string;
  offlineIndicator: boolean;
  iso24495Compliant: boolean;
}

export interface SearchExperienceContract {
  canonicalPath: string;
  isIndexable: boolean;
  titleTag: string;
  metaDescription: string;
  schemaOrgJsonLd: {
    "@context": "https://schema.org";
    "@type": "SoftwareApplication" | "HowTo";
    name: string;
    description: string;
    applicationCategory: string;
    operatingSystem: string;
    offers?: {
      "@type": "Offer";
      price: string;
      priceCurrency: string;
    };
    step?: Array<{
      "@type": "HowToStep";
      name: string;
      text: string;
    }>;
  };
  workedExample: {
    inputSummary: string;
    outputDemonstration: string;
  };
  keywords: string[];
}

export interface AgentExperienceContract {
  toolName: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      pattern?: string;
    }>;
    required: string[];
  };
  returns: {
    type: string;
    description: string;
  };
  requiredScope: string;
  rateLimitPerMinute: number;
  offlineWasmExecutable: boolean;
}

export interface TriViewCompilationResult {
  capabilityKey: string;
  compiledAt: string;
  rfc8785Digest: string;
  humanExperience: HumanExperienceContract;
  searchExperience: SearchExperienceContract;
  agentExperience: AgentExperienceContract;
}

export interface FirewallCheckIssue {
  code: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
  conflictingViews: Array<"HUMAN" | "SEARCH" | "AGENT">;
  remediation: string;
}

export interface FirewallVerificationReport {
  timestamp: string;
  capabilityKey: string;
  status: "PASSED" | "FAILED";
  semanticConsistencyScore: number; // 0.0 to 1.0
  issues: FirewallCheckIssue[];
  metrics: {
    parameterParityConfirmed: boolean;
    zeroExcessSearchClaims: boolean;
    agentSecurityBounded: boolean;
    a11yContrastCompliant: boolean;
    airGapZeroEgressEnforced: boolean;
  };
}
