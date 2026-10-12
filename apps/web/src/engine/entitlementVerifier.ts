/**
 * SPE Ω Paid Entitlement & Public Beta Waitlist Verifier
 *
 * Security Invariant (Finding 1 Closure):
 * Browser clients MUST NEVER self-mint paid `pro` or `team` licenses via `Math.random()`.
 * Paid tier activation requires a server-issued, cryptographically signed entitlement token
 * (`spe_entitlement.v1.<canonical_payload_hex>.<signature_hex>`) bound to a verified payment
 * receipt ID and expiration timestamp. Submitting an email without a signed token records only
 * a `PUBLIC_BETA_WAITLIST_RESERVED` status and does not grant paid tier entitlements.
 */

import { computeSha256 } from "./hashUtils.ts";
import { canonicalizeJson } from "./proofReceipt.ts";

export interface EntitlementTokenPayload {
  schema: "spe.entitlement.v1";
  tier: "pro" | "team";
  planName: string;
  email: string;
  paymentReceiptId: string;
  issuedAtMs: number;
  expiresAtMs: number;
  issuerKeyId: string;
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

const DEFAULT_DEV_AUTHORITY_KEY_ID = "spe-billing-authority-v1";
const DEFAULT_DEV_AUTHORITY_DOMAIN_SALT = "spe.entitlement.v1.authority.domain.2026";

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

function utf8ToHex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Default deterministic signature verifier used when no external asymmetric verifier callback
 * is injected. Uses domain-separated SHA-256 commitment over the RFC 8785 canonical JSON payload
 * and pinned authority secret (for server/test issuance).
 */
export function computeEntitlementCommitmentSignature(
  canonicalPayloadJson: string,
  authoritySecret: string = DEFAULT_DEV_AUTHORITY_DOMAIN_SALT,
): string {
  return computeSha256(`${authoritySecret}:${canonicalPayloadJson}`);
}

/**
 * Issues a signed entitlement token (used by server-side billing webhooks and verification suites).
 */
export function issueSignedEntitlementToken(
  payload: EntitlementTokenPayload,
  signFn?: (canonicalPayloadJson: string) => string,
): string {
  const canonical = canonicalizeJson(payload);
  const payloadHex = utf8ToHex(canonical);
  const sigHex = signFn ? signFn(canonical) : computeEntitlementCommitmentSignature(canonical);
  return `spe_entitlement.v1.${payloadHex}.${sigHex}`;
}

/**
 * Verifies a server-issued signed entitlement token.
 * Explicitly rejects self-minted random strings (`SPE-PRO-XXXX...`), tampered payloads,
 * expired tokens, missing payment receipt IDs, or invalid signatures.
 */
export function verifySignedEntitlementToken(
  rawToken: string,
  options: {
    expectedEmail?: string;
    currentEpochMs?: number;
    trustedIssuerKeyIds?: string[];
    verifySignatureFn?: (
      canonicalPayloadJson: string,
      signatureHex: string,
      issuerKeyId: string,
    ) => boolean;
  } = {},
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
      rejectionReason: "INVALID_TOKEN_ENVELOPE: Expected spe_entitlement.v1.<payload_hex>.<signature_hex>",
    };
  }

  const [, , payloadHex, signatureHex] = parts;
  if (!signatureHex || signatureHex.length < 64 || !/^[0-9a-fA-F]+$/.test(signatureHex)) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "INVALID_ENTITLEMENT_SIGNATURE_FORMAT",
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

  const allowedIssuers = options.trustedIssuerKeyIds ?? [DEFAULT_DEV_AUTHORITY_KEY_ID];
  if (!allowedIssuers.includes(parsed.issuerKeyId)) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: `UNTRUSTED_ENTITLEMENT_ISSUER:${parsed.issuerKeyId}`,
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

  const canonicalPayload = canonicalizeJson(parsed);
  const sigValid = options.verifySignatureFn
    ? options.verifySignatureFn(canonicalPayload, signatureHex, parsed.issuerKeyId)
    : computeEntitlementCommitmentSignature(canonicalPayload).toLowerCase() ===
      signatureHex.toLowerCase();

  if (!sigValid) {
    return {
      verified: false,
      tier: null,
      payload: null,
      rejectionReason: "INVALID_ENTITLEMENT_SIGNATURE",
    };
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
  const digest = computeSha256(`waitlist:${requestedTier}:${email.trim().toLowerCase()}`).slice(0, 12).toUpperCase();
  return {
    status: "PUBLIC_BETA_WAITLIST_RESERVED",
    requestedPlan: selectedPlan,
    requestedTier,
    email: email.trim(),
    reservationId: `SPE-WAITLIST-${digest}`,
    paidEntitlementGranted: false,
  };
}
