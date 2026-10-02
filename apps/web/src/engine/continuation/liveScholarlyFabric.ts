/**
 * Live scholarly fabric + retraction truth layer — CONTRACT + fail-closed stubs.
 *
 * Path (extend existing; NO second engine):
 *   ContextNeed → privacy-minimized query → source policy → live scholarly adapters
 *   → normalization → source firewall → freshness → provenance → conflict
 *   → retraction evidence → ContextCapsule → C02/K3/RT consumers
 *
 * Epistemic law: OFFLINE≠LIVE, CACHE≠LIVE, DOI≠validated, NO_MATCH≠NOT_RETRACTED,
 * UNKNOWN≠PASS, PREPRINT≠PEER_REVIEWED, RETRACTED≠WITHDRAWN≠EoC.
 *
 * LIVE_INDEX / LIVE_RETRACTION remain HOLD until mutants are killed with evidence.
 * These stubs intentionally do NOT implement live adapters (TDD RED phase).
 */

import {
  getScholarlyFabricTruthStatus,
  describeScholarlyFabricDisplayStates,
} from "./researchFabric";
import { minimizePublicQuery as offlineMinimize } from "./oracleGuards";

/** Non-collapsing retraction / notice check status. Never a false boolean. */
export type RetractionCheckStatus =
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

export type PeerReviewClass =
  | "PEER_REVIEWED"
  | "PREPRINT"
  | "UNKNOWN"
  | "NOT_APPLICABLE";

export type FreshnessClass = "CURRENT" | "STALE" | "UNKNOWN" | "NOT_CHECKED";

export type VerificationMode = "OFFLINE_SEED" | "CACHE" | "LIVE" | "UNKNOWN";

export type ProviderId =
  | "OPENALEX"
  | "CROSSREF"
  | "PUBMED"
  | "PMC"
  | "EUROPE_PMC"
  | "ARXIV"
  | "DOAJ"
  | "LOCAL_SENTINEL";

export interface RetractionCheckResult {
  status: RetractionCheckStatus;
  identifier: string | null;
  providersQueried: readonly ProviderId[];
  providersResponded: readonly ProviderId[];
  evidenceIds: readonly string[];
  mode: VerificationMode;
  reasons: readonly string[];
  /** Never true unless LIVE multi-provider evidence actually closed. */
  liveVerified: false | true;
}

export interface LiveIdentifierValidation {
  raw: string;
  kind: "DOI" | "PMID" | "PMCID" | "ARXIV" | "URL" | "INVALID" | "MISSING";
  /** Syntactic only unless providers confirm. */
  syntaxValid: boolean;
  /** DOI syntax ≠ registry-validated. */
  registryValidated: boolean;
  ambiguous: boolean;
  reasons: readonly string[];
}

export interface LiveScholarlyRecord {
  provider: ProviderId;
  identifier: string | null;
  title: string;
  peerReviewClass: PeerReviewClass;
  abstractText: string;
  retrievedAtIso: string | null;
  isFromCache: boolean;
  mode: VerificationMode;
}

export interface LiveAcquireResult {
  status:
    | "NOT_IMPLEMENTED"
    | "HELD_NO_CONSENT"
    | "HELD_CAPABILITY"
    | "TIMEOUT"
    | "RATE_LIMITED"
    | "PARTIAL"
    | "ACQUIRED_LIVE"
    | "REJECTED_PRIVACY"
    | "REJECTED_INJECTION";
  records: readonly LiveScholarlyRecord[];
  networkCalls: number;
  mode: VerificationMode;
  retraction: RetractionCheckResult;
  privacy: { outboundContainedPrivate: boolean; omittedSpans: readonly string[] };
  reasons: readonly string[];
}

export interface LiveFabricCapabilitySnapshot {
  liveIndex: "HOLD";
  liveRetraction: "HOLD";
  fullScholarlyIndex: "NO";
  liveRetractionVerification: "NO";
  adaptersImplemented: readonly ProviderId[];
}

const ALL_STATUSES: readonly RetractionCheckStatus[] = Object.freeze([
  "NOT_CHECKED",
  "CHECKING",
  "NO_SIGNAL_IN_QUERIED_SOURCES",
  "RETRACTION_SIGNAL",
  "WITHDRAWAL_SIGNAL",
  "EXPRESSION_OF_CONCERN",
  "CORRECTION_SIGNAL",
  "CONFLICTING_STATUS",
  "SOURCE_UNAVAILABLE",
  "IDENTIFIER_AMBIGUOUS",
  "UNKNOWN",
]);

export function listRetractionCheckStatuses(): readonly RetractionCheckStatus[] {
  return ALL_STATUSES;
}

/** Capability snapshot — always HOLD/NO until proven. */
export function getLiveFabricCapabilitySnapshot(): LiveFabricCapabilitySnapshot {
  const t = getScholarlyFabricTruthStatus();
  const d = describeScholarlyFabricDisplayStates();
  return Object.freeze({
    liveIndex: d.rtBLiveIndex,
    liveRetraction: d.rtBLiveRetraction,
    fullScholarlyIndex: t.FULL_SCHOLARLY_INDEX,
    liveRetractionVerification: t.LIVE_RETRACTION_VERIFICATION,
    adaptersImplemented: Object.freeze([]) as readonly ProviderId[],
  });
}

/**
 * Syntactic identifier probe only. Does NOT talk to registries.
 * Stub: never sets registryValidated=true.
 */
export function validateLiveIdentifier(raw: string | null | undefined): LiveIdentifierValidation {
  if (raw == null || String(raw).trim() === "") {
    return Object.freeze({
      raw: "",
      kind: "MISSING",
      syntaxValid: false,
      registryValidated: false,
      ambiguous: false,
      reasons: Object.freeze(["IDENTIFIER_MISSING"]),
    });
  }
  const s = String(raw).trim();
  const doi = /^(doi:)?10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(s);
  const pmid = /^(pmid:)?\d{5,9}$/i.test(s);
  const pmcid = /^(pmc:?|PMC)\d+$/i.test(s);
  const arxiv = /^(arxiv:)?\d{4}\.\d{4,5}(v\d+)?$/i.test(s);
  const kinds = [doi && "DOI", pmid && "PMID", pmcid && "PMCID", arxiv && "ARXIV"].filter(
    Boolean,
  ) as Array<"DOI" | "PMID" | "PMCID" | "ARXIV">;
  if (kinds.length > 1) {
    return Object.freeze({
      raw: s,
      kind: "INVALID",
      syntaxValid: false,
      registryValidated: false,
      ambiguous: true,
      reasons: Object.freeze(["IDENTIFIER_AMBIGUOUS"]),
    });
  }
  if (doi) {
    return Object.freeze({
      raw: s,
      kind: "DOI",
      syntaxValid: true,
      registryValidated: false,
      ambiguous: false,
      reasons: Object.freeze(["DOI_SYNTAX_ONLY_NOT_REGISTRY_VALIDATED"]),
    });
  }
  if (pmid) {
    return Object.freeze({
      raw: s,
      kind: "PMID",
      syntaxValid: true,
      registryValidated: false,
      ambiguous: false,
      reasons: Object.freeze(["PMID_SYNTAX_ONLY"]),
    });
  }
  if (pmcid) {
    return Object.freeze({
      raw: s,
      kind: "PMCID",
      syntaxValid: true,
      registryValidated: false,
      ambiguous: false,
      reasons: Object.freeze(["PMCID_SYNTAX_ONLY"]),
    });
  }
  if (arxiv) {
    return Object.freeze({
      raw: s,
      kind: "ARXIV",
      syntaxValid: true,
      registryValidated: false,
      ambiguous: false,
      reasons: Object.freeze(["ARXIV_SYNTAX_ONLY_PREPRINT_CANDIDATE"]),
    });
  }
  if (/^https?:\/\//i.test(s)) {
    return Object.freeze({
      raw: s,
      kind: "URL",
      syntaxValid: true,
      registryValidated: false,
      ambiguous: false,
      reasons: Object.freeze(["URL_NOT_DOI_VALIDATED"]),
    });
  }
  return Object.freeze({
    raw: s,
    kind: "INVALID",
    syntaxValid: false,
    registryValidated: false,
    ambiguous: false,
    reasons: Object.freeze(["FABRICATED_OR_INVALID_IDENTIFIER"]),
  });
}

/**
 * Retraction check stub — fail-closed.
 * Does NOT query live providers. Never returns NOT_RETRACTED boolean.
 * NO_MATCH / empty providers → NO_SIGNAL or UNKNOWN, never "clean pass".
 */
export function checkRetractionStatus(input: {
  identifier?: string | null;
  providers?: readonly ProviderId[];
  cachedStatus?: RetractionCheckStatus;
  treatCacheAsLive?: boolean;
  signals?: readonly { provider: ProviderId; status: RetractionCheckStatus }[];
  timedOut?: boolean;
  rateLimited?: boolean;
}): RetractionCheckResult {
  const id = input.identifier ?? null;
  const idv = validateLiveIdentifier(id);
  if (idv.kind === "MISSING") {
    return Object.freeze({
      status: "NOT_CHECKED",
      identifier: null,
      providersQueried: Object.freeze([]),
      providersResponded: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      mode: "UNKNOWN",
      reasons: Object.freeze(["IDENTIFIER_MISSING", "NOT_CHECKED"]),
      liveVerified: false,
    });
  }
  if (idv.ambiguous || idv.kind === "INVALID") {
    return Object.freeze({
      status: "IDENTIFIER_AMBIGUOUS",
      identifier: id,
      providersQueried: Object.freeze([...(input.providers || [])]),
      providersResponded: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      mode: "UNKNOWN",
      reasons: Object.freeze(["IDENTIFIER_AMBIGUOUS"]),
      liveVerified: false,
    });
  }
  // Cache must never be relabeled LIVE
  if (input.cachedStatus && input.treatCacheAsLive) {
    return Object.freeze({
      status: "UNKNOWN",
      identifier: id,
      providersQueried: Object.freeze([]),
      providersResponded: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      mode: "CACHE",
      reasons: Object.freeze(["CACHE_NE_LIVE", "REFUSED_CACHE_AS_LIVE"]),
      liveVerified: false,
    });
  }
  if (input.timedOut) {
    return Object.freeze({
      status: "SOURCE_UNAVAILABLE",
      identifier: id,
      providersQueried: Object.freeze([...(input.providers || [])]),
      providersResponded: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      mode: "UNKNOWN",
      reasons: Object.freeze(["TIMEOUT", "TIMEOUT_NE_CLEAN"]),
      liveVerified: false,
    });
  }
  if (input.rateLimited) {
    return Object.freeze({
      status: "SOURCE_UNAVAILABLE",
      identifier: id,
      providersQueried: Object.freeze([...(input.providers || [])]),
      providersResponded: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      mode: "UNKNOWN",
      reasons: Object.freeze(["RATE_LIMIT", "SOURCE_UNAVAILABLE"]),
      liveVerified: false,
    });
  }
  const signals = input.signals || [];
  if (signals.length === 0) {
    // Stub: no live query yet → UNKNOWN (not NO_MATCH→NOT_RETRACTED, not PASS)
    return Object.freeze({
      status: "UNKNOWN",
      identifier: id,
      providersQueried: Object.freeze([...(input.providers || [])]),
      providersResponded: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      mode: "UNKNOWN",
      reasons: Object.freeze([
        "LIVE_ADAPTERS_NOT_IMPLEMENTED",
        "NO_MATCH_NE_NOT_RETRACTED",
        "UNKNOWN_NE_PASS",
      ]),
      liveVerified: false,
    });
  }
  const kinds = new Set(signals.map((s) => s.status));
  const positive = [
    "RETRACTION_SIGNAL",
    "WITHDRAWAL_SIGNAL",
    "EXPRESSION_OF_CONCERN",
    "CORRECTION_SIGNAL",
  ] as const;
  const hit = positive.filter((p) => kinds.has(p));
  if (hit.length > 1) {
    return Object.freeze({
      status: "CONFLICTING_STATUS",
      identifier: id,
      providersQueried: Object.freeze(signals.map((s) => s.provider)),
      providersResponded: Object.freeze(signals.map((s) => s.provider)),
      evidenceIds: Object.freeze(signals.map((s) => `${s.provider}:${s.status}`)),
      mode: "LIVE",
      reasons: Object.freeze(["CONFLICTING_NOTICE_KINDS", "RETRACTED_NE_WITHDRAWN_NE_EOC"]),
      liveVerified: false,
    });
  }
  if (hit.length === 1) {
    const singleProvider = new Set(signals.map((s) => s.provider)).size < 2;
    return Object.freeze({
      status: hit[0],
      identifier: id,
      providersQueried: Object.freeze(signals.map((s) => s.provider)),
      providersResponded: Object.freeze(signals.map((s) => s.provider)),
      evidenceIds: Object.freeze(signals.map((s) => `${s.provider}:${s.status}`)),
      mode: "LIVE",
      reasons: Object.freeze(
        singleProvider
          ? ["SINGLE_PROVIDER_NE_MULTI_VERIFIED", "SIGNAL_PRESENT_AWAITING_CORROBORATION"]
          : ["MULTI_PROVIDER_SIGNAL"],
      ),
      liveVerified: !singleProvider,
    });
  }
  if (kinds.has("NO_SIGNAL_IN_QUERIED_SOURCES") && kinds.size === 1) {
    return Object.freeze({
      status: "NO_SIGNAL_IN_QUERIED_SOURCES",
      identifier: id,
      providersQueried: Object.freeze(signals.map((s) => s.provider)),
      providersResponded: Object.freeze(signals.map((s) => s.provider)),
      evidenceIds: Object.freeze([]),
      mode: "LIVE",
      reasons: Object.freeze(["NO_SIGNAL_IN_QUERIED_SOURCES", "NO_MATCH_NE_NOT_RETRACTED"]),
      liveVerified: false,
    });
  }
  return Object.freeze({
    status: "UNKNOWN",
    identifier: id,
    providersQueried: Object.freeze(signals.map((s) => s.provider)),
    providersResponded: Object.freeze(signals.map((s) => s.provider)),
    evidenceIds: Object.freeze([]),
    mode: "UNKNOWN",
    reasons: Object.freeze(["UNKNOWN_NE_PASS"]),
    liveVerified: false,
  });
}

/** Classify peer-review vs preprint — never promote preprint to peer-reviewed. */
export function classifyPeerReview(input: {
  sourceType?: string;
  catalogSource?: string;
  publicationTypes?: readonly string[];
  arxivOnly?: boolean;
}): PeerReviewClass {
  if (input.arxivOnly || input.catalogSource === "ARXIV" || input.sourceType === "PREPRINT") {
    return "PREPRINT";
  }
  if (
    input.sourceType === "PEER_REVIEWED_PAPER" ||
    (input.publicationTypes || []).some((t) => /journal|peer.?review/i.test(t))
  ) {
    return "PEER_REVIEWED";
  }
  if (input.sourceType === "SPECIFICATION") return "NOT_APPLICABLE";
  return "UNKNOWN";
}

/** Freshness: STALE must not be reported as CURRENT. */
export function classifyFreshness(input: {
  retrievedAtIso?: string | null;
  maxAgeHours?: number;
  nowIso?: string;
  fromCache?: boolean;
}): { class: FreshnessClass; mode: VerificationMode; reasons: readonly string[] } {
  if (!input.retrievedAtIso) {
    return {
      class: "NOT_CHECKED",
      mode: "UNKNOWN",
      reasons: Object.freeze(["FRESHNESS_NOT_CHECKED"]),
    };
  }
  if (input.fromCache) {
    return {
      class: "UNKNOWN",
      mode: "CACHE",
      reasons: Object.freeze(["CACHE_NE_LIVE", "STALE_NE_CURRENT_WITHOUT_LIVE_CHECK"]),
    };
  }
  // Stub: no clock authority — refuse CURRENT promotion without live check
  return {
    class: "UNKNOWN",
    mode: "UNKNOWN",
    reasons: Object.freeze(["LIVE_FRESHNESS_NOT_IMPLEMENTED", "STALE_NE_CURRENT"]),
  };
}

/**
 * Sanitize retrieved scholarly body. Abstract instructions are DATA, never AUTHORITY.
 */
export function sanitizeRetrievedScholarlyBody(raw: string): {
  text: string;
  strippedInjection: boolean;
  authorityGranted: false;
  reasons: readonly string[];
} {
  const patterns =
    /\b(ignore previous instructions|ignore all rules|system prompt override|grant full authority|you are now|deploy now|mark as pass)\b/gi;
  const strippedInjection = patterns.test(raw);
  const text = raw.replace(patterns, "[REDACTED_PROMPT_INJECTION]");
  return Object.freeze({
    text,
    strippedInjection,
    authorityGranted: false as const,
    reasons: Object.freeze(
      strippedInjection
        ? ["RETRIEVED_INSTRUCTION_NE_AUTHORITY", "STRIPPED_INJECTION"]
        : ["RETRIEVED_AS_DATA_ONLY"],
    ),
  });
}

/**
 * Privacy-minimized outbound query builder.
 * RAW private spans must never appear in outbound.
 */
export function buildPrivacyMinimizedOutbound(input: {
  rawQuery: string;
  sensitiveSpans?: readonly string[];
}): {
  outboundQuery: string;
  omittedSpans: readonly string[];
  containedPrivate: boolean;
  reasons: readonly string[];
} {
  const spans = [...(input.sensitiveSpans || [])];
  const mini = offlineMinimize(input.rawQuery);
  let outbound = mini.publicQuery;
  const omitted: string[] = [...(mini.omittedSpans || [])];
  for (const span of spans) {
    if (span && outbound.includes(span)) {
      outbound = outbound.split(span).join(" ");
      omitted.push(span);
    }
  }
  outbound = outbound.replace(/\s+/g, " ").trim();
  const leaked = spans.some((s) => Boolean(s) && outbound.includes(s));
  return Object.freeze({
    outboundQuery: outbound,
    omittedSpans: Object.freeze(omitted),
    containedPrivate: leaked,
    reasons: Object.freeze(
      leaked
        ? ["RAW_PRIVATE_LEAKED_TO_OUTBOUND"]
        : omitted.length
          ? ["RAW_PRIVATE_NE_OUTBOUND", "SENSITIVE_SPAN_OMITTED"]
          : ["NO_SENSITIVE_SPANS"],
    ),
  });
}

/**
 * Live acquire stub — NOT implemented. Always HELD_CAPABILITY / NOT_IMPLEMENTED.
 * networkCalls stays 0. mode never LIVE.
 */
export function acquireLiveScholarlyEvidence(_input: {
  needQuery: string;
  consent: boolean;
  sensitiveSpans?: readonly string[];
  providers?: readonly ProviderId[];
}): LiveAcquireResult {
  const caps = getLiveFabricCapabilitySnapshot();
  return Object.freeze({
    status: "NOT_IMPLEMENTED",
    records: Object.freeze([]),
    networkCalls: 0,
    mode: "UNKNOWN" as VerificationMode,
    retraction: checkRetractionStatus({}),
    privacy: Object.freeze({
      outboundContainedPrivate: false,
      omittedSpans: Object.freeze([]),
    }),
    reasons: Object.freeze([
      "LIVE_ADAPTERS_NOT_IMPLEMENTED",
      `LIVE_INDEX=${caps.liveIndex}`,
      `LIVE_RETRACTION=${caps.liveRetraction}`,
      "OFFLINE_NE_LIVE",
    ]),
  });
}

/**
 * Title match alone never yields DOI_VERIFIED.
 */
export function resolveIdentifierFromTitle(_title: string): {
  status: "TITLE_ONLY" | "DOI_VERIFIED" | "AMBIGUOUS" | "NO_MATCH";
  identifier: string | null;
  reasons: readonly string[];
} {
  return Object.freeze({
    status: "TITLE_ONLY",
    identifier: null,
    reasons: Object.freeze(["TITLE_NE_DOI_VERIFIED", "LIVE_TITLE_RESOLVER_NOT_IMPLEMENTED"]),
  });
}

/** Promote live gates? Always false in stub / until mutants killed. */
export function mayPromoteLiveIndex(): false {
  return false;
}
export function mayPromoteLiveRetraction(): false {
  return false;
}
