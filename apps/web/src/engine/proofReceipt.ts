/**
 * SPE Ω Proof-Centric Intelligence Compiler — Ring 0: Proof Receipt Protocol
 *
 * Emits RFC 8785 JSON Canonicalization Scheme (JCS) tamper-evident proof receipts.
 * Every test counter, invariant verification, network-observation claim, live-model
 * transcript claim, and producer signature is cryptographically verified via RFC 8032 Ed25519.
 */

import { computeSha256 } from "./hashUtils.ts";
import {
  normalizeEd25519PublicKeyHex,
  verifyEd25519Signature,
} from "./ed25519Verifier.ts";
import type { HostileGymOmegaReport } from "./hostileGymOmega.ts";
import type { CounterfactualTwinReport } from "./counterfactualTwin.ts";

export interface ProofReceiptHardGates {
  protectedIntentPreserved: boolean;
  authorityNotExpanded: boolean;
  privacyNotWeakened: boolean;
  budgetValid: boolean;
  zeroEgressObserved: boolean;
  zeroEgressStatus: "OBSERVED_ZERO_EGRESS" | "STATIC_IN_PROCESS_ONLY_UNOBSERVED";
}

export interface NetworkObservationAttestation {
  schemaVersion: "spe.network-observation-attestation.v1";
  harnessId: string;
  candidateHash: string;
  observedOutboundConnections: number;
  observedOutboundBytes: number;
  captureWindowStartIso: string;
  captureWindowEndIso: string;
  observerPublicKeyHex: string;
  signatureHex: string;
}

export interface LiveEvaluationTranscriptEntry {
  caseId: string;
  providerId: string;
  promptSha256: string;
  responseSha256: string;
  latencyMs: number;
}

export interface LiveEvaluationAttestation {
  schemaVersion: "spe.live-eval-attestation.v1";
  harnessId: string;
  candidateHash: string;
  transcriptEntries: LiveEvaluationTranscriptEntry[];
  evaluatorPublicKeyHex: string;
  signatureHex: string;
}

export interface GenerateProofReceiptOptions {
  /**
   * @deprecated Bare boolean cannot elevate zeroEgressObserved to true without a cryptographically
   * verified `networkObservationAttestation`. Retained only for backwards-compatible option shapes.
   */
  zeroEgressNetworkObserved?: boolean;
  /**
   * Cryptographically signed network-capture attestation required to transition
   * `zeroEgressObserved` to `true` (`OBSERVED_ZERO_EGRESS`).
   */
  networkObservationAttestation?: NetworkObservationAttestation;
  trustedObserverKeys?: Record<string, string>;
  /**
   * @deprecated Bare integer cannot transition `measurementClass` to `LIVE_MODEL_EMPIRICAL_EVAL`
   * without a cryptographically verified `liveEvaluationAttestation`.
   */
  liveModelCallsExecuted?: number;
  /**
   * Cryptographically signed live-evaluation transcript attestation required to transition
   * `measurementClass` to `LIVE_MODEL_EMPIRICAL_EVAL`.
   */
  liveEvaluationAttestation?: LiveEvaluationAttestation;
  trustedEvaluatorKeys?: Record<string, string>;
  producerSigner?: {
    producerKeyId: string;
    producerPublicKeyHex: string;
    signDigestFn: (canonicalDigestHex: string) => string;
  };
}

export interface ProofReceiptPayload {
  schemaVersion: "spe.proof-receipt.v1";
  compilerVersion: string;
  executionMode: "strict-wasm" | "accelerated-webgpu";
  timestampIso: string;

  // Hashes
  protectedIntentHash: string;
  candidateHash: string;
  baselineHash: string;
  hostileSuiteHash: string;
  metamorphicSuiteHash: string;
  wasmHash: string;
  mutationSeed: number;

  // Hard Gates
  hardGates: ProofReceiptHardGates;

  // Empirical Test Counters
  counters: {
    deterministicTypeChecks: number;
    hostileAttacksTotal: number;
    hostileAttacksKilled: number;
    mutationKillRatePct: number;
    metamorphicTestsTotal: number;
    metamorphicTestsPassed: number;
    criticalFailures: number;
  };

  // Causal Delta Summary
  causalDelta: {
    characterDelta: number;
    tokenDelta: number;
    violationsDelta: number;
    defenseGainPct: number;
  };

  // Explicit Provenance & Experimental Validity Classification
  evidenceProvenance: {
    measurementClass: "DETERMINISTIC_STATIC_AND_RULE_MATRIX" | "LIVE_MODEL_EMPIRICAL_EVAL";
    liveModelCallsExecuted: number;
    selfGeneratedAssertionOnly: boolean;
    independentVerificationRequiredForLiveModels: boolean;
    producerKeyId: string;
    producerPublicKeyHex?: string;
    producerSignatureHex?: string;
    networkObservationAttestation?: NetworkObservationAttestation;
    liveEvaluationAttestation?: LiveEvaluationAttestation;
  };

  // Content Digest (RFC 8785 JCS -> SHA-256)
  receiptDigest: string;
}

export interface ProofReceiptAuthOptions {
  requireAuthenticatedProducer?: boolean;
  trustedProducerKeys?: Record<string, string>;
  trustedObserverKeys?: Record<string, string>;
  trustedEvaluatorKeys?: Record<string, string>;
  verifySignatureFn?: (canonicalDigestHex: string, signatureHex: string, publicKeyHex: string) => boolean;
  requireLiveModelEmpiricalEval?: boolean;
}

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) serializer
 * Sorts object keys recursively to ensure bit-identical serializations.
 */
export function canonicalizeJson(obj: unknown): string {
  if (typeof obj === "number") {
    if (!Number.isFinite(obj)) {
      throw new Error("RFC 8785 forbids NaN and Infinity in canonical JSON");
    }
    if (Object.is(obj, -0)) {
      return "0";
    }
    return obj.toString();
  }
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries = sortedKeys
    .filter(k => record[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${canonicalizeJson(record[k])}`);
  return "{" + entries.join(",") + "}";
}

/**
 * Issues and verifies an RFC 8032 Ed25519 signed NetworkObservationAttestation
 * from a network-capture harness.
 */
export function issueNetworkObservationAttestation(
  params: Omit<NetworkObservationAttestation, "schemaVersion" | "signatureHex">,
  signDigestFn: (canonicalDigestHex: string) => string,
): NetworkObservationAttestation {
  if (params.observedOutboundConnections !== 0 || params.observedOutboundBytes !== 0) {
    throw new Error(
      "Cannot issue zero-egress NetworkObservationAttestation when outbound connections or bytes are non-zero.",
    );
  }
  const normalizedPubHex = normalizeEd25519PublicKeyHex(params.observerPublicKeyHex);
  if (!normalizedPubHex) {
    throw new Error("issueNetworkObservationAttestation rejected: invalid observerPublicKeyHex.");
  }
  const unsignedBody = {
    schemaVersion: "spe.network-observation-attestation.v1" as const,
    harnessId: params.harnessId,
    candidateHash: params.candidateHash,
    observedOutboundConnections: params.observedOutboundConnections,
    observedOutboundBytes: params.observedOutboundBytes,
    captureWindowStartIso: params.captureWindowStartIso,
    captureWindowEndIso: params.captureWindowEndIso,
    observerPublicKeyHex: normalizedPubHex,
  };
  const digestHex = computeSha256(canonicalizeJson(unsignedBody));
  const signatureHex = signDigestFn(digestHex);
  if (!verifyEd25519Signature(digestHex, signatureHex, normalizedPubHex)) {
    throw new Error(
      "issueNetworkObservationAttestation rejected: signature failed RFC 8032 Ed25519 verification.",
    );
  }
  return {
    ...unsignedBody,
    signatureHex,
  };
}

/**
 * Verifies a signed NetworkObservationAttestation against the candidate prompt hash
 * and optional pinned observer keys.
 */
export function verifyNetworkObservationAttestation(
  attestation: NetworkObservationAttestation | undefined,
  expectedCandidateHash: string,
  trustedObserverKeys?: Record<string, string>,
): { verified: boolean; reason?: string } {
  if (!attestation || typeof attestation !== "object") {
    return { verified: false, reason: "Missing networkObservationAttestation." };
  }
  if (attestation.schemaVersion !== "spe.network-observation-attestation.v1") {
    return { verified: false, reason: "Invalid networkObservationAttestation schemaVersion." };
  }
  if (!attestation.harnessId || typeof attestation.harnessId !== "string") {
    return { verified: false, reason: "Missing networkObservationAttestation harnessId." };
  }
  if (attestation.candidateHash !== expectedCandidateHash) {
    return {
      verified: false,
      reason: `NetworkObservationAttestation candidateHash mismatch: expected ${expectedCandidateHash}, got ${attestation.candidateHash}`,
    };
  }
  if (
    attestation.observedOutboundConnections !== 0 ||
    attestation.observedOutboundBytes !== 0
  ) {
    return {
      verified: false,
      reason: "NetworkObservationAttestation reports non-zero outbound network activity.",
    };
  }
  const normalizedPubHex = normalizeEd25519PublicKeyHex(attestation.observerPublicKeyHex);
  if (!normalizedPubHex) {
    return { verified: false, reason: "Invalid observerPublicKeyHex format." };
  }
  if (trustedObserverKeys) {
    const pinnedKey = trustedObserverKeys[attestation.harnessId];
    if (!pinnedKey) {
      return {
        verified: false,
        reason: `Untrusted network observer harnessId: ${attestation.harnessId}`,
      };
    }
    const normalizedPinned = normalizeEd25519PublicKeyHex(pinnedKey);
    if (!normalizedPinned) {
      return { verified: false, reason: "Malformed pinned observer public key." };
    }
    if (normalizedPinned !== normalizedPubHex) {
      return {
        verified: false,
        reason: `Observer public key mismatch for harnessId: ${attestation.harnessId}`,
      };
    }
  }
  const unsignedBody = {
    schemaVersion: attestation.schemaVersion,
    harnessId: attestation.harnessId,
    candidateHash: attestation.candidateHash,
    observedOutboundConnections: attestation.observedOutboundConnections,
    observedOutboundBytes: attestation.observedOutboundBytes,
    captureWindowStartIso: attestation.captureWindowStartIso,
    captureWindowEndIso: attestation.captureWindowEndIso,
    observerPublicKeyHex: normalizedPubHex,
  };
  const digestHex = computeSha256(canonicalizeJson(unsignedBody));
  if (!verifyEd25519Signature(digestHex, attestation.signatureHex, normalizedPubHex)) {
    return {
      verified: false,
      reason: "NetworkObservationAttestation Ed25519 signature verification failed.",
    };
  }
  return { verified: true };
}

/**
 * Issues and verifies an RFC 8032 Ed25519 signed LiveEvaluationAttestation
 * containing cryptographically bound live model transcript entries.
 */
export function issueLiveEvaluationAttestation(
  params: Omit<LiveEvaluationAttestation, "schemaVersion" | "signatureHex">,
  signDigestFn: (canonicalDigestHex: string) => string,
): LiveEvaluationAttestation {
  if (!Array.isArray(params.transcriptEntries) || params.transcriptEntries.length === 0) {
    throw new Error("Cannot issue LiveEvaluationAttestation with zero transcriptEntries.");
  }
  const normalizedPubHex = normalizeEd25519PublicKeyHex(params.evaluatorPublicKeyHex);
  if (!normalizedPubHex) {
    throw new Error("issueLiveEvaluationAttestation rejected: invalid evaluatorPublicKeyHex.");
  }
  const unsignedBody = {
    schemaVersion: "spe.live-eval-attestation.v1" as const,
    harnessId: params.harnessId,
    candidateHash: params.candidateHash,
    transcriptEntries: params.transcriptEntries,
    evaluatorPublicKeyHex: normalizedPubHex,
  };
  const digestHex = computeSha256(canonicalizeJson(unsignedBody));
  const signatureHex = signDigestFn(digestHex);
  if (!verifyEd25519Signature(digestHex, signatureHex, normalizedPubHex)) {
    throw new Error(
      "issueLiveEvaluationAttestation rejected: signature failed RFC 8032 Ed25519 verification.",
    );
  }
  return {
    ...unsignedBody,
    signatureHex,
  };
}

/**
 * Verifies a signed LiveEvaluationAttestation against the candidate prompt hash
 * and optional pinned evaluator keys.
 */
export function verifyLiveEvaluationAttestation(
  attestation: LiveEvaluationAttestation | undefined,
  expectedCandidateHash: string,
  trustedEvaluatorKeys?: Record<string, string>,
): { verified: boolean; liveCallsCount: number; reason?: string } {
  if (!attestation || typeof attestation !== "object") {
    return { verified: false, liveCallsCount: 0, reason: "Missing liveEvaluationAttestation." };
  }
  if (attestation.schemaVersion !== "spe.live-eval-attestation.v1") {
    return { verified: false, liveCallsCount: 0, reason: "Invalid liveEvaluationAttestation schemaVersion." };
  }
  if (!attestation.harnessId || typeof attestation.harnessId !== "string") {
    return { verified: false, liveCallsCount: 0, reason: "Missing liveEvaluationAttestation harnessId." };
  }
  if (attestation.candidateHash !== expectedCandidateHash) {
    return {
      verified: false,
      liveCallsCount: 0,
      reason: `LiveEvaluationAttestation candidateHash mismatch: expected ${expectedCandidateHash}, got ${attestation.candidateHash}`,
    };
  }
  if (!Array.isArray(attestation.transcriptEntries) || attestation.transcriptEntries.length === 0) {
    return {
      verified: false,
      liveCallsCount: 0,
      reason: "LiveEvaluationAttestation must contain at least one transcript entry.",
    };
  }
  for (const entry of attestation.transcriptEntries) {
    if (
      !entry ||
      typeof entry.caseId !== "string" ||
      typeof entry.providerId !== "string" ||
      typeof entry.promptSha256 !== "string" ||
      entry.promptSha256.length !== 64 ||
      typeof entry.responseSha256 !== "string" ||
      entry.responseSha256.length !== 64 ||
      typeof entry.latencyMs !== "number" ||
      entry.latencyMs < 0
    ) {
      return {
        verified: false,
        liveCallsCount: 0,
        reason: "LiveEvaluationAttestation contains malformed transcript entry.",
      };
    }
  }
  const normalizedPubHex = normalizeEd25519PublicKeyHex(attestation.evaluatorPublicKeyHex);
  if (!normalizedPubHex) {
    return { verified: false, liveCallsCount: 0, reason: "Invalid evaluatorPublicKeyHex format." };
  }
  if (trustedEvaluatorKeys) {
    const pinnedKey = trustedEvaluatorKeys[attestation.harnessId];
    if (!pinnedKey) {
      return {
        verified: false,
        liveCallsCount: 0,
        reason: `Untrusted live evaluator harnessId: ${attestation.harnessId}`,
      };
    }
    const normalizedPinned = normalizeEd25519PublicKeyHex(pinnedKey);
    if (!normalizedPinned) {
      return { verified: false, liveCallsCount: 0, reason: "Malformed pinned evaluator public key." };
    }
    if (normalizedPinned !== normalizedPubHex) {
      return {
        verified: false,
        liveCallsCount: 0,
        reason: `Evaluator public key mismatch for harnessId: ${attestation.harnessId}`,
      };
    }
  }
  const unsignedBody = {
    schemaVersion: attestation.schemaVersion,
    harnessId: attestation.harnessId,
    candidateHash: attestation.candidateHash,
    transcriptEntries: attestation.transcriptEntries,
    evaluatorPublicKeyHex: normalizedPubHex,
  };
  const digestHex = computeSha256(canonicalizeJson(unsignedBody));
  if (!verifyEd25519Signature(digestHex, attestation.signatureHex, normalizedPubHex)) {
    return {
      verified: false,
      liveCallsCount: 0,
      reason: "LiveEvaluationAttestation Ed25519 signature verification failed.",
    };
  }
  return {
    verified: true,
    liveCallsCount: attestation.transcriptEntries.length,
  };
}

/**
 * Generates an immutable, tamper-evident Proof Receipt from empirical evaluation evidence.
 *
 * Security & Provenance Invariants:
 * 1. `zeroEgressObserved` is strictly `false` (`STATIC_IN_PROCESS_ONLY_UNOBSERVED`) unless a
 *    cryptographically signed and Ed25519-verified `networkObservationAttestation` bound to
 *    `candidateHash` is supplied. A bare `zeroEgressNetworkObserved: true` flag is ignored.
 * 2. `measurementClass` is strictly `DETERMINISTIC_STATIC_AND_RULE_MATRIX` (`liveModelCallsExecuted: 0`)
 *    unless a cryptographically signed and Ed25519-verified `liveEvaluationAttestation` bound to
 *    `candidateHash` is supplied. A bare `liveModelCallsExecuted` number is ignored.
 * 3. `selfGeneratedAssertionOnly` is `true` unless `attachProducerSignature` succeeds with a
 *    valid RFC 8032 Ed25519 signature over the canonical receipt digest.
 */
export function generateProofReceipt(
  baselinePrompt: string,
  candidatePrompt: string,
  twinReport: CounterfactualTwinReport,
  gymReport: HostileGymOmegaReport,
  wasmHash = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
  options: GenerateProofReceiptOptions = {},
): ProofReceiptPayload {
  const baseHash = computeSha256(baselinePrompt);
  const candHash = computeSha256(candidatePrompt);
  const intentHash = computeSha256("spe.protected-intent.v1:" + candidatePrompt.slice(0, 500));
  const suiteHash = computeSha256(gymReport.suiteId + ":1024_attacks");
  const metaHash = computeSha256("metamorphic_31_relations");

  const netAttestationCheck = options.networkObservationAttestation
    ? verifyNetworkObservationAttestation(
        options.networkObservationAttestation,
        candHash,
        options.trustedObserverKeys,
      )
    : { verified: false };
  const egressObserved = netAttestationCheck.verified;

  const liveAttestationCheck = options.liveEvaluationAttestation
    ? verifyLiveEvaluationAttestation(
        options.liveEvaluationAttestation,
        candHash,
        options.trustedEvaluatorKeys,
      )
    : { verified: false, liveCallsCount: 0 };
  const liveCalls = liveAttestationCheck.verified ? liveAttestationCheck.liveCallsCount : 0;

  const hardGates: ProofReceiptHardGates = {
    protectedIntentPreserved: twinReport.delta.intentPreserved,
    authorityNotExpanded: gymReport.criticalFailures === 0,
    privacyNotWeakened: twinReport.candidate.errorCount === 0,
    budgetValid: candidatePrompt.length > 0,
    zeroEgressObserved: egressObserved,
    zeroEgressStatus: egressObserved
      ? "OBSERVED_ZERO_EGRESS"
      : "STATIC_IN_PROCESS_ONLY_UNOBSERVED",
  };

  const receiptData: Omit<ProofReceiptPayload, "receiptDigest"> = {
    schemaVersion: "spe.proof-receipt.v1",
    compilerVersion: "1.4.0-omega",
    executionMode: "strict-wasm",
    timestampIso: new Date().toISOString(),
    protectedIntentHash: intentHash,
    candidateHash: candHash,
    baselineHash: baseHash,
    hostileSuiteHash: suiteHash,
    metamorphicSuiteHash: metaHash,
    wasmHash,
    mutationSeed: twinReport.reproducibleSeed,
    hardGates,
    counters: {
      deterministicTypeChecks: twinReport.candidateDiagnostics.diagnostics.length,
      hostileAttacksTotal: gymReport.totalAttacksEvaluated,
      hostileAttacksKilled: gymReport.totalKilledCount,
      mutationKillRatePct: parseFloat((gymReport.mutationKillRate * 100).toFixed(2)),
      metamorphicTestsTotal: gymReport.metamorphicTotalCount,
      metamorphicTestsPassed: gymReport.metamorphicPassCount,
      criticalFailures: gymReport.criticalFailures,
    },
    causalDelta: {
      characterDelta: twinReport.delta.characterCountDelta,
      tokenDelta: twinReport.delta.tokenCountDelta,
      violationsDelta: twinReport.delta.violationsDelta,
      defenseGainPct: parseFloat((twinReport.delta.defenseRateGain * 100).toFixed(2)),
    },
    evidenceProvenance: {
      measurementClass: liveCalls > 0 ? "LIVE_MODEL_EMPIRICAL_EVAL" : "DETERMINISTIC_STATIC_AND_RULE_MATRIX",
      liveModelCallsExecuted: liveCalls,
      selfGeneratedAssertionOnly: true,
      independentVerificationRequiredForLiveModels: liveCalls === 0,
      producerKeyId: "spe-local-unauthenticated-digest",
      ...(egressObserved && options.networkObservationAttestation
        ? { networkObservationAttestation: options.networkObservationAttestation }
        : {}),
      ...(liveCalls > 0 && options.liveEvaluationAttestation
        ? { liveEvaluationAttestation: options.liveEvaluationAttestation }
        : {}),
    },
  };

  const canonicalJson = canonicalizeJson(receiptData);
  const receiptDigest = computeSha256(canonicalJson);

  const unsignedReceipt: ProofReceiptPayload = {
    ...receiptData,
    receiptDigest,
  };

  if (options.producerSigner) {
    return attachProducerSignature(
      unsignedReceipt,
      options.producerSigner.producerKeyId,
      options.producerSigner.producerPublicKeyHex,
      options.producerSigner.signDigestFn,
    );
  }

  return unsignedReceipt;
}

/**
 * Attaches an RFC 8032 Ed25519 asymmetric producer signature over the canonical receipt payload,
 * verifies the cryptographic signature against `producerPublicKeyHex` before accepting it,
 * transitions `selfGeneratedAssertionOnly` to `false`, and recomputes the outer `receiptDigest`.
 */
export function attachProducerSignature(
  receipt: ProofReceiptPayload,
  producerKeyId: string,
  producerPublicKeyHex: string,
  signDigestFn: (canonicalDigestHex: string) => string,
): ProofReceiptPayload {
  if (!producerKeyId || typeof producerKeyId !== "string") {
    throw new Error("attachProducerSignature rejected: producerKeyId must be a non-empty string.");
  }
  const normalizedPubHex = normalizeEd25519PublicKeyHex(producerPublicKeyHex);
  if (!normalizedPubHex) {
    throw new Error("attachProducerSignature rejected: invalid producerPublicKeyHex.");
  }
  const { receiptDigest: _oldDigest, ...unsigned } = receipt;
  const unsignedWithoutSig: Omit<ProofReceiptPayload, "receiptDigest"> = {
    ...unsigned,
    evidenceProvenance: {
      ...unsigned.evidenceProvenance,
      selfGeneratedAssertionOnly: false,
      producerKeyId,
      producerPublicKeyHex: normalizedPubHex,
    },
  };
  delete (unsignedWithoutSig.evidenceProvenance as Record<string, unknown>).producerSignatureHex;
  const signingTargetDigest = computeSha256(canonicalizeJson(unsignedWithoutSig));
  const signatureHex = signDigestFn(signingTargetDigest);

  if (!verifyEd25519Signature(signingTargetDigest, signatureHex, normalizedPubHex)) {
    throw new Error(
      "attachProducerSignature rejected: signature failed RFC 8032 Ed25519 cryptographic verification against producerPublicKeyHex.",
    );
  }

  const signedBody: Omit<ProofReceiptPayload, "receiptDigest"> = {
    ...unsignedWithoutSig,
    evidenceProvenance: {
      ...unsignedWithoutSig.evidenceProvenance,
      producerSignatureHex: signatureHex,
    },
  };
  return {
    ...signedBody,
    receiptDigest: computeSha256(canonicalizeJson(signedBody)),
  };
}

/**
 * Verifies:
 * (1) SHA-256 JCS structural integrity,
 * (2) RFC 8032 Ed25519 asymmetric producer authentication (mandatory whenever `selfGeneratedAssertionOnly === false` or `requireAuthenticatedProducer === true`),
 * (3) Cryptographic network-observation attestation whenever `zeroEgressObserved === true`, and
 * (4) Cryptographic live-evaluation transcript attestation whenever `measurementClass === "LIVE_MODEL_EMPIRICAL_EVAL"`.
 */
export function verifyProofReceiptAuthenticity(
  receipt: ProofReceiptPayload,
  options: ProofReceiptAuthOptions = {},
): {
  integrityVerified: boolean;
  producerAuthenticated: boolean;
  experimentalValidityVerified: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const { receiptDigest, ...unsigned } = receipt;
  const recomputedDigest = computeSha256(canonicalizeJson(unsigned));
  const integrityVerified = receiptDigest === recomputedDigest;
  if (!integrityVerified) {
    reasons.push(`Receipt SHA-256 digest mismatch: expected ${recomputedDigest}, got ${receiptDigest}`);
  }

  let producerAuthenticated = false;
  let experimentalValidityVerified = true;
  const prov = receipt.evidenceProvenance;

  if (!prov) {
    reasons.push("Missing evidenceProvenance block.");
    experimentalValidityVerified = false;
  } else {
    const mustAuthenticateProducer =
      Boolean(options.requireAuthenticatedProducer) || prov.selfGeneratedAssertionOnly === false;

    if (prov.producerPublicKeyHex && prov.producerSignatureHex) {
      const normalizedReceiptPubHex = normalizeEd25519PublicKeyHex(prov.producerPublicKeyHex);
      if (!normalizedReceiptPubHex) {
        reasons.push("Malformed producerPublicKeyHex in receipt evidenceProvenance.");
      }

      let keyTrusted = true;
      if (options.trustedProducerKeys) {
        const pinnedKey = options.trustedProducerKeys[prov.producerKeyId];
        if (!pinnedKey) {
          keyTrusted = false;
          reasons.push(`Untrusted or unregistered producerKeyId: ${prov.producerKeyId}`);
        } else {
          const normalizedPinned = normalizeEd25519PublicKeyHex(pinnedKey);
          if (!normalizedPinned) {
            keyTrusted = false;
            reasons.push(`Malformed trusted public key configured for producerKeyId: ${prov.producerKeyId}`);
          } else if (normalizedPinned !== normalizedReceiptPubHex) {
            keyTrusted = false;
            reasons.push(`Pinned public key mismatch for producerKeyId: ${prov.producerKeyId}`);
          }
        }
      }

      if (normalizedReceiptPubHex && keyTrusted) {
        const unsignedWithoutSig: Omit<ProofReceiptPayload, "receiptDigest"> = {
          ...unsigned,
          evidenceProvenance: {
            ...prov,
          },
        };
        delete (unsignedWithoutSig.evidenceProvenance as Record<string, unknown>).producerSignatureHex;
        const signingTargetDigest = computeSha256(canonicalizeJson(unsignedWithoutSig));
        const ed25519Valid = verifyEd25519Signature(
          signingTargetDigest,
          prov.producerSignatureHex,
          normalizedReceiptPubHex,
        );
        const customValid = options.verifySignatureFn
          ? options.verifySignatureFn(
              signingTargetDigest,
              prov.producerSignatureHex,
              prov.producerPublicKeyHex,
            )
          : true;
        producerAuthenticated = ed25519Valid && customValid;
        if (!producerAuthenticated) {
          reasons.push("RFC 8032 Ed25519 producer signature verification failed.");
        }
      }
    } else if (mustAuthenticateProducer) {
      reasons.push("Receipt has only an unauthenticated SHA-256 digest; Ed25519 producer signature required.");
    }

    if (mustAuthenticateProducer && !producerAuthenticated) {
      experimentalValidityVerified = false;
    }

    // Verify zeroEgressObserved provenance claim
    if (
      receipt.hardGates.zeroEgressObserved ||
      receipt.hardGates.zeroEgressStatus === "OBSERVED_ZERO_EGRESS"
    ) {
      const netCheck = verifyNetworkObservationAttestation(
        prov.networkObservationAttestation,
        receipt.candidateHash,
        options.trustedObserverKeys,
      );
      if (!netCheck.verified) {
        experimentalValidityVerified = false;
        reasons.push(
          `Receipt claims OBSERVED_ZERO_EGRESS without a valid signed NetworkObservationAttestation: ${netCheck.reason}`,
        );
      }
    }

    // Verify live model evaluation provenance claim
    if (
      prov.measurementClass === "LIVE_MODEL_EMPIRICAL_EVAL" ||
      prov.liveModelCallsExecuted > 0
    ) {
      const liveCheck = verifyLiveEvaluationAttestation(
        prov.liveEvaluationAttestation,
        receipt.candidateHash,
        options.trustedEvaluatorKeys,
      );
      if (!liveCheck.verified) {
        experimentalValidityVerified = false;
        reasons.push(
          `Receipt claims LIVE_MODEL_EMPIRICAL_EVAL without a valid signed LiveEvaluationAttestation: ${liveCheck.reason}`,
        );
      } else if (liveCheck.liveCallsCount !== prov.liveModelCallsExecuted) {
        experimentalValidityVerified = false;
        reasons.push(
          `Receipt liveModelCallsExecuted (${prov.liveModelCallsExecuted}) does not match verified transcript entry count (${liveCheck.liveCallsCount}).`,
        );
      }
    }
  }

  if (!receipt.hardGates.protectedIntentPreserved || !receipt.hardGates.authorityNotExpanded) {
    experimentalValidityVerified = false;
    reasons.push("Hard gates failed on receipt (intent or authority violation).");
  }
  if (options.requireLiveModelEmpiricalEval) {
    if (
      !prov ||
      prov.measurementClass !== "LIVE_MODEL_EMPIRICAL_EVAL" ||
      prov.liveModelCallsExecuted <= 0
    ) {
      experimentalValidityVerified = false;
      reasons.push(
        "Receipt represents DETERMINISTIC_STATIC_AND_RULE_MATRIX (0 live model calls), not a live model empirical evaluation.",
      );
    }
  }

  return {
    integrityVerified,
    producerAuthenticated,
    experimentalValidityVerified:
      integrityVerified &&
      experimentalValidityVerified &&
      (!options.requireAuthenticatedProducer || producerAuthenticated),
    reasons,
  };
}
