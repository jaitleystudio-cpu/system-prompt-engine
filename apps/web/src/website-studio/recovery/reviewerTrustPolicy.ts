/**
 * SPE R9 — host-anchored reviewer trust-policy verification.
 *
 * NO new execution authority. This extends the existing R8 review path.
 * The offline Ed25519 root public key, current policy digest, epoch floor,
 * and predecessor digest MUST come from independent host configuration,
 * never a .spe, receipt, or user-uploaded policy. Uploaded signed policies
 * are untrusted until verified against these exact host pins.
 *
 * A signature validates integrity of policy bytes, NOT root-key custody,
 * independent organizational control, or provider provenance.
 */
import {
  verifyR8ReceiptForSpe, type R8Verdict, type TrustedR8Reviewer,
} from "./trustedReceiptReview.ts";

export type TrustedR9PolicyAnchor = Readonly<{
  policyId: string;
  audience: string;
  operationId: string;
  offlineRootPublicSpkiBase64: string;
  currentSignedPolicyDigest: string;
  requiredPredecessorDigest: string | null;
  minimumEpoch: number;
  harnessDigest: string;
  browserVersion: string;
}>;
type JsonRecord = Record<string, unknown>;
const object = (x: unknown): x is JsonRecord =>
  !!x && typeof x === "object" && !Array.isArray(x);
const keyPattern = /^[A-Za-z0-9._:-]{8,160}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const encoder = new TextEncoder();
const utf8 = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(encoder.encode(value));
const fail = (reason: string): R8Verdict => ({
  state: "UNVERIFIED_HOLD", reason, authority: "NONE",
  modelIdentityProven: false, providerOutcomeProven: false,
  browserExecutedByStudio: false, retryAuthorized: false,
  deploymentAuthorized: false,
});
const exact = (value: JsonRecord, fields: string[]): boolean =>
  Object.keys(value).sort().join("|") === [...fields].sort().join("|");
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (object(value) && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(k => value[k] === undefined)) throw new Error("NON_PORTABLE_POLICY");
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  throw new Error("NON_PORTABLE_POLICY");
}
// Pure canonicalization helper also used by the CI offline-root fixture.
// This is a wire-format function; it is NOT a permission to self-sign a policy.
export const canonicalR9SignedPolicy = (value: unknown): string => canonical(value);
async function hash(value: string): Promise<string> {
  const data = await globalThis.crypto.subtle.digest("SHA-256", utf8(value));
  return "sha256:" + [...new Uint8Array(data)]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function decode64(raw: unknown, maxChars: number): Uint8Array<ArrayBuffer> {
  if (typeof raw !== "string" || !raw || raw.length > maxChars ||
      raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw))
    throw new Error("BAD_BASE64");
  const decoded = atob(raw);
  if (btoa(decoded) !== raw) throw new Error("NON_CANONICAL_BASE64");
  return new Uint8Array([...decoded].map(char => char.charCodeAt(0)));
}
function dateWindow(start: unknown, end: unknown, now: Date, maxMs: number): boolean {
  if (typeof start !== "string" || typeof end !== "string") return false;
  const a = Date.parse(start), b = Date.parse(end), n = now.getTime();
  return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(n) &&
    b > a && b - a <= maxMs && a <= n + 30000 && b >= n;
}
async function selectR9Reviewer(
  policyText: string, receiptText: string,
  anchor: TrustedR9PolicyAnchor | undefined, now: Date,
): Promise<{ reviewer?: TrustedR8Reviewer; error?: string }> {
  if (!anchor) return { error: "NO_HOST_PINNED_OFFLINE_ROOT" };
  if (!globalThis.crypto?.subtle) return { error: "WEBCRYPTO_UNAVAILABLE" };
  if (typeof policyText !== "string" || encoder.encode(policyText).length > 32000 ||
      typeof receiptText !== "string" || encoder.encode(receiptText).length > 32000)
    return { error: "POLICY_OR_RECEIPT_TOO_LARGE" };
  if (!keyPattern.test(anchor.policyId) || !keyPattern.test(anchor.audience) ||
      !keyPattern.test(anchor.operationId) ||
      !digestPattern.test(anchor.currentSignedPolicyDigest) ||
      (anchor.requiredPredecessorDigest !== null &&
       !digestPattern.test(anchor.requiredPredecessorDigest)) ||
      !Number.isSafeInteger(anchor.minimumEpoch) || anchor.minimumEpoch < 1 ||
      !digestPattern.test(anchor.harnessDigest) ||
      !anchor.browserVersion ||
      typeof anchor.offlineRootPublicSpkiBase64 !== "string")
    return { error: "INVALID_INDEPENDENT_HOST_ANCHOR" };
  let policy: unknown, receipt: unknown;
  try { policy = JSON.parse(policyText); receipt = JSON.parse(receiptText); }
  catch { return { error: "INVALID_POLICY_OR_RECEIPT_JSON" }; }
  if (!object(policy) || !exact(policy, ["signed","signatureAlgorithm","signatureBase64"]) ||
      policy.signatureAlgorithm !== "Ed25519" || !object(policy.signed) ||
      typeof policy.signatureBase64 !== "string" ||
      !object(receipt) || !object(receipt.signed))
    return { error: "INVALID_SIGNED_TRUST_POLICY" };
  const signed = policy.signed;
  if (!exact(signed, [
    "schema", "policyId", "audience", "epoch", "previousPolicyDigest",
    "validFrom", "validUntil", "reviewers",
  ]) || signed.schema !== "spe.reviewer-trust-policy.v1" ||
      signed.policyId !== anchor.policyId || signed.audience !== anchor.audience ||
      !Number.isSafeInteger(signed.epoch) ||
      Number(signed.epoch) < anchor.minimumEpoch ||
      signed.previousPolicyDigest !== anchor.requiredPredecessorDigest ||
      !dateWindow(signed.validFrom, signed.validUntil, now, 30 * 86400000))
    return { error: "STALE_OR_MISMATCHED_POLICY_EPOCH" };
  if (!Array.isArray(signed.reviewers) || signed.reviewers.length < 1 ||
      signed.reviewers.length > 16)
    return { error: "INVALID_REVIEWER_REGISTRY" };
  const reviewerIds = new Set<string>(), reviewerKeys = new Set<string>();
  for (const entry of signed.reviewers) {
    if (!object(entry) ||
        !exact(entry, ["keyId", "publicSpkiBase64", "status", "validFrom", "validUntil"]) ||
        !keyPattern.test(String(entry.keyId)) ||
        typeof entry.publicSpkiBase64 !== "string" ||
        !["ACTIVE", "REVOKED"].includes(String(entry.status)) ||
        !dateWindow(entry.validFrom, entry.validUntil,
          new Date(Date.parse(String(signed.validFrom))), 365 * 86400000))
      return { error: "INVALID_REVIEWER_REGISTRY" };
    if (reviewerIds.has(entry.keyId as string) ||
        reviewerKeys.has(entry.publicSpkiBase64))
      return { error: "DUPLICATE_KEY_OR_ID_IN_POLICY" };
    reviewerIds.add(entry.keyId as string);
    reviewerKeys.add(entry.publicSpkiBase64);
  }
  let policyDigest: string;
  try { policyDigest = await hash(canonical(signed)); }
  catch { return { error: "NON_CANONICAL_POLICY" }; }
  if (policyDigest !== anchor.currentSignedPolicyDigest)
    return { error: "POLICY_ROLLBACK_OR_UNPINNED_DIGEST" };
  try {
    const root = await globalThis.crypto.subtle.importKey(
      "spki", decode64(anchor.offlineRootPublicSpkiBase64, 200),
      { name: "Ed25519" }, false, ["verify"],
    );
    const signature = decode64(policy.signatureBase64, 100);
    if (signature.byteLength !== 64 ||
        !await globalThis.crypto.subtle.verify(
          "Ed25519", root, signature, utf8(canonical(signed)),
        )) return { error: "OFFLINE_ROOT_SIGNATURE_INVALID" };
  } catch { return { error: "OFFLINE_ROOT_SIGNATURE_VERIFICATION_FAILED" }; }

  const receiptId = receipt.signed.reviewerKeyId;
  const reviewer = signed.reviewers.find(
    (entry: JsonRecord) => entry.keyId === receiptId,
  );
  if (!reviewer) return { error: "UNKNOWN_REVIEWER_KEY" };
  if (reviewer.status !== "ACTIVE") return { error: "REVIEWER_KEY_REVOKED" };
  if (!dateWindow(reviewer.validFrom, reviewer.validUntil, now, 365 * 86400000))
    return { error: "REVIEWER_KEY_OUTSIDE_VALIDITY" };
  const reviewerPin: TrustedR8Reviewer = {
    reviewerKeyId: reviewer.keyId as string,
    reviewerPublicKeySpkiBase64: reviewer.publicSpkiBase64 as string,
    audience: anchor.audience,
    operationId: anchor.operationId,
    harnessDigest: anchor.harnessDigest,
    browserVersion: anchor.browserVersion,
  };
  return { reviewer: reviewerPin };
}

/** R9 never turns a successful signature into provider or release authority. */
export async function verifyR9ReceiptForSpe(
  speText: string, receiptText: string, policyText: string,
  hostAnchor?: TrustedR9PolicyAnchor, now = new Date(),
): Promise<R8Verdict> {
  try {
    const selection = await selectR9Reviewer(policyText, receiptText, hostAnchor, now);
    if (!selection.reviewer) return fail(selection.error || "NO_TRUSTED_REVIEWER");
    return await verifyR8ReceiptForSpe(speText, receiptText, selection.reviewer, now);
  } catch {
    return fail("TRUST_POLICY_VERIFIER_EXCEPTION");
  }
}
