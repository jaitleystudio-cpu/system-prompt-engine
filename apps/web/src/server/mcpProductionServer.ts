/**
 * apps/web/src/server/mcpProductionServer.ts
 *
 * SPE Ω — Production Standalone Model Context Protocol (MCP) & REST Gateway Server
 *
 * Grounded in:
 * - Model Context Protocol (MCP) July 28, 2026 stateless core specification.
 * - OWASP API4: Strict 512KB payload ceiling (HTTP 413) & in-memory IP rate-limiting (120 req/min, HTTP 429).
 * - Standard headers: 'MCP-Protocol-Version: 2026-07-28', 'X-Content-Type-Options: nosniff'.
 * - 100% offline, $0 API compute spend, zero cloud egress.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpeMcpServer } from "../engine/mcp/speMcpServer.ts";
import { verifySignedEntitlementToken } from "../engine/entitlementVerifier.ts";

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
}

export class McpProductionServer {
  private server: http.Server | null = null;
  private mcpServer: SpeMcpServer;
  private ipRequestBuckets = new Map<string, { count: number; resetTime: number }>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private trustedBillingKeyHex?: string;

  constructor(config?: McpServerConfig) {
    this.mcpServer = new SpeMcpServer();
    this.trustedBillingKeyHex = config?.trustedBillingAuthorityPublicKeyHex;
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

      // 1. MCP JSON-RPC 2.0 Handler
      if ((url === "/api/v1/mcp" || url === "/api/v1/mcp/") && method === "POST") {
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

        // Optional Pro Entitlement Token Verification hook
        const authHeader = req.headers["x-spe-entitlement-token"] as string | undefined;
        let isProAuthorized = false;
        if (authHeader && this.trustedBillingKeyHex) {
          try {
            const verification = await verifySignedEntitlementToken(authHeader, {
              issuerPublicKeyHex: this.trustedBillingKeyHex,
            });
            if (verification.verified && (verification.tier === "pro" || verification.tier === "team")) {
              isProAuthorized = true;
            }
          } catch {
            isProAuthorized = false;
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
            const response = await this.mcpServer.handleJsonRpcRequest(parsed);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("MCP-Protocol-Version", "2026-07-28");
            if (isProAuthorized) {
              res.setHeader("X-SPE-Entitlement-Status", "VERIFIED_PRO");
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

      // 2. Health & Gateway Status
      if (url === "/api/v1/health" && method === "GET") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("MCP-Protocol-Version", "2026-07-28");
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            status: "ok",
            gateway: "SPE Ω Global AI Gateway",
            protocolVersion: "2026-07-28",
            offlineAirGap: true,
            uptimeSeconds: Math.floor(process.uptime()),
          })
        );
        return;
      }

      // 3. Machine-readable REST Discovery aliases
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

      // 4. Download .spe packages
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

    return new Promise((resolve) => {
      this.server!.listen(port, host, () => {
        const addr = this.server!.address();
        const boundPort = typeof addr === "object" && addr ? addr.port : port;
        resolve(boundPort);
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
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
  });

  const shutdown = async () => {
    console.log("\n[SPE-MCP-GATEWAY] Shutting down cleanly...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
