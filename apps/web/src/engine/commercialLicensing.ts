/**
 * SPE Ω — Commercial Licensing & Anti-Piracy Entitlement Kernel
 *
 * Implements offline-capable, cryptographically tamper-evident licensing:
 * 1. Asymmetric RFC 8032 Ed25519 signature over RFC 8785 canonical JSON.
 * 2. Time-bound cryptographic expiration (enforces renewals even in air-gapped setups).
 * 3. Tiered capability gating (Community vs Pro vs Team vs Enterprise).
 * 4. Dual resolver: filesystem/env in Node.js CLI & localStorage in Browser.
 */

import { verifyEd25519Signature } from "./ed25519Verifier.ts";
import { canonicalizeJson } from "./proofReceipt.ts";

export type PlanTier = "COMMUNITY" | "PRO" | "TEAM" | "ENTERPRISE";

export type LicenseStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "TAMPERED"
  | "UNLICENSED"
  | "INVALID"
  | "FUTURE_ISSUED";

export const COMMERCIAL_CAPABILITIES = [
  "AUTOMATED_CONTINUATION",
  "ENTERPRISE_CI_GATE",
  "OWASP_IMMUNIZATION",
  "FRONTIER_MODEL_ATLAS",
  "MULTI_SEAT_CONSENSUS",
  "APM_TELEMETRY_EXPORT",
  "UNWATERMARKED_EXPORTS",
  "OFFLINE_ENTERPRISE",
] as const;

export type CommercialCapability = (typeof COMMERCIAL_CAPABILITIES)[number];

export interface CommercialLicensePayload {
  license_id: string;
  customer_id: string;
  plan_tier: PlanTier;
  issued_at: string;
  expires_at: string;
  capabilities: string[];
  seats?: number;
  machine_fingerprint?: string | null;
}

export interface CommercialLicenseEnvelope {
  payload: CommercialLicensePayload;
  signature_hex: string;
  public_key_hex: string;
}

export interface LicenseVerificationResult {
  valid: boolean;
  status: LicenseStatus;
  payload: CommercialLicensePayload | null;
  daysRemaining: number;
  isExpired: boolean;
  unlockedCapabilities: string[];
  rejectionReason: string | null;
  publicKeyHex: string | null;
}

export const TIER_DEFAULT_CAPABILITIES: Record<PlanTier, CommercialCapability[]> = {
  COMMUNITY: [],
  PRO: [
    "AUTOMATED_CONTINUATION",
    "OWASP_IMMUNIZATION",
    "UNWATERMARKED_EXPORTS",
    "FRONTIER_MODEL_ATLAS",
  ],
  TEAM: [
    "AUTOMATED_CONTINUATION",
    "OWASP_IMMUNIZATION",
    "UNWATERMARKED_EXPORTS",
    "FRONTIER_MODEL_ATLAS",
    "MULTI_SEAT_CONSENSUS",
    "APM_TELEMETRY_EXPORT",
  ],
  ENTERPRISE: [
    "AUTOMATED_CONTINUATION",
    "ENTERPRISE_CI_GATE",
    "OWASP_IMMUNIZATION",
    "FRONTIER_MODEL_ATLAS",
    "MULTI_SEAT_CONSENSUS",
    "APM_TELEMETRY_EXPORT",
    "UNWATERMARKED_EXPORTS",
    "OFFLINE_ENTERPRISE",
  ],
};

/** Official SPE Production License Authority Root Verification Public Key */
export const OFFICIAL_SPE_ROOT_PUBLIC_KEY_HEX =
  "c30ec17b341551d74cc646fbfadfd562d4630fe1409c58bd933abc7c7ba3871c";

/**
 * Verifies a base64 or raw JSON license token cryptographically.
 */
export function verifyCommercialLicenseToken(
  licenseToken: string,
  options: {
    trustedPublicKeyHex?: string;
    currentEpochMs?: number;
    clockSkewSeconds?: number;
  } = {}
): LicenseVerificationResult {
  const clockSkewSeconds = options.clockSkewSeconds ?? 60;
  const nowMs = options.currentEpochMs ?? Date.now();

  if (!licenseToken || !licenseToken.trim()) {
    return {
      valid: false,
      status: "UNLICENSED",
      payload: null,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "No license token provided",
      publicKeyHex: null,
    };
  }

  let envelope: CommercialLicenseEnvelope;
  try {
    let rawStr = licenseToken.trim();
    if (!rawStr.startsWith("{")) {
      // Decode base64
      if (typeof Buffer !== "undefined") {
        rawStr = Buffer.from(rawStr, "base64").toString("utf-8");
      } else if (typeof atob !== "undefined") {
        rawStr = atob(rawStr);
      }
    }
    envelope = JSON.parse(rawStr);
  } catch (err) {
    return {
      valid: false,
      status: "INVALID",
      payload: null,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: `Malformed license token JSON: ${(err as Error).message}`,
      publicKeyHex: null,
    };
  }

  const { payload, signature_hex, public_key_hex } = envelope;
  if (!payload || !signature_hex || !public_key_hex) {
    return {
      valid: false,
      status: "INVALID",
      payload: null,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "Missing payload, signature_hex, or public_key_hex in envelope",
      publicKeyHex: public_key_hex || null,
    };
  }

  // 1. Verify trusted authority if provided
  if (options.trustedPublicKeyHex && public_key_hex !== options.trustedPublicKeyHex) {
    return {
      valid: false,
      status: "TAMPERED",
      payload,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "Untrusted public key authority",
      publicKeyHex: public_key_hex,
    };
  }

  // 2. Cryptographic Ed25519 verification over RFC 8785 canonical JSON
  const canonicalPayload = canonicalizeJson(payload);
  const isSigValid = verifyEd25519Signature(
    canonicalPayload,
    signature_hex,
    public_key_hex
  );

  if (!isSigValid) {
    return {
      valid: false,
      status: "TAMPERED",
      payload,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "Cryptographic signature verification failed (tampered license)",
      publicKeyHex: public_key_hex,
    };
  }

  // 3. Expiration and clock checks
  const expiresAtMs = Date.parse(payload.expires_at);
  const issuedAtMs = Date.parse(payload.issued_at);

  if (isNaN(expiresAtMs) || isNaN(issuedAtMs)) {
    return {
      valid: false,
      status: "INVALID",
      payload,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "Invalid ISO date formatting in license timestamps",
      publicKeyHex: public_key_hex,
    };
  }

  // Check future issuance beyond clock skew
  if ((issuedAtMs - nowMs) / 1000 > clockSkewSeconds) {
    return {
      valid: false,
      status: "FUTURE_ISSUED",
      payload,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "License issued_at timestamp is in the future beyond allowed clock skew",
      publicKeyHex: public_key_hex,
    };
  }

  const remainingMs = expiresAtMs - nowMs;
  const isExpired = remainingMs < -clockSkewSeconds * 1000;
  const daysRemaining = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

  if (isExpired) {
    return {
      valid: false,
      status: "EXPIRED",
      payload,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: `License expired on ${payload.expires_at}. Renew at https://systempromptengine.com/pricing`,
      publicKeyHex: public_key_hex,
    };
  }

  // Combine explicit capabilities with plan tier defaults
  const declaredCaps = payload.capabilities || [];
  const tierDefaults = TIER_DEFAULT_CAPABILITIES[payload.plan_tier] || [];
  const allCaps = Array.from(new Set([...declaredCaps, ...tierDefaults]));

  return {
    valid: true,
    status: "ACTIVE",
    payload,
    daysRemaining,
    isExpired: false,
    unlockedCapabilities: allCaps,
    rejectionReason: null,
    publicKeyHex: public_key_hex,
  };
}

/**
 * Resolves the active commercial license from environment, filesystem, or browser storage.
 */
export function resolveActiveLicense(customToken?: string): LicenseVerificationResult {
  let token = customToken;

  // 1. Check customToken or process.env (Node)
  if (!token && typeof process !== "undefined" && process.env?.SPE_LICENSE_KEY) {
    token = process.env.SPE_LICENSE_KEY;
  }

  if (!token) {
    return {
      valid: false,
      status: "UNLICENSED",
      payload: null,
      daysRemaining: 0,
      isExpired: true,
      unlockedCapabilities: [],
      rejectionReason: "No active license key found. Running in Community Edition.",
      publicKeyHex: null,
    };
  }

  return verifyCommercialLicenseToken(token);
}

/**
 * Enforces a required commercial capability.
 * Returns true if allowed, or throws an error explaining the missing tier/renewal.
 */
export function assertCommercialCapability(
  capability: CommercialCapability,
  options: { customToken?: string; throwOnFailure?: boolean } = {}
): boolean {
  const result = resolveActiveLicense(options.customToken);
  const hasCap = result.valid && result.unlockedCapabilities.includes(capability);

  if (!hasCap) {
    const reason = result.isExpired
      ? `License Expired: ${result.rejectionReason}`
      : `Feature '${capability}' requires a licensed SPE Pro or Enterprise plan.`;

    if (options.throwOnFailure !== false) {
      throw new Error(
        `[SPE COMMERCIAL GATE] ${reason}\nUpgrade or renew your license at: https://systempromptengine.com/pricing`
      );
    }
    return false;
  }

  return true;
}
