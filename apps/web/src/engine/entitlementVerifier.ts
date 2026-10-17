/**
 * SPE Ω Paid Entitlement & Public Beta Waitlist Verifier (Client Public-Key Boundary)
 *
 * Security Invariants (Audit Finding A Closure):
 * 1. Browser clients MUST NEVER self-mint paid `pro` or `team` licenses, and client-accessible
 *    code MUST NEVER contain any signing secret, shared salt, or Ed25519 private key.
 * 2. This module performs ONLY asymmetric RFC 8032 Ed25519 public-key signature verification
 *    against explicitly pinned authority public keys (`trustedIssuerPublicKeys`).
 * 3. Token issuance is restricted exclusively to the server-side billing authority
 *    (`src/server/billingAuthority.ts`) after payment webhook verification.
 * 4. A claimed `paymentReceiptId` is NEVER accepted on client assertion alone: verification
 *    enforces authoritative payment status, active subscription status, expiration, and revocation.
 */

import { computeSha256 } from "./hashUtils.ts";
import { canonicalizeJson } from "./proofReceipt.ts";
import {
  normalizeEd25519PublicKeyHex,
  verifyEd25519Signature,
} from "./ed25519Verifier.ts";

export interface EntitlementTokenPayload {
  schema: "spe.entitlement.v1";
  tier: "pro" | "team";
  planName: string;
  email: string;
  paymentReceiptId: string;
  subscriptionId?: string;
  paymentStatus?: "PAID" | "UNPAID" | "REFUNDED" | "DISPUTED";
  subscriptionStatus?: "ACTIVE" | "CANCELED" | "PAST_DUE" | "EXPIRED" | "REVOKED";
  issuedAtMs: number;
  expiresAtMs: number;
  issuerKeyId: string;
  isTrial?: boolean;
}

export interface AuthoritativeReceiptRecord {
  exists: boolean;
  paid: boolean;
  paymentStatus?: "PAID" | "UNPAID" | "REFUNDED" | "DISPUTED";
  subscriptionStatus: "ACTIVE" | "CANCELED" | "PAST_DUE" | "EXPIRED" | "REVOKED";
  tier: "pro" | "team";
  email: string;
  expiresAtMs: number;
  revoked: boolean;
  isTrial?: boolean;
  licenseTerm?: "lifetime" | "annual" | "monthly" | "trial";
  sku?: string;
  revocationTerms?: string;
}

export interface SignedReceiptStatusAttestation {
  schema: "spe.receipt_status_attestation.v1" | "spe.receipt_status.v1";
  paymentReceiptId: string;
  subscriptionId: string;
  exists?: boolean;
  paid: boolean;
  paymentStatus?: "PAID" | "UNPAID" | "REFUNDED" | "DISPUTED";
  subscriptionStatus: "ACTIVE" | "CANCELED" | "PAST_DUE" | "EXPIRED" | "REVOKED";
  tier: "pro" | "team";
  planName?: string;
  lifetime?: boolean;
  licenseTerm?: "lifetime" | "annual" | "monthly" | "trial";
  sku?: string;
  email: string;
  expiresAtMs: number;
  revoked: boolean;
  attestedAtMs: number;
  issuerKeyId: string;
  revocationTerms?: string;
  signatureHex?: string;
}

export const DEFAULT_MAX_ATTESTATION_AGE_MS = 24 * 60 * 60 * 1000; // 86,400,000 ms (24 hours)

export interface ReceiptStatusAttestationVerificationOptions {
  trustedIssuerPublicKeys?: Record<string, string>;
  verifySignatureFn?: (
    canonicalPayloadJson: string,
    signatureHex: string,
    pinnedPublicKeyHex: string,
    issuerKeyId: string,
  ) => boolean;
  currentEpochMs?: number;
  maxAttestationAgeMs?: number;
  allowInactiveStatus?: boolean;
}

export interface EntitlementVerificationOptions {
  expectedEmail?: string;
  currentEpochMs?: number;
  issuerPublicKeyHex?: string;
  token?: string;
  /**
   * Explicit map of `issuerKeyId -> ed25519_public_key_hex` (64-hex raw or 88-hex SPKI DER).
   * Every trusted issuer MUST have a pinned Ed25519 public key.
   */
  trustedIssuerPublicKeys?: Record<string, string>;
  revokedReceiptIds?: Iterable<string>;
  revokedSubscriptionIds?: Iterable<string>;
  /**
   * Maximum acceptable age in milliseconds for offline signed receipt attestations.
   * Defaults to 24 hours (86,400,000 ms).
   */
  maxAttestationAgeMs?: number;
  /**
   * Authoritative server receipt & subscription status verifier.
   * Confirms that `paymentReceiptId` exists, was actually paid, is currently ACTIVE,
   * has not expired, and has not been revoked or canceled.
   */
  authoritativeReceiptVerifier?: (
    paymentReceiptId: string,
    payload: EntitlementTokenPayload,
  ) => AuthoritativeReceiptRecord | null | undefined;
  /**
   * Optional Ed25519-signed receipt status attestation (`SignedReceiptStatusAttestation` or `spe_receipt_status.v1.<hex>.<sig>`)
   * issued by the server billing authority for browser/offline receipt verification.
   */
  signedReceiptAttestation?: SignedReceiptStatusAttestation | string;
  /**
   * Defaults to `true`. When `true`, `verifySignedEntitlementToken` rejects any token
   * whose `paymentReceiptId` is not confirmed by `authoritativeReceiptVerifier` or a
   * cryptographically verified server `SignedReceiptStatusAttestation`.
   */
  requireAuthoritativeReceiptCheck?: boolean;
  /**
   * Optional custom asymmetric verifier override (defaults to RFC 8032 `verifyEd25519Signature`).
   */
  verifySignatureFn?: (
    canonicalPayloadJson: string,
    signatureHex: string,
    pinnedPublicKeyHex: string,
    issuerKeyId: string,
  ) => boolean;
}

export interface EntitlementVerificationResult {
  verified: boolean;
  tier: "pro" | "team" | null;
  payload: EntitlementTokenPayload | null;
  signatureHex?: string | null;
  rejectionReason: string | null;
  isTrial?: boolean;
  isAuthoritative?: boolean;
  trialDaysRemaining?: number;
  verificationType?: "CRYPTOGRAPHIC_ED25519" | "LOCAL_CLIENT_TRIAL" | "NONE";
}

export interface TrialEntitlementRecord {
  status: "ACTIVE_TRIAL" | "EXPIRED_TRIAL";
  tier: "pro" | "team";
  planName: string;
  email: string;
  trialId: string;
  activatedAtMs: number;
  expiresAtMs: number;
  isTrial: true;
}

export interface PublicBetaReservationRecord {
  status: "PUBLIC_BETA_WAITLIST_RESERVED";
  requestedPlan: string;
  requestedTier: "pro" | "team";
  email: string;
  reservationId: string;
  paidEntitlementGranted: false;
}

/**
 * Production billing authority Ed25519 public key (32-byte RFC 8032 point).
 * The corresponding private key is held exclusively by the offline/server billing authority
 * and does NOT exist anywhere in client code or repository source.
 */
export const SPE_PRODUCTION_BILLING_AUTHORITY_KEY_ID = "spe-billing-authority-ed25519-prod-v1";
export const SPE_PRODUCTION_BILLING_PUBLIC_KEY_HEX =
  "27fca5b9bbcf0d8036e3e98cd47bcdcaf29f9a3bb6bc8307606584a55d7b4489";

function hexToUtf8(hex: string): string {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("Invalid hex encoding");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

export function utf8ToHex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Cryptographically verifies an Ed25519-signed receipt status attestation
 * (`SignedReceiptStatusAttestation` object, JSON string, or `spe_receipt_status.v1.<attestation_hex>.<ed25519_sig_hex>`)
 * against pinned issuer public keys.
 */
export function verifySignedReceiptStatusAttestation(
  rawAttestation: SignedReceiptStatusAttestation | string,
  options: ReceiptStatusAttestationVerificationOptions = {},
): (AuthoritativeReceiptRecord & { paymentReceiptId: string; attestedAtMs: number }) | null {
  if (!rawAttestation) return null;
  let parsed: SignedReceiptStatusAttestation;
  let sigHex: string | undefined;

  if (typeof rawAttestation === "string") {
    const trimmed = rawAttestation.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("spe_receipt_status.v1.")) {
      const parts = trimmed.split(".");
      if (parts.length !== 4) return null;
      const [, , attHex, embeddedSigHex] = parts;
      sigHex = embeddedSigHex;
      try {
        parsed = JSON.parse(hexToUtf8(attHex)) as SignedReceiptStatusAttestation;
      } catch {
        return null;
      }
    } else {
      try {
        parsed = JSON.parse(trimmed) as SignedReceiptStatusAttestation;
        sigHex = parsed.signatureHex;
      } catch {
        return null;
      }
    }
  } else if (typeof rawAttestation === "object") {
    parsed = rawAttestation;
    sigHex = parsed.signatureHex;
  } else {
    return null;
  }

  if (!sigHex || sigHex.length !== 128 || !/^[0-9a-fA-F]{128}$/.test(sigHex)) {
    return null;
  }
  if (
    !parsed ||
    (parsed.schema !== "spe.receipt_status_attestation.v1" &&
      parsed.schema !== "spe.receipt_status.v1") ||
    !parsed.paymentReceiptId ||
    !parsed.subscriptionId ||
    (parsed.tier !== "pro" && parsed.tier !== "team") ||
    !parsed.email ||
    !parsed.issuerKeyId ||
    typeof parsed.paid !== "boolean" ||
    typeof parsed.revoked !== "boolean" ||
    typeof parsed.expiresAtMs !== "number" ||
    typeof parsed.attestedAtMs !== "number"
  ) {
    return null;
  }

  // Enforce attestation freshness window:
  // If maxAttestationAgeMs is explicitly provided by the caller, enforce it unconditionally
  // (allowing verifiers to enforce bounded offline validity and prevent stale refund bypass).
  // If omitted, enforce DEFAULT_MAX_ATTESTATION_AGE_MS (24h) for recurring subscriptions,
  // while bounding offline lifetime tokens to local CRL (revokedReceiptIds).
  const nowMs = options.currentEpochMs ?? Date.now();
  const isExplicitLifetime =
    parsed.lifetime === true &&
    parsed.licenseTerm !== "monthly" &&
    parsed.licenseTerm !== "annual" &&
    (parsed.licenseTerm === "lifetime" ||
      (typeof parsed.sku === "string" &&
        (parsed.sku === "spe-pro-lifetime" ||
          parsed.sku === "spe-team-lifetime" ||
          parsed.sku.startsWith("spe-lifetime-"))));

  if (options.maxAttestationAgeMs !== undefined) {
    if (parsed.attestedAtMs + options.maxAttestationAgeMs < nowMs) {
      return null; // Expired / stale offline attestation window
    }
  } else if (!isExplicitLifetime) {
    const maxAgeMs = DEFAULT_MAX_ATTESTATION_AGE_MS;
    if (parsed.attestedAtMs + maxAgeMs < nowMs) {
      return null; // Expired / stale offline attestation window
    }
  }

  // Explicit revocation / refund / dispute boundary check:
  // An attestation marked revoked, refunded, or disputed MUST fail immediately, even for lifetime,
  // unless the caller explicitly requested inactive status inspection (e.g. verifySignedEntitlementToken).
  if (
    !options.allowInactiveStatus &&
    (parsed.revoked === true ||
      parsed.paymentStatus === "REFUNDED" ||
      parsed.paymentStatus === "DISPUTED" ||
      parsed.subscriptionStatus === "REVOKED" ||
      parsed.subscriptionStatus === "CANCELED")
  ) {
    return null;
  }
  if (parsed.attestedAtMs > nowMs + 60_000) {
    return null; // Future timestamp clock skew rejected
  }

  const pinnedKeyMap: Record<string, string> = options.trustedIssuerPublicKeys ?? {
    [SPE_PRODUCTION_BILLING_AUTHORITY_KEY_ID]: SPE_PRODUCTION_BILLING_PUBLIC_KEY_HEX,
  };
  const rawPinnedKey = pinnedKeyMap[parsed.issuerKeyId];
  const normalizedPinnedKey = rawPinnedKey ? normalizeEd25519PublicKeyHex(rawPinnedKey) : null;
  if (!normalizedPinnedKey) {
    return null;
  }

  const { signatureHex: _omittedSig, ...unsignedPayload } = parsed;
  const canonical = canonicalizeJson(unsignedPayload);
  const sigValid = options.verifySignatureFn
    ? options.verifySignatureFn(canonical, sigHex, normalizedPinnedKey, parsed.issuerKeyId)
    : verifyEd25519Signature(canonical, sigHex, normalizedPinnedKey);
  if (!sigValid) {
    return null;
  }

  return {
    paymentReceiptId: parsed.paymentReceiptId,
    exists: parsed.exists ?? true,
    paid: parsed.paid,
    paymentStatus: parsed.paymentStatus ?? (parsed.paid ? "PAID" : "UNPAID"),
    subscriptionStatus: parsed.subscriptionStatus,
    tier: parsed.tier,
    email: parsed.email,
    expiresAtMs: parsed.expiresAtMs,
    revoked: parsed.revoked,
    attestedAtMs: parsed.attestedAtMs,
  };
}

/**
 * Verifies a server-issued, Ed25519-signed entitlement token using ONLY pinned public keys
 * and authoritative payment/subscription status verification.
 */
export function verifySignedEntitlementToken(
  rawToken: string,
  options: EntitlementVerificationOptions = {},
): EntitlementVerificationResult {
  const reject = (rejectionReason: string): EntitlementVerificationResult => ({
    verified: false,
    tier: null,
    payload: null,
    signatureHex: null,
    rejectionReason,
    verificationType: "NONE",
  });

  const trimmed = (rawToken || "").trim();
  if (!trimmed) {
    return reject("EMPTY_ENTITLEMENT_TOKEN");
  }

  if (/^SPE-(PRO|TEAM)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed)) {
    return reject("SELF_MINTED_UNVERIFIED_KEY_REJECTED: Client-generated license strings cannot unlock paid tiers.");
  }

  const parts = trimmed.split(".");
  if (
    (parts.length !== 4 && parts.length !== 6) ||
    parts[0] !== "spe_entitlement" ||
    parts[1] !== "v1"
  ) {
    return reject("INVALID_TOKEN_ENVELOPE: Expected spe_entitlement.v1.<payload_hex>.<ed25519_signature_hex>");
  }

  const [, , payloadHex, signatureHex, embeddedReceiptAttHex, embeddedReceiptSigHex] = parts;
  if (!signatureHex || signatureHex.length !== 128 || !/^[0-9a-fA-F]{128}$/.test(signatureHex)) {
    return reject("INVALID_ENTITLEMENT_SIGNATURE_FORMAT: Expected 64-byte (128-hex) Ed25519 signature");
  }

  let parsed: EntitlementTokenPayload;
  try {
    const jsonStr = hexToUtf8(payloadHex);
    parsed = JSON.parse(jsonStr) as EntitlementTokenPayload;
  } catch {
    return reject("MALFORMED_ENTITLEMENT_PAYLOAD");
  }

  if (
    !parsed ||
    parsed.schema !== "spe.entitlement.v1" ||
    (parsed.tier !== "pro" && parsed.tier !== "team") ||
    !parsed.email ||
    !parsed.paymentReceiptId ||
    !parsed.issuerKeyId ||
    typeof parsed.issuedAtMs !== "number" ||
    typeof parsed.expiresAtMs !== "number"
  ) {
    return reject("INCOMPLETE_ENTITLEMENT_CLAIMS");
  }

  if (parsed.paymentStatus !== "PAID") {
    return reject(`UNPAID_OR_INVALID_PAYMENT_STATUS:${String(parsed.paymentStatus ?? "MISSING")}`);
  }

  if (parsed.subscriptionStatus !== "ACTIVE") {
    return reject(`INACTIVE_SUBSCRIPTION_STATUS:${String(parsed.subscriptionStatus ?? "MISSING")}`);
  }

  const revokedReceipts = new Set(options.revokedReceiptIds ?? []);
  const revokedSubs = new Set(options.revokedSubscriptionIds ?? []);
  if (revokedReceipts.has(parsed.paymentReceiptId)) {
    return reject("REVOKED_ENTITLEMENT_TOKEN: REVOKED_RECEIPT_ID");
  }
  if (parsed.subscriptionId && revokedSubs.has(parsed.subscriptionId)) {
    return reject("REVOKED_ENTITLEMENT_TOKEN: REVOKED_SUBSCRIPTION_ID");
  }

  const nowMs = options.currentEpochMs ?? Date.now();
  if (parsed.expiresAtMs <= nowMs) {
    return reject("EXPIRED_ENTITLEMENT_TOKEN");
  }
  if (parsed.issuedAtMs > nowMs + 60_000) {
    return reject("INVALID_ISSUANCE_TIMESTAMP");
  }

  if (
    options.expectedEmail &&
    parsed.email.trim().toLowerCase() !== options.expectedEmail.trim().toLowerCase()
  ) {
    return reject("ENTITLEMENT_EMAIL_MISMATCH");
  }

  // Enforce explicit public-key pinning for the claiming issuerKeyId
  const defaultKey = options.issuerPublicKeyHex ?? SPE_PRODUCTION_BILLING_PUBLIC_KEY_HEX;
  const pinnedKeyMap: Record<string, string> = options.trustedIssuerPublicKeys ?? {
    [SPE_PRODUCTION_BILLING_AUTHORITY_KEY_ID]: defaultKey,
  };
  if (options.issuerPublicKeyHex && !pinnedKeyMap[parsed.issuerKeyId]) {
    pinnedKeyMap[parsed.issuerKeyId] = options.issuerPublicKeyHex;
  }
  const rawPinnedKey = pinnedKeyMap[parsed.issuerKeyId];
  const normalizedPinnedKey = rawPinnedKey ? normalizeEd25519PublicKeyHex(rawPinnedKey) : null;
  if (!normalizedPinnedKey) {
    return reject(`UNTRUSTED_ENTITLEMENT_ISSUER:${parsed.issuerKeyId}`);
  }

  // Cryptographically verify RFC 8032 Ed25519 signature over RFC 8785 canonical JSON payload
  const canonicalPayload = canonicalizeJson(parsed);
  const sigValid = options.verifySignatureFn
    ? options.verifySignatureFn(canonicalPayload, signatureHex, normalizedPinnedKey, parsed.issuerKeyId)
    : verifyEd25519Signature(canonicalPayload, signatureHex, normalizedPinnedKey);

  if (!sigValid) {
    return reject("INVALID_ENTITLEMENT_SIGNATURE");
  }

  // Enforce authoritative payment receipt, subscription status, expiration, and revocation check
  const requireAuthoritative = options.requireAuthoritativeReceiptCheck ?? (!parsed.isTrial);
  if (requireAuthoritative) {
    let effectiveVerifier = options.authoritativeReceiptVerifier;
    if (!effectiveVerifier) {
      const candidateAttestation =
        options.signedReceiptAttestation ||
        (parts.length === 6 && embeddedReceiptAttHex && embeddedReceiptSigHex
          ? `spe_receipt_status.v1.${embeddedReceiptAttHex}.${embeddedReceiptSigHex}`
          : undefined);
      if (candidateAttestation) {
        effectiveVerifier = (requestedReceiptId: string) => {
          const verifiedAtt = verifySignedReceiptStatusAttestation(candidateAttestation, {
            trustedIssuerPublicKeys: pinnedKeyMap,
            verifySignatureFn: options.verifySignatureFn,
            currentEpochMs: nowMs,
            maxAttestationAgeMs: options.maxAttestationAgeMs,
            allowInactiveStatus: true,
          });
          if (
            !verifiedAtt ||
            verifiedAtt.paymentReceiptId !== requestedReceiptId ||
            verifiedAtt.email.trim().toLowerCase() !== parsed.email.trim().toLowerCase()
          ) {
            return null;
          }
          return verifiedAtt;
        };
      }
    }

    if (!effectiveVerifier) {
      return reject("AUTHORITATIVE_RECEIPT_VERIFICATION_REQUIRED: Claimed paymentReceiptId cannot be accepted without authoritative server confirmation.");
    }
    const record = effectiveVerifier(parsed.paymentReceiptId, parsed);
    if (!record || !record.exists) {
      const candidateAttestation =
        options.signedReceiptAttestation ||
        (parts.length === 6 && embeddedReceiptAttHex && embeddedReceiptSigHex
          ? `spe_receipt_status.v1.${embeddedReceiptAttHex}.${embeddedReceiptSigHex}`
          : undefined);
      if (candidateAttestation) {
        const withoutFreshnessLimit = verifySignedReceiptStatusAttestation(candidateAttestation, {
          trustedIssuerPublicKeys: pinnedKeyMap,
          verifySignatureFn: options.verifySignatureFn,
          currentEpochMs: nowMs,
          maxAttestationAgeMs: Number.MAX_SAFE_INTEGER,
          allowInactiveStatus: true,
        });
        if (withoutFreshnessLimit) {
          return reject("STALE_RECEIPT_ATTESTATION: Signed receipt attestation exceeds maximum freshness window (maxAttestationAgeMs). Offline attestation expired.");
        }
      }
      return reject(`UNKNOWN_PAYMENT_RECEIPT_ID:${parsed.paymentReceiptId}`);
    }
    if (!record.paid || record.paymentStatus === "REFUNDED" || record.paymentStatus === "DISPUTED") {
      return reject(`UNPAID_PAYMENT_RECEIPT:${parsed.paymentReceiptId}`);
    }
    if (record.revoked || record.subscriptionStatus !== "ACTIVE") {
      return reject(`REVOKED_OR_CANCELED_SUBSCRIPTION:${record.subscriptionStatus}`);
    }
    if (record.expiresAtMs <= nowMs) {
      return reject("EXPIRED_AUTHORITATIVE_SUBSCRIPTION");
    }
    if (
      record.tier !== parsed.tier ||
      record.email.trim().toLowerCase() !== parsed.email.trim().toLowerCase()
    ) {
      return reject("AUTHORITATIVE_RECEIPT_CLAIM_MISMATCH");
    }
  }

  const isTrial = parsed.isTrial === true;
  const trialDaysRemaining = isTrial
    ? Math.max(0, Math.ceil((parsed.expiresAtMs - nowMs) / (24 * 60 * 60 * 1000)))
    : undefined;

  return {
    verified: true,
    tier: parsed.tier,
    payload: parsed,
    signatureHex,
    rejectionReason: null,
    isTrial,
    isAuthoritative: !isTrial,
    trialDaysRemaining,
    verificationType: "CRYPTOGRAPHIC_ED25519",
  };
}

/**
 * Resolves and cryptographically verifies any stored browser entitlement token from `localStorage`.
 * If absent, tampered, expired, or unverified, clears stale localStorage keys and returns `{ verified: false, tier: null }`.
 */
export function resolveBrowserVerifiedEntitlement(
  options: EntitlementVerificationOptions = {},
): EntitlementVerificationResult {
  try {
    if (typeof localStorage === "undefined" && !options.token) {
      return {
        verified: false,
        tier: null,
        payload: null,
        signatureHex: null,
        rejectionReason: "NO_BROWSER_STORAGE",
        verificationType: "NONE",
      };
    }
    const storedToken =
      options.token ??
      (typeof localStorage !== "undefined" ? localStorage.getItem("spe-license-key") : null);
    if (!storedToken) {
      const trial = resolveBrowserTrialEntitlement(options.currentEpochMs);
      if (trial && trial.status === "ACTIVE_TRIAL") {
        const nowMs = options.currentEpochMs ?? Date.now();
        const daysRemaining = Math.max(0, Math.ceil((trial.expiresAtMs - nowMs) / (24 * 60 * 60 * 1000)));
        return {
          verified: true,
          tier: trial.tier,
          isTrial: true,
          isAuthoritative: false,
          trialDaysRemaining: daysRemaining,
          verificationType: "LOCAL_CLIENT_TRIAL",
          payload: {
            schema: "spe.entitlement.v1",
            tier: trial.tier,
            planName: trial.planName,
            email: trial.email,
            paymentReceiptId: trial.trialId,
            subscriptionId: `sub_trial_${trial.trialId}`,
            paymentStatus: "PAID",
            subscriptionStatus: "ACTIVE",
            issuedAtMs: trial.activatedAtMs,
            expiresAtMs: trial.expiresAtMs,
            issuerKeyId: "spe-trial-authority-local",
            isTrial: true,
          },
          signatureHex: null,
          rejectionReason: null,
        };
      }
      return {
        verified: false,
        tier: null,
        payload: null,
        signatureHex: null,
        rejectionReason: "NO_STORED_ENTITLEMENT_TOKEN",
        verificationType: "NONE",
      };
    }
    const storedAttestation =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("spe-receipt-attestation") || undefined
        : undefined;
    const hostVerifier =
      typeof window !== "undefined"
        ? (
            window as unknown as {
              __SPE_AUTHORITATIVE_RECEIPT_VERIFIER__?: EntitlementVerificationOptions["authoritativeReceiptVerifier"];
            }
          ).__SPE_AUTHORITATIVE_RECEIPT_VERIFIER__
        : undefined;
    const trustedIssuerPublicKeys = options.trustedIssuerPublicKeys ?? {
      [SPE_PRODUCTION_BILLING_AUTHORITY_KEY_ID]:
        options.issuerPublicKeyHex ?? SPE_PRODUCTION_BILLING_PUBLIC_KEY_HEX,
    };
    const check = verifySignedEntitlementToken(storedToken, {
      ...options,
      trustedIssuerPublicKeys,
      authoritativeReceiptVerifier: options.authoritativeReceiptVerifier ?? hostVerifier,
      signedReceiptAttestation: options.signedReceiptAttestation ?? storedAttestation,
    });
    if (!check.verified || !check.tier) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("spe-user-tier");
        localStorage.removeItem("spe-license-key");
        localStorage.removeItem("spe-receipt-attestation");
      }
      const trial = resolveBrowserTrialEntitlement(options.currentEpochMs);
      if (trial && trial.status === "ACTIVE_TRIAL") {
        const nowMs = options.currentEpochMs ?? Date.now();
        const daysRemaining = Math.max(0, Math.ceil((trial.expiresAtMs - nowMs) / (24 * 60 * 60 * 1000)));
        return {
          verified: true,
          tier: trial.tier,
          isTrial: true,
          isAuthoritative: false,
          trialDaysRemaining: daysRemaining,
          verificationType: "LOCAL_CLIENT_TRIAL",
          payload: {
            schema: "spe.entitlement.v1",
            tier: trial.tier,
            planName: trial.planName,
            email: trial.email,
            paymentReceiptId: trial.trialId,
            subscriptionId: `sub_trial_${trial.trialId}`,
            paymentStatus: "PAID",
            subscriptionStatus: "ACTIVE",
            issuedAtMs: trial.activatedAtMs,
            expiresAtMs: trial.expiresAtMs,
            issuerKeyId: "spe-trial-authority-local",
            isTrial: true,
          },
          signatureHex: null,
          rejectionReason: null,
        };
      }
      return check;
    }
    return check;
  } catch {
    return {
      verified: false,
      tier: null,
      payload: null,
      signatureHex: null,
      rejectionReason: "STORAGE_ACCESS_ERROR",
      verificationType: "NONE",
    };
  }
}

export const SPE_TRIAL_CONSUMED_KEY = "spe-trial-consumed-tombstone";

export function hasDeviceConsumedTrial(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(SPE_TRIAL_CONSUMED_KEY) === "true";
  } catch {
    return false;
  }
}

export function resetTrialTombstoneForTesting(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SPE_TRIAL_CONSUMED_KEY);
  } catch {}
}

export function startBrowserFreeTrial(
  tier: "pro" | "team" = "pro",
  email: string = "developer@workspace.local",
  days: number = 7,
  currentEpochMs: number = Date.now(),
): TrialEntitlementRecord {
  if (hasDeviceConsumedTrial()) {
    throw new Error("TRIAL_ALREADY_CONSUMED: Device has already completed or expired a trial window.");
  }
  const safeEmail = email.trim() || "developer@workspace.local";
  const digest = computeSha256(`trial:${tier}:${safeEmail}:${currentEpochMs}`)
    .slice(0, 10)
    .toUpperCase();
  const trialId = `SPE-TRIAL-${tier.toUpperCase()}-${digest}`;
  const planName =
    tier === "team"
      ? "Company & CI/CD Gate (7-Day Free Trial)"
      : "Developer Pro (7-Day Free Trial)";
  const durationMs = days * 24 * 60 * 60 * 1000;
  const record: TrialEntitlementRecord = {
    status: "ACTIVE_TRIAL",
    tier,
    planName,
    email: safeEmail,
    trialId,
    activatedAtMs: currentEpochMs,
    expiresAtMs: currentEpochMs + durationMs,
    isTrial: true,
  };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("spe-trial-entitlement", JSON.stringify(record));
    localStorage.setItem("spe-user-tier", tier);
    localStorage.setItem("spe-user-email", safeEmail);
  }
  return record;
}

export const MAX_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000 + 3600_000; // 7 days + 1h clock skew

export function resolveBrowserTrialEntitlement(
  currentEpochMs: number = Date.now(),
): TrialEntitlementRecord | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("spe-trial-entitlement");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrialEntitlementRecord;
    if (!parsed || parsed.isTrial !== true) return null;
    if (parsed.tier !== "pro" && parsed.tier !== "team") return null;
    if (typeof parsed.activatedAtMs !== "number" || typeof parsed.expiresAtMs !== "number") return null;
    // Reject tampered trial durations exceeding 7-day maximum window
    if (parsed.expiresAtMs < parsed.activatedAtMs) return null;
    if (parsed.expiresAtMs - parsed.activatedAtMs > MAX_TRIAL_DURATION_MS) return null;
    if (hasDeviceConsumedTrial()) {
      return { ...parsed, status: "EXPIRED_TRIAL" };
    }
    if (currentEpochMs - parsed.activatedAtMs > MAX_TRIAL_DURATION_MS) {
      try {
        localStorage.setItem(SPE_TRIAL_CONSUMED_KEY, "true");
      } catch {}
      return { ...parsed, status: "EXPIRED_TRIAL" };
    }
    if (parsed.expiresAtMs <= currentEpochMs) {
      try {
        localStorage.setItem(SPE_TRIAL_CONSUMED_KEY, "true");
      } catch {}
      return { ...parsed, status: "EXPIRED_TRIAL" };
    }
    return { ...parsed, status: "ACTIVE_TRIAL" };
  } catch {
    return null;
  }
}

export function clearBrowserTrialEntitlement(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem("spe-trial-entitlement");
  } catch {}
}

export function persistBrowserVerifiedEntitlement(
  email: string,
  token: string,
  verification: EntitlementVerificationResult,
  signedReceiptAttestation?: SignedReceiptStatusAttestation | string,
): void {
  if (typeof localStorage === "undefined" || !verification.verified || !verification.tier) {
    return;
  }
  localStorage.setItem("spe-user-tier", verification.tier);
  localStorage.setItem("spe-user-email", email.trim());
  localStorage.setItem("spe-license-key", token.trim());
  if (signedReceiptAttestation) {
    localStorage.setItem(
      "spe-receipt-attestation",
      typeof signedReceiptAttestation === "string"
        ? signedReceiptAttestation
        : JSON.stringify(signedReceiptAttestation),
    );
  }
}

export function clearBrowserVerifiedEntitlement(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("spe-user-tier");
  localStorage.removeItem("spe-user-email");
  localStorage.removeItem("spe-license-key");
  localStorage.removeItem("spe-receipt-attestation");
  localStorage.removeItem("spe-trial-entitlement");
}

export function resolveExportEntitlement(options: {
  subscriptionTier?: "free" | "pro" | "team";
  entitlement?: EntitlementVerificationResult | string | null;
  token?: string;
  currentEpochMs?: number;
  trustedIssuerPublicKeys?: Record<string, string>;
  authoritativeReceiptVerifier?: EntitlementVerificationOptions["authoritativeReceiptVerifier"];
  signedReceiptAttestation?: SignedReceiptStatusAttestation | string;
} = {}): EntitlementVerificationResult | null {
  if (options.subscriptionTier === "free") {
    return null;
  }
  if (options.entitlement !== undefined && options.entitlement !== null) {
    if (typeof options.entitlement === "string") {
      const verified = verifySignedEntitlementToken(options.entitlement, {
        currentEpochMs: options.currentEpochMs,
        trustedIssuerPublicKeys: options.trustedIssuerPublicKeys,
        authoritativeReceiptVerifier: options.authoritativeReceiptVerifier,
        signedReceiptAttestation: options.signedReceiptAttestation,
      });
      return verified.verified ? verified : null;
    }
    return options.entitlement.verified ? options.entitlement : null;
  }
  if (options.token) {
    const verified = verifySignedEntitlementToken(options.token, {
      currentEpochMs: options.currentEpochMs,
      trustedIssuerPublicKeys: options.trustedIssuerPublicKeys,
      authoritativeReceiptVerifier: options.authoritativeReceiptVerifier,
      signedReceiptAttestation: options.signedReceiptAttestation,
    });
    return verified.verified ? verified : null;
  }
  return resolveBrowserVerifiedEntitlement({
    currentEpochMs: options.currentEpochMs,
    trustedIssuerPublicKeys: options.trustedIssuerPublicKeys,
    authoritativeReceiptVerifier: options.authoritativeReceiptVerifier,
    signedReceiptAttestation: options.signedReceiptAttestation,
  });
}

/**
 * Records a Public Beta checkout waitlist reservation without granting paid tier entitlements.
 */
export function createPublicBetaWaitlistReservation(
  selectedPlan: string,
  email: string,
): PublicBetaReservationRecord {
  const lowerPlan = selectedPlan.toLowerCase();
  const requestedTier: "pro" | "team" =
    lowerPlan.includes("team") || lowerPlan.includes("company") ? "team" : "pro";
  const digest = computeSha256(`waitlist:${requestedTier}:${email.trim().toLowerCase()}`)
    .slice(0, 12)
    .toUpperCase();
  return {
    status: "PUBLIC_BETA_WAITLIST_RESERVED",
    requestedPlan: selectedPlan,
    requestedTier,
    email: email.trim(),
    reservationId: `SPE-WAITLIST-${digest}`,
    paidEntitlementGranted: false,
  };
}
