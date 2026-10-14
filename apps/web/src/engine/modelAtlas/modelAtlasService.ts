/**
 * Model Atlas Service for SPE (System Prompt Engine)
 * Single source of truth query engine for cutting-edge AI models,
 * capability resolution, and commercial tier authorization.
 */

import registryData from "./modelAtlasRegistry.json" with { type: "json" };
import type {
  AiModelEntry,
  ModelCategory,
  ModelProvider,
  ModelTier,
} from "./modelAtlasSchema";

const modelsList = registryData.models as AiModelEntry[];
const modelsById = new Map<string, AiModelEntry>();
for (const m of modelsList) {
  modelsById.set(m.id, m);
}

/**
 * Returns all verified models in the Model Atlas.
 */
export function getAllModels(): AiModelEntry[] {
  return modelsList;
}

/**
 * Retrieves a specific model by its canonical ID.
 */
export function getModelById(id: string): AiModelEntry | undefined {
  return modelsById.get(id);
}

/**
 * Returns all models from a specific provider (e.g., Anthropic, OpenAI, Google).
 */
export function getModelsByProvider(provider: ModelProvider): AiModelEntry[] {
  return modelsList.filter((m) => m.provider === provider);
}

/**
 * Returns all models in a specific category (e.g., frontier-reasoning, coding-specialist).
 */
export function getModelsByCategory(category: ModelCategory): AiModelEntry[] {
  return modelsList.filter((m) => m.category === category);
}

/**
 * Returns all models matching a specific tier (e.g. free vs pro).
 */
export function getModelsForTier(tier: ModelTier): AiModelEntry[] {
  return modelsList.filter((m) => m.requiredTier === tier);
}

/**
 * Checks if a model is gated for the user's active entitlement.
 * Pro/Team users can access all models. Free users can only access models where requiredTier === "free".
 */
export function isModelGated(modelId: string, userTier?: string | null): boolean {
  const model = modelsById.get(modelId);
  if (!model) return false;
  if (model.requiredTier === "free") return false;

  // Paid tier grants access
  if (userTier === "pro" || userTier === "team" || userTier === "enterprise") {
    return false;
  }

  // Model requires Pro/Enterprise and user is Free/unauthenticated
  return true;
}

/**
 * Calculates estimated token count and input invocation cost for a given prompt.
 * Uses standard heuristic (~4 chars per token).
 */
export function calculatePromptTokenCost(
  modelId: string,
  promptText: string
): { estimatedTokens: number; inputCostUsd: number } {
  const model = modelsById.get(modelId);
  const estimatedTokens = Math.ceil(promptText.length / 4);
  if (!model || model.costInputPerM === 0) {
    return { estimatedTokens, inputCostUsd: 0 };
  }
  const inputCostUsd = (estimatedTokens / 1_000_000) * model.costInputPerM;
  return { estimatedTokens, inputCostUsd };
}

/**
 * Returns summary statistics for display in UI headers and SEO metadata.
 */
export function getModelAtlasStats(): {
  totalModels: number;
  proCount: number;
  freeCount: number;
  reasoningCount: number;
  lastUpdated: string;
  checksum: string;
} {
  return {
    totalModels: modelsList.length,
    proCount: modelsList.filter((m) => m.requiredTier === "pro").length,
    freeCount: modelsList.filter((m) => m.requiredTier === "free").length,
    reasoningCount: modelsList.filter((m) => m.capabilities.supportsThinking).length,
    lastUpdated: registryData.lastUpdated,
    checksum: registryData.checksumSha256,
  };
}
