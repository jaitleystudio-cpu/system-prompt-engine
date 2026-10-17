/**
 * SPE Live Multi-Provider Model Runner
 *
 * Provides universal, in-browser and headless execution across frontier AI models
 * (OpenAI, Anthropic, OpenRouter, Groq, local Ollama, and deterministic mock).
 *
 * Security & Custody:
 * - API keys are stored exclusively in client-side localStorage.
 * - Zero API keys or prompt payloads are sent to SPE servers.
 * - Local Ollama runs directly against http://localhost:11434 with zero cloud egress.
 */

export type ProviderType =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "ollama"
  | "mock";

export interface LiveModelRequest {
  provider: ProviderType;
  model: string;
  systemPrompt: string;
  userInput: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  onToken?: (tokenChunk: string) => void;
  mockResponse?: {
    text: string;
    latencyMs?: number;
    tokens?: { prompt: number; completion: number };
  };
}

export interface LiveModelResponse {
  provider: ProviderType;
  model: string;
  output: string;
  latencyMs: number;
  ttftMs?: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  status: "success" | "error";
  errorMessage?: string;
  cached?: boolean;
}

// Built-in cost estimates per 1M tokens (input / output)
const MODEL_COSTS_PER_M: Record<string, { input: number; output: number }> = {
  // Late 2026 Frontier Models
  "claude-5-5-sonnet": { input: 3.0, output: 15.0 },
  "claude-5-5-haiku": { input: 0.8, output: 4.0 },
  "claude-5-5-opus": { input: 15.0, output: 75.0 },
  "claude-code": { input: 3.0, output: 15.0 },
  "claude-code-2-1": { input: 3.0, output: 15.0 },
  "gpt-6-1-sol": { input: 2.5, output: 10.0 },
  "gpt-6-astra": { input: 3.0, output: 12.0 },
  "gemini-3-8-flash": { input: 0.10, output: 0.40 },
  "gemini-3.8-flash": { input: 0.10, output: 0.40 },
  "gemini-3-8-pro": { input: 1.25, output: 5.0 },
  "gemini-3.8-pro": { input: 1.25, output: 5.0 },
  "aragon-4": { input: 0.85, output: 3.4 },
  "aragon-4-pro": { input: 0.85, output: 3.4 },
  "meta-muse-code": { input: 0, output: 0 },
  // Historical snapshots
  "gpt-4o": { input: 2.5, output: 10.0 }, // historical
  "gpt-4o-mini": { input: 0.15, output: 0.6 }, // historical
  "o3-mini": { input: 1.1, output: 4.4 }, // historical
  "o1": { input: 15.0, output: 60.0 }, // historical
  "claude-3-7-sonnet-20250219": { input: 3.0, output: 15.0 }, // historical
  "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 }, // historical
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 }, // historical
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "deepseek-r1-distill-llama-70b": { input: 0.75, output: 0.99 },
  "llama3": { input: 0, output: 0 },
  "mistral": { input: 0, output: 0 },
  "mock": { input: 0, output: 0 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const normModel = model.toLowerCase();
  let costRule = MODEL_COSTS_PER_M[normModel];
  if (!costRule) {
    for (const [key, rule] of Object.entries(MODEL_COSTS_PER_M)) {
      if (normModel.includes(key)) {
        costRule = rule;
        break;
      }
    }
  }
  if (!costRule) {
    costRule = { input: 1.0, output: 3.0 }; // default baseline fallback
  }
  const inputCost = (promptTokens / 1_000_000) * costRule.input;
  const outputCost = (completionTokens / 1_000_000) * costRule.output;
  return Number((inputCost + outputCost).toFixed(6));
}

export function parseProviderModelString(target: string): { provider: ProviderType; model: string } {
  const parts = target.split(":");
  if (parts.length >= 2) {
    const rawProv = parts[0].toLowerCase();
    const model = parts.slice(1).join(":");
    let provider: ProviderType = "openai";
    if (rawProv === "anthropic") provider = "anthropic";
    else if (rawProv === "openrouter") provider = "openrouter";
    else if (rawProv === "groq") provider = "groq";
    else if (rawProv === "ollama" || rawProv === "local") provider = "ollama";
    else if (rawProv === "mock" || rawProv === "test") provider = "mock";
    return { provider, model };
  }
  return { provider: "mock", model: target };
}

export function getStoredApiKey(provider: ProviderType): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return process?.env?.[`SPE_${provider.toUpperCase()}_API_KEY`] || "";
  }
  return window.localStorage.getItem(`spe_api_key_${provider}`) || "";
}

export function setStoredApiKey(provider: ProviderType, key: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    if (key.trim()) {
      window.localStorage.setItem(`spe_api_key_${provider}`, key.trim());
    } else {
      window.localStorage.removeItem(`spe_api_key_${provider}`);
    }
  }
}

/**
 * Universal execution runner for live AI models.
 */
export async function executeProviderCall(request: LiveModelRequest): Promise<LiveModelResponse> {
  const startTime = Date.now();
  const timeoutMs = request.timeoutMs || 45000;

  // 1. Mock Runner Branch (Instant, deterministic, zero network)
  if (request.provider === "mock") {
    const simLatency = request.mockResponse?.latencyMs ?? 150;
    if (simLatency > 0) {
      await new Promise((resolve) => setTimeout(resolve, simLatency));
    }
    const output = request.mockResponse?.text ?? `[MOCK OUTPUT] Prompt processed successfully for query: ${request.userInput.slice(0, 60)}`;
    if (request.onToken) {
      request.onToken(output);
    }
    const promptTokens = request.mockResponse?.tokens?.prompt ?? Math.max(15, Math.ceil((request.systemPrompt.length + request.userInput.length) / 4));
    const completionTokens = request.mockResponse?.tokens?.completion ?? Math.max(10, Math.ceil(output.length / 4));
    const totalTokens = promptTokens + completionTokens;

    return {
      provider: "mock",
      model: request.model,
      output,
      latencyMs: Date.now() - startTime,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: 0,
      status: "success",
    };
  }

  // 2. Fetch API Key if not explicitly passed
  const apiKey = request.apiKey || getStoredApiKey(request.provider);
  if (request.provider !== "ollama" && !apiKey) {
    return {
      provider: request.provider,
      model: request.model,
      output: "",
      latencyMs: Date.now() - startTime,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      status: "error",
      errorMessage: `Missing API key for provider "${request.provider}". Configure in Eval Studio or set SPE_${request.provider.toUpperCase()}_API_KEY.`,
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let output = "";
    let promptTokens = Math.ceil((request.systemPrompt.length + request.userInput.length) / 4);
    let completionTokens = 0;
    let ttftMs: number | undefined;

    if (request.provider === "openai" || request.provider === "openrouter" || request.provider === "groq") {
      const baseUrl = request.baseUrl || (
        request.provider === "openrouter"
          ? "https://openrouter.ai/api/v1"
          : request.provider === "groq"
            ? "https://api.groq.com/openai/v1"
            : "https://api.openai.com/v1"
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
      if (request.provider === "openrouter") {
        headers["HTTP-Referer"] = "https://systempromptengine.com";
        headers["X-Title"] = "System Prompt Engine";
      }

      const body = {
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userInput },
        ],
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
        stream: Boolean(request.onToken),
      };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 300)}`);
      }

      if (request.onToken && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (ttftMs === undefined) ttftMs = Date.now() - startTime;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  output += delta;
                  request.onToken(delta);
                }
              } catch {
                // Ignore parse chunk errors
              }
            }
          }
        }
        completionTokens = Math.ceil(output.length / 4);
      } else {
        const data = await response.json();
        output = data.choices?.[0]?.message?.content || "";
        promptTokens = data.usage?.prompt_tokens ?? promptTokens;
        completionTokens = data.usage?.completion_tokens ?? Math.ceil(output.length / 4);
      }
    } else if (request.provider === "anthropic") {
      const baseUrl = request.baseUrl || "https://api.anthropic.com/v1";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "dangerously-allow-browser": "true",
      };

      let anthropicModel = request.model.replace(/^anthropic:/i, "");
      if (
        anthropicModel === "claude-5-5-sonnet" ||
        anthropicModel === "claude-4-5-sonnet" ||
        anthropicModel === "claude-3-7-sonnet" ||
        anthropicModel === "claude-3-7-sonnet-20250219" ||
        anthropicModel === "claude-sonnet" ||
        anthropicModel === "claude-sonnet-4-5"
      ) {
        anthropicModel = "claude-5-5-sonnet";
      }

      const body = {
        model: anthropicModel,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userInput }],
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
        stream: Boolean(request.onToken),
      };

      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 300)}`);
      }

      if (request.onToken && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (ttftMs === undefined) ttftMs = Date.now() - startTime;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                  output += parsed.delta.text;
                  request.onToken(parsed.delta.text);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
        completionTokens = Math.ceil(output.length / 4);
      } else {
        const data = await response.json();
        output = data.content?.[0]?.text || "";
        promptTokens = data.usage?.input_tokens ?? promptTokens;
        completionTokens = data.usage?.output_tokens ?? Math.ceil(output.length / 4);
      }
    } else if (request.provider === "ollama") {
      const baseUrl = request.baseUrl || "http://localhost:11434";
      const body = {
        model: request.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userInput },
        ],
        stream: false,
      };

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      output = data.message?.content || "";
      promptTokens = data.prompt_eval_count ?? promptTokens;
      completionTokens = data.eval_count ?? Math.ceil(output.length / 4);
    }

    clearTimeout(timeoutHandle);
    const latencyMs = Date.now() - startTime;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUsd = estimateCostUsd(request.model, promptTokens, completionTokens);

    return {
      provider: request.provider,
      model: request.model,
      output,
      latencyMs,
      ttftMs,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd,
      status: "success",
    };
  } catch (err: unknown) {
    clearTimeout(timeoutHandle);
    const latencyMs = Date.now() - startTime;
    const errMsg = err instanceof Error ? err.message : String(err);

    return {
      provider: request.provider,
      model: request.model,
      output: "",
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      status: "error",
      errorMessage: errMsg,
    };
  }
}
