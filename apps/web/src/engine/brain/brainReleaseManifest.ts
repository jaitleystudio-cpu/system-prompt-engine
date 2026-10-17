/**
 * SPE Ω — BrainRelease Schema & Immutable Manifest Generator
 * Component Evolution & Release Authority Kernel — Layer 01
 *
 * Epistemic Foundations:
 * - TUF Specification (The Update Framework, IETF RFC draft): Version rollback, freshness, and target integrity.
 * - SLSA Build Provenance Level 3: Non-forgeable identity, exact commit binding, and immutable artifact digest.
 * - Reusable Holdout & Independent Qualification: Mandatory evaluation receipt digest binding.
 *
 * Core Non-Negotiable Invariants:
 * 1. UNKNOWN ≠ PASS: Unknown receipt fields or missing verification never become default PASS.
 * 2. CLOCK TICK ≠ IMPROVEMENT: A clock firing or day passing does NOT justify a release bump.
 * 3. COMPONENT SEPARABILITY: Knowledge, model registry, prompt bundle, router, skills, and policy
 *    are separately digested so incidents can pinpoint and revert the responsible component.
 * 4. SIGNATURES ≠ TRUTH: Signatures authenticate the publisher, not factual correctness.
 * 5. ROLLBACK ≠ HISTORY REWRITE: Recovery creates a new auditable forward transition referencing previous verified data.
 * 6. DEPLOYED REQUIRES WITNESS: A 'deployed' release requires provider-observed deploymentExecutionId and verified signatures.
 */

import { createHmac, createPrivateKey, createPublicKey, sign, verify, randomBytes, timingSafeEqual } from "node:crypto";
import { computeSha256 } from "../hashUtils.ts";
import { REVOKED_COMPROMISED_KEY_HASHES, TRUSTED_AUTHORITY_PUBLIC_KEYS } from "../evolution/releaseSafetyGovernor.ts";

export type BrainReleaseChannel = "development" | "qualified" | "deployed";

export interface TaskLanguageSlice {
  readonly sliceId: string;
  readonly taskId: string; // e.g. "plain-brief-to-prompt", "instruction-export", "prompt-reuse-invariants"
  readonly language: string; // ISO 639-1 e.g. "en", "es", "hi", "te", "ar", "ja"
  readonly script?: string; // ISO 15924 e.g. "Latn", "Deva", "Telu", "Arab", "Jpan"
  readonly rtl?: boolean;
  readonly minPreservationFloor: number; // 0.0 to 1.0 (e.g. 0.95 = 95%)
}

export interface BrainReleaseSignature {
  readonly authorityId: string; // e.g. "founder_release_authority"
  readonly algorithm: "Ed25519" | "HMAC-SHA256";
  readonly signatureHex: string;
  readonly signedAtIso: string;
  readonly nonce: string;
}

export interface BrainReleaseManifest {
  readonly brainReleaseId: string;
  readonly appVersion: string;
  readonly channel: BrainReleaseChannel;
  readonly knowledgeSnapshotDigest: string; // 64-char hex SHA-256
  readonly modelRegistryDigest: string; // 64-char hex SHA-256
  readonly promptBundleDigest: string; // 64-char hex SHA-256
  readonly routerDigest: string; // 64-char hex SHA-256
  readonly skillLibraryDigest: string; // 64-char hex SHA-256
  readonly policyDigest: string; // 64-char hex SHA-256
  readonly evaluatorVersion: string;
  readonly evaluationReceiptDigest: string; // 64-char hex SHA-256
  readonly supportedTaskLanguageSlices: readonly TaskLanguageSlice[];
  readonly sourceCommit: string; // exact 40-char lowercase git SHA
  readonly artifactDigest: string; // 64-char hex SHA-256 of built bytes (e.g. WASM)
  readonly previousReleaseId: string | null;
  readonly deploymentExecutionId?: string;
  readonly rollbackTargetReleaseId?: string;
  readonly createdAtIso: string;
  readonly expiresAtIso: string; // TUF freshness threshold
  readonly manifestDigest: string; // canonical SHA-256 of manifest content
  readonly signatures: readonly BrainReleaseSignature[];
}

export interface CreateBrainReleaseParams {
  brainReleaseId?: string;
  appVersion: string;
  channel?: BrainReleaseChannel;
  knowledgeSnapshotDigest: string;
  modelRegistryDigest: string;
  promptBundleDigest: string;
  routerDigest: string;
  skillLibraryDigest: string;
  policyDigest: string;
  evaluatorVersion: string;
  evaluationReceiptDigest: string;
  supportedTaskLanguageSlices: readonly TaskLanguageSlice[];
  sourceCommit: string;
  artifactDigest: string;
  previousReleaseId?: string | null;
  deploymentExecutionId?: string;
  rollbackTargetReleaseId?: string;
  createdAtIso?: string;
  validityDurationMs?: number; // default 7 days (604,800,000 ms)
}

export interface SigningCredentials {
  privateKeyPem?: string;
  hmacSecret?: string;
}

export interface ManifestVerificationOptions {
  trustedKeys?: Readonly<Record<string, string>>;
  expectedArtifactBytes?: Buffer | Uint8Array;
  currentTimestampIso?: string;
  allowExpired?: boolean;
}

export interface ManifestVerificationResult {
  valid: boolean;
  errors: string[];
  manifestDigest: string;
  verifiedAuthorities: string[];
}

const HEX_64_REGEX = /^[0-9a-f]{64}$/i;
const GIT_SHA_40_REGEX = /^[0-9a-f]{40}$/i;

export const ALLOWED_MANIFEST_KEYS: ReadonlySet<string> = new Set([
  "brainReleaseId",
  "appVersion",
  "channel",
  "knowledgeSnapshotDigest",
  "modelRegistryDigest",
  "promptBundleDigest",
  "routerDigest",
  "skillLibraryDigest",
  "policyDigest",
  "evaluatorVersion",
  "evaluationReceiptDigest",
  "supportedTaskLanguageSlices",
  "sourceCommit",
  "artifactDigest",
  "previousReleaseId",
  "deploymentExecutionId",
  "rollbackTargetReleaseId",
  "createdAtIso",
  "expiresAtIso",
  "manifestDigest",
  "signatures",
]);

/**
 * Deterministically sorts object keys for canonical RFC 8785 JSON serialization.
 * Strictly ignores undefined properties so that in-memory objects match serialized JSON digests.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalizeJson(item)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).filter((key) => obj[key] !== undefined).sort();
  const pairs = sortedKeys.map((key) => {
    return JSON.stringify(key) + ":" + canonicalizeJson(obj[key]);
  });
  return "{" + pairs.join(",") + "}";
}

/**
 * Computes the canonical manifest digest over all immutable manifest fields (excluding manifestDigest and signatures).
 */
export function computeCanonicalManifestDigest(
  manifestFields: Omit<BrainReleaseManifest, "manifestDigest" | "signatures">
): string {
  const canonicalString = canonicalizeJson(manifestFields);
  return computeSha256(canonicalString);
}

/**
 * Validates a 64-character hexadecimal SHA-256 digest.
 */
function assertValidSha256(digest: string, fieldName: string): void {
  if (!digest || typeof digest !== "string" || !HEX_64_REGEX.test(digest)) {
    throw new Error(`VALIDATION_ERROR: Field "${fieldName}" must be a 64-character hex SHA-256 digest, received "${digest}".`);
  }
}

/**
 * Generates an immutable BrainReleaseManifest binding all component digests, policy, evaluator, exact commit SHA, and artifact digest.
 */
export function generateBrainReleaseManifest(params: CreateBrainReleaseParams): BrainReleaseManifest {
  // Validate commit SHA format (strict 40-char git commit)
  if (!params.sourceCommit || !GIT_SHA_40_REGEX.test(params.sourceCommit.toLowerCase())) {
    throw new Error(
      `VALIDATION_ERROR: sourceCommit must be an exact 40-character lowercase git hex SHA, received "${params.sourceCommit}".`
    );
  }

  // Validate all component digests
  assertValidSha256(params.knowledgeSnapshotDigest, "knowledgeSnapshotDigest");
  assertValidSha256(params.modelRegistryDigest, "modelRegistryDigest");
  assertValidSha256(params.promptBundleDigest, "promptBundleDigest");
  assertValidSha256(params.routerDigest, "routerDigest");
  assertValidSha256(params.skillLibraryDigest, "skillLibraryDigest");
  assertValidSha256(params.policyDigest, "policyDigest");
  assertValidSha256(params.evaluationReceiptDigest, "evaluationReceiptDigest");
  assertValidSha256(params.artifactDigest, "artifactDigest");

  if (!params.appVersion || typeof params.appVersion !== "string" || params.appVersion.trim().length === 0) {
    throw new Error("VALIDATION_ERROR: appVersion must be a non-empty string.");
  }

  if (!params.evaluatorVersion || typeof params.evaluatorVersion !== "string" || params.evaluatorVersion.trim().length === 0) {
    throw new Error("VALIDATION_ERROR: evaluatorVersion must be a non-empty string.");
  }

  if (!Array.isArray(params.supportedTaskLanguageSlices) || params.supportedTaskLanguageSlices.length === 0) {
    throw new Error("VALIDATION_ERROR: supportedTaskLanguageSlices must contain at least one qualified slice.");
  }

  for (const slice of params.supportedTaskLanguageSlices) {
    if (!slice.sliceId || !slice.taskId || !slice.language || typeof slice.minPreservationFloor !== "number") {
      throw new Error(`VALIDATION_ERROR: Invalid slice definition: ${JSON.stringify(slice)}`);
    }
    if (slice.minPreservationFloor < 0 || slice.minPreservationFloor > 1) {
      throw new Error(`VALIDATION_ERROR: Slice floor must be between 0.0 and 1.0, received ${slice.minPreservationFloor}`);
    }
  }

  const channel: BrainReleaseChannel = params.channel ?? "qualified";
  if (channel === "deployed" && (!params.deploymentExecutionId || params.deploymentExecutionId.trim().length === 0)) {
    throw new Error("VALIDATION_ERROR: Deployed channel releases require an authentic provider-observed deploymentExecutionId.");
  }

  const createdAtIso = params.createdAtIso || new Date().toISOString();
  const validityMs = params.validityDurationMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
  const expiresAtIso = new Date(new Date(createdAtIso).getTime() + validityMs).toISOString();

  const releaseId =
    params.brainReleaseId ||
    `spe-brain-${createdAtIso.replace(/[-:T]/g, "").slice(0, 8)}-${params.sourceCommit.slice(0, 8)}-${params.artifactDigest.slice(0, 6)}`;

  const manifestBase: Omit<BrainReleaseManifest, "manifestDigest" | "signatures"> = {
    brainReleaseId: releaseId,
    appVersion: params.appVersion.trim(),
    channel,
    knowledgeSnapshotDigest: params.knowledgeSnapshotDigest.toLowerCase(),
    modelRegistryDigest: params.modelRegistryDigest.toLowerCase(),
    promptBundleDigest: params.promptBundleDigest.toLowerCase(),
    routerDigest: params.routerDigest.toLowerCase(),
    skillLibraryDigest: params.skillLibraryDigest.toLowerCase(),
    policyDigest: params.policyDigest.toLowerCase(),
    evaluatorVersion: params.evaluatorVersion.trim(),
    evaluationReceiptDigest: params.evaluationReceiptDigest.toLowerCase(),
    supportedTaskLanguageSlices: Object.freeze([...params.supportedTaskLanguageSlices]),
    sourceCommit: params.sourceCommit.toLowerCase(),
    artifactDigest: params.artifactDigest.toLowerCase(),
    previousReleaseId: params.previousReleaseId ?? null,
    ...(params.deploymentExecutionId ? { deploymentExecutionId: params.deploymentExecutionId } : {}),
    ...(params.rollbackTargetReleaseId ? { rollbackTargetReleaseId: params.rollbackTargetReleaseId } : {}),
    createdAtIso,
    expiresAtIso,
  };

  const manifestDigest = computeCanonicalManifestDigest(manifestBase);

  return Object.freeze({
    ...manifestBase,
    manifestDigest,
    signatures: Object.freeze([]),
  });
}

/**
 * Attaches a cryptographic signature from an external release authority to a BrainReleaseManifest.
 */
export function signBrainReleaseManifest(
  manifest: BrainReleaseManifest,
  authorityId: string,
  credentials: SigningCredentials
): BrainReleaseManifest {
  if (!credentials || (!credentials.privateKeyPem && !credentials.hmacSecret)) {
    throw new Error("CREDENTIAL_ERROR: signBrainReleaseManifest requires external signing credentials.");
  }

  if (credentials.hmacSecret) {
    const keyHash = computeSha256(credentials.hmacSecret);
    if (REVOKED_COMPROMISED_KEY_HASHES.has(keyHash)) {
      throw new Error("CREDENTIAL_REVOKED: Attempted to sign manifest using an exposed, revoked credential.");
    }
  }

  if (credentials.privateKeyPem) {
    const privKeyHash = computeSha256(credentials.privateKeyPem);
    if (REVOKED_COMPROMISED_KEY_HASHES.has(privKeyHash)) {
      throw new Error("CREDENTIAL_REVOKED: Attempted to sign manifest using an exposed, revoked private key credential.");
    }
    try {
      const pubKeyObj = createPublicKey(credentials.privateKeyPem);
      const pubDerHex = pubKeyObj.export({ type: "spki", format: "der" }).toString("hex");
      if (REVOKED_COMPROMISED_KEY_HASHES.has(computeSha256(pubDerHex))) {
        throw new Error("CREDENTIAL_REVOKED: Attempted to sign manifest using an exposed, revoked key credential.");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("CREDENTIAL_REVOKED")) throw err;
    }
  }

  const nonce = `brain_nonce_${Date.now()}_${randomBytes(8).toString("hex")}`;
  const signedAtIso = new Date().toISOString();
  const signaturePayload = `${manifest.manifestDigest}:${authorityId}:${signedAtIso}:${nonce}`;

  let signatureHex = "";
  let algorithm: "Ed25519" | "HMAC-SHA256" = "Ed25519";

  if (credentials.privateKeyPem) {
    const privKey = createPrivateKey(credentials.privateKeyPem);
    const sig = sign(null, Buffer.from(signaturePayload, "utf-8"), privKey);
    signatureHex = sig.toString("hex");
    algorithm = "Ed25519";
  } else if (credentials.hmacSecret) {
    signatureHex = createHmac("sha256", credentials.hmacSecret).update(signaturePayload).digest("hex");
    algorithm = "HMAC-SHA256";
  }

  const newSignature: BrainReleaseSignature = {
    authorityId,
    algorithm,
    signatureHex,
    signedAtIso,
    nonce,
  };

  const updatedSignatures = Object.freeze([...manifest.signatures, newSignature]);

  return Object.freeze({
    ...manifest,
    signatures: updatedSignatures,
  });
}

/**
 * Verifies the integrity, freshness, component bindings, artifact match, and signatures of a BrainReleaseManifest.
 */
export function verifyBrainReleaseManifest(
  manifest: BrainReleaseManifest,
  options: ManifestVerificationOptions = {}
): ManifestVerificationResult {
  const errors: string[] = [];
  const verifiedAuthorities: string[] = [];

  // 0. Unknown Fields Detection (UNKNOWN ≠ PASS Invariant)
  if (!manifest || typeof manifest !== "object") {
    return {
      valid: false,
      errors: ["INVALID_MANIFEST: Manifest payload must be a non-null object."],
      manifestDigest: "",
      verifiedAuthorities: [],
    };
  }
  for (const key of Object.keys(manifest)) {
    if (!ALLOWED_MANIFEST_KEYS.has(key)) {
      errors.push(`UNKNOWN_FIELD_DETECTED: Field "${key}" is not part of canonical BrainRelease schema.`);
    }
  }

  // 1. Recompute and verify manifest digest
  const manifestFields: Omit<BrainReleaseManifest, "manifestDigest" | "signatures"> = {
    brainReleaseId: manifest.brainReleaseId,
    appVersion: manifest.appVersion,
    channel: manifest.channel,
    knowledgeSnapshotDigest: manifest.knowledgeSnapshotDigest,
    modelRegistryDigest: manifest.modelRegistryDigest,
    promptBundleDigest: manifest.promptBundleDigest,
    routerDigest: manifest.routerDigest,
    skillLibraryDigest: manifest.skillLibraryDigest,
    policyDigest: manifest.policyDigest,
    evaluatorVersion: manifest.evaluatorVersion,
    evaluationReceiptDigest: manifest.evaluationReceiptDigest,
    supportedTaskLanguageSlices: manifest.supportedTaskLanguageSlices,
    sourceCommit: manifest.sourceCommit,
    artifactDigest: manifest.artifactDigest,
    previousReleaseId: manifest.previousReleaseId,
    ...(manifest.deploymentExecutionId ? { deploymentExecutionId: manifest.deploymentExecutionId } : {}),
    ...(manifest.rollbackTargetReleaseId ? { rollbackTargetReleaseId: manifest.rollbackTargetReleaseId } : {}),
    createdAtIso: manifest.createdAtIso,
    expiresAtIso: manifest.expiresAtIso,
  };

  const recomputedDigest = computeCanonicalManifestDigest(manifestFields);
  if (recomputedDigest !== manifest.manifestDigest) {
    errors.push(`DIGEST_MISMATCH: Manifest digest tamper detected. Recomputed ${recomputedDigest} !== observed ${manifest.manifestDigest}`);
  }

  // 2. Verify Commit SHA format
  if (!GIT_SHA_40_REGEX.test(manifest.sourceCommit)) {
    errors.push(`INVALID_SOURCE_COMMIT: sourceCommit must be a 40-character git SHA: "${manifest.sourceCommit}"`);
  }

  // 3. Verify component hashes
  for (const [key, val] of Object.entries({
    knowledgeSnapshotDigest: manifest.knowledgeSnapshotDigest,
    modelRegistryDigest: manifest.modelRegistryDigest,
    promptBundleDigest: manifest.promptBundleDigest,
    routerDigest: manifest.routerDigest,
    skillLibraryDigest: manifest.skillLibraryDigest,
    policyDigest: manifest.policyDigest,
    evaluationReceiptDigest: manifest.evaluationReceiptDigest,
    artifactDigest: manifest.artifactDigest,
  })) {
    if (!HEX_64_REGEX.test(val)) {
      errors.push(`INVALID_COMPONENT_DIGEST: ${key} is not a valid 64-char hex string: "${val}"`);
    }
  }

  // 4. Freshness / TUF check & Future-dating defense
  const now = options.currentTimestampIso ? new Date(options.currentTimestampIso).getTime() : Date.now();
  const createdAtMs = new Date(manifest.createdAtIso).getTime();
  if (isNaN(createdAtMs)) {
    errors.push(`INVALID_CREATED_AT: createdAtIso is not a valid ISO date string: "${manifest.createdAtIso}"`);
  } else if (createdAtMs > now + 60000) {
    errors.push(`FUTURE_DATED_MANIFEST: Manifest creation timestamp "${manifest.createdAtIso}" is in the future.`);
  }

  const expiresAtMs = new Date(manifest.expiresAtIso).getTime();
  if (isNaN(expiresAtMs)) {
    errors.push(`INVALID_EXPIRATION: expiresAtIso is not a valid ISO date string: "${manifest.expiresAtIso}"`);
  } else if (!options.allowExpired && now > expiresAtMs) {
    errors.push(`MANIFEST_EXPIRED: Manifest expired at ${manifest.expiresAtIso} (current: ${new Date(now).toISOString()})`);
  }

  // 5. Artifact bytes match
  if (options.expectedArtifactBytes) {
    const actualArtifactDigest = computeSha256(
      Buffer.isBuffer(options.expectedArtifactBytes)
        ? options.expectedArtifactBytes
        : Buffer.from(options.expectedArtifactBytes)
    );
    if (actualArtifactDigest.toLowerCase() !== manifest.artifactDigest.toLowerCase()) {
      errors.push(
        `ARTIFACT_DIGEST_MISMATCH: Physical artifact bytes digest ${actualArtifactDigest} does not match manifest ${manifest.artifactDigest}`
      );
    }
  }

  // 6. Channel constraints
  if (manifest.channel === "deployed") {
    if (!manifest.deploymentExecutionId) {
      errors.push("DEPLOYED_CHANNEL_MISSING_EXECUTION_ID: A deployed release manifest must contain deploymentExecutionId.");
    }
    if (manifest.signatures.length === 0) {
      errors.push("DEPLOYED_CHANNEL_UNSIGNED: A deployed release manifest must have at least one cryptographic signature.");
    }
  }

  // 7. Signature verification (constant-time timingSafeEqual HMAC + Ed25519)
  const trustedKeys = options.trustedKeys ?? TRUSTED_AUTHORITY_PUBLIC_KEYS;
  if (manifest.signatures.length > 0) {
    for (const sig of manifest.signatures) {
      const trustedKey = trustedKeys[sig.authorityId];
      if (!trustedKey) {
        errors.push(`UNTRUSTED_AUTHORITY: Authority "${sig.authorityId}" is not in trusted keys list.`);
        continue;
      }

      // Check key revocation
      if (REVOKED_COMPROMISED_KEY_HASHES.has(computeSha256(trustedKey))) {
        errors.push(`REVOKED_KEY_USED: Key for authority "${sig.authorityId}" is revoked.`);
        continue;
      }

      const signedAtMs = new Date(sig.signedAtIso).getTime();
      if (isNaN(signedAtMs) || signedAtMs > now + 60000) {
        errors.push(`INVALID_SIGNATURE_TIMESTAMP: Signature timestamp "${sig.signedAtIso}" is invalid or future-dated.`);
        continue;
      }

      const signaturePayload = `${manifest.manifestDigest}:${sig.authorityId}:${sig.signedAtIso}:${sig.nonce}`;

      try {
        if (sig.algorithm === "Ed25519") {
          const pubKeyObj = createPublicKey({
            key: Buffer.from(trustedKey, "hex"),
            format: "der",
            type: "spki",
          });
          const isValid = verify(null, Buffer.from(signaturePayload, "utf-8"), pubKeyObj, Buffer.from(sig.signatureHex, "hex"));
          if (!isValid) {
            errors.push(`INVALID_SIGNATURE: Ed25519 signature for authority "${sig.authorityId}" failed cryptographic verification.`);
          } else {
            verifiedAuthorities.push(sig.authorityId);
          }
        } else if (sig.algorithm === "HMAC-SHA256") {
          const expectedSig = createHmac("sha256", trustedKey).update(signaturePayload).digest("hex");
          const bufExpected = Buffer.from(expectedSig, "hex");
          const bufActual = Buffer.from(sig.signatureHex, "hex");
          if (bufExpected.length !== bufActual.length || !timingSafeEqual(bufExpected, bufActual)) {
            errors.push(`INVALID_SIGNATURE: HMAC signature for authority "${sig.authorityId}" failed verification.`);
          } else {
            verifiedAuthorities.push(sig.authorityId);
          }
        }
      } catch (err: unknown) {
        errors.push(`SIGNATURE_VERIFICATION_EXCEPTION: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    manifestDigest: manifest.manifestDigest,
    verifiedAuthorities,
  };
}

/**
 * Creates an auditable forward rollback release transition referencing a previous verified release.
 * Adheres to: ROLLBACK ≠ HISTORY REWRITE.
 * Does NOT truncate or mutate previous history; creates a new manifest that restores prior verified
 * component digests under a new release identifier and logs rollbackTargetReleaseId.
 */
export function createRollbackBrainRelease(
  currentRelease: BrainReleaseManifest,
  targetPriorRelease: BrainReleaseManifest,
  reason: string,
  author: string,
  credentials: SigningCredentials
): BrainReleaseManifest {
  if (!reason || reason.trim().length === 0) {
    throw new Error("ROLLBACK_ERROR: A specific reason must be provided for auditable rollback.");
  }
  if (!author || author.trim().length === 0) {
    throw new Error("ROLLBACK_ERROR: An author identity must be provided for auditable rollback.");
  }

  // Pre-condition: Target prior release must pass integrity verification
  const priorVerification = verifyBrainReleaseManifest(targetPriorRelease, { allowExpired: true });
  if (!priorVerification.valid) {
    throw new Error(`ROLLBACK_ERROR: targetPriorRelease failed verification: ${priorVerification.errors.join("; ")}`);
  }

  const createdAtIso = new Date().toISOString();
  const rollbackReleaseId = `spe-brain-rollback-${createdAtIso.replace(/[-:T]/g, "").slice(0, 8)}-to-${targetPriorRelease.brainReleaseId}`;

  // Restore the prior target's proven component digests while preserving new lineage
  const rollbackManifest = generateBrainReleaseManifest({
    brainReleaseId: rollbackReleaseId,
    appVersion: currentRelease.appVersion,
    channel: "qualified", // rollback starts as qualified, then deployed
    knowledgeSnapshotDigest: targetPriorRelease.knowledgeSnapshotDigest,
    modelRegistryDigest: targetPriorRelease.modelRegistryDigest,
    promptBundleDigest: targetPriorRelease.promptBundleDigest,
    routerDigest: targetPriorRelease.routerDigest,
    skillLibraryDigest: targetPriorRelease.skillLibraryDigest,
    policyDigest: targetPriorRelease.policyDigest,
    evaluatorVersion: targetPriorRelease.evaluatorVersion,
    evaluationReceiptDigest: targetPriorRelease.evaluationReceiptDigest,
    supportedTaskLanguageSlices: targetPriorRelease.supportedTaskLanguageSlices,
    sourceCommit: targetPriorRelease.sourceCommit,
    artifactDigest: targetPriorRelease.artifactDigest,
    previousReleaseId: currentRelease.brainReleaseId,
    rollbackTargetReleaseId: targetPriorRelease.brainReleaseId,
    createdAtIso,
  });

  // Sign with author / rollback credentials
  return signBrainReleaseManifest(rollbackManifest, author, credentials);
}
