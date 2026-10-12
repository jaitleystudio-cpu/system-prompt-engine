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
}

export interface AuthoritativeReceiptRecord {
  exists: boolean;
  paid: boolean;
  subscriptionStatus: "ACTIVE" | "CANCELED" | "PAST_DUE" | "EXPIRED" | "REVOKED";
  tier: "pro" | "team";
  email: string;
  expiresAtMs: number;
  revoked: boolean;
}

export interface EntitlementVerificationOptions {
  expectedEmail?: string;
  currentEpochMs?: number;
  /**
   * Explicit map of `issuerKeyId -> ed25519_public_key_hex` (64-hex raw or 88-hex SPKI DER).
   * Every trusted issuer MUST have a pinned Ed25519 public key.
   */
  trustedIssuerPublicKeys?: Record<string, string>;
  revokedReceiptIds?: Iterable<string>;
  revokedSubscriptionIds?: Iterable<string>;
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
   * Defaults to `true`. When `true`, `verifySignedEntitlementToken` rejects any token
   * whose `paymentReceiptId` is not confirmed by `authoritativeReceiptVerifier`.
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
  rejectionReason: string | null;
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
 * Verifies a server-issued, Ed25519-signed entitlement token using ONLY pinned public keys
 * and authoritative payment/subscription status verification.
 */
export function verifySignedEntitlementToken(
  rawToken: string,
  options: EntitlementVerificationOptions = {},
): EntitlementVerificationResult {
  const trimmed = (rawToken || "").trim();
  if (!trimmed) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "EMPTY_ENTITLEMENT_TOKEN",
    };
  }

  if (/^SPE-(PRO|TEAM)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed)) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason:
        "SELF_MINTED_UNVERIFIED_KEY_REJECTED: Client-generated license strings cannot unlock paid tiers.",
    };
  }

  const parts = trimmed.split(".");
  if (parts.length !== 4 || parts[0] !== "spe_entitlement" || parts[1] !== "v1") {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason:
        "INVALID_TOKEN_ENVELOPE: Expected spe_entitlement.v1.<payload_hex>.<ed25519_signature_hex>",
    };
  }

  const [, , payloadHex, signatureHex] = parts;
  if (!signatureHex || signatureHex.length !== 128 || !/^[0-9a-fA-F]{128}$/.test(signatureHex)) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "INVALID_ENTITLEMENT_SIGNATURE_FORMAT: Expected 64-byte (128-hex) Ed25519 signature",
    };
  }

  let parsed: EntitlementTokenPayload;
  try {
    const jsonStr = hexToUtf8(payloadHex);
    parsed = JSON.parse(jsonStr) as EntitlementTokenPayload;
  } catch {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "MALFORMED_ENTITLEMENT_PAYLOAD",
    };
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
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "INCOMPLETE_ENTITLEMENT_CLAIMS",
    };
  }

  if (parsed.paymentStatus !== undefined && parsed.paymentStatus !== "PAID") {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: `UNPAID_OR_INVALID_PAYMENT_STATUS:${parsed.paymentStatus}`,
    };
  }

  if (parsed.subscriptionStatus !== undefined && parsed.subscriptionStatus !== "ACTIVE") {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: `INACTIVE_SUBSCRIPTION_STATUS:${parsed.subscriptionStatus}`,
    };
  }

  const revokedReceipts = new Set(options.revokedReceiptIds ?? []);
  const revokedSubs = new Set(options.revokedSubscriptionIds ?? []);
  if (
    revokedReceipts.has(parsed.paymentReceiptId) ||
    (parsed.subscriptionId && revokedSubs.has(parsed.subscriptionId))
  ) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "REVOKED_ENTITLEMENT_TOKEN",
    };
  }

  const nowMs = options.currentEpochMs ?? Date.now();
  if (parsed.expiresAtMs <= nowMs) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "EXPIRED_ENTITLEMENT_TOKEN",
    };
  }
  if (parsed.issuedAtMs > nowMs + 60_000) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "INVALID_ISSUANCE_TIMESTAMP",
    };
  }

  if (
    options.expectedEmail &&
    parsed.email.trim().toLowerCase() !== options.expectedEmail.trim().toLowerCase()
  ) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "ENTITLEMENT_EMAIL_MISMATCH",
    };
  }

  // Enforce explicit public-key pinning for the claiming issuerKeyId
  const pinnedKeyMap: Record<string, string> = options.trustedIssuerPublicKeys ?? {
    [SPE_PRODUCTION_BILLING_AUTHORITY_KEY_ID]: SPE_PRODUCTION_BILLING_PUBLIC_KEY_HEX,
  };
  const rawPinnedKey = pinnedKeyMap[parsed.issuerKeyId];
  const normalizedPinnedKey = rawPinnedKey ? normalizeEd25519PublicKeyHex(rawPinnedKey) : null;
  if (!normalizedPinnedKey) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: `UNTRUSTED_ENTITLEMENT_ISSUER:${parsed.issuerKeyId}`,
    };
  }

  // Cryptographically verify RFC 8032 Ed25519 signature over RFC 8785 canonical JSON payload
  const canonicalPayload = canonicalizeJson(parsed);
  const sigValid = options.verifySignatureFn
    ? options.verifySignatureFn(canonicalPayload, signatureHex, normalizedPinnedKey, parsed.issuerKeyId)
    : verifyEd25519Signature(canonicalPayload, signatureHex, normalizedPinnedKey);

  if (!sigValid) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "INVALID_ENTITLEMENT_SIGNATURE",
    };
  }

  // Enforce authoritative payment receipt, subscription status, expiration, and revocation check
  const requireAuthoritative = options.requireAuthoritativeReceiptCheck ?? true;
  if (requireAuthoritative) {
    if (!options.authoritativeReceiptVerifier) {
      return {
        verified: false,
        tier: null,
        payload: null,
        rejectionReason:
          "AUTHORITATIVE_RECEIPT_VERIFICATION_REQUIRED: Claimed paymentReceiptId cannot be accepted without authoritative server confirmation.",
      };
    }
    const record = options.authoritativeReceiptVerifier(parsed.paymentReceiptId, parsed);
    if (!record || !record.exists) {
      return {
        verified: false,
        tier: null,
        payload: null,
        rejectionReason: `UNKNOWN_PAYMENT_RECEIPT_ID:${parsed.paymentReceiptId}`,
      };
    }
    if (!record.paid) {
      return {
        verified: false,
        tier: null,
        payload: null,
        rejectionReason: `UNPAID_PAYMENT_RECEIPT:${parsed.paymentReceiptId}`,
      };
    }
    if (record.revoked || record.subscriptionStatus !== "ACTIVE") {
      return {
        verified: false,
        tier: null,
        payload: null,
        rejectionReason: `REVOKED_OR_CANCELED_SUBSCRIPTION:${record.subscriptionStatus}`,
      };
    }
    if (record.expiresAtMs <= nowMs) {
      return {
        verified: false,
        tier: null,
        payload: null,
        rejectionReason: "EXPIRED_AUTHORITATIVE_SUBSCRIPTION",
      };
    }
    if (
      record.tier !== parsed.tier ||
      record.email.trim().toLowerCase() !== parsed.email.trim().toLowerCase()
    ) {
      return {
        verified: false,
        tier: null,
        payload: null,
        rejectionReason: "AUTHORITATIVE_RECEIPT_CLAIM_MISMATCH",
      };
    }
  }

  return {
    verified: true,
    tier: parsed.tier,
    payload: parsed,
    rejectionReason: null,
  };
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
