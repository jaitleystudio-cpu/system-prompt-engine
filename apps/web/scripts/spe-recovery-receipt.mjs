/**
 * SPE R4: Ed25519-bound fresh-browser replay evidence (review-only).
 *
 * Integration boundary for SPE's existing ProofReceipt/qualifyReceipt owners;
 * this file is NOT an alternative authority engine. Its receipts cannot
 * authorize provider retries, release, deploy, or CLAIM original model identity.
 * A signature proves only that the pinned reviewer key signed THESE bytes;
 * genuine independence depends on external custody of that key/process.
 */
import {
  createHash, createPublicKey, randomUUID, sign as edSign, verify as edVerify,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { TEST_SCOPE } from "./spe-crash-recovery-harness.mjs";
import { reconcileRecoveryReadOnly } from "./spe-recovery-reconciliation.mjs";

export const RECEIPT_SCHEMA = "spe.browser-replay.observation.v1";
export const RECEIPT_AUTHORITY = "REVIEW_ONLY_NO_MODEL_OR_RELEASE_AUTHORITY";
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9._:-]{8,160}$/;
const nowMs = time => {
  const n = Date.parse(time);
  return Number.isFinite(n) ? n : NaN;
};
const sha = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const hasOwn = (v, k) => Object.prototype.hasOwnProperty.call(v, k);

function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(k => value[k] === undefined)) throw new Error("NON_PORTABLE_RECEIPT");
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  throw new Error("NON_PORTABLE_RECEIPT");
}
function validDigest(v) { return typeof v === "string" && DIGEST.test(v); }

export async function getR4HarnessDigest() {
  const paths = [
    "./spe-crash-recovery-harness.mjs",
    "./spe-recovery-journal-custody.mjs",
    "./spe-recovery-reconciliation.mjs",
    "./spe-recovery-receipt.mjs",
  ];
  const hashes = [];
  for (const relative of paths) {
    hashes.push({
      module: relative,
      sha256: sha(await readFile(new URL(relative, import.meta.url))),
    });
  }
  return sha(canonical(hashes));
}

/**
 * Sign a fresh browser replay with an OUT-OF-BAND REVIEWER KEY.
 * Caller is responsible for actual key isolation and reviewer independence;
 * CI's temporary key is an acceptance-test fixture, NOT a production trust root.
 */
async function signBrowserReplayReceipt({
  reconciliation, goal, originalPrompt, reviewerPrivateKey,
  reviewerKeyId, audience, operationId, browserVersion,
  now = new Date(), lifetimeMs = 5 * 60_000,
}) {
  if (!reconciliation || reconciliation.status !== "BROWSER_REPLAYED_PROVIDER_UNATTESTED"
      || reconciliation.browserReplay?.passed !== true
      || reconciliation.browserReplay?.candidateDigest !== reconciliation.candidateDigest
      || reconciliation.browserReplay?.errors?.length !== 0
      || !Object.values(reconciliation.browserReplay?.checks || {}).every(v => v === true)
      || reconciliation.nextModelCallAuthorized !== false
      || reconciliation.providerOutcomeProven !== false
      || reconciliation.retryEligible !== false
      || reconciliation.releaseAuthorized !== false)
    throw new Error("UNQUALIFIED_RECONCILIATION_CANNOT_SIGN");
  if (!validDigest(reconciliation.candidateDigest) || !validDigest(reconciliation.checkpointDigest)
      || !validDigest(reconciliation.browserReplay?.screenshotDigest))
    throw new Error("MISSING_ARTIFACT_OR_SCREENSHOT_CUSTODY");
  if (typeof goal !== "string" || !goal || typeof originalPrompt !== "string"
      || !ID.test(reviewerKeyId || "") || !ID.test(audience || "")
      || !ID.test(operationId || "") || !browserVersion || typeof browserVersion !== "string")
    throw new Error("INVALID_SIGNING_CONTEXT");
  if (typeof lifetimeMs !== "number" || lifetimeMs <= 0 || lifetimeMs > 5 * 60_000)
    throw new Error("INVALID_RECEIPT_LIFETIME");
  const createdMs = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(createdMs)) throw new Error("INVALID_RECEIPT_CREATION_TIME");
  const observations = {
    candidateDigest: reconciliation.candidateDigest,
    checkpointDigest: reconciliation.checkpointDigest,
    originalGoalDigest: sha(Buffer.from(goal, "utf8")),
    compiledPromptDigest: sha(Buffer.from(originalPrompt, "utf8")),
    screenshotDigest: reconciliation.browserReplay.screenshotDigest,
    acceptanceDigest: sha(Buffer.from(canonical(TEST_SCOPE), "utf8")),
    browserVersion,
    harnessDigest: await getR4HarnessDigest(),
    tests: { applicationVisible: true, canvasVisible: true, interactionWorking: true },
    errors: 0,
    provenance: reconciliation.provenanceClaim,
    providerOutcome: "UNATTESTED",
    verifiedScope: "FRESH_BROWSER_REPLAY_ONLY",
  };
  const signed = {
    schema: RECEIPT_SCHEMA,
    authority: RECEIPT_AUTHORITY,
    reviewerKeyId,
    audience,
    operationId,
    receiptNonce: randomUUID(),
    createdAt: new Date(createdMs).toISOString(),
    expiresAt: new Date(createdMs + lifetimeMs).toISOString(),
    observations,
  };
  const signature = edSign(null, Buffer.from(canonical(signed)), reviewerPrivateKey);
  return { signed, signatureAlgorithm: "Ed25519", signatureBase64: signature.toString("base64") };
}

/**
 * Only public receipt-issuance entry point: EXECUTE fresh browser replay first.
 * There is intentionally no public API to sign a caller-supplied PASS object.
 * Caller must keep the reviewer private key outside model and app execution.
 */
export async function reviewRecoveryAndSign({
  evidenceDirectory, browser, goal, originalPrompt,
  reviewerPrivateKey, reviewerKeyId, audience, operationId,
  now = new Date(),
}) {
  if (!browser || typeof browser.newContext !== "function") {
    return {
      disposition: "HOLD_RECONCILIATION_REQUIRED",
      reason: "REVIEWER_BROWSER_EXECUTOR_REQUIRED",
      receipt: null,
    };
  }
  const reconciliation = await reconcileRecoveryReadOnly({
    evidenceDirectory, browser, goal, originalPrompt,
  });
  if (reconciliation.status !== "BROWSER_REPLAYED_PROVIDER_UNATTESTED"
      || reconciliation.browserReplay?.passed !== true) {
    return {
      disposition: "HOLD_RECONCILIATION_REQUIRED",
      reason: reconciliation.reason,
      receipt: null,
      reconciliation,
    };
  }
  const receipt = await signBrowserReplayReceipt({
    reconciliation, goal, originalPrompt, reviewerPrivateKey,
    reviewerKeyId, audience, operationId, browserVersion: browser.version(),
    now,
  });
  return {
    disposition: "REVIEW_ONLY_SIGNED_BROWSER_REPLAY",
    receipt, reconciliation,
  };
}

/**
 * Verification must get the public key via an independent, trusted channel,
 * never from the receipt itself. This function never grants execution authority.
 */
export function verifyBrowserReplayReceipt(receipt, {
  pinnedReviewerPublicKey, reviewerKeyId, audience, operationId,
  goal, originalPrompt, candidateDigest, checkpointDigest,
  harnessDigest, browserVersion,
  now = new Date(), maxClockSkewMs = 30_000,
} = {}) {
  const reject = reason => ({
    valid: false, reason, authority: "NONE",
    nextModelCallAuthorized: false, retryEligible: false,
    providerOutcomeProven: false, releaseAuthorized: false,
  });
  if (!receipt || typeof receipt !== "object" || !receipt.signed
      || receipt.signatureAlgorithm !== "Ed25519"
      || typeof receipt.signatureBase64 !== "string"
      || !/^[A-Za-z0-9+/]{86}==$/.test(receipt.signatureBase64))
    return reject("MALFORMED_RECEIPT");
  const signed = receipt.signed;
  if (!signed || typeof signed !== "object" || Array.isArray(signed)
      || Object.keys(signed).sort().join("|") !==
         ["schema","authority","reviewerKeyId","audience","operationId","receiptNonce","createdAt","expiresAt","observations"].sort().join("|"))
    return reject("UNEXPECTED_SIGNED_FIELDS");
  if (signed.schema !== RECEIPT_SCHEMA || signed.authority !== RECEIPT_AUTHORITY)
    return reject("WRONG_RECEIPT_AUTHORITY_OR_SCHEMA");
  if (!ID.test(reviewerKeyId || "") || !ID.test(audience || "")
      || !ID.test(operationId || "")
      || signed.reviewerKeyId !== reviewerKeyId
      || signed.audience !== audience || signed.operationId !== operationId)
    return reject("REVIEWER_AUDIENCE_OR_OPERATION_MISMATCH");
  const observed = signed.observations;
  if (!observed || typeof observed !== "object" || Array.isArray(observed)
      || Object.keys(observed).sort().join("|") !== [
        "candidateDigest","checkpointDigest","originalGoalDigest","compiledPromptDigest",
        "screenshotDigest","acceptanceDigest","browserVersion","harnessDigest","tests",
        "errors","provenance","providerOutcome","verifiedScope",
      ].sort().join("|"))
    return reject("INVALID_OBSERVATIONS");
  if (!validDigest(observed.candidateDigest) || !validDigest(observed.checkpointDigest)
      || !validDigest(observed.screenshotDigest) || !validDigest(observed.harnessDigest)
      || observed.candidateDigest !== candidateDigest
      || observed.checkpointDigest !== checkpointDigest
      || observed.originalGoalDigest !== sha(Buffer.from(goal || "", "utf8"))
      || observed.compiledPromptDigest !== sha(Buffer.from(originalPrompt || "", "utf8")))
    return reject("CANDIDATE_CHECKPOINT_OR_INTENT_MISMATCH");
  if (observed.acceptanceDigest !== sha(Buffer.from(canonical(TEST_SCOPE), "utf8"))
      || observed.verifiedScope !== "FRESH_BROWSER_REPLAY_ONLY"
      || observed.providerOutcome !== "UNATTESTED"
      || observed.errors !== 0 || observed.provenance !== "FIXTURE"
        && observed.provenance !== "EXTERNAL_COMMAND_UNATTESTED"
      || JSON.stringify(observed.tests) !== JSON.stringify({
        applicationVisible: true, canvasVisible: true, interactionWorking: true,
      }))
    return reject("INVALID_EVIDENCE_SCOPE_OR_RESULTS");
  if (!validDigest(harnessDigest) || observed.harnessDigest !== harnessDigest
      || !browserVersion || observed.browserVersion !== browserVersion)
    return reject("ENVIRONMENT_OR_HARNESS_MISMATCH");
  const created = nowMs(signed.createdAt), expires = nowMs(signed.expiresAt);
  const current = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(created) || !Number.isFinite(expires)
      || !Number.isFinite(current) || expires <= created || expires - created > 5 * 60_000
      || created > current + maxClockSkewMs || expires < current)
    return reject("STALE_OR_INVALID_TIME_WINDOW");
  if (!pinnedReviewerPublicKey) return reject("UNPINNED_REVIEWER_KEY");
  try {
    // crypto.createPublicKey() only accepts a PRIVATE KeyObject input;
    // an already-pinned PUBLIC KeyObject is used directly, not recreated.
    const key = pinnedReviewerPublicKey?.type === "public"
      ? pinnedReviewerPublicKey
      : createPublicKey(pinnedReviewerPublicKey);
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519")
      return reject("UNTRUSTED_KEY_TYPE");
    const signedBytes = Buffer.from(canonical(signed), "utf8");
    const signature = Buffer.from(receipt.signatureBase64, "base64");
    if (!edVerify(null, signedBytes, key, signature)) return reject("BAD_REVIEWER_SIGNATURE");
  } catch {
    return reject("BAD_REVIEWER_SIGNATURE_OR_PAYLOAD");
  }
  return {
    valid: true, reason: "SIGNATURE_AND_BROWSER_REPLAY_SCOPE_BOUND",
    authority: RECEIPT_AUTHORITY,
    nextModelCallAuthorized: false, retryEligible: false,
    providerOutcomeProven: false, releaseAuthorized: false,
    candidateDigest: observed.candidateDigest,
    checkpointDigest: observed.checkpointDigest,
  };
}
