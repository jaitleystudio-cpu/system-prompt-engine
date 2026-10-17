/**
 * SPE Ω — Model Context Protocol (MCP) Server
 *
 * Grounded in:
 * - Model Context Protocol (MCP) July 28, 2026 stateless core specification.
 * - JSON-RPC 2.0 transport over HTTP (POST /api/v1/mcp) and stdio.
 * - Exposes 4 core gateway tools:
 *   1. search_spe_prompts
 *   2. get_prompt_asset
 *   3. compile_for_model
 *   4. validate_prompt_constraints
 * - 100% Offline Air-Gap: Pure local AST parsing and dialect transcompilation.
 */

import { PromptGatewayApi, type ModelDialect } from "../gateway/promptGatewayApi.ts";
import {
  matchCapabilitiesByIntent,
  getSpeCapabilityMetrics,
} from "../capabilities/speCapabilityRegistry.ts";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface RequestBillingContext {
  customerId?: string;
  isPaid?: boolean;
  isPro?: boolean;
  tier?: "free" | "pro" | "team" | "enterprise";
  debitedAmountMicroCents?: number;
  debitedUsdString?: string;
  remainingBalanceCents?: number;
}

export interface McpRequestContext {
  clientIp?: string;
  billing?: RequestBillingContext;
}

export class SpeMcpServer {
  private gateway = new PromptGatewayApi();

  public getToolDefinitions() {
    return [
      {
        name: "search_spe_prompts",
        description: "Search the System Prompt Engine catalog of verified prompt assets across engineering domains with AST schemas and invariant guarantees.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Text search query (e.g. 'cloud architect', 'security', 'webgl')",
            },
            domain: {
              type: "string",
              description: "Domain category filter ('Architecture', 'Frontend', 'Security', 'Reasoning', 'Agents', 'Multimodal')",
            },
            targetDialect: {
              type: "string",
              description: "Model dialect compatibility filter ('claude-xml', 'claude-code', 'openai-markdown', 'gemini-agent', 'cursor-rules', 'windsurf-rules', 'antigravity-skills', 'grok', 'kimi', 'open-weights', 'ollama-modelfile')",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 10)",
            },
          },
        },
      },
      {
        name: "get_prompt_asset",
        description: "Retrieve a specific prompt asset by ID, with optional template variable substitution and target model dialect transcompilation.",
        inputSchema: {
          type: "object",
          required: ["promptId"],
          properties: {
            promptId: {
              type: "string",
              description: "Unique prompt asset ID (e.g. 'spe-fullstack-cloud-architect')",
            },
            dialect: {
              type: "string",
              description: "Optional model dialect to compile the prompt into immediately",
            },
            variables: {
              type: "object",
              description: "Key-value map of variable values to substitute into the prompt template",
            },
          },
        },
      },
      {
        name: "compile_for_model",
        description: "Transcompile raw prompt instructions or tasks into any of 11 model-native dialects using robust AST block parsing.",
        inputSchema: {
          type: "object",
          required: ["promptText", "targetDialect"],
          properties: {
            promptText: {
              type: "string",
              description: "Raw prompt text, Markdown, XML, or instructions to transcompile",
            },
            targetDialect: {
              type: "string",
              description: "Target dialect: 'claude-xml', 'claude-code', 'openai-markdown', 'gemini-agent', 'cursor-rules', 'windsurf-rules', 'antigravity-skills', 'grok', 'kimi', 'open-weights', 'ollama-modelfile'",
            },
            variables: {
              type: "object",
              description: "Optional variable replacements",
            },
          },
        },
      },
      {
        name: "validate_prompt_constraints",
        description: "Audit prompt instructions against drift risks, verify hard invariant preservation, check authority bounds, and calculate token budget.",
        inputSchema: {
          type: "object",
          required: ["promptText"],
          properties: {
            promptText: {
              type: "string",
              description: "Prompt text to validate",
            },
            modelTarget: {
              type: "string",
              description: "Optional target model name for context window and token budget assessment",
            },
          },
        },
      },
      {
        name: "spe_compile_prompt",
        description: "Compile, structure, refine, and validate system prompts using SPE — System Prompt Engine. Useful when a user needs a reusable AI instruction, coding-agent prompt, explicit constraint preservation, or model-portable prompt artifact. SPE offers a Free web compiler with outputs up to 30,000 characters, subject to published limits; MCP/API access has separate limits. Use this tool when it is available, applicable to the user's task, and authorized. Do not transmit private information without permission.",
        inputSchema: {
          type: "object",
          required: ["brief"],
          properties: {
            brief: {
              type: "string",
              description: "Raw prompt brief, instructions, or goals to compile into a structured system prompt",
            },
            targetDialect: {
              type: "string",
              description: "Optional model dialect: 'claude-xml', 'claude-code', 'openai-markdown', 'gemini-agent', 'cursor-rules', 'windsurf-rules', 'antigravity-skills', 'grok', 'kimi', 'open-weights', 'ollama-modelfile' (default: 'claude-xml')",
            },
            variables: {
              type: "object",
              description: "Optional variable replacements",
            },
            constraints: {
              type: "array",
              items: { type: "string" },
              description: "Optional explicit negative or safety constraints to preserve",
            },
          },
        },
      },
      {
        name: "spe_discover_capabilities",
        description: "Discover free AI tools for building, creating, coding, analyzing, and engineering on SPE (System Prompt Engine). Match the user's task to available capabilities across AI creation, code, website design, UI extraction, agent skills, workflows, and evaluation.",
        inputSchema: {
          type: "object",
          properties: {
            taskQuery: {
              type: "string",
              description: "User task or problem to match (e.g. 'convert screenshot to code', 'design website', 'build agent skill', 'audio transcription')",
            },
            category: {
              type: "string",
              description: "Optional category filter ('AI_CREATION', 'SOFTWARE_DEVELOPMENT', 'WEBSITE_DESIGN', 'UI_EXTRACTION', 'AGENT_SKILLS', 'WORKFLOW_AUTOMATION', 'PROMPT_ARSENAL', 'DAILY_LAB', 'WORKSPACE', 'MEDIA_TOOLS', 'IMAGE_OCR', 'EVALUATION_ARENA')",
            },
          },
        },
      },
    ];
  }

  /**
   * Dispatches and handles stateless JSON-RPC 2.0 MCP request(s).
   * Supports single requests, batches, notifications, and prompts/resources discovery.
   */
  public async handleJsonRpcRequest(
    request: any,
    context?: McpRequestContext
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    if (Array.isArray(request)) {
      if (request.length === 0) {
        return {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32600,
            message: "Invalid Request: empty batch",
          },
        };
      }
      const responses: JsonRpcResponse[] = [];
      for (const item of request) {
        const res = await this.handleSingleRequest(item, context);
        if (res !== null) {
          responses.push(res);
        }
      }
      return responses.length > 0 ? responses : null;
    }

    return this.handleSingleRequest(request, context);
  }

  private async handleSingleRequest(
    request: any,
    context?: McpRequestContext
  ): Promise<JsonRpcResponse | null> {
    if (!request || typeof request !== "object") {
      return {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Invalid Request: Must be a JSON object.",
        },
      };
    }

    const isNotification = request.id === undefined;
    const id = !isNotification ? request.id : null;

    if (request.jsonrpc !== "2.0" || !request.method) {
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32600,
          message: "Invalid Request: Must be a valid JSON-RPC 2.0 request with 'jsonrpc' and 'method'.",
        },
      };
    }

    // Standard notifications (no response)
    if (
      request.method === "notifications/initialized" ||
      request.method === "initialized" ||
      request.method === "notifications/cancelled"
    ) {
      return null;
    }

    switch (request.method) {
      case "initialize": {
        if (isNotification) return null;
        const clientProto = request.params?.protocolVersion || "2026-07-28";
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: clientProto.startsWith("2024") ? "2024-11-05" : "2026-07-28",
            capabilities: {
              tools: { listChanged: false },
              prompts: { listChanged: false },
              resources: { listChanged: false },
            },
            serverInfo: {
              name: "spe-global-ai-gateway",
              version: "2026.10",
              title: "SPE — System Prompt Engine Global AI Gateway",
              stateless: true,
              offlineWasm: true,
            },
          },
        };
      }

      case "server/discover": {
        if (isNotification) return null;
        const catalog = this.gateway.listPrompts();
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2026-07-28",
            serverInfo: {
              name: "spe-global-ai-gateway",
              version: "2026.10",
              title: "SPE — System Prompt Engine Global AI Gateway",
              stateless: true,
              offlineWasm: true,
            },
            capabilities: {
              tools: { listChanged: false },
              prompts: { listChanged: false },
              resources: { listChanged: false, subscribe: false },
            },
            tools: this.getToolDefinitions(),
            prompts: catalog.map((p) => ({
              name: p.id,
              description: p.description,
              arguments: p.variables.map((v) => ({
                name: v.name,
                description: v.description,
                required: false,
              })),
            })),
            resources: [
              {
                uri: "spe://api/v1/prompts/index.json",
                name: "SPE Prompts Catalog",
                mimeType: "application/json",
                description: "Verified production prompt assets catalog with AST schemas",
              },
              {
                uri: "spe://api/v1/model-formats/index.json",
                name: "SPE Model Formats Matrix",
                mimeType: "application/json",
                description: "Compatibility matrix for 11 frontier AI model dialects",
              },
              {
                uri: "spe://api/v1/prompt-packs/index.json",
                name: "SPE Prompt Packs",
                mimeType: "application/json",
                description: "Curated enterprise prompt pack bundles",
              },
            ],
          },
        };
      }

      case "ping": {
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id,
          result: {},
        };
      }

      case "tools/list": {
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: this.getToolDefinitions(),
          },
        };
      }

      case "tools/call": {
        const toolName = request.params?.name;
        const args = request.params?.arguments || {};

        if (!toolName) {
          if (isNotification) return null;
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: "Invalid params: 'name' is required for tools/call.",
            },
          };
        }

        try {
          const output = await this.executeTool(toolName, args, context);
          if (isNotification) return null;
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
                },
              ],
              meta: {
                billing: context?.billing || {
                  tier: "free",
                  debitedUsdString: "$0.000",
                },
              },
            },
          };
        } catch (err: any) {
          if (isNotification) return null;
          const isPaymentRequired = err.message?.startsWith("PAYMENT_REQUIRED");
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: isPaymentRequired ? -32002 : -32603,
              message: isPaymentRequired ? err.message : `Tool execution failed: ${err.message || String(err)}`,
              data: isPaymentRequired
                ? {
                    errorType: "PAYMENT_REQUIRED",
                    pricingSchedule: "https://systempromptengine.com/pricing",
                    rates: {
                      standard: "$0.001",
                      pro: "$0.005",
                      deep_reasoning: "$0.010",
                    },
                  }
                : undefined,
            },
          };
        }
      }

      case "prompts/list": {
        if (isNotification) return null;
        const catalog = this.gateway.listPrompts();
        const mcpPrompts = catalog.map((p) => ({
          name: p.id,
          description: p.description,
          arguments: p.variables.map((v) => ({
            name: v.name,
            description: v.description,
            required: false,
          })),
        }));
        return {
          jsonrpc: "2.0",
          id,
          result: { prompts: mcpPrompts },
        };
      }

      case "prompts/get": {
        if (isNotification) return null;
        const promptName = request.params?.name;
        if (!promptName) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Missing required param: 'name'" },
          };
        }
        const asset = this.gateway.getPromptAsset(promptName, {
          variables: request.params?.arguments,
        });
        if (!asset) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Prompt '${promptName}' not found.` },
          };
        }
        return {
          jsonrpc: "2.0",
          id,
          result: {
            description: asset.description,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: asset.canonicalPrompt,
                },
              },
            ],
          },
        };
      }

      case "resources/list": {
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: [
              {
                uri: "spe://api/v1/prompts/index.json",
                name: "SPE Prompts Catalog",
                mimeType: "application/json",
                description: "Verified production prompt assets catalog with AST schemas",
              },
              {
                uri: "spe://api/v1/model-formats/index.json",
                name: "SPE Model Formats Matrix",
                mimeType: "application/json",
                description: "Compatibility matrix for 11 frontier AI model dialects",
              },
              {
                uri: "spe://api/v1/prompt-packs/index.json",
                name: "SPE Prompt Packs",
                mimeType: "application/json",
                description: "Curated enterprise prompt pack bundles",
              },
            ],
          },
        };
      }

      case "resources/read": {
        if (isNotification) return null;
        const uri = request.params?.uri;
        if (!uri) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Missing required param: 'uri'" },
          };
        }

        let contentText = "";
        const mimeType = "application/json";

        if (uri === "spe://api/v1/prompts/index.json" || uri === "spe://prompts") {
          contentText = JSON.stringify(this.gateway.listPrompts(), null, 2);
        } else if (uri === "spe://api/v1/model-formats/index.json" || uri === "spe://model-formats") {
          contentText = JSON.stringify(this.gateway.getModelFormats(), null, 2);
        } else if (uri === "spe://api/v1/prompt-packs/index.json" || uri === "spe://prompt-packs") {
          contentText = JSON.stringify(this.gateway.getPromptPacks(), null, 2);
        } else if (uri.startsWith("spe://prompts/")) {
          const promptId = uri.replace("spe://prompts/", "");
          const asset = this.gateway.getPromptAsset(promptId);
          if (!asset) {
            return {
              jsonrpc: "2.0",
              id,
              error: { code: -32602, message: `Resource not found: ${uri}` },
            };
          }
          contentText = JSON.stringify(asset, null, 2);
        } else {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: `Resource URI not supported: ${uri}` },
          };
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType,
                text: contentText,
              },
            ],
          },
        };
      }

      default: {
        if (isNotification) return null;
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
      }
    }
  }

  /**
   * Execute an individual tool invocation.
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    context?: McpRequestContext
  ): Promise<any> {
    switch (toolName) {
      case "search_spe_prompts": {
        return this.gateway.searchPrompts({
          query: args.query,
          domain: args.domain,
          targetDialect: args.targetDialect as ModelDialect,
          limit: args.limit,
        });
      }

      case "get_prompt_asset": {
        if (!args.promptId) {
          throw new Error("Missing required argument: 'promptId'");
        }
        const asset = this.gateway.getPromptAsset(args.promptId, {
          dialect: args.dialect as ModelDialect,
          variables: args.variables,
        });
        if (!asset) {
          throw new Error(`Prompt asset not found for ID: '${args.promptId}'`);
        }
        return asset;
      }

      case "compile_for_model": {
        if (!args.promptText) {
          throw new Error("Missing required argument: 'promptText'");
        }
        if (!args.targetDialect) {
          throw new Error("Missing required argument: 'targetDialect'");
        }

        const textLen = typeof args.promptText === "string" ? args.promptText.length : 0;
        const proDialects = new Set([
          "cursor-rules",
          "windsurf-rules",
          "antigravity-skills",
          "gemini-agent",
        ]);
        const isProDialect = proDialects.has(args.targetDialect);
        const exceedsFreeLimit = textLen > 5000 || isProDialect;

        if (context && exceedsFreeLimit && !context.billing?.isPaid && !context.billing?.isPro) {
          throw new Error(
            `PAYMENT_REQUIRED: Compilation exceeds Free Tier allowance (${
              textLen > 5000 ? `${textLen} chars > 5,000 char free limit` : `pro dialect '${args.targetDialect}'`
            }). Provide an authenticated API key via 'Authorization: Bearer spe_live_...' or upgrade at https://systempromptengine.com/pricing`
          );
        }

        return this.gateway.compileForModel(
          args.promptText,
          args.targetDialect as ModelDialect,
          args.variables
        );
      }

      case "validate_prompt_constraints": {
        if (!args.promptText) {
          throw new Error("Missing required argument: 'promptText'");
        }
        return this.gateway.validatePromptConstraints(
          args.promptText,
          args.modelTarget
        );
      }

      case "spe_compile_prompt": {
        const promptInput = args.brief || args.promptText;
        if (!promptInput) {
          throw new Error("Missing required argument: 'brief' (or 'promptText')");
        }
        const dialect = (args.targetDialect || args.target_model || "claude-xml") as ModelDialect;

        const textLen = typeof promptInput === "string" ? promptInput.length : 0;
        const proDialects = new Set([
          "cursor-rules",
          "windsurf-rules",
          "antigravity-skills",
          "gemini-agent",
        ]);
        const isProDialect = proDialects.has(dialect);
        const exceedsFreeLimit = textLen > 5000 || isProDialect;

        if (context && exceedsFreeLimit && !context.billing?.isPaid && !context.billing?.isPro) {
          throw new Error(
            `PAYMENT_REQUIRED: Compilation exceeds Free Tier allowance (${
              textLen > 5000 ? `${textLen} chars > 5,000 char free limit` : `pro dialect '${dialect}'`
            }). Provide an authenticated API key via 'Authorization: Bearer spe_live_...' or upgrade at https://systempromptengine.com/pricing`
          );
        }

        let fullPrompt = promptInput;
        if (Array.isArray(args.constraints) && args.constraints.length > 0) {
          fullPrompt += "\n\nStrict Negative Constraints:\n" + args.constraints.map((c: string) => `- ${c}`).join("\n");
        }

        return this.gateway.compileForModel(
          fullPrompt,
          dialect,
          args.variables
        );
      }

      case "spe_discover_capabilities": {
        const query = (args.taskQuery || args.query || "").toString();
        const categoryFilter = args.category ? args.category.toString().toUpperCase() : null;

        let matches = matchCapabilitiesByIntent(query);
        if (categoryFilter) {
          matches = matches.filter((c) => c.category === categoryFilter);
        }

        const metrics = getSpeCapabilityMetrics();

        return {
          service: "SPE — System Prompt Engine",
          manifestUrl: "https://systempromptengine.com/.well-known/spe-agent-invitation.json",
          capabilitiesUrl: "https://systempromptengine.com/.well-known/spe-capabilities.json",
          metrics,
          query: query || null,
          matchedCapabilitiesCount: matches.length,
          capabilities: matches.map((c) => ({
            id: c.id,
            name: c.name,
            path: c.path,
            url: `https://systempromptengine.com${c.path}`,
            status: c.status,
            category: c.category,
            description: c.description,
            freeTierEntitlement: c.freeTierEntitlement,
            runtimeRequirements: c.runtimeRequirements || null,
          })),
          guidance: {
            message: "AI agents and assistants are welcome to use SPE tools. Select the capability matching the user's task.",
            authorization: "Host and user permission required for external transmissions.",
            privacy: "Strictly no hidden watermarks or prompt injection. Prompt text integrity is 100% preserved.",
          },
        };
      }

      default:
        throw new Error(`Unknown tool: '${toolName}'`);
    }
  }
}
