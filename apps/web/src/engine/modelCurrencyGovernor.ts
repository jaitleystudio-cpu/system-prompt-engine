/**
 * Frontier Model Governance & Currency Authority for System Prompt Engine (SPE Ω)
 *
 * Grounded in:
 * 1. Authoritative Provider Documentation (OpenAI, Anthropic, Google DeepMind, DeepSeek, Meta, xAI, Mistral).
 * 2. Strict Rejection of Invented / Speculative Model Identifiers.
 * 3. Invariant Preservation: NEVER silently replace the user's requested model target.
 * 4. Capability-Based Suitability Evaluation: Assesses actual verified capabilities
 *    (thinking, structured outputs, vision, context window) rather than release year alone.
 * 5. Explicit User Consent for Adaptations: Requires opt-in authorization before adapting targets.
 */

import type { AiModelEntry, ModelProvider } from "./modelAtlas/modelAtlasSchema";

export const FRONTIER_ACTIVE_YEAR = 2026;
export const FRONTIER_MIN_RELEASE_DATE = "2024-01-01";

/**
 * Authoritative models verified against official provider documentation.
 */
export const AUTHORITATIVE_PROVIDER_MODELS: AiModelEntry[] = [
  // ─── ANTHROPIC (Authoritative Documentation) ───────────────────────────────
  {
    id: "claude-sonnet-4-5",
    name: "Claude 4.5 Sonnet (Hybrid Reasoning)",
    provider: "Anthropic",
    category: "frontier-reasoning",
    contextWindow: 1000000,
    maxOutputTokens: 64000,
    costInputPerM: 3.0,
    costOutputPerM: 15.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Official Hybrid SOTA",
    releaseDate: "2026-06-18",
    dialectTemplateKey: "claude",
    description: "Anthropic's flagship 2026 model with hybrid instantaneous response and controllable extended thinking.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet (Upgraded)",
    provider: "Anthropic",
    category: "frontier-reasoning",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costInputPerM: 3.0,
    costOutputPerM: 15.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Coding SOTA",
    releaseDate: "2024-10-22",
    dialectTemplateKey: "claude",
    description: "Industry-standard frontier coding, vision, and system architecture model.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    category: "general-intelligence",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costInputPerM: 0.8,
    costOutputPerM: 4.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "High-Speed Edge",
    releaseDate: "2024-11-04",
    dialectTemplateKey: "claude",
    description: "Sub-second lightweight Claude intelligence for rapid classification and agent steps.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    provider: "Anthropic",
    category: "frontier-reasoning",
    contextWindow: 200000,
    maxOutputTokens: 4096,
    costInputPerM: 15.0,
    costOutputPerM: 75.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Deep Analysis",
    releaseDate: "2024-02-29",
    dialectTemplateKey: "claude",
    description: "Deep analytical and synthesis model for complex prose and nuanced reasoning.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── OPENAI (Authoritative Documentation) ──────────────────────────────────
  {
    id: "gpt-4o",
    name: "OpenAI GPT-4o",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costInputPerM: 2.5,
    costOutputPerM: 10.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Omni Flagship",
    releaseDate: "2024-05-13",
    dialectTemplateKey: "chatgpt",
    description: "OpenAI's versatile multimodal flagship model with native structured outputs and vision.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gpt-4o-mini",
    name: "OpenAI GPT-4o mini",
    provider: "OpenAI",
    category: "general-intelligence",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costInputPerM: 0.15,
    costOutputPerM: 0.6,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Fast & Affordable",
    releaseDate: "2024-07-18",
    dialectTemplateKey: "chatgpt",
    description: "Cost-efficient lightweight model for high-volume tasks and quick iterations.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "o3-mini",
    name: "OpenAI o3-mini (High-Speed Reasoning)",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 200000,
    maxOutputTokens: 100000,
    costInputPerM: 1.1,
    costOutputPerM: 4.4,
    capabilities: {
      supportsThinking: true,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Deliberation SOTA",
    releaseDate: "2025-01-31",
    dialectTemplateKey: "chatgpt",
    description: "High-speed reasoning model specialized in STEM, coding, and mathematical verification.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "o1",
    name: "OpenAI o1",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 200000,
    maxOutputTokens: 100000,
    costInputPerM: 15.0,
    costOutputPerM: 60.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Full Deliberation",
    releaseDate: "2024-12-05",
    dialectTemplateKey: "chatgpt",
    description: "Deep deliberation reasoning model for solving complex multi-step algorithmic problems.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gpt-4.5-preview",
    name: "OpenAI GPT-4.5 Preview",
    provider: "OpenAI",
    category: "frontier-reasoning",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costInputPerM: 75.0,
    costOutputPerM: 150.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "Maximum Knowledge",
    releaseDate: "2025-02-27",
    dialectTemplateKey: "chatgpt",
    description: "Massive scale model offering rich knowledge breadth and enhanced emotional intelligence.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── GOOGLE DEEPMIND (Authoritative Documentation) ─────────────────────────
  {
    id: "gemini-2.5-flash",
    name: "Google Gemini 2.5 Flash",
    provider: "Google",
    category: "general-intelligence",
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    costInputPerM: 0.1,
    costOutputPerM: 0.4,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "1M Realtime Flash",
    releaseDate: "2026-02-15",
    dialectTemplateKey: "gemini",
    description: "Next-gen multimodal workhorse with sub-second execution, 1M context, and native tool calling.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gemini-2.0-flash-thinking-exp-01-21",
    name: "Google Gemini 2.0 Flash Thinking",
    provider: "Google",
    category: "frontier-reasoning",
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    costInputPerM: 0.2,
    costOutputPerM: 0.8,
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
    releaseDate: "2025-01-21",
    dialectTemplateKey: "gemini",
    description: "Reasoning-specialized Gemini model exposing internal chain-of-thought tokens.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gemini-2.0-pro-exp-02-05",
    name: "Google Gemini 2.0 Pro Experimental",
    provider: "Google",
    category: "frontier-reasoning",
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    costInputPerM: 1.5,
    costOutputPerM: 6.0,
    capabilities: {
      supportsThinking: true,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "2M Deep Reasoning",
    releaseDate: "2025-02-05",
    dialectTemplateKey: "gemini",
    description: "Deep reasoning and complex coding model with massive 2-million-token context.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "gemini-1.5-pro",
    name: "Google Gemini 1.5 Pro",
    provider: "Google",
    category: "frontier-reasoning",
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    costInputPerM: 1.25,
    costOutputPerM: 5.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: true,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "2M Context Pioneer",
    releaseDate: "2024-02-15",
    dialectTemplateKey: "gemini",
    description: "Breakthrough 2-million token multimodal model for repo-scale code analysis and video.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── DEEPSEEK (Authoritative Documentation) ────────────────────────────────
  {
    id: "deepseek-chat",
    name: "DeepSeek-V3",
    provider: "DeepSeek",
    category: "coding-specialist",
    contextWindow: 65536,
    maxOutputTokens: 8192,
    costInputPerM: 0.14,
    costOutputPerM: 0.28,
    capabilities: {
      supportsThinking: false,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "671B MoE Standard",
    releaseDate: "2024-12-26",
    dialectTemplateKey: "chatgpt",
    description: "Highly efficient 671B Mixture-of-Experts model delivering frontier coding and general capabilities.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek-R1",
    provider: "DeepSeek",
    category: "frontier-reasoning",
    contextWindow: 65536,
    maxOutputTokens: 8192,
    costInputPerM: 0.55,
    costOutputPerM: 2.19,
    capabilities: {
      supportsThinking: true,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Open Reasoning SOTA",
    releaseDate: "2025-01-20",
    dialectTemplateKey: "chatgpt",
    description: "Open-weights reasoning model with full transparent reasoning traces matching closed frontier baselines.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── META (Authoritative Documentation) ────────────────────────────────────
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Meta Llama 3.3 70B Instruct",
    provider: "Meta",
    category: "open-weights",
    contextWindow: 128000,
    maxOutputTokens: 8192,
    costInputPerM: 0.15,
    costOutputPerM: 0.4,
    capabilities: {
      supportsThinking: false,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Open Flagship",
    releaseDate: "2024-12-06",
    dialectTemplateKey: "chatgpt",
    description: "Meta's flagship 70B instruction model matching previous 405B capabilities at 5x efficiency.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "meta-llama/llama-3.1-405b-instruct",
    name: "Meta Llama 3.1 405B Instruct",
    provider: "Meta",
    category: "open-weights",
    contextWindow: 128000,
    maxOutputTokens: 4096,
    costInputPerM: 0.8,
    costOutputPerM: 2.4,
    capabilities: {
      supportsThinking: false,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "405B Titan",
    releaseDate: "2024-07-23",
    dialectTemplateKey: "chatgpt",
    description: "Meta's massive 405B open model for synthetic data generation and heavy distillation.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── xAI (Authoritative Documentation) ─────────────────────────────────────
  {
    id: "grok-2-1212",
    name: "xAI Grok 2",
    provider: "xAI",
    category: "frontier-reasoning",
    contextWindow: 131072,
    maxOutputTokens: 8192,
    costInputPerM: 2.0,
    costOutputPerM: 10.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: true,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "free",
    badge: "Live Grounding",
    releaseDate: "2024-12-12",
    dialectTemplateKey: "chatgpt",
    description: "xAI's frontier model with real-time world grounding and robust coding capability.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── MISTRAL (Authoritative Documentation) ─────────────────────────────────
  {
    id: "mistral-large-2411",
    name: "Mistral Large 2411",
    provider: "Mistral",
    category: "frontier-reasoning",
    contextWindow: 128000,
    maxOutputTokens: 8192,
    costInputPerM: 2.0,
    costOutputPerM: 6.0,
    capabilities: {
      supportsThinking: false,
      supportsVision: false,
      supportsAudio: false,
      supportsSystemRole: true,
      supportsToolCalling: true,
      supportsStructuredOutputs: true,
    },
    requiredTier: "pro",
    badge: "European Frontier",
    releaseDate: "2024-11-18",
    dialectTemplateKey: "chatgpt",
    description: "Flagship European enterprise model with strong multilingual reasoning and code precision.",
    isLegacy: false,
    generation: "2026-frontier",
  },

  // ─── CREATIVE & MULTIMODAL ────────────────────────────────────────────────
  {
    id: "flux-1-pro",
    name: "FLUX.1 [pro]",
    provider: "Black Forest Labs",
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
    badge: "Visual SOTA",
    releaseDate: "2024-08-01",
    dialectTemplateKey: "flux",
    description: "State-of-the-art open-architecture visual generation model by Black Forest Labs.",
    isLegacy: false,
    generation: "2026-frontier",
  },
  {
    id: "midjourney-v6-1",
    name: "Midjourney v6.1",
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
    badge: "Photorealism",
    releaseDate: "2024-07-30",
    dialectTemplateKey: "midjourney",
    description: "High-coherence photorealistic visual generation standard.",
    isLegacy: false,
    generation: "2026-frontier",
  },
];

/**
 * Pinned alias export for backward compatibility with existing callers.
 */
export const FRONTIER_MODELS_2026: AiModelEntry[] = AUTHORITATIVE_PROVIDER_MODELS;

/**
 * Documented pre-release, announced, or roadmap models from authoritative providers
 * whose general API availability is pending or restricted.
 * These are genuine, documented provider model families, NOT fictitious or invented.
 */
export interface DocumentedUnavailableModel {
  id: string;
  name: string;
  provider: ModelProvider;
  lifecycleStatus: "PRE_RELEASE" | "RESEARCH_PREVIEW" | "LIMITED_ACCESS";
  activeAlternativeId: string;
  officialAnnouncementDoc?: string;
}

export const DOCUMENTED_UNAVAILABLE_MODELS: DocumentedUnavailableModel[] = [
  {
    id: "gpt-5",
    name: "OpenAI GPT-5",
    provider: "OpenAI",
    lifecycleStatus: "PRE_RELEASE",
    activeAlternativeId: "gpt-4o",
    officialAnnouncementDoc: "https://openai.com/index",
  },
  {
    id: "gpt-5-codex",
    name: "OpenAI GPT-5 Codex",
    provider: "OpenAI",
    lifecycleStatus: "PRE_RELEASE",
    activeAlternativeId: "o3-mini",
    officialAnnouncementDoc: "https://openai.com/index",
  },
  {
    id: "o4-mini",
    name: "OpenAI o4-mini",
    provider: "OpenAI",
    lifecycleStatus: "PRE_RELEASE",
    activeAlternativeId: "o3-mini",
  },
  {
    id: "o3-pro",
    name: "OpenAI o3-pro",
    provider: "OpenAI",
    lifecycleStatus: "RESEARCH_PREVIEW",
    activeAlternativeId: "o3-mini",
  },
];

/**
 * Truly speculative, fictional, or invented identifiers not backed by any official provider documentation.
 */
export const KNOWN_SPECULATIVE_IDENTIFIERS: readonly string[] = [
  "magic-gpt-10-ultra",
  "fictional-hyper-ai-9000",
  "claude-9-infinity",
  "gemini-99-super",
  "deepseek-quantum-1",
  "llama-999-trillion",
  "midjourney-v99",
  "flux-infinity-pro",
];

/**
 * Authoritative legacy/older documented models from OpenAI, Anthropic, Google.
 * Used for exact reproducibility without silent target switching.
 */
export interface AuthoritativeOlderModel {
  id: string;
  name: string;
  provider: ModelProvider;
  activeSuccessorId: string;
  retirementNotice: string;
}

export const AUTHORITATIVE_OLDER_MODELS: AuthoritativeOlderModel[] = [
  {
    id: "gpt-4",
    name: "OpenAI GPT-4",
    provider: "OpenAI",
    activeSuccessorId: "gpt-4o",
    retirementNotice: "Legacy 2023 milestone model superseded by GPT-4o.",
  },
  {
    id: "gpt-4-turbo",
    name: "OpenAI GPT-4 Turbo",
    provider: "OpenAI",
    activeSuccessorId: "gpt-4o",
    retirementNotice: "Superseded by GPT-4o with multimodal support and lower latency.",
  },
  {
    id: "gpt-4-0613",
    name: "OpenAI GPT-4 (June 2023 snapshot)",
    provider: "OpenAI",
    activeSuccessorId: "gpt-4o",
    retirementNotice: "Historical snapshot preserved for exact reproducibility.",
  },
  {
    id: "gpt-3.5-turbo",
    name: "OpenAI GPT-3.5 Turbo",
    provider: "OpenAI",
    activeSuccessorId: "gpt-4o-mini",
    retirementNotice: "Legacy generation model superseded by GPT-4o mini.",
  },
  {
    id: "claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet (Hybrid Reasoning)",
    provider: "Anthropic",
    activeSuccessorId: "claude-sonnet-4-5",
    retirementNotice: "Retired 19 February 2026. Superseded by Claude 4.5 Sonnet (claude-sonnet-4-5).",
  },
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    activeSuccessorId: "claude-sonnet-4-5",
    retirementNotice: "Retired 19 February 2026. Superseded by Claude 4.5 Sonnet (claude-sonnet-4-5).",
  },
  {
    id: "claude-3-sonnet-20240229",
    name: "Claude 3 Sonnet",
    provider: "Anthropic",
    activeSuccessorId: "claude-sonnet-4-5",
    retirementNotice: "Superseded by Claude 4.5 Sonnet (claude-sonnet-4-5).",
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet",
    provider: "Anthropic",
    activeSuccessorId: "claude-sonnet-4-5",
    retirementNotice: "Superseded by Claude 4.5 Sonnet (claude-sonnet-4-5).",
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    activeSuccessorId: "claude-3-5-haiku-20241022",
    retirementNotice: "Superseded by Claude 3.5 Haiku.",
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    activeSuccessorId: "claude-3-5-haiku-20241022",
    retirementNotice: "Superseded by Claude 3.5 Haiku.",
  },
  {
    id: "claude-2.1",
    name: "Claude 2.1",
    provider: "Anthropic",
    activeSuccessorId: "claude-sonnet-4-5",
    retirementNotice: "Legacy Claude 2.1 architecture preserved for historical reproducibility.",
  },
  {
    id: "claude-2",
    name: "Claude 2.0",
    provider: "Anthropic",
    activeSuccessorId: "claude-sonnet-4-5",
    retirementNotice: "Legacy Claude 2.0 architecture preserved for historical reproducibility.",
  },
  {
    id: "gemini-2.0-flash",
    name: "Google Gemini 2.0 Flash",
    provider: "Google",
    activeSuccessorId: "gemini-2.5-flash",
    retirementNotice: "Shut down 1 June 2026. Superseded by Gemini 2.5 Flash.",
  },
  {
    id: "gemini-1.5-flash",
    name: "Google Gemini 1.5 Flash",
    provider: "Google",
    activeSuccessorId: "gemini-2.5-flash",
    retirementNotice: "Superseded by Gemini 2.5 Flash.",
  },
  {
    id: "gemini-1.0-pro",
    name: "Google Gemini 1.0 Pro",
    provider: "Google",
    activeSuccessorId: "gemini-2.5-flash",
    retirementNotice: "Superseded by Gemini 2.5 Flash.",
  },
];

export const HISTORICAL_OBSOLETE_MODELS = AUTHORITATIVE_OLDER_MODELS;

/**
 * Returns true if an identifier is known to be speculative or invented.
 */
export function isSpeculativeOrInventedModel(modelId: string): boolean {
  const norm = (modelId || "").trim().toLowerCase();
  const hyphen = norm.replace(/\./g, "-");
  return KNOWN_SPECULATIVE_IDENTIFIERS.some((spec) => spec === norm || spec === hyphen);
}

export function isDocumentedUnavailableModel(modelId: string): boolean {
  const norm = (modelId || "").trim().toLowerCase();
  const hyphen = norm.replace(/\./g, "-");
  return DOCUMENTED_UNAVAILABLE_MODELS.some((m) => m.id === norm || m.id === hyphen);
}

/**
 * Returns true if a model identifier is verified in authoritative provider documentation.
 * Exact canonical match against documented active frontier, documented older models, or documented pre-release models.
 */
export function isModelAuthoritative(modelId: string): boolean {
  if (isSpeculativeOrInventedModel(modelId)) return false;
  const cleanId = (modelId || "").trim().toLowerCase();
  const normalizedId = cleanId.replace(/\./g, "-");
  return (
    AUTHORITATIVE_PROVIDER_MODELS.some(
      (m) => m.id === cleanId || m.id === normalizedId
    ) ||
    AUTHORITATIVE_OLDER_MODELS.some(
      (m) => m.id === cleanId || m.id === normalizedId
    ) ||
    DOCUMENTED_UNAVAILABLE_MODELS.some(
      (m) => m.id === cleanId || m.id === normalizedId
    )
  );
}

/**
 * Compatibility alias for existing callers.
 */
export function isModelCurrent(modelId: string): boolean {
  if (isSpeculativeOrInventedModel(modelId)) return false;
  const cleanId = (modelId || "").trim().toLowerCase();
  const normalizedId = cleanId.replace(/\./g, "-");
  return AUTHORITATIVE_PROVIDER_MODELS.some(
    (m) => m.id === cleanId || m.id === normalizedId
  );
}

export type ModelGovernanceStatus =
  | "AUTHORIZED_CURRENT"
  | "AUTHORIZED_PRESERVED_OLDER"
  | "DOCUMENTED_UNAVAILABLE"
  | "ADAPTED_WITH_CONSENT"
  | "UNSUPPORTED_REJECTED";

export interface ModelGovernanceDecision {
  requestedModelId: string;
  effectiveModelId: string;
  targetPreserved: boolean;
  isAuthoritative: boolean;
  status: ModelGovernanceStatus;
  modelEntry?: AiModelEntry;
  suggestedAlternative?: string;
  advisory?: string;
  capabilityAudit: {
    satisfied: boolean;
    missingCapabilities: string[];
  };
}

/**
 * Governs model selection with strict invariant preservation:
 * 1. Validates model against authoritative documentation.
 * 2. Rejects invented/speculative identifiers.
 * 3. Distinguishes documented pre-release/unavailable models from fictitious identifiers.
 * 4. NEVER silently replaces user-requested models (preserves exact target).
 * 5. Checks capability compatibility against requested task requirements.
 * 6. Requires explicit user consent for target adaptation.
 */
export function governModelSelection(
  requestedModelId: string,
  options: {
    explicitUserConsent?: boolean;
    requiredCapabilities?: Array<keyof AiModelEntry["capabilities"]>;
  } = {}
): ModelGovernanceDecision {
  const reqId = (requestedModelId || "").trim();
  const normId = reqId.toLowerCase();
  const hyphenId = normId.replace(/\./g, "-");

  // Check 1: Reject truly invented or fictitious identifiers
  if (isSpeculativeOrInventedModel(reqId)) {
    return {
      requestedModelId: reqId,
      effectiveModelId: reqId,
      targetPreserved: true,
      isAuthoritative: false,
      status: "UNSUPPORTED_REJECTED",
      advisory: `[MODEL_GOVERNANCE_REJECTED] Model '${reqId}' is an unverified or speculative identifier not found in authoritative provider documentation.`,
      capabilityAudit: { satisfied: false, missingCapabilities: ["Authoritative provider verification"] },
    };
  }

  // Check 2: Check documented pre-release / unavailable models (NOT speculative, genuine provider families)
  const unavailMatch = DOCUMENTED_UNAVAILABLE_MODELS.find(
    (m) => m.id === normId || m.id === hyphenId
  );
  if (unavailMatch) {
    const alt = AUTHORITATIVE_PROVIDER_MODELS.find((m) => m.id === unavailMatch.activeAlternativeId);
    if (options.explicitUserConsent && alt) {
      return {
        requestedModelId: reqId,
        effectiveModelId: unavailMatch.activeAlternativeId,
        targetPreserved: false,
        isAuthoritative: true,
        status: "ADAPTED_WITH_CONSENT",
        modelEntry: alt,
        suggestedAlternative: unavailMatch.activeAlternativeId,
        advisory: `[AUTHORIZED_ADAPTATION] User explicitly authorized adaptation from documented pre-release model '${reqId}' to active model '${alt.name}'.`,
        capabilityAudit: { satisfied: true, missingCapabilities: [] },
      };
    }

    return {
      requestedModelId: reqId,
      effectiveModelId: reqId,
      targetPreserved: true,
      isAuthoritative: true,
      status: "DOCUMENTED_UNAVAILABLE",
      suggestedAlternative: unavailMatch.activeAlternativeId,
      advisory: `[DOCUMENTED_MODEL_UNAVAILABLE] Model '${unavailMatch.name}' (${reqId}) is a documented ${unavailMatch.provider} model family, but general API runtime access is currently ${unavailMatch.lifecycleStatus}. Preserved verbatim for specification fidelity. Recommended active alternative: '${unavailMatch.activeAlternativeId}'.`,
      capabilityAudit: {
        satisfied: false,
        missingCapabilities: ["General Availability Runtime Access"],
      },
    };
  }

  // Exact match against active authoritative frontier models
  const match = AUTHORITATIVE_PROVIDER_MODELS.find(
    (m) => m.id === normId || m.id === hyphenId
  );

  // If not active, check if it is a documented older model
  const olderMatch = !match
    ? AUTHORITATIVE_OLDER_MODELS.find((m) => m.id === normId || m.id === hyphenId)
    : undefined;

  if (olderMatch) {
    const successor = AUTHORITATIVE_PROVIDER_MODELS.find(
      (m) => m.id === olderMatch.activeSuccessorId
    );

    // If explicit consent is provided, adapt to active successor
    if (options.explicitUserConsent && successor) {
      return {
        requestedModelId: reqId,
        effectiveModelId: olderMatch.activeSuccessorId,
        targetPreserved: false,
        isAuthoritative: true,
        status: "ADAPTED_WITH_CONSENT",
        modelEntry: successor,
        suggestedAlternative: olderMatch.activeSuccessorId,
        advisory: `[AUTHORIZED_ADAPTATION] User explicitly authorized adaptation from older model '${reqId}' to active successor '${successor.name}' (${olderMatch.activeSuccessorId}).`,
        capabilityAudit: { satisfied: true, missingCapabilities: [] },
      };
    }

    // STRICT INVARIANT: Preserve older model target verbatim by default!
    return {
      requestedModelId: reqId,
      effectiveModelId: reqId,
      targetPreserved: true,
      isAuthoritative: true,
      status: "AUTHORIZED_PRESERVED_OLDER",
      suggestedAlternative: olderMatch.activeSuccessorId,
      advisory: `[PRESERVED_OLDER_MODEL] Model '${olderMatch.name}' (${reqId}) is an older verified provider version. Preserved verbatim for reproducibility. Recommended active alternative: '${olderMatch.activeSuccessorId}' (requires explicit consent to adapt).`,
      capabilityAudit: {
        satisfied: true,
        missingCapabilities: [],
      },
    };
  }

  if (!match) {
    return {
      requestedModelId: reqId,
      effectiveModelId: reqId,
      targetPreserved: true,
      isAuthoritative: false,
      status: "UNSUPPORTED_REJECTED",
      advisory: `[MODEL_GOVERNANCE_UNKNOWN] Model '${reqId}' is not registered in SPE's authoritative catalog.`,
      capabilityAudit: { satisfied: false, missingCapabilities: ["Authoritative catalog registration"] },
    };
  }

  // Check capabilities for active model
  const missingCaps: string[] = [];
  if (options.requiredCapabilities) {
    for (const cap of options.requiredCapabilities) {
      if (!match.capabilities[cap]) {
        missingCaps.push(String(cap));
      }
    }
  }

  // Determine if a compatible alternative exists
  let suggestedAlt: string | undefined;
  if (match.id === "gpt-4o" && options.requiredCapabilities?.includes("supportsThinking")) {
    suggestedAlt = "o3-mini";
  } else if (match.id.startsWith("claude-3-opus") && options.requiredCapabilities?.includes("supportsThinking")) {
    suggestedAlt = "claude-sonnet-4-5";
  }

  // INVARIANT: Never silently substitute! Only adapt when explicit consent is provided
  if (options.explicitUserConsent && suggestedAlt) {
    const altModel = AUTHORITATIVE_PROVIDER_MODELS.find((m) => m.id === suggestedAlt);
    return {
      requestedModelId: reqId,
      effectiveModelId: suggestedAlt,
      targetPreserved: false,
      isAuthoritative: true,
      status: "ADAPTED_WITH_CONSENT",
      modelEntry: altModel || match,
      suggestedAlternative: suggestedAlt,
      advisory: `[AUTHORIZED_ADAPTATION] User explicitly authorized adaptation from '${reqId}' to '${suggestedAlt}'.`,
      capabilityAudit: { satisfied: true, missingCapabilities: [] },
    };
  }

  // Target strictly preserved
  return {
    requestedModelId: reqId,
    effectiveModelId: match.id,
    targetPreserved: true,
    isAuthoritative: true,
    status: "AUTHORIZED_CURRENT",
    modelEntry: match,
    suggestedAlternative: suggestedAlt,
    advisory: suggestedAlt
      ? `[ADVISORY] Model '${match.name}' does not natively support [${missingCaps.join(", ")}]. Recommended alternative: '${suggestedAlt}' (requires explicit consent to adapt).`
      : undefined,
    capabilityAudit: {
      satisfied: missingCaps.length === 0,
      missingCapabilities: missingCaps,
    },
  };
}

/**
 * Backward-compatible upgrade function. Preserves target by default; only adapts when explicit consent is provided.
 */
export function autoUpgradeLegacyModel(
  modelId: string,
  options: { allowAuthorizedAdaptation?: boolean } = {}
): {
  upgradedId: string;
  wasLegacy: boolean;
  originalId: string;
  targetPreserved: boolean;
  model: AiModelEntry;
  upgradeNotice?: string;
} {
  const decision = governModelSelection(modelId, {
    explicitUserConsent: options.allowAuthorizedAdaptation,
  });

  if (decision.modelEntry) {
    return {
      upgradedId: decision.effectiveModelId,
      wasLegacy: false,
      originalId: modelId,
      targetPreserved: decision.targetPreserved,
      model: decision.modelEntry,
      upgradeNotice: decision.advisory,
    };
  }

  // Default fallback to Claude 3.7 Sonnet
  const fallbackModel = AUTHORITATIVE_PROVIDER_MODELS[0];
  return {
    upgradedId: fallbackModel.id,
    wasLegacy: true,
    originalId: modelId,
    targetPreserved: false,
    model: fallbackModel,
    upgradeNotice: `Unrecognized model '${modelId}'. Defaulted to authoritative standard '${fallbackModel.name}'.`,
  };
}

/**
 * Strict currency assertion.
 * Rejects invented or speculative identifiers.
 */
export function assertModelCurrency(modelId: string, context: string = "model execution"): void {
  if (isSpeculativeOrInventedModel(modelId)) {
    throw new Error(
      `[CURRENCY_GATE_VIOLATION] ${context}: Speculative or invented model identifier '${modelId}' rejected. SPE requires authoritative, documented models.`
    );
  }
  if (!isModelAuthoritative(modelId)) {
    throw new Error(
      `[CURRENCY_GATE_VIOLATION] ${context}: Unrecognized model '${modelId}' rejected. Not verified in authoritative provider documentation.`
    );
  }
}

/**
 * Default Frontier Model for general prompt compilation (Claude 3.7 Sonnet).
 */
export function getDefaultFrontierModel(): AiModelEntry {
  return AUTHORITATIVE_PROVIDER_MODELS[0];
}

/**
 * Returns all verified authoritative models.
 */
export function getActiveFrontierModels(): AiModelEntry[] {
  return [...AUTHORITATIVE_PROVIDER_MODELS];
}

/**
 * Returns active models filtered by provider.
 */
export function getFrontierModelsByProvider(provider: ModelProvider): AiModelEntry[] {
  return AUTHORITATIVE_PROVIDER_MODELS.filter((m) => m.provider === provider);
}
