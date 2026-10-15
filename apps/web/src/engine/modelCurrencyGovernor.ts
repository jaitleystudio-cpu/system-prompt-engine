/**
 * Frontier Model Currency Governor (FMCG) for System Prompt Engine (SPE Ω)
 *
 * MANDATE: Zero Stale Models.
 * In late 2026, language models and agent frameworks operate at a 2x forward stage.
 * Using 2024 or early 2025 AI models (such as Claude 3.x, GPT-4.x, Gemini 1.5/2.0)
 * compromises prompt reliability, token efficiency, and reasoning quality.
 *
 * This governor enforces that ALL prompt compilers, evaluation suites, export adapters,
 * and UI selectors exclusively target the active 2026 Frontier Generation.
 */

import type { AiModelEntry, ModelProvider } from "./modelAtlas/modelAtlasSchema";

export const FRONTIER_ACTIVE_YEAR = 2026;
export const FRONTIER_MIN_RELEASE_DATE = "2026-01-01";

/**
 * 2026 Active Frontier Model Definitions
 */
export const FRONTIER_MODELS_2026: AiModelEntry[] = [
  // ─── ANTHROPIC (2026 Frontier) ─────────────────────────────────────────────
  {
    id: "claude-4-5-sonnet",
    name: "Claude 4.5 Sonnet (Hybrid Frontier)",
    provider: "Anthropic",
    category: "frontier-reasoning",
    contextWindow: 262144,
    maxOutputTokens: 65536,
    costInputPerM: 2.5,
    costOutputPerM: 12.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "2026 Flagship",
    releaseDate: "2026-06-18",
    dialectTemplateKey: "claude",
    description: "Anthropic's 2026 frontier flagship. Native hybrid reasoning, zero token slop, and sovereign agentic coding precision.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "claude-4-5-opus",
    name: "Claude 4.5 Opus (Ultra Reasoning)",
    provider: "Anthropic",
    category: "frontier-reasoning",
    contextWindow: 524288,
    maxOutputTokens: 131072,
    costInputPerM: 10.0,
    costOutputPerM: 50.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Epistemic Giant",
    releaseDate: "2026-08-12",
    dialectTemplateKey: "claude",
    description: "Anthropic's maximum-depth reasoning engine for formal verification, mathematical proofs, and hyper-complex systems.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "claude-4-5-haiku",
    name: "Claude 4.5 Haiku",
    provider: "Anthropic",
    category: "general-intelligence",
    contextWindow: 262144,
    maxOutputTokens: 16384,
    costInputPerM: 0.6,
    costOutputPerM: 3.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Sub-Second Edge",
    releaseDate: "2026-07-02",
    dialectTemplateKey: "claude",
    description: "Ultra-fast, low-latency 2026 intelligence for real-time edge streaming, high-throughput extraction, and routing.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── OPENAI (2026 Frontier) ────────────────────────────────────────────────
  {
    id: "gpt-5",
    name: "OpenAI GPT-5 (Omni Flagship 2026)",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 262144,
    maxOutputTokens: 32768,
    costInputPerM: 2.0,
    costOutputPerM: 8.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "GPT-5 Omni",
    releaseDate: "2026-05-14",
    dialectTemplateKey: "chatgpt",
    description: "OpenAI's foundational 2026 frontier model with integrated real-time deliberation, multi-modal audio, and system contracts.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gpt-5-codex",
    name: "OpenAI GPT-5 Codex (Agentic Engineer)",
    provider: "OpenAI",
    category: "coding-specialist",
    contextWindow: 262144,
    maxOutputTokens: 65536,
    costInputPerM: 2.5,
    costOutputPerM: 10.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "2026 Code Engine",
    releaseDate: "2026-07-22",
    dialectTemplateKey: "cursor",
    description: "Specialized 2026 code generation and repository-scale autonomous refactoring engine powering Cursor & IDEs.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "o4-mini",
    name: "OpenAI o4-mini (High-Speed Reasoning)",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 262144,
    maxOutputTokens: 65536,
    costInputPerM: 0.8,
    costOutputPerM: 3.2,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Fast Reasoning",
    releaseDate: "2026-04-08",
    dialectTemplateKey: "chatgpt",
    description: "Next-gen compact reasoning model exceeding previous o1/o3 benchmarks at 4x lower latency.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "o3-pro",
    name: "OpenAI o3-pro (Extended Deliberation)",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 262144,
    maxOutputTokens: 100000,
    costInputPerM: 12.0,
    costOutputPerM: 48.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Heavy Reasoning",
    releaseDate: "2026-06-25",
    dialectTemplateKey: "chatgpt",
    description: "Extended deliberation flagship for deep algorithmic synthesis and competitive programming.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── GOOGLE DEEPMIND (2026 Frontier) ────────────────────────────────────────
  {
    id: "gemini-3-pro",
    name: "Google Gemini 3 Pro (4M Multimodal)",
    provider: "Google",
    category: "frontier-reasoning",
    contextWindow: 4194304,
    maxOutputTokens: 65536,
    costInputPerM: 1.0,
    costOutputPerM: 4.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "4M Ultra Context",
    releaseDate: "2026-05-20",
    dialectTemplateKey: "gemini",
    description: "Google DeepMind's 2026 4-million-token frontier giant capable of ingesting whole polyglot monorepos and video archives.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gemini-3-flash",
    name: "Google Gemini 3 Flash (Realtime Agent)",
    provider: "Google",
    category: "general-intelligence",
    contextWindow: 2097152,
    maxOutputTokens: 32768,
    costInputPerM: 0.1,
    costOutputPerM: 0.4,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Realtime 2M",
    releaseDate: "2026-06-11",
    dialectTemplateKey: "gemini",
    description: "High-speed 2026 multimodal agentic workhorse with instant tool dispatch and 2M token memory.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gemini-2-5-ultra",
    name: "Google Gemini 2.5 Ultra",
    provider: "Google",
    category: "frontier-reasoning",
    contextWindow: 2097152,
    maxOutputTokens: 65536,
    costInputPerM: 3.0,
    costOutputPerM: 12.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Deep Scientific",
    releaseDate: "2026-04-18",
    dialectTemplateKey: "gemini",
    description: "Long-horizon scientific and mathematical reasoning flagship with extreme multi-agent fidelity.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── xAI (2026 Frontier) ───────────────────────────────────────────────────
  {
    id: "grok-4",
    name: "xAI Grok 4 (Frontier Truth & Reasoning)",
    provider: "xAI",
    category: "frontier-reasoning",
    contextWindow: 262144,
    maxOutputTokens: 32768,
    costInputPerM: 2.0,
    costOutputPerM: 8.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Truth Anchor",
    releaseDate: "2026-07-15",
    dialectTemplateKey: "chatgpt",
    description: "xAI's 2026 colossal reasoning architecture with live world telemetry, zero bias anchors, and deep symbolic proofing.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "grok-3-5",
    name: "xAI Grok 3.5 Realtime",
    provider: "xAI",
    category: "general-intelligence",
    contextWindow: 131072,
    maxOutputTokens: 16384,
    costInputPerM: 0.5,
    costOutputPerM: 2.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "High Velocity",
    releaseDate: "2026-03-10",
    dialectTemplateKey: "chatgpt",
    description: "Fast-path xAI intelligence combining live web grounding with low inference latency.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── DEEPSEEK (2026 Frontier) ──────────────────────────────────────────────
  {
    id: "deepseek-r2",
    name: "DeepSeek-R2 (Open Frontier Reasoning)",
    provider: "DeepSeek",
    category: "frontier-reasoning",
    contextWindow: 131072,
    maxOutputTokens: 32768,
    costInputPerM: 0.45,
    costOutputPerM: 1.8,
    capabilities: {
      supportsThinking: true,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Open Reasoning",
    releaseDate: "2026-05-02",
    dialectTemplateKey: "chatgpt",
    description: "DeepSeek's 2026 next-generation open reasoning flagship with verified chain-of-thought traces.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "deepseek-v4",
    name: "DeepSeek-V4 (MoE Coding Engine)",
    provider: "DeepSeek",
    category: "coding-specialist",
    contextWindow: 131072,
    maxOutputTokens: 16384,
    costInputPerM: 0.12,
    costOutputPerM: 0.24,
    capabilities: {
      supportsThinking: false,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "2026 MoE Value",
    releaseDate: "2026-06-20",
    dialectTemplateKey: "chatgpt",
    description: "Extremely cost-effective 2026 Mixture-of-Experts coding model delivering frontier performance at micro-cost.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── META (2026 Frontier) ──────────────────────────────────────────────────
  {
    id: "llama-4-405b",
    name: "Meta Llama 4 405B Maverick",
    provider: "Meta",
    category: "open-weights",
    contextWindow: 262144,
    maxOutputTokens: 32768,
    costInputPerM: 0.8,
    costOutputPerM: 2.4,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Open SOTA 405B",
    releaseDate: "2026-06-28",
    dialectTemplateKey: "chatgpt",
    description: "Meta's flagship 2026 405B open-weights titan matching proprietary frontier closed models.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "llama-4-70b",
    name: "Meta Llama 4 70B Instruct",
    provider: "Meta",
    category: "open-weights",
    contextWindow: 131072,
    maxOutputTokens: 16384,
    costInputPerM: 0.15,
    costOutputPerM: 0.3,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Open Leader",
    releaseDate: "2026-05-18",
    dialectTemplateKey: "chatgpt",
    description: "Flagship everyday open weights model for local Ollama, vLLM, and private enterprise clusters.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── CREATIVE & MULTIMODAL (2026 Frontier) ─────────────────────────────────
  {
    id: "midjourney-v7",
    name: "Midjourney v7",
    provider: "Midjourney",
    category: "creative-multimodal",
    contextWindow: 4096,
    maxOutputTokens: 1,
    costInputPerM: 0.05,
    costOutputPerM: 0.05,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: false,
      supportsToolCalling: false,
      supportsStructuredOutputs: false,
    },
    requiredTier: "pro",
    badge: "v7 Photorealism",
    releaseDate: "2026-06-05",
    dialectTemplateKey: "midjourney",
    description: "2026 visual generation standard with flawless typography, complex multi-character anatomy, and coherent spatial light.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "flux-2-pro",
    name: "FLUX.2 [pro]",
    provider: "Black Forest Labs",
    category: "creative-multimodal",
    contextWindow: 4096,
    maxOutputTokens: 1,
    costInputPerM: 0.04,
    costOutputPerM: 0.04,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: false,
      supportsToolCalling: false,
      supportsStructuredOutputs: false,
    },
    requiredTier: "pro",
    badge: "Pro Composition",
    releaseDate: "2026-05-15",
    dialectTemplateKey: "flux",
    description: "Premier open-architecture visual synthesis model delivering pixel-perfect brand rendering and multi-view consistency.",
    isLegacy: false,
    generation: "2026-frontier",
  },
];

/**
 * Deterministic mapping of obsolete 2024 / early 2025 AI models to their active 2026 frontier successors.
 */
export const LEGACY_TO_FRONTIER_MAPPING: Record<string, string> = {
  // Anthropic legacy (Claude 3.x) -> Claude 4.5
  "claude-3-opus": "claude-4-5-sonnet",
  "claude-3-sonnet": "claude-4-5-sonnet",
  "claude-3-haiku": "claude-4-5-haiku",
  "claude-3-5-sonnet": "claude-4-5-sonnet",
  "claude-3-5-haiku": "claude-4-5-haiku",
  "claude-3-7-sonnet": "claude-4-5-sonnet",
  "anthropic:claude-3-7-sonnet-20250219": "claude-4-5-sonnet",

  // OpenAI legacy (GPT-4.x, o1, o3-mini) -> GPT-5 / o4-mini / o3-pro
  "gpt-4": "gpt-5",
  "gpt-4-turbo": "gpt-5",
  "gpt-4o": "gpt-5",
  "gpt-4o-mini": "o4-mini",
  "gpt-4-5": "gpt-5",
  "gpt-4.5": "gpt-5",
  "gpt-4-5-preview": "gpt-5",
  "gpt-4.5-preview": "gpt-5",
  "o1": "o4-mini",
  "o1-preview": "o4-mini",
  "o1-mini": "o4-mini",
  "o3-mini": "o4-mini",

  // Google legacy (Gemini 1.5, Gemini 2.0) -> Gemini 3
  "gemini-1-5-flash": "gemini-3-flash",
  "gemini-1.5-flash": "gemini-3-flash",
  "gemini-1-5-pro": "gemini-3-pro",
  "gemini-1.5-pro": "gemini-3-pro",
  "gemini-2-0-flash": "gemini-3-flash",
  "gemini-2.0-flash": "gemini-3-flash",
  "gemini-2-0-flash-thinking": "gemini-3-flash",
  "gemini-2.0-flash-thinking": "gemini-3-flash",
  "gemini-2-0-pro-exp": "gemini-3-pro",
  "gemini-2.0-pro-exp": "gemini-3-pro",
  "gemini-2-0-pro": "gemini-3-pro",
  "gemini-2.0-pro": "gemini-3-pro",

  // xAI legacy (Grok 2, Grok 3) -> Grok 4
  "grok-2": "grok-4",
  "grok-3": "grok-4",
  "grok-3-mini": "grok-4",

  // DeepSeek legacy (R1, V3) -> R2, V4
  "deepseek-r1": "deepseek-r2",
  "deepseek-v3": "deepseek-v4",

  // Meta legacy (Llama 3.x) -> Llama 4
  "llama-3-3-70b": "llama-4-70b",
  "llama-3.3-70b": "llama-4-70b",
  "llama-3-1-405b": "llama-4-405b",
  "llama-3.1-405b": "llama-4-405b",
  "llama-3-1-70b": "llama-4-70b",
  "llama-3.1-70b": "llama-4-70b",
  "llama-3-1-8b": "llama-4-70b",
  "llama-3.1-8b": "llama-4-70b",

  // Creative legacy -> v7 / FLUX.2
  "midjourney-v6-1": "midjourney-v7",
  "midjourney-v6.1": "midjourney-v7",
  "flux-1-pro": "flux-2-pro",
};

/**
 * Returns true if a model belongs to the active 2026 Frontier Generation.
 */
export function isModelCurrent(modelId: string): boolean {
  const cleanId = modelId.trim().toLowerCase();
  const normalizedId = cleanId.replace(/\./g, "-");
  return FRONTIER_MODELS_2026.some((m) => m.id === cleanId || m.id === normalizedId);
}

/**
 * Automatically upgrades an obsolete or legacy model ID to its active 2026 frontier successor.
 */
export function autoUpgradeLegacyModel(modelId: string): {
  upgradedId: string;
  wasLegacy: boolean;
  originalId: string;
  model: AiModelEntry;
  upgradeNotice?: string;
} {
  const normalizedId = modelId.trim().toLowerCase();
  const hyphenId = normalizedId.replace(/\./g, "-");

  // If already active 2026 frontier model, return as-is
  const activeMatch = FRONTIER_MODELS_2026.find((m) => m.id === normalizedId || m.id === hyphenId);
  if (activeMatch) {
    return {
      upgradedId: activeMatch.id,
      wasLegacy: false,
      originalId: modelId,
      model: activeMatch,
    };
  }

  // Check legacy mapping
  const mappedId = LEGACY_TO_FRONTIER_MAPPING[normalizedId] || LEGACY_TO_FRONTIER_MAPPING[hyphenId];
  if (mappedId) {
    const upgradedModel = FRONTIER_MODELS_2026.find((m) => m.id === mappedId);
    if (upgradedModel) {
      return {
        upgradedId: mappedId,
        wasLegacy: true,
        originalId: modelId,
        model: upgradedModel,
        upgradeNotice: `[FRONTIER MODEL UPGRADE] Upgraded obsolete model '${modelId}' to 2026 active frontier model '${upgradedModel.name}' (${upgradedModel.id}).`,
      };
    }
  }

  // Fallback to default 2026 frontier model
  const defaultModel = FRONTIER_MODELS_2026[0]; // Claude 4.5 Sonnet
  return {
    upgradedId: defaultModel.id,
    wasLegacy: true,
    originalId: normalizedId,
    model: defaultModel,
    upgradeNotice: `[FRONTIER MODEL UPGRADE] Unrecognized or obsolete model '${normalizedId}' automatically upgraded to 2026 default '${defaultModel.name}'.`,
  };
}

/**
 * Strict currency assertion.
 * Throws an error if an obsolete or legacy model is passed without allowLegacy flag.
 */
export function assertModelCurrency(modelId: string, context: string = "model execution"): void {
  if (isModelCurrent(modelId)) {
    return;
  }
  const upgrade = autoUpgradeLegacyModel(modelId);
  throw new Error(
    `[CURRENCY_GATE_VIOLATION] ${context}: Obsolete model '${modelId}' rejected. SPE requires active 2026 frontier models. Use '${upgrade.upgradedId}' (${upgrade.model.name}) instead.`
  );
}

/**
 * Default 2026 Frontier Model for general prompt compilation and system execution.
 */
export function getDefaultFrontierModel(): AiModelEntry {
  return FRONTIER_MODELS_2026[0]; // Claude 4.5 Sonnet
}

/**
 * Returns all active 2026 frontier models.
 */
export function getActiveFrontierModels(): AiModelEntry[] {
  return [...FRONTIER_MODELS_2026];
}

/**
 * Returns active 2026 frontier models filtered by provider.
 */
export function getFrontierModelsByProvider(provider: ModelProvider): AiModelEntry[] {
  return FRONTIER_MODELS_2026.filter((m) => m.provider === provider);
}
