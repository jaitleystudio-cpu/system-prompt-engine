/**
 * SPE Ω Authoritative Server-Side Billing Webhook & Ed25519 Entitlement Issuer
 *
 * Security Invariants (Audit Finding A Closure):
 * 1. Runs strictly on the authoritative server / backend boundary (`node:crypto`).
 *    Never imported into browser bundles.
 * 2. Holds the server-only Ed25519 private key and webhook HMAC secret in private fields
 *    (injected from environment/HSM or generated via CSPRNG per authority instance — never
 *    derived from a fixed seed in source code).
 * 3. Requires a cryptographically verified payment webhook (`payment.succeeded`) before
 *    recording a paid receipt in the authoritative ledger or issuing an Ed25519 entitlement token.
 * 4. Enforces authoritative subscription status (`ACTIVE`, `CANCELED`, `EXPIRED`, `REVOKED`),
 *    expiration, and immediate revocation across all verification checks.
 */

import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";
import { canonicalizeJson } from "../engine/proofReceipt.ts";
import { normalizeEd25519PublicKeyHex } from "../engine/ed25519Verifier.ts";
import {
  utf8ToHex,
  type AuthoritativeReceiptRecord,
  type EntitlementTokenPayload,
} from "../engine/entitlementVerifier.ts";

export interface PaymentWebhookEvent {
  eventId: string;
  eventType:
    | "payment.succeeded"
    | "subscription.canceled"
    | "subscription.expired"
    | "entitlement.revoked";
  paymentReceiptId: string;
  subscriptionId: string;
  tier: "pro" | "team";
  planName: string;
  email: string;
  amountCents: number;
  currency: "USD";
  occurredAtMs: number;
  expiresAtMs: number;
}

export interface ServerBillingAuthorityOptions {
  issuerKeyId?: string;
  ed25519PrivateKeyPemOrDerHex?: string;
  webhookHmacSecret?: string;
}

export class AuthoritativeBillingAuthority {
  readonly issuerKeyId: string;
  readonly publicKeyHex: string;
  readonly #privateKey: KeyObject;
  readonly #webhookSecret: Buffer;
  readonly #receiptLedger = new Map<
    string,
    AuthoritativeReceiptRecord & {
      subscriptionId: string;
      planName: string;
      issuedAtMs: number;
      amountCents: number;
    }
  >();

  constructor(options: ServerBillingAuthorityOptions = {}) {
    this.issuerKeyId = options.issuerKeyId ?? "spe-billing-authority-ed25519-prod-v1";

    if (options.ed25519PrivateKeyPemOrDerHex) {
      const raw = options.ed25519PrivateKeyPemOrDerHex.trim();
      this.#privateKey = raw.startsWith("-----BEGIN")
        ? createPrivateKey(raw)
        : createPrivateKey({
            key: Buffer.from(raw, "hex"),
            format: "der",
            type: "pkcs8",
          });
      const pubObj = createPublicKey(this.#privateKey);
      const spkiHex = pubObj.export({ format: "der", type: "spki" }).toString("hex");
      const norm = normalizeEd25519PublicKeyHex(spkiHex);
      if (!norm) {
        throw new Error("Invalid Ed25519 key supplied to AuthoritativeBillingAuthority");
      }
      this.publicKeyHex = norm;
    } else {
      // Ephemeral CSPRNG Ed25519 keypair (non-deterministic OS entropy)
      const { publicKey, privateKey } = generateKeyPairSync("ed25519");
      this.#privateKey = privateKey;
      const spkiHex = publicKey.export({ format: "der", type: "spki" }).toString("hex");
      const norm = normalizeEd25519PublicKeyHex(spkiHex);
      if (!norm) {
        throw new Error("Failed to normalize generated Ed25519 public key");
      }
      this.publicKeyHex = norm;
    }

    this.#webhookSecret = options.webhookHmacSecret
      ? Buffer.from(options.webhookHmacSecret, "utf8")
      : randomBytes(32);
  }

  /**
   * Computes the expected payment processor webhook HMAC-SHA256 signature over canonical event JSON.
   */
  signWebhookPayload(event: PaymentWebhookEvent): string {
    const canonical = canonicalizeJson(event);
    return createHmac("sha256", this.#webhookSecret).update(canonical, "utf8").digest("hex");
  }

  /**
   * Verifies a payment webhook signature and updates the authoritative server receipt & subscription ledger.
   */
  processVerifiedPaymentWebhook(
    event: PaymentWebhookEvent,
    webhookSignatureHex: string,
  ): AuthoritativeReceiptRecord {
    const canonical = canonicalizeJson(event);
    const expectedMac = createHmac("sha256", this.#webhookSecret)
      .update(canonical, "utf8")
      .digest();
    const providedMac = Buffer.from(webhookSignatureHex || "", "hex");
    if (
      providedMac.length !== expectedMac.length ||
      !timingSafeEqual(providedMac, expectedMac)
    ) {
      throw new Error("INVALID_PAYMENT_WEBHOOK_SIGNATURE: Webhook failed HMAC-SHA256 verification");
    }

    if (!event.paymentReceiptId || !event.email || !event.subscriptionId) {
      throw new Error("INCOMPLETE_PAYMENT_WEBHOOK_EVENT");
    }

    if (event.eventType === "payment.succeeded") {
      const minRequiredCents = event.tier === "team" ? 900 : 100;
      if (event.amountCents < minRequiredCents) {
        throw new Error(
          `INSUFFICIENT_PAYMENT_AMOUNT: tier=${event.tier} requires >= ${minRequiredCents} cents`,
        );
      }
      const record = {
        exists: true,
        paid: true,
        subscriptionStatus: "ACTIVE" as const,
        tier: event.tier,
        planName: event.planName,
        email: event.email.trim(),
        subscriptionId: event.subscriptionId,
        issuedAtMs: event.occurredAtMs,
        expiresAtMs: event.expiresAtMs,
        amountCents: event.amountCents,
        revoked: false,
      };
      this.#receiptLedger.set(event.paymentReceiptId, record);
      return { ...record };
    }

    const existing = this.#receiptLedger.get(event.paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${event.paymentReceiptId}`);
    }

    if (event.eventType === "subscription.canceled") {
      existing.subscriptionStatus = "CANCELED";
      existing.revoked = true;
    } else if (event.eventType === "subscription.expired") {
      existing.subscriptionStatus = "EXPIRED";
      existing.expiresAtMs = Math.min(existing.expiresAtMs, event.occurredAtMs);
    } else if (event.eventType === "entitlement.revoked") {
      existing.subscriptionStatus = "REVOKED";
      existing.revoked = true;
    }

    this.#receiptLedger.set(event.paymentReceiptId, existing);
    return { ...existing };
  }

  /**
   * Issues an Ed25519-signed entitlement token ONLY if `paymentReceiptId` exists in the
   * authoritative server ledger, is confirmed PAID, is ACTIVE, is not revoked, and has not expired.
   */
  issueSignedEntitlementTokenForPaidReceipt(
    paymentReceiptId: string,
    currentEpochMs: number = Date.now(),
  ): string {
    const record = this.#receiptLedger.get(paymentReceiptId);
    if (!record || !record.exists) {
      throw new Error(
        `CANNOT_ISSUE_ENTITLEMENT_FOR_UNKNOWN_RECEIPT:${paymentReceiptId}`,
      );
    }
    if (!record.paid) {
      throw new Error(`CANNOT_ISSUE_ENTITLEMENT_FOR_UNPAID_RECEIPT:${paymentReceiptId}`);
    }
    if (record.revoked || record.subscriptionStatus !== "ACTIVE") {
      throw new Error(
        `CANNOT_ISSUE_ENTITLEMENT_FOR_INACTIVE_SUBSCRIPTION:${record.subscriptionStatus}`,
      );
    }
    if (record.expiresAtMs <= currentEpochMs) {
      throw new Error(`CANNOT_ISSUE_ENTITLEMENT_FOR_EXPIRED_RECEIPT:${paymentReceiptId}`);
    }

    const payload: EntitlementTokenPayload = {
      schema: "spe.entitlement.v1",
      tier: record.tier,
      planName: record.planName,
      email: record.email,
      paymentReceiptId,
      subscriptionId: record.subscriptionId,
      paymentStatus: "PAID",
      subscriptionStatus: record.subscriptionStatus,
      issuedAtMs: record.issuedAtMs,
      expiresAtMs: record.expiresAtMs,
      issuerKeyId: this.issuerKeyId,
    };

    const canonical = canonicalizeJson(payload);
    const payloadHex = utf8ToHex(canonical);
    const sigHex = sign(null, Buffer.from(canonical, "utf8"), this.#privateKey).toString("hex");
    return `spe_entitlement.v1.${payloadHex}.${sigHex}`;
  }

  /**
   * Authoritative server-side cancellation, revocation, or expiration mutators.
   */
  cancelSubscription(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.subscriptionStatus = "CANCELED";
    existing.revoked = true;
  }

  revokeEntitlement(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.subscriptionStatus = "REVOKED";
    existing.revoked = true;
  }

  /**
   * Returns an authoritative receipt status verifier bound to this server ledger.
   */
  createAuthoritativeReceiptVerifier(): (
    paymentReceiptId: string,
    payload: EntitlementTokenPayload,
  ) => AuthoritativeReceiptRecord | null {
    return (paymentReceiptId: string) => {
      const rec = this.#receiptLedger.get(paymentReceiptId);
      if (!rec) return null;
      return {
        exists: rec.exists,
        paid: rec.paid,
        subscriptionStatus: rec.subscriptionStatus,
        tier: rec.tier,
        email: rec.email,
        expiresAtMs: rec.expiresAtMs,
        revoked: rec.revoked,
      };
    };
  }
}
