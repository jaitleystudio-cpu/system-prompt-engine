/**
 * apps/web/scripts/local-mcp-gateway-plugin.mjs
 *
 * Vite middleware plugin for SPE Ω Global AI Gateway:
 * - Live stateless Model Context Protocol (MCP) HTTP POST JSON-RPC 2.0 handler (/api/v1/mcp).
 * - Direct REST discovery rewriting for /api/v1/prompts, /api/v1/model-formats, /api/v1/prompt-packs.
 * - Rate limiting (120 req/min per IP, HTTP 429) & 512KB body size limit (HTTP 413) per OWASP API4.
 * - Emits MCP-Protocol-Version: 2026-07-28 header.
 * - 100% offline, zero cloud egress.
 */

import { SpeMcpServer } from "../src/engine/mcp/speMcpServer.ts";

const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120;

export function localMcpGatewayPlugin() {
  const mcpServer = new SpeMcpServer();
  const ipRequestBuckets = new Map();

  function isRateLimited(ip) {
    const now = Date.now();
    let bucket = ipRequestBuckets.get(ip);
    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
      ipRequestBuckets.set(ip, bucket);
      return false;
    }
    bucket.count++;
    if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
      return true;
    }
    return false;
  }

  // Periodic cleanup of stale rate-limit buckets every 5 mins
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of ipRequestBuckets.entries()) {
      if (now > bucket.resetTime) {
        ipRequestBuckets.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref?.();

  function attachMiddleware(middlewares) {
    middlewares.use(async (req, res, next) => {
      const url = req.url ? req.url.split("?")[0] : "";

      // MCP HTTP JSON-RPC 2.0 endpoint
      if ((url === "/api/v1/mcp" || url === "/api/v1/mcp/") && req.method === "POST") {
        const clientIp = req.socket?.remoteAddress || req.headers["x-forwarded-for"] || "127.0.0.1";
        if (isRateLimited(clientIp)) {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Retry-After", "60");
          res.statusCode = 429;
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32000,
                message: "Rate limit exceeded (120 req/min). Please back off.",
              },
            })
          );
          return;
        }

        let body = "";
        let receivedBytes = 0;
        let isTooLarge = false;

        req.on("data", (chunk) => {
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
          body += chunk;
        });

        req.on("end", async () => {
          if (isTooLarge) return;

          try {
            const parsed = JSON.parse(body || "{}");
            const response = await mcpServer.handleJsonRpcRequest(parsed);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("MCP-Protocol-Version", "2026-07-28");
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.statusCode = 200;
            res.end(response !== null ? JSON.stringify(response) : "");
          } catch (err) {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("MCP-Protocol-Version", "2026-07-28");
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: {
                  code: -32700,
                  message: `Parse error: ${err.message || String(err)}`,
                },
              })
            );
          }
        });
        return;
      }

      // Machine-readable REST API endpoint aliases
      if (req.method === "GET") {
        if (url === "/api/v1/prompts" || url === "/api/v1/prompts/") {
          req.url = "/api/v1/prompts/index.json";
        } else if (url === "/api/v1/model-formats" || url === "/api/v1/model-formats/") {
          req.url = "/api/v1/model-formats/index.json";
        } else if (url === "/api/v1/prompt-packs" || url === "/api/v1/prompt-packs/") {
          req.url = "/api/v1/prompt-packs/index.json";
        } else if (url === "/api/v1" || url === "/api/v1/") {
          req.url = "/api/v1/index.json";
        }
      }

      next();
    });
  }

  return {
    name: "spe-local-mcp-gateway-plugin",
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}
