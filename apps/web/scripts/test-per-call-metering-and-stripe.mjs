/**
 * apps/web/scripts/test-per-call-metering-and-stripe.mjs
 *
 * SPE Ω — Comprehensive Automated Verification Suite for:
 * 1. Per-Call Usage Metering ($0.001 - $0.010)
 * 2. Authenticated Account & API Identity (Authorization: Bearer spe_live_...)
 * 3. Free Tier Allowance Enforcement (<= 5,000 chars, standard dialect, hourly quota)
 * 4. Stripe Payment Processor Integration (HMAC-SHA256 signature verification, checkout, meter events)
 * 5. Replay Defense, Idempotency, and Fail-Closed Error Zero-Charge Policy
 * 6. Audit Probe Replay (Resolves findings in /private/tmp/spe-monetization-ad87ca52/REVIEW.md)
 */

import { EventEmitter } from "node:events";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { McpProductionServer } from "../src/server/mcpProductionServer.ts";
import {
  AuthoritativeBillingAuthority,
  UsageMeteringEngine,
  StripeProcessorAdapter,
  PRICING_SCHEDULE,
} from "../src/server/billingAuthority.ts";

console.log("==================================================================");
console.log("💰 TESTING: SPE Ω Per-Call Metering & Stripe Processor Integration");
console.log("==================================================================");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
  passedTests++;
}

// ────────────────────────────────────────────────────────────────
// TEST SETUP: In-Memory Server & Dedicated Engines
// ────────────────────────────────────────────────────────────────
const usageEngine = new UsageMeteringEngine();
const billingAuthority = new AuthoritativeBillingAuthority();
const stripeProcessor = new StripeProcessorAdapter({
  webhookSecret: "whsec_test_secret_for_verification_suite",
  billingAuthority,
  usageEngine,
});

const serverInstance = new McpProductionServer({
  usageEngine,
  billingAuthority,
  stripeProcessor,
  stripeWebhookSecret: "whsec_test_secret_for_verification_suite",
});

const httpServer = serverInstance.createHttpServer();
const requestHandler = httpServer.listeners("request")[0];

async function simulateHttpRequest(options, bodyPayload = "") {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    const headers = { ...options.headers };
    if (bodyPayload && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    Object.assign(req, {
      url: options.path || "/api/v1/mcp",
      method: options.method || "POST",
      socket: { remoteAddress: options.clientIp || "127.0.0.1" },
      headers,
    });

    const responseHeaders = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) {
        responseHeaders[k.toLowerCase()] = v;
      },
      end(body) {
        let json = null;
        try {
          json = JSON.parse(body || "{}");
        } catch {
          json = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: responseHeaders,
          body: json,
          rawBody: body,
        });
      },
    };

    requestHandler(req, res);
    if (bodyPayload) {
      req.emit("data", Buffer.from(bodyPayload));
    }
    req.emit("end");
  });
}

// ────────────────────────────────────────────────────────────────
// GATE 1: AUDIT PROBE REPLAY (Resolves probe.mjs findings)
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 1] Replaying and resolving auditor probe.mjs findings...");

// 1.1 Unauthenticated Short Request within Free Tier Allowance
const probe1 = await simulateHttpRequest(
  { path: "/api/v1/mcp", method: "POST", headers: {} },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Write a concise report.",
        targetDialect: "openai-markdown",
      },
    },
  })
);
assert(probe1.statusCode === 200, "Unauthenticated short request under free allowance returns HTTP 200");
assert(probe1.body.result?.content?.[0]?.text?.length > 0, "Tool compiled output returned");
assert(probe1.headers["x-spe-usage-charge-usd"]?.includes("Free Tier Allowance"), "Response header correctly marks Free Tier Allowance");

// 1.2 Invalid Authorization Bearer Token
const probe2 = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: { authorization: "Bearer sk-invalid-fixture" },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Write a concise report.",
        targetDialect: "openai-markdown",
      },
    },
  })
);
assert(probe2.statusCode === 401, `Invalid Authorization bearer rejected with HTTP 401 (got ${probe2.statusCode})`);
assert(probe2.body.error?.code === -32001, "Error code is -32001 (UNAUTHORIZED)");
assert(probe2.body.error?.message?.includes("Invalid API key credentials"), "Message explicitly explains invalid key credentials");

// 1.3 Invalid Entitlement Token
const probe3 = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: { "x-spe-entitlement-token": "invalid-fixture" },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Write a concise report.",
        targetDialect: "openai-markdown",
      },
    },
  })
);
assert(probe3.statusCode === 401, `Invalid x-spe-entitlement-token rejected with HTTP 401 (got ${probe3.statusCode})`);
assert(probe3.body.error?.code === -32001, "Error code is -32001 (UNAUTHORIZED)");
assert(probe3.body.error?.message?.includes("x-spe-entitlement-token"), "Message explicitly cites invalid entitlement token");

// ────────────────────────────────────────────────────────────────
// GATE 2: FREE TIER BOUNDARIES & PAID CAPABILITY ENFORCEMENT
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 2] Verifying Free Tier Boundaries & Paid Capability Enforcement...");

// 2.1 Unauthenticated request exceeding 5,000 characters
const oversizePrompt = "A".repeat(6000);
const freeOversize = await simulateHttpRequest(
  { path: "/api/v1/mcp", method: "POST", headers: {} },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: oversizePrompt,
        targetDialect: "openai-markdown",
      },
    },
  })
);
assert(freeOversize.statusCode === 402, `Unauthenticated request > 5,000 chars rejected with HTTP 402 Payment Required (got ${freeOversize.statusCode})`);
assert(freeOversize.body.error?.code === -32002, "Error code is -32002 (PAYMENT_REQUIRED)");
assert(freeOversize.body.error?.data?.errorType === "PAYMENT_REQUIRED", "Error data specifies PAYMENT_REQUIRED");

// 2.2 Unauthenticated request for Pro dialect (cursor-rules)
const freeProDialect = await simulateHttpRequest(
  { path: "/api/v1/mcp", method: "POST", headers: {} },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Build a web app.",
        targetDialect: "cursor-rules",
      },
    },
  })
);
assert(freeProDialect.statusCode === 402, `Unauthenticated request for Pro dialect rejected with HTTP 402 Payment Required (got ${freeProDialect.statusCode})`);
assert(freeProDialect.body.error?.message?.includes("Pro-tier capability"), "Message explains cursor-rules is a Pro capability");

// ────────────────────────────────────────────────────────────────
// GATE 3: AUTHENTICATED CUSTOMER PER-CALL USAGE METERING ($0.001 - $0.010)
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 3] Verifying Authenticated Customer Per-Call Usage Metering...");

// 3.1 Create test customer account with $10.00 prepaid credit
const { account: customer, apiKey } = usageEngine.createCustomerAccount({
  customerId: "cus_spe_acme_corp_01",
  email: "engineering@acme.corp",
  initialBalanceCents: 1000, // $10.00 = 1,000 cents
  isTest: false,
});
assert(customer.customerId === "cus_spe_acme_corp_01", "Customer account registered in usage engine");
assert(apiKey.startsWith("spe_live_"), "Generated API key has spe_live_ prefix");
assert(customer.balanceMicroCents === 10000000, "Starting balance is exactly 10,000,000 micro-cents ($10.0000)");

// 3.2 Standard Compilation: $0.001 (1,000 micro-cents)
const reqStandard = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-spe-request-id": "req_001_standard",
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Write a high-performance database schema.",
        targetDialect: "openai-markdown",
      },
    },
  })
);
assert(reqStandard.statusCode === 200, "Authenticated standard compilation returns HTTP 200");
assert(reqStandard.headers["x-spe-usage-charge-usd"] === "$0.001", "Charge header exactly $0.001");
assert(reqStandard.headers["x-spe-customer-id"] === customer.customerId, "Customer ID header attached");
assert(reqStandard.headers["x-spe-remaining-balance-usd"] === "9.9990", "Remaining balance is $9.9990");

// 3.3 Pro Compilation (Large prompt > 5,000 chars): $0.005 (5,000 micro-cents)
const reqPro = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-spe-request-id": "req_002_pro",
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "System Architecture Directive:\n" + "X".repeat(8000),
        targetDialect: "cursor-rules",
      },
    },
  })
);
assert(reqPro.statusCode === 200, "Authenticated Pro compilation returns HTTP 200");
assert(reqPro.headers["x-spe-usage-charge-usd"] === "$0.005", "Pro charge header exactly $0.005");
assert(reqPro.headers["x-spe-remaining-balance-usd"] === "9.9940", "Remaining balance is $9.9940");

// 3.4 Deep Reasoning / Giant Compilation (> 30,000 chars): $0.010 (10,000 micro-cents)
const reqGiant = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-spe-request-id": "req_003_giant",
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Master Enterprise Synthesis:\n" + "Z".repeat(35000),
        targetDialect: "claude-xml",
      },
    },
  })
);
assert(reqGiant.statusCode === 200, "Authenticated Giant compilation returns HTTP 200");
assert(reqGiant.headers["x-spe-usage-charge-usd"] === "$0.010", "Giant charge header exactly $0.010");
assert(reqGiant.headers["x-spe-remaining-balance-usd"] === "9.9840", "Remaining balance is $9.9840");

// 3.5 Idempotency Protection: Replaying with identical request ID does NOT charge twice
const reqReplay = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-spe-request-id": "req_003_giant", // identical request ID
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 12,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        promptText: "Master Enterprise Synthesis:\n" + "Z".repeat(35000),
        targetDialect: "claude-xml",
      },
    },
  })
);
assert(reqReplay.statusCode === 200, "Idempotent replay returns HTTP 200");
const updatedAcc = usageEngine.getCustomerAccount(customer.customerId);
assert(updatedAcc.balanceMicroCents === 9984000, "Balance remains $9.9840 (no duplicate debit on replay)");

// 3.6 Fail-Closed Zero-Charge on Tool Error
const reqError = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-spe-request-id": "req_004_error",
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 13,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: {
        // missing required promptText & targetDialect
      },
    },
  })
);
assert(reqError.body.error !== undefined, "Malformed tool call returns JSON-RPC error");
const accAfterError = usageEngine.getCustomerAccount(customer.customerId);
assert(accAfterError.balanceMicroCents === 9984000, "Balance unchanged on tool execution error ($0 charge)");

// 3.7 Customer-Scoped Request Idempotency Key Isolation (BILL-P0-06)
// Two distinct customers presenting the identical request ID must NOT collide.
const customerBData = usageEngine.createCustomerAccount({
  customerId: "cust_idempotency_b",
  email: "customerB@spe.dev",
  initialBalanceCents: 1000,
});

const reqCustA = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "x-spe-request-id": "shared_client_req_001",
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 99,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: { promptText: "Task for Customer A", targetDialect: "claude-xml" },
    },
  })
);
assert(reqCustA.statusCode === 200, "Customer A request with shared request ID returns HTTP 200");

const reqCustB = await simulateHttpRequest(
  {
    path: "/api/v1/mcp",
    method: "POST",
    headers: {
      authorization: `Bearer ${customerBData.apiKey}`,
      "x-spe-request-id": "shared_client_req_001",
    },
  },
  JSON.stringify({
    jsonrpc: "2.0",
    id: 99,
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: { promptText: "Task for Customer B", targetDialect: "claude-xml" },
    },
  })
);
assert(reqCustB.statusCode === 200, "Customer B request with same request ID is independently debited (customer-scoped idempotency)");
const accB = usageEngine.getCustomerAccount("cust_idempotency_b");
assert(accB.totalCalls === 1, "Customer B debited exactly once without cross-customer key collision");

// ────────────────────────────────────────────────────────────────
// GATE 4: STRIPE PAYMENT PROCESSOR & WEBHOOK SIGNATURE VERIFICATION
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 4] Verifying Stripe Processor & Authenticated Webhook Handling...");

// 4.1 Stripe Checkout Session Creation & Provenance Disclosure (BILL-P0-01)
const checkoutRes = await simulateHttpRequest(
  { path: "/api/v1/billing/checkout", method: "POST", headers: {} },
  JSON.stringify({
    customerId: customer.customerId,
    customerEmail: customer.email,
    mode: "payment",
    prepaidAmountUsd: 50,
  })
);
assert(checkoutRes.statusCode === 200, "Stripe Checkout session endpoint returns HTTP 200");
assert(checkoutRes.body.id.startsWith("cs_spe_"), "Checkout session has valid cs_spe_ identifier");
assert(checkoutRes.body.amountTotalCents === 5000, "Checkout session amountTotalCents is 5000 ($50.00)");
assert(checkoutRes.body.provenance === "SIMULATED_TEST_SANDBOX", "Checkout session provenance disclosed as SIMULATED_TEST_SANDBOX");

// 4.2 Authentic Stripe Webhook Processing (checkout.session.completed)
const stripePayload = JSON.stringify({
  id: "evt_stripe_test_checkout_001",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_stripe_001",
      client_reference_id: customer.customerId,
      mode: "payment",
      amount_total: 2000, // $20.00
      customer_details: { email: customer.email },
    },
  },
});

const authenticSig = stripeProcessor.signPayload(stripePayload);
const webhookRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": authenticSig },
  },
  stripePayload
);
assert(webhookRes.statusCode === 200, "Authentic Stripe webhook returns HTTP 200");
assert(webhookRes.body.received === true, "Webhook confirmed received");
assert(webhookRes.body.result?.actionTaken?.includes("CREDITED_PREPAID_BALANCE"), "Prepaid balance credited");

const accAfterCredit = usageEngine.getCustomerAccount(customer.customerId);
// Previous balance was 9,983,000 micro-cents (after 3.7 standard charge of 1,000 micro-cents) + $20.00 (20,000,000 micro-cents)
assert(accAfterCredit.balanceMicroCents === 29983000, `Balance after $20 top-up matches expected micro-cents (got ${accAfterCredit.balanceMicroCents})`);

// 4.2B Webhook Replay Protection: Replaying the exact same webhook event ID must NOT credit account again (BILL-P0-05)
const replayedWebhookRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": authenticSig },
  },
  stripePayload
);
assert(replayedWebhookRes.statusCode === 200, "Replayed Stripe webhook returns HTTP 200");
assert(replayedWebhookRes.body.result?.accountUpdated === false, "Replayed webhook marks accountUpdated = false");
assert(replayedWebhookRes.body.result?.actionTaken?.includes("IDEMPOTENT_IGNORED_DUPLICATE_EVENT"), "Replay recognized as duplicate event");
const accAfterReplay = usageEngine.getCustomerAccount(customer.customerId);
assert(accAfterReplay.balanceMicroCents === 29983000, "Balance remains unchanged after replayed webhook (zero duplicate credit)");

// 4.3 Tampered Stripe Webhook Signature Rejection
const tamperedSig = authenticSig.slice(0, -6) + "badbad";
const badWebhookRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": tamperedSig },
  },
  stripePayload
);
assert(badWebhookRes.statusCode === 400, `Tampered Stripe signature rejected with HTTP 400 (got ${badWebhookRes.statusCode})`);
assert(badWebhookRes.body.error === "WEBHOOK_VERIFICATION_FAILED", "Error code confirms WEBHOOK_VERIFICATION_FAILED");

// 4.4 Stale/Expired Stripe Webhook Timestamp Rejection (> 300s)
const staleTimestampSec = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
const staleSig = stripeProcessor.signPayload(stripePayload, staleTimestampSec);
const staleWebhookRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": staleSig },
  },
  stripePayload
);
assert(staleWebhookRes.statusCode === 400, "Expired Stripe signature timestamp rejected with HTTP 400");
assert(staleWebhookRes.body.message?.includes("STRIPE_SIGNATURE_EXPIRED"), "Message explicitly cites STRIPE_SIGNATURE_EXPIRED");

// 4.5 First-Payment New Account Accounting: amountCents passed directly (BILL-P0-03)
const newCustPayload = JSON.stringify({
  id: "evt_stripe_new_cust_topup_001",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_stripe_new_001",
      client_reference_id: "cust_first_payment_new",
      mode: "payment",
      amount_total: 5000, // 5000 cents = $50.00
      customer_details: { email: "firstpayment@spe.dev" },
    },
  },
});
const newCustSig = stripeProcessor.signPayload(newCustPayload);
const newCustRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": newCustSig },
  },
  newCustPayload
);
assert(newCustRes.statusCode === 200, "First payment webhook returns HTTP 200");
const firstPaymentAcc = usageEngine.getCustomerAccount("cust_first_payment_new");
assert(firstPaymentAcc !== undefined, "First payment account registered in usage engine");
assert(firstPaymentAcc.balanceMicroCents === 50000000, `First-payment account has exactly $50.00 credit (50,000,000 micro-cents, got ${firstPaymentAcc?.balanceMicroCents})`);

// 4.6 Webhook Secret Fallback Fail-Closed in Production (BILL-P0-02)
const prevNodeEnv = process.env.NODE_ENV;
const prevWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
process.env.NODE_ENV = "production";
delete process.env.STRIPE_WEBHOOK_SECRET;
let prodSecretFailedClosed = false;
try {
  new StripeProcessorAdapter({
    billingAuthority,
    usageEngine,
  });
} catch (err) {
  if (err.message?.includes("PRODUCTION_SECURITY_ERROR")) {
    prodSecretFailedClosed = true;
  }
} finally {
  process.env.NODE_ENV = prevNodeEnv;
  if (prevWebhookSecret) process.env.STRIPE_WEBHOOK_SECRET = prevWebhookSecret;
}
assert(prodSecretFailedClosed === true, "StripeProcessorAdapter strictly fails closed in production when webhook secret is missing");

// 4.7 Durable Webhook Deduplication Across Instance Restarts (BILL-P0-05)
const tmpLedgerPath = resolve(process.cwd(), `proofs/generated/test_durable_ledger_${Date.now()}.json`);
try {
  const durableUsageEngine = new UsageMeteringEngine({ storageFilePath: tmpLedgerPath });
  const durableAdapter1 = new StripeProcessorAdapter({
    webhookSecret: "whsec_test_secret_for_verification_suite",
    billingAuthority,
    usageEngine: durableUsageEngine,
  });
  const durableEvtPayload = JSON.stringify({
    id: "evt_stripe_durable_dedup_001",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_stripe_durable_001",
        client_reference_id: "cust_durable_test",
        mode: "payment",
        amount_total: 1000,
        customer_details: { email: "durable@spe.dev" },
      },
    },
  });
  const durableSig = durableAdapter1.signPayload(durableEvtPayload);
  const res1 = durableAdapter1.handleVerifiedStripeWebhook(durableEvtPayload, durableSig);
  assert(res1.accountUpdated === true, "Durable webhook initially processed and account updated");

  // Simulate server restart: create fresh UsageMeteringEngine and StripeProcessorAdapter from disk
  const reloadedUsageEngine = new UsageMeteringEngine({ storageFilePath: tmpLedgerPath });
  const durableAdapter2 = new StripeProcessorAdapter({
    webhookSecret: "whsec_test_secret_for_verification_suite",
    billingAuthority,
    usageEngine: reloadedUsageEngine,
  });
  assert(durableAdapter2.hasProcessedEvent("evt_stripe_durable_dedup_001") === true, "Reloaded adapter recognizes processed webhook event from durable storage");
  const res2 = durableAdapter2.handleVerifiedStripeWebhook(durableEvtPayload, durableSig);
  assert(res2.accountUpdated === false, "Replayed webhook after server restart strictly rejected with accountUpdated=false");
  assert(res2.actionTaken.includes("IDEMPOTENT_IGNORED_DUPLICATE_EVENT"), "Action confirms idempotent duplicate event ignored across restart");
} finally {
  if (existsSync(tmpLedgerPath)) unlinkSync(tmpLedgerPath);
}

// 4.8 Fail-Closed Production Checks (BILL-P0-02/BILL-P0-04/BILL-P0-01)
const prevNodeEnv2 = process.env.NODE_ENV;
const prevAdminSec = process.env.SPE_ADMIN_SECRET;
const prevBillingSec = process.env.SPE_BILLING_ADMIN_SECRET;
process.env.NODE_ENV = "production";
delete process.env.SPE_ADMIN_SECRET;
delete process.env.SPE_BILLING_ADMIN_SECRET;
let adminSecretFailedClosed = false;
try {
  new McpProductionServer({ stripeWebhookSecret: "whsec_test_secret" });
} catch (err) {
  if (err.message?.includes("PRODUCTION_SECURITY_ERROR: SPE_ADMIN_SECRET")) {
    adminSecretFailedClosed = true;
  }
}
assert(adminSecretFailedClosed === true, "McpProductionServer fails closed in production when SPE_ADMIN_SECRET is missing");

const prevStripeKey = process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_SECRET_KEY;
let checkoutSecretFailedClosed = false;
try {
  const prodStripeProcessor = new StripeProcessorAdapter({
    webhookSecret: "whsec_prod_secret",
    billingAuthority,
    usageEngine,
  });
  await prodStripeProcessor.createCheckoutSession({
    customerId: "cust_test_prod",
    customerEmail: "prod@spe.dev",
    mode: "payment",
    successUrl: "https://systempromptengine.com/success",
    cancelUrl: "https://systempromptengine.com/cancel",
  });
} catch (err) {
  if (err.message?.includes("PRODUCTION_SECURITY_ERROR: STRIPE_SECRET_KEY")) {
    checkoutSecretFailedClosed = true;
  }
} finally {
  process.env.NODE_ENV = prevNodeEnv2;
  if (prevAdminSec) process.env.SPE_ADMIN_SECRET = prevAdminSec;
  if (prevBillingSec) process.env.SPE_BILLING_ADMIN_SECRET = prevBillingSec;
  if (prevStripeKey) process.env.STRIPE_SECRET_KEY = prevStripeKey;
}
assert(checkoutSecretFailedClosed === true, "StripeProcessorAdapter fails closed in production when creating checkout session without STRIPE_SECRET_KEY");

// 4.9 Live Stripe API Checkout Session creation with mocked fetch (BILL-P0-01)
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "cs_live_stripe_mock_001", url: "https://checkout.stripe.com/c/pay/cs_live_stripe_mock_001" }),
    };
  };
  const liveStripeProcessor = new StripeProcessorAdapter({
    webhookSecret: "whsec_test_secret",
    stripeSecretKey: "sk_live_spe_real_key_simulated",
    billingAuthority,
    usageEngine,
  });
  const liveSession = await liveStripeProcessor.createCheckoutSession({
    customerId: "cust_live_test",
    customerEmail: "live@spe.dev",
    mode: "payment",
    successUrl: "https://systempromptengine.com/success",
    cancelUrl: "https://systempromptengine.com/cancel",
  });
  assert(liveSession.provenance === "LIVE_STRIPE_API", "Checkout session reports provenance LIVE_STRIPE_API when secret key is provided");
  assert(liveSession.id === "cs_live_stripe_mock_001", "Live session ID matches Stripe API response");
} finally {
  globalThis.fetch = originalFetch;
}

// ────────────────────────────────────────────────────────────────
// GATE 5: STRIPE USAGE METER EVENT EXPORT & RECONCILIATION
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 5] Verifying Stripe Meter Events Export & Ledger Reconciliation...");

// 5.1 Export Stripe Meter Events
const meterEvents = usageEngine.exportStripeMeterEvents();
assert(Array.isArray(meterEvents) && meterEvents.length >= 3, `Exported ${meterEvents.length} Stripe meter events`);
assert(meterEvents[0].event_name === "spe_prompt_compilation", "Event name matches 'spe_prompt_compilation'");
assert(meterEvents[0].payload.stripe_customer_id === customer.customerId, "Customer ID committed in payload");
assert(meterEvents[0].payload.value === "1", "Meter event unit value is 1");
assert(typeof meterEvents[0].payload.micro_cents === "number", "Micro-cents rate attached to meter event");

// 5.2 Ledger Mathematical Reconciliation
const reconciliation = usageEngine.reconcileCustomer(customer.customerId);
assert(reconciliation.reconciled === true, "Ledger mathematically reconciled with 0 micro-cent discrepancy");
assert(reconciliation.totalDebitedCents === 1.7, `Total debited is exactly 1.7 cents ($0.0170) (got ${reconciliation.totalDebitedCents})`);
assert(reconciliation.activeRecordsCount === 4, "Exactly 4 debited usage events in journal");

// 5.3 Health Endpoint Audit & 24/7 Zero-Downtime Guarantee
const healthRes = await simulateHttpRequest(
  { path: "/api/v1/health", method: "GET", headers: {} },
  ""
);
assert(healthRes.statusCode === 200, "Health check endpoint returns HTTP 200");
assert(healthRes.body.billing?.activeMeterRates?.standardCompile === "$0.001", "Health endpoint publishes $0.001 standard rate");
assert(healthRes.body.billing?.activeMeterRates?.proCompile === "$0.005", "Health endpoint publishes $0.005 pro rate");
assert(healthRes.body.billing?.activeMeterRates?.deepReasoning === "$0.010", "Health endpoint publishes $0.010 deep reasoning rate");
assert(healthRes.body.billing?.universalWebFreeCeilingChars === 30000, "Health endpoint discloses 30,000 char free output ceiling (PRODUCT-P0-01)");
assert(healthRes.body.zeroDowntimeGuaranteed === true, "Health endpoint confirms zero-downtime serving guarantee");
assert(healthRes.body.availability === "24/7/365_WORLDWIDE_NON_BLOCKING", "Health endpoint publishes 24/7 worldwide non-blocking availability");
assert(healthRes.body.servingArchitecture === "READ_COPY_UPDATE_ATOMIC_HOT_SWAP", "Health endpoint confirms RCU atomic hot-swap serving architecture");
assert(healthRes.body.timezoneIsolation?.usBusinessHoursProtected === true, "Health endpoint confirms US business hours protected against maintenance downtime");
assert(healthRes.body.timezoneIsolation?.servingInterruptionDuringMaintenance === false, "Health endpoint confirms zero serving interruption during background maintenance");

// 5.4 Protected Billing Endpoints Authorization Check (BILL-P0-04)
const unauthMeterRes = await simulateHttpRequest(
  { path: "/api/v1/billing/meter-events", method: "GET", headers: {} },
  ""
);
assert(unauthMeterRes.statusCode === 401, "Unauthenticated GET /api/v1/billing/meter-events rejected with HTTP 401");
assert(unauthMeterRes.body.error === "UNAUTHORIZED", "Error specifies UNAUTHORIZED");

const authMeterRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/meter-events",
    method: "GET",
    headers: { authorization: "Bearer spe_admin_secret_auth_token_prod_v1" },
  },
  ""
);
assert(authMeterRes.statusCode === 200, "Authenticated GET /api/v1/billing/meter-events with admin key returns HTTP 200");

const unauthCustReconcile = await simulateHttpRequest(
  { path: `/api/v1/billing/customer/${customer.customerId}`, method: "GET", headers: {} },
  ""
);
assert(unauthCustReconcile.statusCode === 401, "Unauthenticated customer reconciliation endpoint rejected with HTTP 401");

const authCustReconcile = await simulateHttpRequest(
  {
    path: `/api/v1/billing/customer/${customer.customerId}`,
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
  },
  ""
);
assert(authCustReconcile.statusCode === 200, "Customer accessing their own reconciliation with valid API key returns HTTP 200");

// 5.5 Fail-Closed Execution Exception Debit Refund Policy
const balanceBeforeCrash = usageEngine.getCustomerAccount(customer.customerId).balanceMicroCents;
const crashMcpServer = new McpProductionServer({
  usageEngine,
  billingAuthority,
  stripeProcessor,
  adminSecret: "spe_admin_secret_auth_token_prod_v1",
});
// Override handleJsonRpcRequest to simulate an unexpected crash/throw during execution
crashMcpServer["mcpServer"].handleJsonRpcRequest = async () => {
  throw new Error("SIMULATED_DOWNSTREAM_CRASH");
};
const crashHttpServer = crashMcpServer.createHttpServer();
const crashRes = await new Promise((resResolve) => {
  const req = new EventEmitter();
  Object.assign(req, {
    url: "/api/v1/mcp",
    method: "POST",
    socket: { remoteAddress: "127.0.0.1" },
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  const crashPayload = JSON.stringify({
    jsonrpc: "2.0",
    id: "req_crash_test",
    method: "tools/call",
    params: {
      name: "compile_for_model",
      arguments: { promptText: "Test crash refund", targetDialect: "claude-xml" },
    },
  });
  let bodyStr = "";
  const res = {
    setHeader: () => {},
    statusCode: 200,
    end: (chunk) => {
      if (chunk) bodyStr += chunk;
      resResolve({ statusCode: res.statusCode, body: bodyStr ? JSON.parse(bodyStr) : null });
    },
  };
  crashHttpServer.emit("request", req, res);
  req.emit("data", Buffer.from(crashPayload));
  req.emit("end");
});
assert(crashRes.statusCode === 400, "Crashed tool execution returns HTTP 400");
const balanceAfterCrash = usageEngine.getCustomerAccount(customer.customerId).balanceMicroCents;
assert(balanceAfterCrash === balanceBeforeCrash, "Customer balance is strictly refunded and unchanged on downstream execution crash");

// ────────────────────────────────────────────────────────────────
// GATE 6: ADVANCED BILLING REPAIR VERIFICATIONS (BILL-P0-07, 08, 09)
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 6] Verifying Subscription Cancellation, Refund Entitlement Revocation, and Atomic Transactions...");

// 6.1 BILL-P0-07: Subscription Cancellation revokes entitlement and downgrades to free
const subCustId = "cust_sub_test_revocation";
usageEngine.createCustomerAccount({
  customerId: subCustId,
  email: "sub_test@spe.dev",
  tier: "pro",
  initialBalanceCents: 1000,
});
const subAccountBefore = usageEngine.getCustomerAccount(subCustId);
assert(subAccountBefore.tier === "pro", "Subscription customer starts at Pro tier");

const cancelWebhookPayload = JSON.stringify({
  id: "evt_sub_del_test_001",
  object: "event",
  type: "customer.subscription.deleted",
  data: {
    object: {
      id: "sub_del_test_001",
      customer: subCustId,
      client_reference_id: subCustId,
    },
  },
});
const cancelSig = stripeProcessor.signPayload(cancelWebhookPayload);
const cancelRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": cancelSig },
  },
  cancelWebhookPayload
);
assert(cancelRes.statusCode === 200, "Subscription deleted webhook returns HTTP 200");
const subAccountAfter = usageEngine.getCustomerAccount(subCustId);
assert(subAccountAfter.tier === "free", "Subscription cancellation revokes Pro tier and downgrades to free");
assert(subAccountAfter.subscriptionStatus === "CANCELED", "Account subscription status is CANCELED");

// 6.2 BILL-P0-07: Charge Refund reverses balance and revokes entitlement when balance reaches zero
const refundCustId = "cust_refund_test_001";
usageEngine.createCustomerAccount({
  customerId: refundCustId,
  email: "refund_test@spe.dev",
  tier: "pro",
  initialBalanceCents: 5000, // $50.00
});
const refundWebhookPayload = JSON.stringify({
  id: "evt_charge_refund_test_001",
  object: "event",
  type: "charge.refunded",
  data: {
    object: {
      payment_intent: "pi_refund_test_001",
      customer: refundCustId,
      client_reference_id: refundCustId,
      amount_refunded: 5000, // full $50 refund
    },
  },
});
const refundSig = stripeProcessor.signPayload(refundWebhookPayload);
const refundRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": refundSig },
  },
  refundWebhookPayload
);
assert(refundRes.statusCode === 200, "Charge refunded webhook returns HTTP 200");
const refundAccountAfter = usageEngine.getCustomerAccount(refundCustId);
assert(refundAccountAfter.balanceMicroCents === 0, "Refunded customer balance is deducted to 0");
assert(refundAccountAfter.tier === "free", "Customer downgraded to free on full refund");
assert(refundAccountAfter.subscriptionStatus === "REVOKED", "Customer subscription status marked REVOKED on refund");

// 6.3 BILL-P0-08: Atomic Webhook Accounting Transaction
const atomicCustId = "cust_atomic_txn_001";
const atomicEventId = "evt_atomic_test_999";
const atomicTxn = usageEngine.applyWebhookTransaction({
  eventId: atomicEventId,
  customerId: atomicCustId,
  action: "credit_balance",
  amountCents: 2500,
});
assert(atomicTxn.success === true, "Atomic transaction succeeded");
assert(usageEngine.hasProcessedWebhookEvent(atomicEventId) === true, "Processed event ID durably recorded in same commit");
assert(usageEngine.getCustomerAccount(atomicCustId).balanceMicroCents === 25000000, "Customer balance credited in same atomic commit");

// Replay atomic transaction
const atomicReplay = usageEngine.applyWebhookTransaction({
  eventId: atomicEventId,
  customerId: atomicCustId,
  action: "credit_balance",
  amountCents: 2500,
});
assert(atomicReplay.alreadyProcessed === true, "Atomic transaction recognized as duplicate on replay");
assert(atomicReplay.accountUpdated === false, "Zero duplicate credit on replay");
assert(usageEngine.getCustomerAccount(atomicCustId).balanceMicroCents === 25000000, "Balance unchanged on atomic replay");

// 6.4 BILL-P0-09: Stronger Business Validation (Currency & Amount)
const badCurrencyPayload = JSON.stringify({
  id: "evt_bad_curr_001",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      client_reference_id: "cust_bad_curr",
      currency: "eur", // Non-USD currency
      amount_total: 1000,
      mode: "payment",
    },
  },
});
const badCurrSig = stripeProcessor.signPayload(badCurrencyPayload);
const badCurrRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": badCurrSig },
  },
  badCurrencyPayload
);
assert(badCurrRes.statusCode === 400, "Non-USD currency checkout strictly rejected with HTTP 400");
assert(badCurrRes.body.message.includes("INVALID_CURRENCY"), "Error cites INVALID_CURRENCY");

const zeroAmountPayload = JSON.stringify({
  id: "evt_zero_amt_001",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      client_reference_id: "cust_zero_amt",
      currency: "usd",
      amount_total: 0, // <= 0 amount
      mode: "payment",
    },
  },
});
const zeroAmtSig = stripeProcessor.signPayload(zeroAmountPayload);
const zeroAmtRes = await simulateHttpRequest(
  {
    path: "/api/v1/billing/webhook/stripe",
    method: "POST",
    headers: { "stripe-signature": zeroAmtSig },
  },
  zeroAmountPayload
);
assert(zeroAmtRes.statusCode === 400, "Zero-amount payment session strictly rejected with HTTP 400");
assert(zeroAmtRes.body.message.includes("INVALID_PAYMENT_AMOUNT"), "Error cites INVALID_PAYMENT_AMOUNT");

console.log("\n==================================================================");
console.log(`🎉 ALL ${passedTests}/${totalTests} PER-CALL METERING & STRIPE TESTS PASSED CLEANLY (100%)!`);
console.log("==================================================================");
