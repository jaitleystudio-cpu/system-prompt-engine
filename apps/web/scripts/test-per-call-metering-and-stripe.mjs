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

// ────────────────────────────────────────────────────────────────
// GATE 4: STRIPE PAYMENT PROCESSOR & WEBHOOK SIGNATURE VERIFICATION
// ────────────────────────────────────────────────────────────────
console.log("\n[GATE 4] Verifying Stripe Processor & Authenticated Webhook Handling...");

// 4.1 Stripe Checkout Session Creation
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
// Previous balance was 9,984,000 micro-cents ($9.9840) + $20.00 (20,000,000 micro-cents) = 29,984,000 micro-cents ($29.9840)
assert(accAfterCredit.balanceMicroCents === 29984000, `Balance after $20 top-up is $29.9840 (got ${(accAfterCredit.balanceMicroCents / 1000000).toFixed(4)})`);

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
assert(reconciliation.totalDebitedCents === 1.6, `Total debited is exactly 1.6 cents ($0.0160) (got ${reconciliation.totalDebitedCents})`);
assert(reconciliation.activeRecordsCount === 3, "Exactly 3 debited usage events in journal");

// 5.3 Health Endpoint Audit
const healthRes = await simulateHttpRequest(
  { path: "/api/v1/health", method: "GET", headers: {} },
  ""
);
assert(healthRes.statusCode === 200, "Health check endpoint returns HTTP 200");
assert(healthRes.body.billing?.activeMeterRates?.standardCompile === "$0.001", "Health endpoint publishes $0.001 standard rate");
assert(healthRes.body.billing?.activeMeterRates?.proCompile === "$0.005", "Health endpoint publishes $0.005 pro rate");
assert(healthRes.body.billing?.activeMeterRates?.deepReasoning === "$0.010", "Health endpoint publishes $0.010 deep reasoning rate");
assert(healthRes.body.billing?.payoutSchedule?.includes("Standard merchant account schedule"), "Health endpoint accurately discloses bank payout settlement schedule");

console.log("\n==================================================================");
console.log(`🎉 ALL ${passedTests}/${totalTests} PER-CALL METERING & STRIPE TESTS PASSED CLEANLY (100%)!`);
console.log("==================================================================");
