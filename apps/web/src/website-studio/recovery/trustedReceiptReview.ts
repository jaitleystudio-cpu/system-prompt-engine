/**
 * SPE R8 browser-side RECEIPT VERIFICATION, not an execution authority.
 * Trust context MUST come from the embedding host's independently controlled
 * configuration — NEVER the imported .spe, receipt, or a user-supplied key.
 *
 * Unlike R4's Node-only signer, this browser verifier uses SubtleCrypto to
 * check Ed25519 against pinned SPKI bytes. The exact R4 canonical JSON
 * convention is reproduced here for interoperable verification, not signing.
 * Only "signed reviewer says these bytes passed a bounded replay" is proven.
 */
export type TrustedR8Reviewer = Readonly<{
  reviewerKeyId: string;
  reviewerPublicKeySpkiBase64: string;
  audience: string;
  operationId: string;
  harnessDigest: string;
  browserVersion: string;
}>;
export type R8Verdict = Readonly<{
  state: "UNVERIFIED_HOLD" | "SIGNATURE_VALID_REVIEW_ONLY";
  reason: string;
  authority: "NONE";
  modelIdentityProven: false;
  providerOutcomeProven: false;
  browserExecutedByStudio: false;
  retryAuthorized: false;
  deploymentAuthorized: false;
}>;
const reject = (reason: string): R8Verdict => ({
  state: "UNVERIFIED_HOLD", reason, authority: "NONE",
  modelIdentityProven: false, providerOutcomeProven: false,
  browserExecutedByStudio: false, retryAuthorized: false,
  deploymentAuthorized: false,
});
const valid = (): R8Verdict => ({
  ...reject("PINNED_REVIEWER_SIGNATURE_VALID_FOR_BOUNDED_BROWSER_REPLAY"),
  state: "SIGNATURE_VALID_REVIEW_ONLY",
});
type Obj = Record<string, unknown>;
const record = (value: unknown): value is Obj =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const shaPattern = /^sha256:[0-9a-f]{64}$/;
const isHash = (v: unknown): v is string =>
  typeof v === "string" && shaPattern.test(v);
const idPattern = /^[A-Za-z0-9._:-]{8,160}$/;
const exactKeys = (obj: Obj, keys: string[]) =>
  Object.keys(obj).sort().join("|") === keys.sort().join("|");
const textEncoder = new TextEncoder();
const bytes = (s: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(textEncoder.encode(s));
const toDigest = async (value: string): Promise<string> => {
  const result = await crypto.subtle.digest("SHA-256", bytes(value));
  return "sha256:" + [...new Uint8Array(result)].map(b => b.toString(16).padStart(2, "0")).join("");
};
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (record(value) && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(k => value[k] === undefined)) throw new Error("NON_PORTABLE_RECEIPT");
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  throw new Error("NON_PORTABLE_RECEIPT");
}
function base64(raw: unknown, max: number): Uint8Array<ArrayBuffer> {
  if (typeof raw !== "string" || raw.length > max ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.length % 4 !== 0)
    throw new Error("INVALID_BASE64");
  const binary = atob(raw);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  // Reject alternate encodings of identical bytes.
  if (btoa(binary) !== raw) throw new Error("NON_CANONICAL_BASE64");
  return out;
}
const expectedScope = {
  selectors: ["#spe-app", "canvas#spe-stage", "#spe-interact"],
  interaction: "click increments window.speInteractionCount",
  errors: "zero page exceptions and relevant console errors in test window",
  network: "all browser requests blocked",
};

/**
 * Requires an independently pinned trust context and a canonical .spe.
 * Never takes the reviewer key from either uploaded file.
 */
export async function verifyR8ReceiptForSpe(
  speRaw: string, receiptRaw: string, pinned?: TrustedR8Reviewer,
  now: Date = new Date(),
): Promise<R8Verdict> {
  if (!pinned) return reject("NO_DEPLOYMENT_PINNED_REVIEWER_KEY");
  if (!globalThis.crypto?.subtle) return reject("WEBCRYPTO_UNAVAILABLE");
  if (typeof speRaw !== "string" || textEncoder.encode(speRaw).length > 256000 ||
      typeof receiptRaw !== "string" || textEncoder.encode(receiptRaw).length > 32000)
    return reject("OVERSIZED_OR_INVALID_INPUT");
  let spe: unknown, receipt: unknown;
  try { spe = JSON.parse(speRaw); receipt = JSON.parse(receiptRaw); }
  catch { return reject("INVALID_JSON"); }
  if (!record(spe) || !record(receipt) ||
      !["spe.artifact.v1", "spe.artifact.v2"].includes(String(spe.spe_format)) ||
      typeof spe.user_request !== "string" || typeof spe.rendered_prompt !== "string" ||
      !record(spe.intent) || !record(spe.execution_record))
    return reject("CANONICAL_SPE_REQUIRED");
  const er = spe.execution_record;
  if (er.schema !== "spe.execution.browser-recovery-bridge.v0" ||
      er.disposition !== "REVIEW_ONLY_UNATTESTED" ||
      er.execution_authority !== "NONE" ||
      er.source_kind !== "SELF_REPORTED_BROWSER_HARNESS" ||
      !isHash(er.checkpoint_digest) ||
      !isHash(er.browser_passed_artifact_digest) ||
      !Array.isArray(er.attempts) || ![1, 2].includes(er.attempts.length))
    return reject("NO_CHECKPOINT_BOUND_REVIEW_ONLY_RECORD");
  const final = er.attempts.at(-1);
  if (!record(final) || !record(spe.integrity) ||
      final.browser_pass_claim !== true ||
      final.candidate_digest !== er.browser_passed_artifact_digest)
    return reject("NO_CONSISTENT_BROWSER_PASSED_ARTIFACT");
  if (receipt.signatureAlgorithm !== "Ed25519" ||
      typeof receipt.signatureBase64 !== "string" ||
      !record(receipt.signed) ||
      !exactKeys(receipt, ["signed", "signatureAlgorithm", "signatureBase64"]))
    return reject("MALFORMED_RECEIPT");
  const signed = receipt.signed;
  if (!exactKeys(signed, [
    "schema", "authority", "reviewerKeyId", "audience", "operationId",
    "receiptNonce", "createdAt", "expiresAt", "observations",
  ]) || signed.schema !== "spe.browser-replay.observation.v1" ||
      signed.authority !== "REVIEW_ONLY_NO_MODEL_OR_RELEASE_AUTHORITY" ||
      !record(signed.observations))
    return reject("INVALID_RECEIPT_SCOPE");
  if (![pinned.reviewerKeyId, pinned.audience, pinned.operationId].every(x =>
       typeof x === "string" && idPattern.test(x)) ||
      signed.reviewerKeyId !== pinned.reviewerKeyId ||
      signed.audience !== pinned.audience ||
      signed.operationId !== pinned.operationId)
    return reject("REVIEWER_AUDIENCE_OR_OPERATION_MISMATCH");
  const observed = signed.observations;
  if (!exactKeys(observed, [
    "candidateDigest", "checkpointDigest", "originalGoalDigest",
    "compiledPromptDigest", "screenshotDigest", "acceptanceDigest",
    "browserVersion", "harnessDigest", "tests", "errors", "provenance",
    "providerOutcome", "verifiedScope",
  ]) || !isHash(observed.screenshotDigest) ||
      !isHash(observed.harnessDigest) || !isHash(pinned.harnessDigest) ||
      !record(observed.tests) ||
      !exactKeys(observed.tests, ["applicationVisible", "canvasVisible", "interactionWorking"]) ||
      Object.values(observed.tests).some(x => x !== true) ||
      observed.errors !== 0 ||
      observed.providerOutcome !== "UNATTESTED" ||
      observed.verifiedScope !== "FRESH_BROWSER_REPLAY_ONLY" ||
      !["FIXTURE", "EXTERNAL_COMMAND_UNATTESTED"].includes(String(observed.provenance)) ||
      observed.provenance !== er.model_provenance_claim)
    return reject("INVALID_BOUNDED_OBSERVATIONS");
  if (observed.candidateDigest !== er.browser_passed_artifact_digest ||
      observed.checkpointDigest !== er.checkpoint_digest ||
      observed.harnessDigest !== pinned.harnessDigest ||
      observed.browserVersion !== pinned.browserVersion ||
      observed.originalGoalDigest !== await toDigest(spe.user_request) ||
      observed.compiledPromptDigest !== await toDigest(spe.rendered_prompt) ||
      observed.acceptanceDigest !== await toDigest(canonical(expectedScope)))
    return reject("ARTIFACT_GOAL_CHECKPOINT_OR_ENVIRONMENT_MISMATCH");
  const created = Date.parse(String(signed.createdAt));
  const expires = Date.parse(String(signed.expiresAt));
  if (!Number.isFinite(created) || !Number.isFinite(expires) ||
      !Number.isFinite(now.getTime()) || expires <= created ||
      expires - created > 300000 || created > now.getTime() + 30000 ||
      expires < now.getTime())
    return reject("STALE_OR_INVALID_RECEIPT");
  if (!idPattern.test(String(signed.receiptNonce)) ||
      typeof pinned.reviewerPublicKeySpkiBase64 !== "string")
    return reject("INVALID_REVIEWER_CONTEXT");
  try {
    const key = await crypto.subtle.importKey(
      "spki", base64(pinned.reviewerPublicKeySpkiBase64, 200),
      { name: "Ed25519" }, false, ["verify"],
    );
    const sig = base64(receipt.signatureBase64, 100);
    if (sig.byteLength !== 64) return reject("INVALID_SIGNATURE_LENGTH");
    const verified = await crypto.subtle.verify(
      "Ed25519", key, sig, bytes(canonical(signed)),
    );
    return verified ? valid() : reject("BAD_PINNED_REVIEWER_SIGNATURE");
  } catch {
    return reject("SIGNATURE_VERIFICATION_FAILED");
  }
}
