/**
 * Oral Life Outcomes: Canonical Types
 *
 * Implements the "Oral Life Colliding with Written Systems" outcome layer:
 * Transforms raw audio transcripts and OCR observations into legally actionable,
 * panic-reducing, and economically valuable human outcomes.
 *
 * INVARIANTS:
 * - RAW_USER_DATA_EGRESS = 0 (strictly enforced on all receipts)
 * - Cryptographic digest binding (tamper-evident SHA-256)
 * - Multilingual support for all 30+ major global languages worldwide
 */

export interface GlobalLanguageInfo {
  code: string; // ISO 639-1
  name: string;
  nativeName: string;
  scriptFamily:
    | "Latin"
    | "Devanagari"
    | "Han"
    | "Arabic"
    | "Bengali"
    | "Cyrillic"
    | "Japanese"
    | "Telugu"
    | "Tamil"
    | "Hangul"
    | "Gujarati"
    | "Kannada"
    | "Malayalam"
    | "Gurmukhi"
    | "Thai";
  direction: "ltr" | "rtl";
  speakersEstimateMillions: number;
}

// -------------------------------------------------------------
// 1. Spoken Promise Ledger
// -------------------------------------------------------------

export interface PromiseParty {
  id: string;
  name: string;
  role: "promisor" | "promisee" | "witness" | "contractor" | "client";
}

export interface PromiseCommitment {
  id: string;
  promisor: string;
  promisee: string;
  obligation: string;
  category: "WAGE" | "REPAIR" | "DELIVERY" | "DEAL_TERM" | "LOAN" | "GENERAL";
  deadlineText?: string;
  deadlineDate?: string;
  monetaryAmount?: {
    value: number;
    currency: string;
  };
  secondaryMonetaryAmount?: {
    value: number;
    currency: string;
  };
  additionalAmounts?: Array<{
    value: number;
    currency: string;
  }>;
  condition?: string;
  confidence: number;
  audioStartSec: number;
  audioEndSec: number;
  quoteSnippet: string;
  status: "PENDING" | "FULFILLED" | "DISPUTED" | "BREACHED";
  needsClarification?: boolean;
  clarificationPrompt?: string;
  turnIndex?: number;
}

export interface HighConsequenceSafetyEnvelope {
  draftStatus: "DRAFT_ONLY";
  requiresHumanConfirmation: true;
  noAutonomousSubmission: true;
  negativeAuthorities: {
    noAutonomousDosingDecision?: true;
    noClinicalDecision?: true;
    noLegalConclusion?: true;
    noBankingAuthority?: true;
    noEligibilityDecision?: true;
    noAutonomousSubmission?: true;
  };
}

/**
 * Anti-harm gate: Strictly forbids autonomous submission of any high-consequence drafted artifact.
 */
export function attemptAutonomousSubmission(_artifact: unknown): never {
  throw new Error(
    "SAFETY VIOLATION: Autonomous submission of high-consequence drafts (medical dosing, legal complaints, banking freezes, government benefit filings) is strictly prohibited. Human confirmation is mandatory.",
  );
}

export interface PromiseLedger {
  ledgerId: string;
  timestamp: string;
  language: string;
  sourceAudioDigest: string;
  parties: PromiseParty[];
  commitments: PromiseCommitment[];
  summaryText: string;
  executableContractPrompt: string;
  receiptDigest: string;
  rawUserDataEgress: 0;
  draftStatus?: "DRAFT_ONLY";
  requiresHumanConfirmation?: boolean;
  noAutonomousSubmission?: boolean;
  negativeAuthorities?: {
    noLegalConclusion?: true;
  };
}

// -------------------------------------------------------------
// 2. Chronic-Care & Family Care Timeline
// -------------------------------------------------------------

export interface DosageSchedule {
  medicationName: string;
  dosage: string;
  frequency: string;
  timeOfDay: ("MORNING" | "AFTERNOON" | "EVENING" | "NIGHT")[];
  withFood: boolean;
  alarmTimes: string[];
  instructionsNative: string;
  draftStatus?: "DRAFT_ONLY";
  requiresHumanConfirmation?: boolean;
  noAutonomousSubmission?: boolean;
  noAutonomousDosingDecision?: true;
  noClinicalDecision?: true;
}

export interface CareTimelineEntry {
  id: string;
  timestamp: string;
  source: "VOICE_CALL" | "VOICE_NOTE" | "PRESCRIPTION_PHOTO" | "LAB_RESULT";
  title: string;
  category: "DECISION" | "MEDICATION" | "NEXT_STEP" | "APPOINTMENT" | "SYMPTOM";
  details: string;
  language: string;
  dosageSchedule?: DosageSchedule;
  confidence: number;
  evidenceSnippet: string;
}

export interface CaregiverHandoff {
  shift: "NIGHT_TO_MORNING" | "MORNING_TO_EVENING" | "SHIFT_CHANGE";
  recordedAt: string;
  bulletStatus: string[];
  urgentAlerts: string[];
  pendingMeds: string[];
  vitalObservations: string[];
}

export interface ParentMentalLoad {
  sortedFeeds: string[];
  sortedMeds: string[];
  appointments: string[];
  overdueActions: string[];
  sleepNotes: string[];
  partnerDelegation?: string[];
}

export interface ChronicCareTimeline {
  timelineId: string;
  patientReference: string;
  primaryLanguage: string;
  entries: CareTimelineEntry[];
  caregiverHandoff?: CaregiverHandoff;
  parentMentalLoad?: ParentMentalLoad;
  nextDecisionsSummary: string[];
  receiptDigest: string;
  rawUserDataEgress: 0;
  draftStatus?: "DRAFT_ONLY";
  requiresHumanConfirmation?: boolean;
  noAutonomousSubmission?: boolean;
  negativeAuthorities?: {
    noAutonomousDosingDecision?: true;
    noClinicalDecision?: true;
  };
}

// -------------------------------------------------------------
// 3. Speak-to-Fill Gov & Benefit Forms
// -------------------------------------------------------------

export type GovFormType =
  | "PENSION_BENEFIT"
  | "RURAL_LOAN"
  | "IDENTITY_CERTIFICATE"
  | "DISABILITY_CLAIM"
  | "HEALTH_INSURANCE"
  | "CROP_COMPENSATION";

export interface FormFieldExtraction {
  fieldKey: string;
  label: string;
  extractedValue: string;
  confidence: number; // 0.0 - 1.0
  audioProofStartSec: number;
  audioProofEndSec: number;
  needsClarification: boolean;
  required: boolean;
}

export interface SpeakToFillForm {
  formId: string;
  formType: GovFormType;
  language: string;
  fields: FormFieldExtraction[];
  completionPercentage: number;
  readBackScriptNative: string; // Plain-spoken summary for illiterate applicant to confirm
  readBackScriptEnglish: string;
  clarificationsNeeded: string[];
  receiptDigest: string;
  rawUserDataEgress: 0;
  draftStatus?: "DRAFT_ONLY";
  requiresHumanConfirmation?: boolean;
  noAutonomousSubmission?: boolean;
  negativeAuthorities?: {
    noEligibilityDecision?: true;
    noAutonomousSubmission?: true;
  };
}

// -------------------------------------------------------------
// 4. Scam & Coercion Afterglow Narrative & Evidence Pack
// -------------------------------------------------------------

export interface CoercionDemand {
  id: string;
  type:
    | "EXTORTION_MONEY"
    | "OTP_REQUEST"
    | "GIFT_CARD"
    | "THREAT_OF_ARREST"
    | "IMPERSONATION_POLICE"
    | "IMPERSONATION_BANK"
    | "DIGITAL_ARREST";
  details: string;
  amountDemanded?: string;
  accountNumbersMentioned: string[];
  phoneNumbersMentioned: string[];
  upiIdsMentioned?: string[];
  urgencyKeywords: string[];
  audioStartSec: number;
  audioEndSec: number;
  turnIndex?: number;
}

export interface ScamCoercionPack {
  incidentId: string;
  recordedAt: string;
  language: string;
  riskScore: number; // 0 - 100
  threatsDetected: string[];
  demands: CoercionDemand[];
  policeFirNarrative: string; // Ready for law enforcement submission
  bankDisputeNotice: string; // Ready for bank fraud division freeze
  victimReassuranceSteps: string[];
  statutorySections?: string[];
  receiptDigest: string;
  rawUserDataEgress: 0;
  draftStatus?: "DRAFT_ONLY";
  requiresHumanConfirmation?: boolean;
  noAutonomousSubmission?: boolean;
  negativeAuthorities?: {
    noLegalConclusion?: true;
    noBankingAuthority?: true;
  };
}

// -------------------------------------------------------------
// 5. Creator Clip Mine
// -------------------------------------------------------------

export interface ViralCutCandidate {
  rank: number; // 1 to 20
  hookScore: number; // 0 - 100
  startSec: number;
  endSec: number;
  durationSec: number;
  hookHeadline: string;
  punchlineText: string;
  suggestedCaptions: {
    primary: string;
    bilingualEnglish?: string;
  };
  pacingPps: number; // Phonemes or words per second
  viralReason: string;
}

export interface CreatorClipMine {
  mineId: string;
  sourceDigest: string;
  totalDurationSec: number;
  language: string;
  topCuts: ViralCutCandidate[];
  receiptDigest: string;
  rawUserDataEgress: 0;
}

// -------------------------------------------------------------
// 6. Marketplace Dispute Pack
// -------------------------------------------------------------

export interface DiscrepancyItem {
  id: string;
  feature: string;
  spokenPromise: string;
  spokenAudioStartSec: number;
  spokenAudioEndSec: number;
  actualDeliveredEvidence: string;
  discrepancyType: "MISMATCH" | "MISSING_ITEM" | "DAMAGED" | "LATE";
  severity: "CRITICAL" | "MODERATE" | "MINOR";
}

export interface MarketplaceDisputePack {
  disputeId: string;
  buyerClaims: string[];
  sellerPromises: string[];
  discrepancies: DiscrepancyItem[];
  recommendedResolution: "FULL_REFUND" | "PARTIAL_REFUND" | "RELEASE_TO_SELLER" | "REPLACEMENT";
  resolutionJustification: string;
  receiptDigest: string;
  rawUserDataEgress: 0;
  draftStatus?: "DRAFT_ONLY";
  requiresHumanConfirmation?: boolean;
  noAutonomousSubmission?: boolean;
  negativeAuthorities?: {
    noLegalConclusion?: true;
  };
}
