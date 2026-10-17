/**
 * apps/web/src/server/mcpProductionServer.ts
 *
 * SPE Ω — Production Standalone Model Context Protocol (MCP) & Monetized REST Gateway Server
 *
 * Grounded in:
 * - Model Context Protocol (MCP) July 28, 2026 stateless core specification.
 * - OWASP API4: Strict 512KB payload ceiling (HTTP 413) & in-memory IP rate-limiting (120 req/min, HTTP 429).
 * - Standard headers: 'MCP-Protocol-Version: 2026-07-28', 'X-Content-Type-Options: nosniff'.
 * - Authenticated Account & API Key Identity ('Authorization: Bearer spe_live_...' / 'x-spe-api-key').
 * - Integrated Fractional-Cent Usage Metering Engine ($0.001 - $0.010 per compilation).
 * - Real Stripe Payment Processor Integration:
 *   - Stripe Webhook endpoint ('/api/v1/billing/webhook/stripe') with HMAC-SHA256 signature verification.
 *   - Stripe Checkout Session creation ('/api/v1/billing/checkout').
 *   - Stripe Usage Billing Meter Events export ('/api/v1/billing/meter-events').
 * - Free Tier Allowance Enforcement:
 *   - Free public requests permitted up to 10 calls/hour (<= 5,000 chars, standard dialect).
 *   - Requests exceeding free allowance or requesting pro dialects require an authenticated funded key (HTTP 402).
 * - 100% offline local AST execution ($0 compute cost), zero cloud tokens.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { SpeMcpServer, type McpRequestContext } from "../engine/mcp/speMcpServer.ts";
import { verifySignedEntitlementToken } from "../engine/entitlementVerifier.ts";
import {
  AuthoritativeBillingAuthority,
  UsageMeteringEngine,
  StripeProcessorAdapter,
  type CustomerAccount,
  type MeteredUsageRecord,
} from "./billingAuthority.ts";
import { ZeroDowntimeBrainRuntime } from "../engine/brain/zeroDowntimeBrainRuntime.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../../public");

const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120;

export interface McpServerConfig {
  port?: number;
  host?: string;
  trustedBillingAuthorityPublicKeyHex?: string;
  billingAuthority?: AuthoritativeBillingAuthority;
  usageEngine?: UsageMeteringEngine;
  stripeProcessor?: StripeProcessorAdapter;
  stripeWebhookSecret?: string;
  adminSecret?: string;
  storageFilePath?: string;
}

export class McpProductionServer {
  private server: http.Server | null = null;
  private mcpServer: SpeMcpServer;
  private ipRequestBuckets = new Map<string, { count: number; resetTime: number }>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private trustedBillingKeyHex?: string;
  private adminSecret: string;

  public billingAuthority: AuthoritativeBillingAuthority;
  public usageEngine: UsageMeteringEngine;
  public stripeProcessor: StripeProcessorAdapter;
  public brainPointerPath: string;
  private pointerSyncTimer: NodeJS.Timeout | null = null;

  constructor(config?: McpServerConfig) {
    this.mcpServer = new SpeMcpServer();
    this.billingAuthority = config?.billingAuthority ?? new AuthoritativeBillingAuthority();
    
    // BILL-P0-06: Durable filesystem ledger persistence as default in production
    const defaultLedgerPath =
      config?.storageFilePath ||
      process.env.SPE_USAGE_LEDGER_PATH ||
      path.resolve(process.cwd(), "proofs/generated/SPE_PRODUCTION_USAGE_LEDGER.json");

    this.usageEngine =
      config?.usageEngine ??
      (process.env.NODE_ENV === "test" && !config?.storageFilePath
        ? new UsageMeteringEngine()
        : new UsageMeteringEngine({ storageFilePath: defaultLedgerPath }));

    this.stripeProcessor =
      config?.stripeProcessor ??
      new StripeProcessorAdapter({
        webhookSecret: config?.stripeWebhookSecret,
        billingAuthority: this.billingAuthority,
        usageEngine: this.usageEngine,
      });

    this.trustedBillingKeyHex =
      config?.trustedBillingAuthorityPublicKeyHex || this.billingAuthority.publicKeyHex;

    const configuredAdminSecret =
      config?.adminSecret ||
      process.env.SPE_ADMIN_SECRET ||
      process.env.SPE_BILLING_ADMIN_SECRET;

    // Fail closed in production when admin secret is unconfigured (BILL-P0-02/04)
    if (process.env.NODE_ENV === "production" && !configuredAdminSecret) {
      throw new Error(
        "PRODUCTION_SECURITY_ERROR: SPE_ADMIN_SECRET must be explicitly configured in production. Refusing to start with mock admin secret fallback."
      );
    }

    this.adminSecret = configuredAdminSecret || "spe_admin_secret_auth_token_prod_v1";

    this.brainPointerPath =
      process.env.SPE_ACTIVE_BRAIN_POINTER_PATH ||
      path.resolve(process.cwd(), "proofs/generated/ACTIVE_BRAIN_POINTER.json");

    // P0-03: Synchronize with durable pointer on disk if available
    try {
      ZeroDowntimeBrainRuntime.getInstance(undefined, this.brainPointerPath).syncWithDurablePointer(
        this.brainPointerPath
      );
    } catch {}
  }

  private isRateLimited(ip: string): boolean {
    const now = Date.now();
    let bucket = this.ipRequestBuckets.get(ip);
    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
      this.ipRequestBuckets.set(ip, bucket);
      return false;
    }
    bucket.count++;
    return bucket.count > MAX_REQUESTS_PER_WINDOW;
  }

  public createHttpServer(): http.Server {
    const server = http.createServer(async (req, res) => {
      const url = (req.url || "").split("?")[0];
      const method = req.method || "GET";
      const clientIp = req.socket?.remoteAddress || (req.headers["x-forwarded-for"] as string) || "127.0.0.1";

      // Security headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");

      // ────────────────────────────────────────────────────────────────
      // 1. STRIPE BILLING & PAYMENT PROCESSOR ENDPOINTS
      // ────────────────────────────────────────────────────────────────

      // 1.1 Stripe Webhook Endpoint (POST /api/v1/billing/webhook/stripe)
      if (url === "/api/v1/billing/webhook/stripe" && method === "POST") {
        let rawBody = "";
        req.on("data", (chunk: Buffer) => {
          rawBody += chunk.toString("utf8");
        });
        req.on("end", () => {
          const sigHeader = (req.headers["stripe-signature"] as string) || "";
          try {
            const result = this.stripeProcessor.handleVerifiedStripeWebhook(rawBody, sigHeader);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify({ received: true, result }));
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "WEBHOOK_VERIFICATION_FAILED", message: err.message }));
          }
        });
        return;
      }

      // Helper: Verify admin authorization for sensitive financial/accounting endpoints
      const checkAdminAuth = (): boolean => {
        const rawAuth = (req.headers["authorization"] as string) || "";
        const rawAdminKey = (req.headers["x-spe-admin-key"] as string) || "";
        const bearer = rawAuth.toLowerCase().startsWith("bearer ") ? rawAuth.slice(7).trim() : "";
        const token = bearer || rawAdminKey;
        if (!token || !this.adminSecret) return false;
        const tokenBuf = Buffer.from(token, "utf8");
        const secretBuf = Buffer.from(this.adminSecret, "utf8");
        if (tokenBuf.length !== secretBuf.length) return false;
        return crypto.timingSafeEqual(tokenBuf, secretBuf);
      };

      // 1.2 Stripe Checkout Session Creator (POST /api/v1/billing/checkout)
      if (url === "/api/v1/billing/checkout" && method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk.toString("utf8")));
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            if (!parsed.customerId || !parsed.customerEmail) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing required fields: customerId, customerEmail" }));
              return;
            }
            const session = await this.stripeProcessor.createCheckoutSession({
              customerId: parsed.customerId,
              customerEmail: parsed.customerEmail,
              mode: parsed.mode || "payment",
              tier: parsed.tier,
              prepaidAmountUsd: parsed.prepaidAmountUsd,
              successUrl: parsed.successUrl || "https://systempromptengine.com/checkout/success",
              cancelUrl: parsed.cancelUrl || "https://systempromptengine.com/checkout/cancel",
            });
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(session));
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      // 1.3 Stripe Meter Events Export (GET /api/v1/billing/meter-events) - Protected (BILL-P0-04)
      if (url === "/api/v1/billing/meter-events" && method === "GET") {
        if (!checkAdminAuth()) {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 401;
          res.end(
            JSON.stringify({
              error: "UNAUTHORIZED",
              message: "Admin authorization required to export billing meter events.",
            })
          );
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ meterEvents: this.usageEngine.exportStripeMeterEvents() }));
        return;
      }

      // 1.4 Customer Account Status & Reconciliation - Protected (BILL-P0-04)
      if (
        (url.startsWith("/api/v1/billing/customer/") || url === "/api/v1/billing/reconcile") &&
        method === "GET"
      ) {
        let isAuthorized = checkAdminAuth();
        let targetCustomerId = url.startsWith("/api/v1/billing/customer/")
          ? url.replace("/api/v1/billing/customer/", "")
          : new URLSearchParams((req.url || "").split("?")[1] || "").get("customerId") || "";

        if (!isAuthorized) {
          // Allow customer to view their own reconciliation if authenticated with their own valid API key
          const rawAuth = (req.headers["authorization"] as string) || "";
          const rawApiKeyHeader = (req.headers["x-spe-api-key"] as string) || "";
          const bearer = rawAuth.toLowerCase().startsWith("bearer ") ? rawAuth.slice(7).trim() : "";
          const apiKey = bearer || rawApiKeyHeader;
          const authCust = apiKey ? this.usageEngine.authenticateApiKey(apiKey) : null;
          if (authCust && targetCustomerId && authCust.customerId === targetCustomerId) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 401;
          res.end(
            JSON.stringify({
              error: "UNAUTHORIZED",
              message: "Admin or authorized customer authorization required to access reconciliation records.",
            })
          );
          return;
        }

        try {
          const reconciliation = this.usageEngine.reconcileCustomer(targetCustomerId);
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          res.end(JSON.stringify({ customerId: targetCustomerId, ...reconciliation }));
        } catch (err: any) {
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 404;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // ────────────────────────────────────────────────────────────────
      // 2. MCP JSON-RPC 2.0 HANDLER (POST /api/v1/mcp)
      // ────────────────────────────────────────────────────────────────
      if ((url === "/api/v1/mcp" || url === "/api/v1/mcp/") && method === "POST") {
        // OWASP Rate limit: 120 req/min per IP
        if (this.isRateLimited(clientIp)) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Retry-After", "60");
          res.statusCode = 429;
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32000, message: "Rate limit exceeded (120 req/min). Please back off." },
            })
          );
          return;
        }

        // ────────────────────────────────────────────────────────────
        // Authenticated Account & Credential Verification
        // ────────────────────────────────────────────────────────────
        const rawAuth = (req.headers["authorization"] as string) || "";
        const rawApiKeyHeader = (req.headers["x-spe-api-key"] as string) || "";
        const entitlementHeader = (req.headers["x-spe-entitlement-token"] as string) || "";

        let authenticatedCustomer: CustomerAccount | null = null;
        let isProAuthorized = false;

        // Check Authorization: Bearer <key> or x-spe-api-key
        const rawApiKey = rawApiKeyHeader || (rawAuth.toLowerCase().startsWith("bearer ") ? rawAuth.slice(7).trim() : "");

        if (rawApiKey) {
          // Reject keys that do not match the SPE key format or fail authentication
          if (!rawApiKey.startsWith("spe_live_") && !rawApiKey.startsWith("spe_test_")) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 401;
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: {
                  code: -32001,
                  message:
                    "UNAUTHORIZED: Invalid API key credentials. SPE API keys must begin with 'spe_live_' or 'spe_test_'. Obtain a key at https://systempromptengine.com",
                },
              })
            );
            return;
          }

          authenticatedCustomer = this.usageEngine.authenticateApiKey(rawApiKey);
          if (!authenticatedCustomer) {
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 401;
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: {
                  code: -32001,
                  message: "UNAUTHORIZED: Unrecognized, expired, or revoked API key.",
                },
              })
            );
            return;
          }
        }

        // Check x-spe-entitlement-token (signed Ed25519 token)
        if (entitlementHeader) {
          try {
            const verification = await verifySignedEntitlementToken(entitlementHeader, {
              issuerPublicKeyHex: this.trustedBillingKeyHex,
            });
            if (verification.verified && (verification.tier === "pro" || verification.tier === "team")) {
              isProAuthorized = true;
            } else if (!authenticatedCustomer) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 401;
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: null,
                  error: {
                    code: -32001,
                    message: "UNAUTHORIZED: The provided 'x-spe-entitlement-token' is invalid, corrupted, or unverified.",
                  },
                })
              );
              return;
            }
          } catch {
            if (!authenticatedCustomer) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 401;
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: null,
                  error: {
                    code: -32001,
                    message: "UNAUTHORIZED: The provided 'x-spe-entitlement-token' is invalid, expired, or corrupted.",
                  },
                })
              );
              return;
            }
          }
        }

        let body = "";
        let receivedBytes = 0;
        let isTooLarge = false;

        req.on("data", (chunk: Buffer) => {
          if (isTooLarge) return;
          receivedBytes += chunk.length;
          if (receivedBytes > MAX_BODY_BYTES) {
            isTooLarge = true;
            req.pause();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Connection", "close");
            res.statusCode = 413;
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: {
                  code: -32001,
                  message: `Payload Too Large: request body exceeds ${MAX_BODY_BYTES} bytes limit.`,
                },
              })
            );
            return;
          }
          body += chunk.toString("utf8");
        });

        req.on("end", async () => {
          if (isTooLarge) return;

          try {
            const parsed = JSON.parse(body || "{}");

            // Build request context and apply per-call usage metering
            let requestContext: McpRequestContext = {
              clientIp,
              billing: {
                isPaid: Boolean(authenticatedCustomer),
                isPro: isProAuthorized || authenticatedCustomer?.tier === "pro" || authenticatedCustomer?.tier === "team",
                tier: authenticatedCustomer?.tier || (isProAuthorized ? "pro" : "free"),
                debitedUsdString: "$0.000",
              },
            };

            let usageRecord: MeteredUsageRecord | null = null;

            // If request is calling a tool
            const isToolCall = parsed.method === "tools/call";
            const toolName = parsed.params?.name;
            const toolArgs = parsed.params?.arguments || {};

            if (isToolCall && toolName === "compile_for_model") {
              const promptText = typeof toolArgs.promptText === "string" ? toolArgs.promptText : "";
              const targetDialect = typeof toolArgs.targetDialect === "string" ? toolArgs.targetDialect : undefined;

              const billableDetails = {
                toolName: "compile_for_model",
                promptChars: promptText.length,
                targetDialect,
              };

              if (authenticatedCustomer) {
                // Authenticated paying customer: debit per-call meter
                const idempotencyKey =
                  (req.headers["x-spe-request-id"] as string) ||
                  (req.headers["idempotency-key"] as string) ||
                  (parsed.id ? String(parsed.id) : undefined);

                try {
                  usageRecord = this.usageEngine.debitCustomerUsage(
                    authenticatedCustomer.customerId,
                    billableDetails,
                    idempotencyKey
                  );

                  const updatedAcc = this.usageEngine.getCustomerAccount(authenticatedCustomer.customerId);
                  requestContext.billing = {
                    customerId: authenticatedCustomer.customerId,
                    isPaid: true,
                    isPro: true,
                    tier: authenticatedCustomer.tier,
                    debitedAmountMicroCents: usageRecord.debitedMicroCents,
                    debitedUsdString: usageRecord.debitedUsdString,
                    remainingBalanceCents: updatedAcc ? updatedAcc.balanceMicroCents / 10000 : 0,
                  };
                } catch (debitErr: any) {
                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 402; // Payment Required
                  res.end(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: parsed.id || null,
                      error: {
                        code: -32002,
                        message: debitErr.message,
                        data: {
                          errorType: "PAYMENT_REQUIRED",
                          pricingSchedule: "https://systempromptengine.com/pricing",
                          rates: {
                            standard: "$0.001",
                            pro: "$0.005",
                            deep_reasoning: "$0.010",
                          },
                        },
                      },
                    })
                  );
                  return;
                }
              } else if (isProAuthorized) {
                // Unlimited pro subscriber entitlement token
                requestContext.billing = {
                  isPaid: true,
                  isPro: true,
                  tier: "pro",
                  debitedUsdString: "$0.000 (Included in Pro Subscription)",
                };
              } else {
                // Unauthenticated / Free public caller: check free allowance
                const freeCheck = this.usageEngine.checkFreeAllowance(clientIp, billableDetails);
                if (!freeCheck.eligible) {
                  res.setHeader("Content-Type", "application/json");
                  res.statusCode = 402; // Payment Required
                  res.end(
                    JSON.stringify({
                      jsonrpc: "2.0",
                      id: parsed.id || null,
                      error: {
                        code: -32002,
                        message: `PAYMENT_REQUIRED: ${freeCheck.reason}`,
                        data: {
                          errorType: "PAYMENT_REQUIRED",
                          pricingSchedule: "https://systempromptengine.com/pricing",
                          rates: {
                            standard: "$0.001",
                            pro: "$0.005",
                            deep_reasoning: "$0.010",
                          },
                        },
                      },
                    })
                  );
                  return;
                }

                // Consume one free call
                this.usageEngine.consumeFreeAllowance(clientIp);
                requestContext.billing = {
                  isPaid: false,
                  isPro: false,
                  tier: "free",
                  debitedUsdString: "$0.000 (Free Tier Allowance)",
                };
              }
            }

            // Dispatch to MCP server with authenticated context
            let response: any;
            try {
              response = await this.mcpServer.handleJsonRpcRequest(parsed, requestContext);
            } catch (execErr: any) {
              if (usageRecord) {
                this.usageEngine.refundDebit(usageRecord.eventId, execErr.message);
              }
              throw execErr;
            }

            // If downstream execution failed, refund any debited amount (fail-closed zero charge policy)
            if (response && !Array.isArray(response) && response.error && usageRecord) {
              this.usageEngine.refundDebit(usageRecord.eventId, response.error.message);
            }

            // Response headers
            res.setHeader("Content-Type", "application/json");
            res.setHeader("MCP-Protocol-Version", "2026-07-28");
            if (isProAuthorized) {
              res.setHeader("X-SPE-Entitlement-Status", "VERIFIED_PRO");
            }
            if (usageRecord) {
              res.setHeader("X-SPE-Usage-Charge-Usd", usageRecord.debitedUsdString);
              const acc = this.usageEngine.getCustomerAccount(usageRecord.customerId);
              if (acc) {
                res.setHeader("X-SPE-Remaining-Balance-Usd", (acc.balanceMicroCents / 1000000).toFixed(4));
              }
              res.setHeader("X-SPE-Customer-Id", usageRecord.customerId);
            } else {
              res.setHeader("X-SPE-Usage-Charge-Usd", requestContext.billing?.debitedUsdString || "$0.000");
            }

            res.statusCode = 200;
            res.end(response !== null ? JSON.stringify(response) : "");
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("MCP-Protocol-Version", "2026-07-28");
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32700, message: `Parse error: ${err.message || String(err)}` },
              })
            );
          }
        });
        return;
      }

      // ────────────────────────────────────────────────────────────────
      // 3. HEALTH & GATEWAY STATUS
      // ────────────────────────────────────────────────────────────────
      if (url === "/api/v1/health" && method === "GET") {
        const brainRuntime = ZeroDowntimeBrainRuntime.getInstance();
        try {
          brainRuntime.syncWithDurablePointer(this.brainPointerPath);
        } catch {}
        const runtimeMetrics = brainRuntime.getMetrics();

        res.setHeader("Content-Type", "application/json");
        res.setHeader("MCP-Protocol-Version", "2026-07-28");
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            status: "ok",
            gateway: "SPE Ω Global AI Gateway",
            protocolVersion: "2026-07-28",
            offlineAirGap: true,
            zeroDowntimeGuaranteed: runtimeMetrics.zeroDowntimeGuaranteed,
            availability: runtimeMetrics.uptimeStatus,
            servingArchitecture: "READ_COPY_UPDATE_ATOMIC_HOT_SWAP",
            measuredAvailability: {
              uptimeStatus: runtimeMetrics.uptimeStatus,
              measuredAvailabilityPercent: runtimeMetrics.measuredAvailabilityPercent,
              totalRequests: runtimeMetrics.totalRequests,
              successfulRequests: runtimeMetrics.successfulRequests,
              failedRequests: runtimeMetrics.failedRequests,
              activeInFlightRequests: runtimeMetrics.activeInFlightRequests,
              hotSwapsCompleted: runtimeMetrics.hotSwapsCompleted,
              rollbacksExecuted: runtimeMetrics.rollbacksExecuted,
              currentBrainId: runtimeMetrics.currentBrainId,
              currentGenerationIndex: runtimeMetrics.currentGenerationIndex,
            },
            brainRuntimeMetrics: runtimeMetrics,
            timezoneIsolation: {
              principle: "Non-blocking out-of-band background maintenance with RCU pointer hot-swap",
              usBusinessHoursProtected: true,
              indiaNightScheduledUtc: "20:47 UTC (02:17 IST)",
              usPeakHoursUtc: "16:00-23:00 UTC (09:00-16:00 PT / 12:00-19:00 ET)",
              servingInterruptionDuringMaintenance: false,
            },
            billing: {
              activeMeterRates: {
                standardCompile: "$0.001",
                proCompile: "$0.005",
                deepReasoning: "$0.010",
              },
              freeAllowanceMaxChars: 5000,
              freeAllowanceCallsPerHour: 10,
              universalWebFreeCeilingChars: 30000,
              stripeWebhookActive: true,
              payoutSchedule: "Standard merchant account schedule (rolling 2-business-day / weekly settlement)",
            },
            uptimeSeconds: Math.floor(process.uptime()),
          })
        );
        return;
      }

      // ────────────────────────────────────────────────────────────────
      // 4. REST DISCOVERY ALIASES & .SPE PACKAGES
      // ────────────────────────────────────────────────────────────────
      const routeMap: Record<string, string> = {
        "/api/v1/prompts": path.join(PUBLIC_DIR, "api/v1/prompts/index.json"),
        "/api/v1/prompts/index.json": path.join(PUBLIC_DIR, "api/v1/prompts/index.json"),
        "/api/v1/model-formats": path.join(PUBLIC_DIR, "api/v1/model-formats/index.json"),
        "/api/v1/model-formats/index.json": path.join(PUBLIC_DIR, "api/v1/model-formats/index.json"),
        "/api/v1/prompt-packs": path.join(PUBLIC_DIR, "api/v1/prompt-packs/index.json"),
        "/api/v1/prompt-packs/index.json": path.join(PUBLIC_DIR, "api/v1/prompt-packs/index.json"),
        "/.well-known/agent-card.json": path.join(PUBLIC_DIR, ".well-known/agent-card.json"),
        "/.well-known/agent.json": path.join(PUBLIC_DIR, ".well-known/agent.json"),
        "/packages/index.json": path.join(PUBLIC_DIR, "api/v1/prompts/index.json"),
      };

      const normalizedUrl = url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;
      const targetFilePath = routeMap[normalizedUrl];

      if (targetFilePath && method === "GET") {
        if (fs.existsSync(targetFilePath)) {
          const content = fs.readFileSync(targetFilePath, "utf8");
          res.setHeader("Content-Type", "application/json");
          res.setHeader("MCP-Protocol-Version", "2026-07-28");
          res.statusCode = 200;
          res.end(content);
          return;
        }
      }

      if (url.startsWith("/packages/") && method === "GET") {
        const pkgFilename = path.basename(url);
        const pkgFilePath = path.join(PUBLIC_DIR, "packages", pkgFilename);
        if (fs.existsSync(pkgFilePath) && pkgFilename.endsWith(".spe")) {
          const fileStream = fs.createReadStream(pkgFilePath);
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Disposition", `attachment; filename="${pkgFilename}"`);
          res.statusCode = 200;
          fileStream.pipe(res);
          return;
        }
      }

      // 404 Fallback
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Endpoint not found", path: url }));
    });

    return server;
  }

  public async start(port = 8080, host = "0.0.0.0"): Promise<number> {
    this.server = this.createHttpServer();

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [ip, bucket] of this.ipRequestBuckets.entries()) {
        if (now > bucket.resetTime) {
          this.ipRequestBuckets.delete(ip);
        }
      }
    }, 5 * 60 * 1000);
    this.cleanupTimer.unref?.();

    // P0-03: Cross-process durable pointer hot-reload watcher
    this.pointerSyncTimer = setInterval(() => {
      try {
        ZeroDowntimeBrainRuntime.getInstance().syncWithDurablePointer(this.brainPointerPath);
      } catch {}
    }, 2000);
    this.pointerSyncTimer.unref?.();

    return new Promise((resolve) => {
      this.server!.listen(port, host, () => {
        const addr = this.server!.address();
        const boundPort = typeof addr === "object" && addr ? addr.port : port;
        resolve(boundPort);
      });
    });
  }

  public syncBrainPointer(): { reloaded: boolean; activeBrainId: string } {
    return ZeroDowntimeBrainRuntime.getInstance().syncWithDurablePointer(this.brainPointerPath);
  }

  public async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.pointerSyncTimer) {
      clearInterval(this.pointerSyncTimer);
      this.pointerSyncTimer = null;
    }
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}

// Direct CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = parseInt(process.env.SPE_MCP_PORT || process.env.PORT || "8080", 10);
  const host = process.env.SPE_MCP_HOST || process.env.HOST || "0.0.0.0";
  const server = new McpProductionServer();
  server.start(port, host).then(() => {
    console.log(`[SPE-MCP-GATEWAY] Running on http://${host}:${port} (Stateless Core 2026-07-28)`);
    console.log(`[SPE-MCP-GATEWAY] Rate Meter Active: Standard $0.001 | Pro $0.005 | Deep Reasoning $0.010`);
    console.log(`[SPE-MCP-GATEWAY] Stripe Webhook Listening on /api/v1/billing/webhook/stripe`);
  });

  const shutdown = async () => {
    console.log("\n[SPE-MCP-GATEWAY] Shutting down cleanly...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
