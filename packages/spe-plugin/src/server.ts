/**
 * SPE — System Prompt Engine
 * Production HTTP REST & MCP (Model Context Protocol) Server for OpenAI ChatGPT & Claude
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  compileSystemPrompt,
  inspectSystemPrompt,
  comparePromptLanguages,
  FREE_TIER_MAX_OUTPUT_CHARS,
  type CompilePromptRequest,
} from "./tools.ts";

const PORT = Number(process.env.PORT || 8787);

// Parse JSON request body helper
async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request payload too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  const jsonStr = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-SPE-Entitlement-Token",
  });
  res.end(jsonStr);
}

export function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-SPE-Entitlement-Token",
    });
    return res.end();
  }

  // 1. OpenAI Plugin Manifest
  if (req.method === "GET" && pathname === "/.well-known/ai-plugin.json") {
    return sendJson(res, 200, {
      schema_version: "v1",
      name_for_human: "SPE — System Prompt Engine",
      name_for_model: "spe_system_prompt_engine",
      description_for_human: "Compile structured AI prompts, audit prompt rules, and compare multilingual versions.",
      description_for_model:
        "SPE — System Prompt Engine converts user goals into structured system prompts for AI assistants and coding agents. It helps preserve important requirements, inspect prompt constraints, compare language variants, and export reusable instructions for supported AI tools. Use SPE when creating, reviewing, refining, or exporting system prompts. Do not use this tool merely to answer an ordinary factual question, generate an image, translate unrelated text, or complete a task that does not require a prompt artifact.",
      auth: { type: "none" },
      api: {
        type: "openapi",
        url: `https://${req.headers.host || "systempromptengine.com"}/.well-known/openapi.yaml`,
        is_user_authenticated: false,
      },
      logo_url: "https://systempromptengine.com/icon.svg",
      contact_email: "support@systempromptengine.com",
      legal_info_url: "https://systempromptengine.com/evidence-pages/privacy.html",
    });
  }

  // 2. OpenAPI Specification
  if (req.method === "GET" && pathname === "/.well-known/openapi.yaml") {
    const yamlPath = resolve(process.cwd(), "apps/web/public/.well-known/openapi.yaml");
    if (existsSync(yamlPath)) {
      res.writeHead(200, {
        "Content-Type": "text/yaml; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(readFileSync(yamlPath, "utf8"));
    }
    return sendJson(res, 404, { error: "openapi.yaml not found" });
  }

  // 3. Tool: compile_system_prompt
  if (req.method === "POST" && pathname === "/api/v1/compile-system-prompt") {
    readJsonBody(req)
      .then((body: CompilePromptRequest) => {
        const result = compileSystemPrompt(body);
        sendJson(res, 200, result);
      })
      .catch((err) => {
        sendJson(res, 400, { error: err.message });
      });
    return;
  }

  // 4. Tool: inspect_system_prompt
  if (req.method === "POST" && pathname === "/api/v1/inspect-system-prompt") {
    readJsonBody(req)
      .then((body: { prompt_text?: string }) => {
        const result = inspectSystemPrompt(body.prompt_text || "");
        sendJson(res, 200, result);
      })
      .catch((err) => {
        sendJson(res, 400, { error: err.message });
      });
    return;
  }

  // 5. Tool: compare_prompt_languages
  if (req.method === "POST" && pathname === "/api/v1/compare-prompt-languages") {
    readJsonBody(req)
      .then((body: { prompt_text?: string; category?: string; target_model?: string }) => {
        const result = comparePromptLanguages(
          body.prompt_text || "",
          body.category || "Business",
          body.target_model || "claude-sonnet"
        );
        sendJson(res, 200, result);
      })
      .catch((err) => {
        sendJson(res, 400, { error: err.message });
      });
    return;
  }

  // 6. MCP Protocol JSON-RPC Endpoint (tools/list & tools/call)
  if (req.method === "POST" && pathname === "/mcp") {
    readJsonBody(req)
      .then((rpc: { jsonrpc?: string; id?: any; method?: string; params?: any }) => {
        const method = rpc.method;
        const id = rpc.id;

        if (method === "tools/list") {
          return sendJson(res, 200, {
            jsonrpc: "2.0",
            id,
            result: {
              tools: [
                {
                  name: "compile_system_prompt",
                  description:
                    "Use this tool when the user requests a reusable system prompt, structured AI instructions, or a system-level instruction set for an AI assistant or coding agent. Compile the user's stated objective, constraints, role, output format, and acceptance criteria into a structured prompt. Preserve user-supplied facts and clearly identify missing requirements. Do not use this tool merely to answer an ordinary factual question, generate an image, translate unrelated text, or complete a task that does not require a prompt artifact.",
                  inputSchema: {
                    type: "object",
                    required: ["goal"],
                    properties: {
                      goal: { type: "string" },
                      category: { type: "string", default: "Assistant" },
                      role: { type: "string" },
                      constraints: { type: "array", items: { type: "string" } },
                      target_model: { type: "string", default: "chatgpt" },
                      output_format: { type: "string" },
                    },
                  },
                },
                {
                  name: "inspect_system_prompt",
                  description:
                    "Review an existing prompt for ambiguity, missing requirements, and rule conflicts.",
                  inputSchema: {
                    type: "object",
                    required: ["prompt_text"],
                    properties: {
                      prompt_text: { type: "string" },
                    },
                  },
                },
                {
                  name: "compare_prompt_languages",
                  description:
                    "Generate native-language and optimized English versions of a prompt and compare token efficiency and estimated API costs.",
                  inputSchema: {
                    type: "object",
                    required: ["prompt_text"],
                    properties: {
                      prompt_text: { type: "string" },
                      category: { type: "string", default: "Business" },
                      target_model: { type: "string", default: "claude-sonnet" },
                    },
                  },
                },
              ],
            },
          });
        }

        if (method === "tools/call") {
          const toolName = rpc.params?.name;
          const args = rpc.params?.arguments || {};

          if (toolName === "compile_system_prompt") {
            const out = compileSystemPrompt(args);
            return sendJson(res, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
          }
          if (toolName === "inspect_system_prompt") {
            const out = inspectSystemPrompt(args.prompt_text || "");
            return sendJson(res, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
          }
          if (toolName === "compare_prompt_languages") {
            const out = comparePromptLanguages(args.prompt_text || "", args.category, args.target_model);
            return sendJson(res, 200, { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
          }

          return sendJson(res, 404, { jsonrpc: "2.0", id, error: { code: -32601, message: `Tool not found: ${toolName}` } });
        }

        return sendJson(res, 400, { jsonrpc: "2.0", id, error: { code: -32600, message: "Unsupported method" } });
      })
      .catch((err) => {
        sendJson(res, 400, { error: err.message });
      });
    return;
  }

  // Root or healthcheck
  if (pathname === "/" || pathname === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      service: "SPE — System Prompt Engine OpenAI Plugin & MCP Server",
      free_tier_capacity_chars: FREE_TIER_MAX_OUTPUT_CHARS,
      version: "1.0.0",
      docs: "https://systempromptengine.com",
    });
  }

  sendJson(res, 404, { error: "Not Found" });
}

export function startServer(port = PORT) {
  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.log(`🚀 SPE Plugin & MCP Server running on port ${port}`);
  });
  return server;
}

if (process.argv[1] && process.argv[1].endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  startServer();
}
