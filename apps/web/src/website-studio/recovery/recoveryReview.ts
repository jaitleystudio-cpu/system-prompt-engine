/**
 * SPE R6 — strictly read-only projection of an existing canonical .spe record.
 * This is a UI parser, NOT the canonical integrity or ProofReceipt verifier.
 * It cannot issue a PASS, run a model, replay code, alter WebsiteSpecV2, or
 * claim that an imported journal was cryptographically authenticated.
 */
export const RECOVERY_VIEW_SCHEMA = "spe.execution.browser-recovery-bridge.v0";
const digest = /^sha256:[0-9a-f]{64}$/;
const MAX_TEXT_BYTES = 256_000;
const claims = new Set([
  "FIXTURE_PASS_NOT_LIVE", "FIXTURE_REPAIRED_NOT_LIVE",
  "FAILED_BOUNDED_REPAIR", "INCONCLUSIVE_EXCEPTION",
  "BROWSER_PASS_PROVIDER_UNATTESTED",
  "BROWSER_REPAIRED_PROVIDER_UNATTESTED",
]);
const provenance = new Set(["FIXTURE", "EXTERNAL_COMMAND_UNATTESTED"]);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const isDigest = (v: unknown): v is string =>
  typeof v === "string" && digest.test(v);
const clipped = (v: string, length = 220): string =>
  v.length <= length ? v : v.slice(0, length) + "…";
const has = (v: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(v, key);

export type BrowserObservationView = Readonly<{
  phase: "INITIAL" | "REPAIR";
  promptDigest: string;
  candidateDigest: string;
  browserPassClaim: boolean;
  observedErrorCount: number;
  diagnosticExcerpts: readonly string[];
  diagnosticsTruncated: boolean;
}>;
export type RepairTraceView = Readonly<{
  sourceCandidateDigest: string;
  promptV2Digest: string;
  promptV2Text: string;
  causalHypothesis: string;
  targetedConstraints: readonly string[];
  sourceKind: "SELF_REPORTED_REPAIR_PROMPT";
}>;
export type RecoveryReviewView = Readonly<{
  protectedGoalExcerpt: string;
  protectedGoalIncluded: boolean;
  sourceFormat: string;
  disposition: "REVIEW_ONLY_UNATTESTED";
  authority: "NONE";
  modelProvenanceClaim: string;
  qualificationClaim: string;
  manifestDigest: string;
  artifactDigest: string | null;
  attempts: readonly BrowserObservationView[];
  limitations: readonly string[];
  repairPromptAvailable: boolean;
  repairTrace: RepairTraceView | null;
  independentVerification: "NOT_PERFORMED_BY_STUDIO";
  projectBinding: "NOT_BOUND_TO_ACTIVE_SITE";
}>;

function error(reason: string): never {
  throw new Error(reason);
}
export function parseRecoverySpeForReview(raw: string): RecoveryReviewView {
  if (typeof raw !== "string" || !raw || new TextEncoder().encode(raw).length > MAX_TEXT_BYTES)
    return error("RECOVERY_FILE_EMPTY_OR_TOO_LARGE");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return error("RECOVERY_FILE_NOT_VALID_JSON"); }
  if (!isRecord(parsed) || !["spe.artifact.v1", "spe.artifact.v2"].includes(String(parsed.spe_format)))
    return error("CANONICAL_SPE_REQUIRED");
  if (!isRecord(parsed.intent) || !isRecord(parsed.integrity)
      || typeof parsed.user_request !== "string" || !parsed.user_request.trim()
      || typeof parsed.rendered_prompt !== "string" || !parsed.rendered_prompt.trim())
    return error("MISSING_CANONICAL_SPE_FIELDS");
  const execution = parsed.execution_record;
  if (!isRecord(execution) || execution.schema !== RECOVERY_VIEW_SCHEMA)
    return error("NO_SUPPORTED_RECOVERY_RECORD");
  if (execution.disposition !== "REVIEW_ONLY_UNATTESTED"
      || execution.execution_authority !== "NONE"
      || execution.source_kind !== "SELF_REPORTED_BROWSER_HARNESS"
      || !claims.has(String(execution.qualification_claim))
      || !provenance.has(String(execution.model_provenance_claim)))
    return error("UNSAFE_OR_UNKNOWN_EXECUTION_CLAIM");
  const claim = String(execution.qualification_claim);
  const source = String(execution.model_provenance_claim);
  if (source === "FIXTURE" && claim.startsWith("BROWSER_")
      || source !== "FIXTURE" && claim.startsWith("FIXTURE_"))
    return error("PROVENANCE_CLAIM_MISMATCH");
  if (!isDigest(execution.manifest_digest))
    return error("INVALID_MANIFEST_DIGEST");
  const passedArtifact = execution.browser_passed_artifact_digest;
  if (passedArtifact !== null && !isDigest(passedArtifact))
    return error("INVALID_ARTIFACT_DIGEST");
  if (!Array.isArray(execution.attempts) || ![1, 2].includes(execution.attempts.length))
    return error("INVALID_ATTEMPT_HISTORY");
  const attempts: BrowserObservationView[] = execution.attempts.map((attempt: unknown, index: number) => {
    if (!isRecord(attempt) ||
        attempt.phase !== (index === 0 ? "INITIAL" : "REPAIR") ||
        !isDigest(attempt.prompt_digest) || !isDigest(attempt.candidate_digest) ||
        typeof attempt.browser_pass_claim !== "boolean" ||
        !Number.isInteger(attempt.observed_error_count) ||
        Number(attempt.observed_error_count) < 0 || Number(attempt.observed_error_count) > 1_000_000)
      return error("INVALID_ATTEMPT_ROW");
    if (attempt.browser_pass_claim && Number(attempt.observed_error_count) !== 0)
      return error("CONTRADICTORY_BROWSER_CLAIM");
    const excerpts = attempt.diagnostic_excerpts === undefined ? [] : attempt.diagnostic_excerpts;
    const truncated = attempt.diagnostics_truncated === undefined ? false : attempt.diagnostics_truncated;
    if (!Array.isArray(excerpts) || excerpts.length > 6 ||
        excerpts.some((x: unknown) => typeof x !== "string" || x.length > 600) ||
        typeof truncated !== "boolean" ||
        excerpts.length > Number(attempt.observed_error_count) ||
        (Number(attempt.observed_error_count) === 0 && (excerpts.length !== 0 || truncated)))
      return error("INVALID_DIAGNOSTIC_EXCERPTS");
    return Object.freeze({
      phase: attempt.phase as "INITIAL" | "REPAIR",
      promptDigest: attempt.prompt_digest,
      candidateDigest: attempt.candidate_digest,
      browserPassClaim: attempt.browser_pass_claim,
      observedErrorCount: Number(attempt.observed_error_count),
      diagnosticExcerpts: Object.freeze([...excerpts] as string[]),
      diagnosticsTruncated: truncated,
    });
  });
  if (attempts.length === 2 && attempts[0].browserPassClaim)
    return error("REPAIR_AFTER_SUCCESS_CONTRADICTION");
  if (!Array.isArray(execution.known_limitations) ||
      execution.known_limitations.length > 16 ||
      execution.known_limitations.some((x: unknown) => typeof x !== "string" || x.length > 300))
    return error("INVALID_PROOF_LIMITATIONS");
  const final = attempts.at(-1)!;
  if (passedArtifact !== null && (passedArtifact !== final.candidateDigest || !final.browserPassClaim)
      || passedArtifact === null && final.browserPassClaim)
    return error("FINAL_ARTIFACT_CLAIM_MISMATCH");
  const claimedSuccess = claim.endsWith("PASS_NOT_LIVE") || claim.endsWith("REPAIRED_NOT_LIVE")
    || claim.startsWith("BROWSER_");
  if (claim === "FAILED_BOUNDED_REPAIR" && (attempts.length !== 2 || final.browserPassClaim)
      || claimedSuccess && !final.browserPassClaim
      || claim.includes("REPAIRED") && attempts.length !== 2
      || claim.includes("PASS_") && attempts.length !== 1)
    return error("QUALIFICATION_HISTORY_CONTRADICTION");
  // Preserve the R6 legacy contract: older .spe imports legitimately lack
  // detailed repair traces; never reconstruct unavailable details from hashes.
  let repairTrace: RepairTraceView | null = null;
  const rawTrace = execution.repair_trace;
  if (rawTrace !== undefined && rawTrace !== null) {
    if (!isRecord(rawTrace) || attempts.length !== 2 ||
        rawTrace.schema !== "spe.execution.repair-trace.v1" ||
        rawTrace.source_kind !== "SELF_REPORTED_REPAIR_PROMPT" ||
        rawTrace.execution_authority !== "NONE" ||
        !isDigest(rawTrace.source_candidate_digest) ||
        rawTrace.source_candidate_digest !== attempts[0].candidateDigest ||
        !isDigest(rawTrace.prompt_v2_digest) ||
        rawTrace.prompt_v2_digest !== attempts[1].promptDigest ||
        typeof rawTrace.prompt_v2_text !== "string" ||
        new TextEncoder().encode(rawTrace.prompt_v2_text).length > 16000 ||
        !rawTrace.prompt_v2_text ||
        typeof rawTrace.causal_hypothesis !== "string" ||
        !rawTrace.causal_hypothesis || rawTrace.causal_hypothesis.length > 1000 ||
        !rawTrace.prompt_v2_text.includes(rawTrace.causal_hypothesis) ||
        !Array.isArray(rawTrace.targeted_constraints) ||
        ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(rawTrace.targeted_constraints.length) ||
        rawTrace.targeted_constraints.some((x: unknown) =>
          typeof x !== "string" || !x || x.length > 400 ||
          !String(rawTrace.prompt_v2_text).includes(x)))
      return error("INVALID_REPAIR_TRACE_OR_LINEAGE");
    repairTrace = Object.freeze({
      sourceCandidateDigest: rawTrace.source_candidate_digest,
      promptV2Digest: rawTrace.prompt_v2_digest,
      promptV2Text: rawTrace.prompt_v2_text,
      causalHypothesis: rawTrace.causal_hypothesis,
      targetedConstraints: Object.freeze([...rawTrace.targeted_constraints] as string[]),
      sourceKind: "SELF_REPORTED_REPAIR_PROMPT",
    });
  }
  // The Studio never executes imported HTML/code or elevates self-reported
  // integrity or signature fields. Imported prompts are displayed only as text.
  return Object.freeze({
    protectedGoalExcerpt: clipped(parsed.user_request),
    protectedGoalIncluded: has(parsed, "user_request"),
    sourceFormat: String(parsed.spe_format),
    disposition: "REVIEW_ONLY_UNATTESTED",
    authority: "NONE",
    modelProvenanceClaim: source,
    qualificationClaim: claim,
    manifestDigest: execution.manifest_digest,
    artifactDigest: passedArtifact as string | null,
    attempts: Object.freeze(attempts),
    limitations: Object.freeze([...execution.known_limitations] as string[]),
    repairPromptAvailable: repairTrace !== null,
    repairTrace,
    independentVerification: "NOT_PERFORMED_BY_STUDIO",
    projectBinding: "NOT_BOUND_TO_ACTIVE_SITE",
  });
}
