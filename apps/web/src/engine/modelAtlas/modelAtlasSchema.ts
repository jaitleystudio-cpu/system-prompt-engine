/**
 * Model Atlas Schema for SPE (System Prompt Engine)
 * Defines the canonical types for dynamic, real-time AI model discovery,
 * capability tracking, and commercial tier gating.
 */

export type ModelTier = "free" | "pro" | "enterprise";

export type ModelCategory =
  | "frontier-reasoning"
  | "coding-specialist"
  | "general-intelligence"
  | "creative-multimodal"
  | "open-weights";

export type ModelProvider =
  | "Anthropic"
  | "OpenAI"
  | "Google"
  | "xAI"
  | "DeepSeek"
  | "Meta"
  | "Mistral"
  | "Alibaba"
  | "Midjourney"
  | "Black Forest Labs"
  | "Runway"
  | "Suno";

export interface ModelCapabilities {
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsSystemRole: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutputs: boolean;
}

export interface AiModelEntry {
  id: string;
  name: string;
  provider: ModelProvider;
  category: ModelCategory;
  contextWindow: number;
  maxOutputTokens: number;
  costInputPerM: number;
  costOutputPerM: number;
  capabilities: ModelCapabilities;
  requiredTier: ModelTier;
  badge?: string;
  releaseDate: string;
  dialectTemplateKey: string;
  description: string;
}

export interface ModelAtlasRegistry {
  version: string;
  lastUpdated: string;
  checksumSha256: string;
  totalModels: number;
  models: AiModelEntry[];
}
