/**
 * Phase 3 founder-grade LIVE_* promotion gate.
 * Product LIVE_INDEX / LIVE_RETRACTION constants stay HOLD until founder flips.
 */

export type GateRetractionStatus =
  | "NOT_CHECKED"
  | "CHECKING"
  | "NO_SIGNAL_IN_QUERIED_SOURCES"
  | "RETRACTION_SIGNAL"
  | "WITHDRAWAL_SIGNAL"
  | "EXPRESSION_OF_CONCERN"
  | "CORRECTION_SIGNAL"
  | "CONFLICTING_STATUS"
  | "SOURCE_UNAVAILABLE"
  | "IDENTIFIER_AMBIGUOUS"
  | "UNKNOWN";

export interface LivePromotionGateEvidence {
  identityProvidersAgreeing: number;
  retractionStatus: GateRetractionStatus;
  provenancePresent: boolean;
  mutantsGreen: boolean;
  independentLiveNetworkProof: boolean;
  noSignalCollapsedToNotRetracted?: boolean;
}

export interface LivePromotionGateResult {
  mayPromoteIndex: boolean;
  mayPromoteRetraction: boolean;
  reasons: readonly string[];
  productLiveIndex: "HOLD";
  productLiveRetraction: "HOLD";
}

const TERMINAL_OK = new Set<GateRetractionStatus>([
  "NO_SIGNAL_IN_QUERIED_SOURCES",
  "RETRACTION_SIGNAL",
  "WITHDRAWAL_SIGNAL",
  "EXPRESSION_OF_CONCERN",
  "CORRECTION_SIGNAL",
  "CONFLICTING_STATUS",
  "SOURCE_UNAVAILABLE",
  "IDENTIFIER_AMBIGUOUS",
]);

export function evaluateLivePromotionGate(
  evidence?: LivePromotionGateEvidence | null,
): LivePromotionGateResult {
  if (!evidence) {
    return Object.freeze({
      mayPromoteIndex: false,
      mayPromoteRetraction: false,
      reasons: Object.freeze(["NO_EVIDENCE_PACK", "LIVE_INDEX=HOLD", "LIVE_RETRACTION=HOLD"]),
      productLiveIndex: "HOLD",
      productLiveRetraction: "HOLD",
    });
  }
  const reasons: string[] = [];
  if (evidence.identityProvidersAgreeing < 2) {
    reasons.push("NEED_GE2_PROVIDERS_IDENTITY_AGREE");
  }
  if (evidence.retractionStatus === "NOT_CHECKED") {
    reasons.push("RETRACTION_NOT_CHECKED");
  }
  if (evidence.retractionStatus === "CHECKING") {
    reasons.push("RETRACTION_STILL_CHECKING");
  }
  if (evidence.retractionStatus === "UNKNOWN") {
    reasons.push("UNKNOWN_NE_TERMINAL_OK");
  }
  if (evidence.noSignalCollapsedToNotRetracted) {
    reasons.push("NO_SIGNAL_COLLAPSE_TO_NOT_RETRACTED_FORBIDDEN");
  }
  if (!evidence.provenancePresent) reasons.push("PROVENANCE_MISSING");
  if (!evidence.mutantsGreen) reasons.push("MUTANTS_NOT_GREEN");
  if (!evidence.independentLiveNetworkProof) {
    reasons.push("INDEPENDENT_LIVE_NETWORK_PROOF_MISSING");
  }

  const ok =
    evidence.identityProvidersAgreeing >= 2 &&
    evidence.retractionStatus !== "NOT_CHECKED" &&
    evidence.retractionStatus !== "CHECKING" &&
    TERMINAL_OK.has(evidence.retractionStatus) &&
    !evidence.noSignalCollapsedToNotRetracted &&
    evidence.provenancePresent &&
    evidence.mutantsGreen &&
    evidence.independentLiveNetworkProof;

  if (ok) {
    reasons.push("GATE_MET_PRODUCT_CONSTANTS_STILL_HOLD");
    reasons.push("FOUNDER_FLIP_REQUIRED_FOR_LIVE_YES");
  } else {
    reasons.push("LIVE_INDEX=HOLD");
    reasons.push("LIVE_RETRACTION=HOLD");
  }

  return Object.freeze({
    mayPromoteIndex: ok,
    mayPromoteRetraction: ok,
    reasons: Object.freeze(reasons),
    productLiveIndex: "HOLD",
    productLiveRetraction: "HOLD",
  });
}

export function countIdentityProviderAgreement(
  records: readonly { provider: string; identifier: string | null }[],
): number {
  const byId = new Map<string, Set<string>>();
  for (const rec of records) {
    let ident = String(rec.identifier || "").trim().toLowerCase();
    if (ident.startsWith("doi:")) ident = ident.slice(4);
    ident = ident.replace(/^https?:\/\/doi\.org\//i, "");
    const prov = String(rec.provider || "").trim().toUpperCase();
    // pmid/arxiv agreement is not independent DOI identity.
    if (!prov || !/^10\.\d{4,9}\/\S+$/i.test(ident)) continue;
    if (!byId.has(ident)) byId.set(ident, new Set());
    byId.get(ident)!.add(prov);
  }
  let max = 0;
  for (const set of byId.values()) max = Math.max(max, set.size);
  return max;
}

/** Default mayPromote* with no evidence pack -- always false / HOLD. */
export function mayPromoteLiveIndexFromGate(
  evidence?: LivePromotionGateEvidence | null,
): boolean {
  return evaluateLivePromotionGate(evidence ?? null).mayPromoteIndex;
}

export function mayPromoteLiveRetractionFromGate(
  evidence?: LivePromotionGateEvidence | null,
): boolean {
  return evaluateLivePromotionGate(evidence ?? null).mayPromoteRetraction;
}

/** Canonical names (also re-exported for callers that import from gate). */
export const mayPromoteLiveIndex = mayPromoteLiveIndexFromGate;
export const mayPromoteLiveRetraction = mayPromoteLiveRetractionFromGate;
