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
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalizeJson } from "../engine/proofReceipt.ts";
import { normalizeEd25519PublicKeyHex } from "../engine/ed25519Verifier.ts";
import {
  utf8ToHex,
  type AuthoritativeReceiptRecord,
  type EntitlementTokenPayload,
  type SignedReceiptStatusAttestation,
} from "../engine/entitlementVerifier.ts";

export type AuthoritativeLedgerRecord = AuthoritativeReceiptRecord & {
  paymentReceiptId: string;
  subscriptionId: string;
  planName: string;
  issuedAtMs: number;
  amountCents: number;
  paymentStatus: "PAID" | "UNPAID" | "REFUNDED" | "DISPUTED";
};

export interface BillingLedgerState {
  records: Record<string, AuthoritativeLedgerRecord>;
  processedEventIds: string[];
}

export interface BillingStorageAdapter {
  load(): BillingLedgerState;
  save(state: BillingLedgerState): void;
}

export class InMemoryBillingStorageAdapter implements BillingStorageAdapter {
  #state: BillingLedgerState = { records: {}, processedEventIds: [] };

  load(): BillingLedgerState {
    return {
      records: { ...this.#state.records },
      processedEventIds: [...this.#state.processedEventIds],
    };
  }

  save(state: BillingLedgerState): void {
    this.#state = {
      records: { ...state.records },
      processedEventIds: [...state.processedEventIds],
    };
  }
}

export class FileBillingStorageAdapter implements BillingStorageAdapter {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): BillingLedgerState {
    if (!existsSync(this.filePath)) {
      return { records: {}, processedEventIds: [] };
    }
    try {
      const raw = readFileSync(this.filePath, "utf8");
      if (!raw || !raw.trim()) {
        return { records: {}, processedEventIds: [] };
      }
      const parsed = JSON.parse(raw);
      return {
        records: (parsed && typeof parsed.records === "object" ? parsed.records : {}) as Record<
          string,
          AuthoritativeLedgerRecord
        >,
        processedEventIds: Array.isArray(parsed?.processedEventIds) ? parsed.processedEventIds : [],
      };
    } catch (err) {
      throw new Error(
        `FAILED_TO_LOAD_BILLING_LEDGER from ${this.filePath}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  save(state: BillingLedgerState): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.filePath}.${randomBytes(6).toString("hex")}.tmp`;
    const serialized = JSON.stringify(state, null, 2);
    writeFileSync(tmpPath, serialized, "utf8");
    renameSync(tmpPath, this.filePath);
  }
}

export interface PaymentWebhookEvent {
  eventId: string;
  eventNonce?: string;
  eventType:
    | "payment.succeeded"
    | "subscription.past_due"
    | "subscription.canceled"
    | "subscription.expired"
    | "payment.refunded"
    | "charge.refunded"
    | "payment.disputed"
    | "charge.dispute.created"
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
  storageAdapter?: BillingStorageAdapter;
  storageFilePath?: string;
}

export class AuthoritativeBillingAuthority {
  readonly issuerKeyId: string;
  readonly publicKeyHex: string;
  readonly #privateKey: KeyObject;
  readonly #webhookSecret: Buffer;
  readonly #storageAdapter: BillingStorageAdapter;
  readonly #receiptLedger = new Map<string, AuthoritativeLedgerRecord>();
  readonly #processedEventIds = new Set<string>();

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

    this.#storageAdapter =
      options.storageAdapter ??
      (options.storageFilePath
        ? new FileBillingStorageAdapter(options.storageFilePath)
        : new InMemoryBillingStorageAdapter());

    this.reloadLedger();
  }

  /**
   * Reloads authoritative state from the durable storage adapter.
   */
  reloadLedger(): void {
    const loaded = this.#storageAdapter.load();
    this.#receiptLedger.clear();
    for (const [id, rec] of Object.entries(loaded.records || {})) {
      this.#receiptLedger.set(id, { ...rec });
    }
    this.#processedEventIds.clear();
    for (const eventId of loaded.processedEventIds || []) {
      this.#processedEventIds.add(eventId);
    }
  }

  flush(): void {
    this.#saveLedger();
  }

  #saveLedger(): void {
    const records: Record<string, AuthoritativeLedgerRecord> = {};
    for (const [id, rec] of this.#receiptLedger.entries()) {
      records[id] = { ...rec };
    }
    this.#storageAdapter.save({
      records,
      processedEventIds: Array.from(this.#processedEventIds),
    });
  }

  getProcessedEventIds(): Set<string> {
    return new Set(this.#processedEventIds);
  }

  getLedgerRecord(paymentReceiptId: string): AuthoritativeLedgerRecord | undefined {
    const rec = this.#receiptLedger.get(paymentReceiptId);
    return rec ? { ...rec } : undefined;
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
   * Enforces replay protection and event deduplication via eventId.
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

    if (!event.eventId || typeof event.eventId !== "string" || !event.eventId.trim()) {
      throw new Error("MISSING_WEBHOOK_EVENT_ID: Webhook eventId is required for replay protection");
    }

    if (!event.paymentReceiptId || !event.email || !event.subscriptionId) {
      throw new Error("INCOMPLETE_PAYMENT_WEBHOOK_EVENT");
    }

    // Idempotent webhook replay deduplication: safe replay without state corruption
    const isReplay =
      this.#processedEventIds.has(event.eventId) ||
      (typeof event.eventNonce === "string" &&
        event.eventNonce.trim() !== "" &&
        this.#processedEventIds.has(event.eventNonce.trim()));
    if (isReplay) {
      const existing = this.#receiptLedger.get(event.paymentReceiptId);
      if (existing) {
        return { ...existing };
      }
    }

    if (event.eventType === "payment.succeeded") {
      const minRequiredCents = event.tier === "team" ? 900 : 100;
      if (event.amountCents < minRequiredCents) {
        throw new Error(
          `INSUFFICIENT_PAYMENT_AMOUNT: tier=${event.tier} requires >= ${minRequiredCents} cents`,
        );
      }
      const record: AuthoritativeLedgerRecord = {
        paymentReceiptId: event.paymentReceiptId,
        exists: true,
        paid: true,
        paymentStatus: "PAID",
        subscriptionStatus: "ACTIVE",
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
      this.#processedEventIds.add(event.eventId);
      if (typeof event.eventNonce === "string" && event.eventNonce.trim() !== "") {
        this.#processedEventIds.add(event.eventNonce.trim());
      }
      this.#saveLedger();
      return { ...record };
    }

    const existing = this.#receiptLedger.get(event.paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${event.paymentReceiptId}`);
    }

    if (event.eventType === "subscription.past_due") {
      existing.subscriptionStatus = "PAST_DUE";
      existing.revoked = true;
    } else if (event.eventType === "subscription.canceled") {
      existing.subscriptionStatus = "CANCELED";
      existing.revoked = true;
    } else if (event.eventType === "subscription.expired") {
      existing.subscriptionStatus = "EXPIRED";
      existing.expiresAtMs = Math.min(existing.expiresAtMs, event.occurredAtMs);
      existing.revoked = true;
    } else if (event.eventType === "payment.refunded" || event.eventType === "charge.refunded") {
      existing.paid = false;
      existing.paymentStatus = "REFUNDED";
      existing.subscriptionStatus = "CANCELED";
      existing.revoked = true;
    } else if (
      event.eventType === "payment.disputed" ||
      event.eventType === "charge.dispute.created"
    ) {
      existing.paid = false;
      existing.paymentStatus = "DISPUTED";
      existing.subscriptionStatus = "REVOKED";
      existing.revoked = true;
    } else if (event.eventType === "entitlement.revoked") {
      existing.subscriptionStatus = "REVOKED";
      existing.revoked = true;
    } else {
      throw new Error(`UNRECOGNIZED_WEBHOOK_EVENT_TYPE:${event.eventType}`);
    }

    this.#receiptLedger.set(event.paymentReceiptId, existing);
    this.#processedEventIds.add(event.eventId);
    if (typeof event.eventNonce === "string" && event.eventNonce.trim() !== "") {
      this.#processedEventIds.add(event.eventNonce.trim());
    }
    this.#saveLedger();
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
   * Issues an Ed25519-signed receipt status attestation reflecting the current authoritative
   * state of `paymentReceiptId` in the server ledger.
   */
  issueSignedReceiptStatusAttestation(
    paymentReceiptId: string,
    currentEpochMs: number = Date.now(),
  ): SignedReceiptStatusAttestation {
    const record = this.#receiptLedger.get(paymentReceiptId);
    if (!record) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    const attestationPayload: Omit<SignedReceiptStatusAttestation, "signatureHex"> = {
      schema: "spe.receipt_status_attestation.v1",
      paymentReceiptId,
      subscriptionId: record.subscriptionId,
      exists: record.exists,
      paid: record.paid,
      subscriptionStatus: record.subscriptionStatus,
      tier: record.tier,
      planName: record.planName,
      lifetime:
        record.expiresAtMs >= 2_000_000_000_000 ||
        (typeof record.planName === "string" && record.planName.toLowerCase().includes("lifetime")),
      email: record.email,
      expiresAtMs: record.expiresAtMs,
      revoked: Boolean(record.revoked),
      attestedAtMs: currentEpochMs,
      issuerKeyId: this.issuerKeyId,
    };
    const canonical = canonicalizeJson(attestationPayload);
    const signatureHex = sign(
      null,
      Buffer.from(canonical, "utf8"),
      this.#privateKey,
    ).toString("hex");
    return {
      ...attestationPayload,
      signatureHex,
    };
  }

  /**
   * Issues a 6-part composite checkout bundle containing both the Ed25519 entitlement token
   * and an embedded Ed25519 receipt status attestation (`spe_entitlement.v1.<payloadHex>.<sigHex>.<receiptAttHex>.<receiptSigHex>`).
   */
  issueSignedCheckoutBundleForPaidReceipt(
    paymentReceiptId: string,
    currentEpochMs: number = Date.now(),
  ): string {
    const baseToken = this.issueSignedEntitlementTokenForPaidReceipt(
      paymentReceiptId,
      currentEpochMs,
    );
    const receiptAttestation = this.issueSignedReceiptStatusAttestation(
      paymentReceiptId,
      currentEpochMs,
    );
    const { signatureHex, ...unsignedAttestation } = receiptAttestation;
    const attHex = utf8ToHex(canonicalizeJson(unsignedAttestation));
    return `${baseToken}.${attHex}.${signatureHex}`;
  }

  /**
   * Registers and issues an Ed25519-signed trial entitlement token without requiring a payment webhook.
   */
  issueSignedTrialEntitlementToken(
    tier: "pro" | "team" = "pro",
    email: string = "trial@developer.spe",
    trialDays: number = 7,
    currentEpochMs: number = Date.now(),
  ): string {
    const trialId = `SPE-TRIAL-${tier.toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
    const expiresAtMs = currentEpochMs + trialDays * 24 * 60 * 60 * 1000;
    const planName =
      tier === "team"
        ? "Company & CI/CD Gate (7-Day Free Trial)"
        : "Developer Pro (7-Day Free Trial)";

    const record: AuthoritativeLedgerRecord = {
      paymentReceiptId: trialId,
      subscriptionId: `sub_trial_${trialId}`,
      planName,
      amountCents: 0,
      issuedAtMs: currentEpochMs,
      expiresAtMs,
      paid: true,
      exists: true,
      paymentStatus: "PAID",
      subscriptionStatus: "ACTIVE",
      tier,
      email: email.trim(),
      revoked: false,
      isTrial: true,
    };

    this.#receiptLedger.set(trialId, record);
    this.#saveLedger();

    const payload: EntitlementTokenPayload = {
      schema: "spe.entitlement.v1",
      tier,
      planName,
      email: email.trim(),
      paymentReceiptId: trialId,
      subscriptionId: record.subscriptionId,
      paymentStatus: "PAID",
      subscriptionStatus: "ACTIVE",
      issuedAtMs: currentEpochMs,
      expiresAtMs,
      issuerKeyId: this.issuerKeyId,
      isTrial: true,
    };

    const canonical = canonicalizeJson(payload);
    const payloadHex = utf8ToHex(canonical);
    const sigHex = sign(null, Buffer.from(canonical, "utf8"), this.#privateKey).toString("hex");
    return `spe_entitlement.v1.${payloadHex}.${sigHex}`;
  }

  /**
   * Authoritative server-side lifecycle mutators.
   */
  cancelSubscription(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.subscriptionStatus = "CANCELED";
    existing.revoked = true;
    this.#receiptLedger.set(paymentReceiptId, existing);
    this.#saveLedger();
  }

  revokeEntitlement(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.subscriptionStatus = "REVOKED";
    existing.revoked = true;
    this.#receiptLedger.set(paymentReceiptId, existing);
    this.#saveLedger();
  }

  markPastDue(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.subscriptionStatus = "PAST_DUE";
    existing.revoked = true;
    this.#receiptLedger.set(paymentReceiptId, existing);
    this.#saveLedger();
  }

  markRefunded(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.paid = false;
    existing.paymentStatus = "REFUNDED";
    existing.subscriptionStatus = "CANCELED";
    existing.revoked = true;
    this.#receiptLedger.set(paymentReceiptId, existing);
    this.#saveLedger();
  }

  markDisputed(paymentReceiptId: string): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.paid = false;
    existing.paymentStatus = "DISPUTED";
    existing.subscriptionStatus = "REVOKED";
    existing.revoked = true;
    this.#receiptLedger.set(paymentReceiptId, existing);
    this.#saveLedger();
  }

  markExpired(paymentReceiptId: string, expiredAtMs: number = Date.now()): void {
    const existing = this.#receiptLedger.get(paymentReceiptId);
    if (!existing) {
      throw new Error(`UNKNOWN_PAYMENT_RECEIPT_ID:${paymentReceiptId}`);
    }
    existing.subscriptionStatus = "EXPIRED";
    existing.expiresAtMs = Math.min(existing.expiresAtMs, expiredAtMs);
    existing.revoked = true;
    this.#receiptLedger.set(paymentReceiptId, existing);
    this.#saveLedger();
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
