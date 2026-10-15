/**
 * SPE Ω — Autonomous Website Evolution Types & Contracts
 *
 * Mandate:
 * Grounded in peer-reviewed research (SWE-bench Goes Live! NeurIPS 2025,
 * SAGEO Arena KDD 2026, LOLA Marketing Science 2024, When Errors Become Narratives 2026)
 * and official specs (Google Search Console API, Google Search Central, WCAG 2.2).
 *
 * Defines:
 * - Autonomy Levels L0-L5
 * - Risk Classification: LOW, MEDIUM, HIGH
 * - Proof-Carrying Website Change Proposals
 * - Traceable Evidence Receipts
 * - 3-View Verification Contracts
 * - Search Console Analytics & Query-Intent Contracts
 */

export type AutonomyLevel =
  | "L0_OBSERVE"          // Read-only health, SEO, visual, and telemetry evidence
  | "L1_DIAGNOSE"         // Identify root cause and recommend intervention
  | "L2_PREPARE"          // Produce isolated repair branch and patch PR
  | "L3_QUALIFY"          // Execute test suites, negative controls, and mutation checks
  | "L4_LIMITED_AUTO_RELEASE" // Promote allowlisted LOW-RISK mechanical repairs
  | "L5_HUMAN_AUTHORIZED" // Required for visual, SEO, copy, security, billing, routing

export type ChangeRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ProposalStatus =
  | "PROPOSED"
  | "REPRODUCED"
  | "PATCH_PREPARED"
  | "QUALIFIED"
  | "APPROVED_FOR_RELEASE"
  | "PROMOTED"
  | "REJECTED"
  | "ROLLED_BACK"
  | "HELD_INCONCLUSIVE";

export type DefectCategory =
  | "BROKEN_INTERNAL_LINK"
  | "CANONICAL_CONFLICT"
  | "ACCIDENTAL_NOINDEX"
  | "SITEMAP_INCONSISTENCY"
  | "INVALID_STRUCTURED_DATA"
  | "KEYWORD_STUFFING"
  | "FABRICATED_CLAIM"
  | "DUPLICATE_PAGE"
  | "INELIGIBLE_INDEXING_API"
  | "MOBILE_CLIPPING"
  | "HIDDEN_CTA"
  | "KEYBOARD_NAV_BROKEN"
  | "A11Y_SCREEN_READER"
  | "LCP_REGRESSION"
  | "CLS_REGRESSION"
  | "HYDRATION_FAILURE"
  | "OBSERVABILITY_SILENT_ERROR"
  | "FALSE_SUCCESS_CLAIM"
  | "TEST_TAMPERING_REWARD_HACK"
  | "PROMPT_INJECTION_EXTERNAL"
  | "MODEL_NAME_REGISTRY_DRIFT"
  | "SPE_COMPATIBILITY_REGRESSION"
  | "CONCURRENT_JOB_CONFLICT"
  | "INTERRUPTED_DEPLOYMENT"
  | "SPARSE_SEARCH_DATA"
  | "GOOGLE_API_OUTAGE"
  | "OSCILLATION_REPEATED_FAILURE"
  | "UNAUTHORIZED_PRODUCTION_WRITE"
  | "DECEPTIVE_VISUAL_PASS"
  | "ROLLBACK_FAILURE";

export interface EvidenceReceipt {
  id: string;
  source: "GSC" | "PLAYWRIGHT" | "LIGHTHOUSE" | "SENTRY" | "USER_JOURNEY" | "INDEPENDENT_ORACLE" | "POLICY_SCANNER";
  timestamp: string;
  payloadDigest: string;
  isFinalized: boolean;
  confidenceScore: number;
  rawDetails: Record<string, unknown>;
}

export interface SearchConsoleQueryRow {
  query: string;
  page: string;
  country: string;
  device: "MOBILE" | "DESKTOP" | "TABLET";
  date: string;
  searchAppearance: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  isFinalized: boolean;
}

export interface IntentTaskMapping {
  query: string;
  detectedIntent: string;
  authoritativeRoute: string;
  expectedUserTask: string;
  titleAligned: boolean;
  ctaAligned: boolean;
  recommendation: string;
}

export interface ThreeViewVerificationResult {
  route: string;
  timestamp: string;
  screenshotCheck: {
    passed: boolean;
    clippedTextDetected: boolean;
    overflowDetected: boolean;
    pixelDifferencePct: number;
    diffSummary: string;
  };
  domCheck: {
    passed: boolean;
    hiddenCtaCount: number;
    semanticHierarchyValid: boolean;
    issues: string[];
  };
  accessibilityCheck: {
    passed: boolean;
    wcag22Violations: number;
    minContrastRatioObserved: number;
    keyboardTraversable: boolean;
    screenReaderLabelsValid: boolean;
    issues: string[];
  };
  webVitals: {
    passed: boolean;
    lcpMs: number;
    clsScore: number;
    inpMs: number;
    regressions: string[];
  };
  overallPassed: boolean;
}

export interface ProofCarryingChangeProposal {
  id: string;
  defectCategory: DefectCategory;
  observedEvidence: EvidenceReceipt;
  affectedRoutes: string[];
  affectedComponents: string[];
  rootCauseHypothesis: string;
  minimalPatch: {
    targetFile: string;
    originalChunk: string;
    replacementChunk: string;
    lineCountDiff: number;
  };
  failingTestBeforeFix: {
    testName: string;
    failingOutput: string;
    reproduced: boolean;
  };
  expectedUserBenefit: string;
  potentialHarm: string;
  riskLevel: ChangeRiskLevel;
  requiredAutonomy: AutonomyLevel;
  qualificationResults: {
    targetedUnitTestsPassed: boolean;
    regressionSuitePassed: boolean;
    securityPolicyPassed: boolean;
    visualA11yPassed: boolean;
    seoPolicyPassed: boolean;
    oracleIntegrityPreserved: boolean;
    antiMutationKillRate: number;
  };
  approvalAuthority: {
    status: ProposalStatus;
    authorizedBy: string;
    authorizationTimestamp?: string;
    rejectionReason?: string;
  };
  rollbackReference: {
    snapshotCommit: string;
    rollbackRecipe: string;
    verifiedRollbackCapable: boolean;
  };
  measuredOutcome?: {
    taskCompletionDelta: number;
    bounceRateDelta: number;
    ctrDelta: number;
  };
  verificationDigest: string;
}

export interface WebsiteInventoryItem {
  id: string;
  route: string;
  canonicalUrl: string;
  isIndexable: boolean;
  isInSitemap: boolean;
  seoTitle: string;
  metaDescription: string;
  h1Heading: string;
  structuredDataType?: string;
  primaryUserTask: string;
  assignedOwner: string;
  surfaceClassification: "LOCKED" | "SEO_PROTECTED" | "DYNAMIC_CANDIDATE" | "EXPERIMENT_ELIGIBLE" | "LEGAL_PROTECTED";
  performanceBudgetLcpMs: number;
}
