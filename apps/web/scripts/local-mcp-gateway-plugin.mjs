/**
 * apps/web/scripts/local-mcp-gateway-plugin.mjs
 *
 * Vite middleware plugin for SPE Ω Global AI Gateway:
 * - Live stateless Model Context Protocol (MCP) HTTP POST JSON-RPC 2.0 handler (/api/v1/mcp).
 * - Direct REST discovery rewriting for /api/v1/prompts, /api/v1/model-formats, /api/v1/prompt-packs.
 * - 100% offline, zero cloud egress.
 */

import { SpeMcpServer } from "../src/engine/mcp/speMcpServer.ts";

export function localMcpGatewayPlugin() {
  const mcpServer = new SpeMcpServer();

  function attachMiddleware(middlewares) {
    middlewares.use(async (req, res, next) => {
      const url = req.url ? req.url.split("?")[0] : "";

      // MCP HTTP JSON-RPC 2.0 endpoint
      if ((url === "/api/v1/mcp" || url === "/api/v1/mcp/") && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body);
            const response = await mcpServer.handleJsonRpcRequest(parsed);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(response !== null ? JSON.stringify(response) : "");
          } catch (err) {
            res.setHeader("Content-Type", "application/json");
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
