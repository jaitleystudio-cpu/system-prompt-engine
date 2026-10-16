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
    ];
  }

  /**
   * Dispatches and handles stateless JSON-RPC 2.0 MCP request(s).
   * Supports single requests, batches, notifications, and prompts/resources discovery.
   */
  public async handleJsonRpcRequest(request: any): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
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
        const res = await this.handleSingleRequest(item);
        if (res !== null) {
          responses.push(res);
        }
      }
      return responses.length > 0 ? responses : null;
    }

    return this.handleSingleRequest(request);
  }

  private async handleSingleRequest(request: any): Promise<JsonRpcResponse | null> {
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
          const output = await this.executeTool(toolName, args);
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
            },
          };
        } catch (err: any) {
          if (isNotification) return null;
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32603,
              message: `Tool execution failed: ${err.message || String(err)}`,
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
  public async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
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

      default:
        throw new Error(`Unknown tool: '${toolName}'`);
    }
  }
}
