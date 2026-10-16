#!/usr/bin/env node
/**
 * tools/spe_mcp_server.mjs
 *
 * Stdio JSON-RPC 2.0 Runner for SPE Model Context Protocol (MCP) Server.
 * Conforms to July 28, 2026 Model Context Protocol specification.
 *
 * Usage:
 *   node --experimental-strip-types tools/spe_mcp_server.mjs
 */

import readline from "node:readline";
import { SpeMcpServer } from "../apps/web/src/engine/mcp/speMcpServer.ts";

const server = new SpeMcpServer();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const request = JSON.parse(trimmed);
    const response = await server.handleJsonRpcRequest(request);
    if (response !== null) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: `Parse error: ${err.message || String(err)}`,
      },
    };
    process.stdout.write(JSON.stringify(errorResponse) + "\n");
  }
});
