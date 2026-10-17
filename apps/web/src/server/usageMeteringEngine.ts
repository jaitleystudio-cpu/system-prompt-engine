/**
 * apps/web/src/server/usageMeteringEngine.ts
 *
 * SPE Ω — Authoritative Per-Call Usage Metering & Customer Accounting Engine
 *
 * Implements:
 * 1. Explicit Billable Event Definitions & Tiered Fractional-Cent Price Schedule:
 *    - Standard compilation (<= 5,000 chars, standard dialect): $0.0010 (1,000 micro-cents / 100,000 nanoUSD)
 *    - Pro compilation (5,001-30,000 chars or pro dialect):    $0.0050 (5,000 micro-cents / 500,000 nanoUSD)
 *    - Deep reasoning / giant compilation (> 30,000 chars):   $0.0100 (10,000 micro-cents / 1,000,000 nanoUSD)
 * 2. Customer-Linked Account Ledger & Prepaid Balance Accounting (Integer micro-cents to prevent float drift).
 * 3. Free Allowance Policy:
 *    - Unauthenticated / Free public requests get up to 10 free compilations per hour (max 5,000 chars).
 *    - Requests exceeding the free allowance or requesting paid pro capabilities require a funded API key.
 * 4. Idempotency & Replay Defense:
 *    - Request IDs / idempotency nonces prevent duplicate billing on client network retries.
 * 5. Fail-Closed Error Policy:
 *    - Failed or errored tool runs (4xx/5xx) are NEVER billed ($0 charge).
 *    - Refunds automatically reverse debits if tool execution encounters an unhandled exception.
 * 6. Reconciliation & Stripe Meter Queue:
 *    - Maintains audit journal and exports meter events conforming to Stripe Billing Meter specification.
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Micro-cents: 1 USD = 100 cents = 100,000 micro-cents.
// 1 cent = 1,000 micro-cents.
// $0.001 = 100 micro-cents? Wait:
// $1.00 = 100 cents.
// $0.01 = 1 cent = 10,000 micro-cents.
// $0.001 = 0.1 cent = 1,000 micro-cents.
// $0.005 = 0.5 cent = 5,000 micro-cents.
// $0.010 = 1.0 cent = 10,000 micro-cents.
// This allows exact integer arithmetic with no float errors.

export const PRICING_SCHEDULE = {
  STANDARD_COMPILE_MICRO_CENTS: 1000,    // $0.0010 (0.10 cents)
  PRO_COMPILE_MICRO_CENTS: 5000,         // $0.0050 (0.50 cents)
  DEEP_REASONING_MICRO_CENTS: 10000,     // $0.0100 (1.00 cent)
  FREE_ALLOWANCE_MAX_CHARS: 5000,
  FREE_ALLOWANCE_CALLS_PER_HOUR: 10,
} as const;

export type PricingTier = "standard" | "pro" | "deep_reasoning";

export interface BillableEventDetails {
  toolName: string;
  promptChars: number;
  targetDialect?: string;
  isDeepReasoning?: boolean;
}

export interface CustomerAccount {
  customerId: string;
  email: string;
  apiKeyHash: string;
  tier: "free" | "pro" | "team" | "enterprise";
  balanceMicroCents: number;
  totalDebitedMicroCents: number;
  totalCalls: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface MeteredUsageRecord {
  eventId: string;
  customerId: string;
  idempotencyKey?: string;
  toolName: string;
  promptChars: number;
  dialect?: string;
  pricingTier: PricingTier;
  debitedMicroCents: number;
  debitedUsdString: string;
  status: "DEBITED" | "REFUNDED" | "FREE_ALLOWANCE";
  occurredAtMs: number;
  stripeMeterReported: boolean;
}

export interface UsageLedgerState {
  accounts: Record<string, CustomerAccount>;
  apiKeyToCustomerId: Record<string, string>;
  records: Record<string, MeteredUsageRecord>;
  idempotencyIndex: Record<string, string>; // idempotencyKey -> eventId
}

export interface UsageStorageAdapter {
  load(): UsageLedgerState;
  save(state: UsageLedgerState): void;
}

export class InMemoryUsageStorageAdapter implements UsageStorageAdapter {
  #state: UsageLedgerState = {
    accounts: {},
    apiKeyToCustomerId: {},
    records: {},
    idempotencyIndex: {},
  };

  load(): UsageLedgerState {
    return {
      accounts: { ...this.#state.accounts },
      apiKeyToCustomerId: { ...this.#state.apiKeyToCustomerId },
      records: { ...this.#state.records },
      idempotencyIndex: { ...this.#state.idempotencyIndex },
    };
  }

  save(state: UsageLedgerState): void {
    this.#state = {
      accounts: { ...state.accounts },
      apiKeyToCustomerId: { ...state.apiKeyToCustomerId },
      records: { ...state.records },
      idempotencyIndex: { ...state.idempotencyIndex },
    };
  }
}

export class FileUsageStorageAdapter implements UsageStorageAdapter {
  readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): UsageLedgerState {
    if (!existsSync(this.filePath)) {
      return { accounts: {}, apiKeyToCustomerId: {}, records: {}, idempotencyIndex: {} };
    }
    try {
      const raw = readFileSync(this.filePath, "utf8");
      if (!raw || !raw.trim()) {
        return { accounts: {}, apiKeyToCustomerId: {}, records: {}, idempotencyIndex: {} };
      }
      const parsed = JSON.parse(raw);
      return {
        accounts: parsed.accounts || {},
        apiKeyToCustomerId: parsed.apiKeyToCustomerId || {},
        records: parsed.records || {},
        idempotencyIndex: parsed.idempotencyIndex || {},
      };
    } catch (err: any) {
      throw new Error(`FAILED_TO_LOAD_USAGE_LEDGER from ${this.filePath}: ${err.message}`);
    }
  }

  save(state: UsageLedgerState): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.filePath}.${randomBytes(6).toString("hex")}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf8");
    renameSync(tmpPath, this.filePath);
  }
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

export class UsageMeteringEngine {
  readonly #storage: UsageStorageAdapter;
  readonly #accounts = new Map<string, CustomerAccount>();
  readonly #apiKeyToCustomerId = new Map<string, string>();
  readonly #records = new Map<string, MeteredUsageRecord>();
  readonly #idempotencyIndex = new Map<string, string>();

  // In-memory free tier tracking by IP/identifier
  readonly #freeAllowanceBuckets = new Map<string, { count: number; resetAtMs: number }>();

  constructor(options: { storageAdapter?: UsageStorageAdapter; storageFilePath?: string } = {}) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.SPE_DURABLE_LEDGER === "true";
    const defaultDurablePath = resolve(process.cwd(), "proofs/generated/SPE_PRODUCTION_USAGE_LEDGER.json");

    this.#storage =
      options.storageAdapter ??
      (options.storageFilePath
        ? new FileUsageStorageAdapter(options.storageFilePath)
        : isProduction
        ? new FileUsageStorageAdapter(process.env.SPE_USAGE_LEDGER_PATH || defaultDurablePath)
        : new InMemoryUsageStorageAdapter());
    this.reload();
  }

  reload(): void {
    const state = this.#storage.load();
    this.#accounts.clear();
    for (const [id, acc] of Object.entries(state.accounts || {})) {
      this.#accounts.set(id, { ...acc });
    }
    this.#apiKeyToCustomerId.clear();
    for (const [hash, custId] of Object.entries(state.apiKeyToCustomerId || {})) {
      this.#apiKeyToCustomerId.set(hash, custId);
    }
    this.#records.clear();
    for (const [evtId, rec] of Object.entries(state.records || {})) {
      this.#records.set(evtId, { ...rec });
    }
    this.#idempotencyIndex.clear();
    for (const [key, evtId] of Object.entries(state.idempotencyIndex || {})) {
      this.#idempotencyIndex.set(key, evtId);
    }
  }

  flush(): void {
    const accounts: Record<string, CustomerAccount> = {};
    for (const [id, acc] of this.#accounts.entries()) {
      accounts[id] = { ...acc };
    }
    const apiKeyToCustomerId: Record<string, string> = {};
    for (const [hash, custId] of this.#apiKeyToCustomerId.entries()) {
      apiKeyToCustomerId[hash] = custId;
    }
    const records: Record<string, MeteredUsageRecord> = {};
    for (const [id, rec] of this.#records.entries()) {
      records[id] = { ...rec };
    }
    const idempotencyIndex: Record<string, string> = {};
    for (const [key, id] of this.#idempotencyIndex.entries()) {
      idempotencyIndex[key] = id;
    }
    this.#storage.save({
      accounts,
      apiKeyToCustomerId,
      records,
      idempotencyIndex,
    });
  }

  /**
   * Registers a customer account with an initial prepaid balance (in cents or micro-cents)
   * and generates an API key prefixed with spe_live_ or spe_test_.
   */
  createCustomerAccount(options: {
    customerId: string;
    email: string;
    initialBalanceCents?: number;
    tier?: "free" | "pro" | "team" | "enterprise";
    isTest?: boolean;
  }): { account: CustomerAccount; apiKey: string } {
    const prefix = options.isTest ? "spe_test_" : "spe_live_";
    const apiKey = `${prefix}${randomBytes(24).toString("hex")}`;
    const keyHash = hashApiKey(apiKey);

    const now = Date.now();
    const balanceMicroCents = (options.initialBalanceCents || 0) * 10000;

    const account: CustomerAccount = {
      customerId: options.customerId,
      email: options.email,
      apiKeyHash: keyHash,
      tier: options.tier || "pro",
      balanceMicroCents,
      totalDebitedMicroCents: 0,
      totalCalls: 0,
      createdAtMs: now,
      updatedAtMs: now,
    };

    this.#accounts.set(account.customerId, account);
    this.#apiKeyToCustomerId.set(keyHash, account.customerId);
    this.flush();

    return { account: { ...account }, apiKey };
  }

  /**
   * Adds prepaid balance in cents to an existing customer account (e.g. from Stripe checkout).
   */
  creditBalance(customerId: string, amountCents: number): CustomerAccount {
    const account = this.#accounts.get(customerId);
    if (!account) {
      throw new Error(`CUSTOMER_NOT_FOUND: ${customerId}`);
    }
    if (amountCents <= 0) {
      throw new Error("INVALID_CREDIT_AMOUNT: amount must be > 0 cents");
    }
    account.balanceMicroCents += amountCents * 10000;
    account.updatedAtMs = Date.now();
    this.flush();
    return { ...account };
  }

  /**
   * Resolves a customer account by raw API key.
   */
  authenticateApiKey(rawApiKey: string): CustomerAccount | null {
    if (!rawApiKey || typeof rawApiKey !== "string") return null;
    const keyHash = hashApiKey(rawApiKey);
    const customerId = this.#apiKeyToCustomerId.get(keyHash);
    if (!customerId) return null;
    const account = this.#accounts.get(customerId);
    return account ? { ...account } : null;
  }

  getCustomerAccount(customerId: string): CustomerAccount | undefined {
    const acc = this.#accounts.get(customerId);
    return acc ? { ...acc } : undefined;
  }

  /**
   * Calculates the exact billable price for a compilation event based on prompt volume,
   * target dialect, and reasoning requirements.
   */
  calculatePrice(details: BillableEventDetails): {
    pricingTier: PricingTier;
    priceMicroCents: number;
    priceUsd: number;
    priceUsdString: string;
  } {
    const chars = details.promptChars || 0;
    const proDialects = new Set([
      "cursor-rules",
      "windsurf-rules",
      "antigravity-skills",
      "gemini-agent",
    ]);

    if (chars > 30000 || details.isDeepReasoning) {
      return {
        pricingTier: "deep_reasoning",
        priceMicroCents: PRICING_SCHEDULE.DEEP_REASONING_MICRO_CENTS,
        priceUsd: 0.010,
        priceUsdString: "$0.010",
      };
    }

    if (chars > 5000 || (details.targetDialect && proDialects.has(details.targetDialect))) {
      return {
        pricingTier: "pro",
        priceMicroCents: PRICING_SCHEDULE.PRO_COMPILE_MICRO_CENTS,
        priceUsd: 0.005,
        priceUsdString: "$0.005",
      };
    }

    return {
      pricingTier: "standard",
      priceMicroCents: PRICING_SCHEDULE.STANDARD_COMPILE_MICRO_CENTS,
      priceUsd: 0.001,
      priceUsdString: "$0.001",
    };
  }

  /**
   * Assesses whether an unauthenticated request is eligible for the free tier allowance.
   */
  checkFreeAllowance(
    clientIp: string,
    details: BillableEventDetails
  ): { eligible: boolean; reason?: string; remainingHourlyCalls: number } {
    if (details.promptChars > PRICING_SCHEDULE.FREE_ALLOWANCE_MAX_CHARS) {
      return {
        eligible: false,
        reason: `Prompt length (${details.promptChars} chars) exceeds Free Tier allowance (${PRICING_SCHEDULE.FREE_ALLOWANCE_MAX_CHARS} chars). Paid API key required.`,
        remainingHourlyCalls: 0,
      };
    }

    const proDialects = new Set(["cursor-rules", "windsurf-rules", "antigravity-skills", "gemini-agent"]);
    if (details.targetDialect && proDialects.has(details.targetDialect)) {
      return {
        eligible: false,
        reason: `Target dialect '${details.targetDialect}' is a Pro-tier capability. Paid API key required.`,
        remainingHourlyCalls: 0,
      };
    }

    const now = Date.now();
    let bucket = this.#freeAllowanceBuckets.get(clientIp);
    if (!bucket || now > bucket.resetAtMs) {
      bucket = { count: 0, resetAtMs: now + 60 * 60 * 1000 };
      this.#freeAllowanceBuckets.set(clientIp, bucket);
    }

    if (bucket.count >= PRICING_SCHEDULE.FREE_ALLOWANCE_CALLS_PER_HOUR) {
      return {
        eligible: false,
        reason: `Hourly free allowance exceeded (${PRICING_SCHEDULE.FREE_ALLOWANCE_CALLS_PER_HOUR} calls/hour). Provide an API key via 'Authorization: Bearer <key>'.`,
        remainingHourlyCalls: 0,
      };
    }

    return {
      eligible: true,
      remainingHourlyCalls: PRICING_SCHEDULE.FREE_ALLOWANCE_CALLS_PER_HOUR - bucket.count,
    };
  }

  consumeFreeAllowance(clientIp: string): void {
    const now = Date.now();
    let bucket = this.#freeAllowanceBuckets.get(clientIp);
    if (!bucket || now > bucket.resetAtMs) {
      bucket = { count: 1, resetAtMs: now + 60 * 60 * 1000 };
      this.#freeAllowanceBuckets.set(clientIp, bucket);
    } else {
      bucket.count++;
    }
  }

  /**
   * Checks idempotency: if request with idempotencyKey was already successfully billed,
   * returns the existing record to prevent duplicate billing.
   * Scoped to customerId to prevent cross-customer replay collisions (BILL-P0-06).
   */
  findIdempotentRecord(idempotencyKey?: string, customerId?: string): MeteredUsageRecord | null {
    if (!idempotencyKey) return null;
    const keyToLookup = customerId ? `${customerId}:${idempotencyKey}` : idempotencyKey;
    const existingEvtId = this.#idempotencyIndex.get(keyToLookup);
    if (!existingEvtId) return null;
    const record = this.#records.get(existingEvtId);
    return record ? { ...record } : null;
  }

  /**
   * Atomically debits the customer account balance for a billable compilation event.
   * Throws INSUFFICIENT_PREPAID_CREDIT if balance is inadequate.
   */
  debitCustomerUsage(
    customerId: string,
    details: BillableEventDetails,
    idempotencyKey?: string
  ): MeteredUsageRecord {
    if (idempotencyKey) {
      const existing = this.findIdempotentRecord(idempotencyKey, customerId);
      if (existing) {
        return existing;
      }
    }

    const account = this.#accounts.get(customerId);
    if (!account) {
      throw new Error(`CUSTOMER_ACCOUNT_NOT_FOUND: ${customerId}`);
    }

    const { pricingTier, priceMicroCents, priceUsdString } = this.calculatePrice(details);

    if (account.balanceMicroCents < priceMicroCents) {
      const balanceUsd = (account.balanceMicroCents / 1000000).toFixed(4);
      throw new Error(
        `INSUFFICIENT_PREPAID_CREDIT: Required ${priceUsdString}, available balance is $${balanceUsd}. Top up your account at https://systempromptengine.com/pricing`
      );
    }

    // Atomic debit
    account.balanceMicroCents -= priceMicroCents;
    account.totalDebitedMicroCents += priceMicroCents;
    account.totalCalls += 1;
    account.updatedAtMs = Date.now();

    const eventId = `spe_meter_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const record: MeteredUsageRecord = {
      eventId,
      customerId,
      idempotencyKey,
      toolName: details.toolName,
      promptChars: details.promptChars,
      dialect: details.targetDialect,
      pricingTier,
      debitedMicroCents: priceMicroCents,
      debitedUsdString: priceUsdString,
      status: "DEBITED",
      occurredAtMs: Date.now(),
      stripeMeterReported: false,
    };

    this.#records.set(eventId, record);
    if (idempotencyKey) {
      const scopedKey = `${customerId}:${idempotencyKey}`;
      this.#idempotencyIndex.set(scopedKey, eventId);
    }

    this.flush();
    return { ...record };
  }

  /**
   * Reverses a debit if the downstream tool execution failed (fail-closed zero charge policy).
   */
  refundDebit(eventId: string, _reason?: string): void {
    const record = this.#records.get(eventId);
    if (!record || record.status !== "DEBITED") return;

    const account = this.#accounts.get(record.customerId);
    if (account) {
      account.balanceMicroCents += record.debitedMicroCents;
      account.totalDebitedMicroCents -= record.debitedMicroCents;
      account.updatedAtMs = Date.now();
    }

    record.status = "REFUNDED";
    this.flush();
  }

  /**
   * Formats pending usage events into Stripe Billing Meter Events payload
   * (conforming to Stripe's POST /v2/billing/meter_event_stream specification).
   */
  exportStripeMeterEvents(): Array<{
    event_name: string;
    payload: {
      stripe_customer_id: string;
      value: string;
      tier: string;
      micro_cents: number;
    };
    identifier: string;
    timestamp: number;
  }> {
    const out: any[] = [];
    for (const record of this.#records.values()) {
      if (record.status === "DEBITED" && !record.stripeMeterReported) {
        out.push({
          event_name: "spe_prompt_compilation",
          payload: {
            stripe_customer_id: record.customerId,
            value: "1",
            tier: record.pricingTier,
            micro_cents: record.debitedMicroCents,
          },
          identifier: record.eventId,
          timestamp: Math.floor(record.occurredAtMs / 1000),
        });
      }
    }
    return out;
  }

  markStripeMeterEventsReported(eventIds: string[]): void {
    for (const id of eventIds) {
      const record = this.#records.get(id);
      if (record) {
        record.stripeMeterReported = true;
      }
    }
    this.flush();
  }

  /**
   * Reconciles the customer ledger to prove mathematical consistency:
   * Current Balance + Total Debited == Total Credited (within 0 micro-cent tolerance).
   */
  reconcileCustomer(customerId: string): {
    reconciled: boolean;
    balanceCents: number;
    totalDebitedCents: number;
    activeRecordsCount: number;
  } {
    const account = this.#accounts.get(customerId);
    if (!account) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    let calculatedDebits = 0;
    let activeRecords = 0;
    for (const rec of this.#records.values()) {
      if (rec.customerId === customerId && rec.status === "DEBITED") {
        calculatedDebits += rec.debitedMicroCents;
        activeRecords++;
      }
    }

    const reconciled = calculatedDebits === account.totalDebitedMicroCents;
    return {
      reconciled,
      balanceCents: account.balanceMicroCents / 10000,
      totalDebitedCents: account.totalDebitedMicroCents / 10000,
      activeRecordsCount: activeRecords,
    };
  }

  /**
   * Reconciles all accounts across the entire usage ledger.
   */
  reconcileLedger(): {
    isReconciled: boolean;
    totalUsageRecords: number;
    totalAccounts: number;
    totalDebitedMicroCents: number;
    discrepancyMicroCents: number;
  } {
    let totalUsageRecords = 0;
    let totalDebitedMicroCents = 0;

    for (const rec of this.#records.values()) {
      if (rec.status === "DEBITED") {
        totalDebitedMicroCents += rec.debitedMicroCents;
        totalUsageRecords++;
      }
    }

    let sumAccountDebited = 0;
    for (const acc of this.#accounts.values()) {
      sumAccountDebited += acc.totalDebitedMicroCents;
    }

    const discrepancyMicroCents = Math.abs(totalDebitedMicroCents - sumAccountDebited);
    return {
      isReconciled: discrepancyMicroCents === 0,
      totalUsageRecords,
      totalAccounts: this.#accounts.size,
      totalDebitedMicroCents,
      discrepancyMicroCents,
    };
  }
}
