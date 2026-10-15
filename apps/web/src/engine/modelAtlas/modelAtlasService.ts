/**
 * Model Atlas Service for SPE (System Prompt Engine)
 * Single source of truth query engine for cutting-edge AI models,
 * capability resolution, and commercial tier authorization.
 *
 * MANDATE: Zero Stale Models. Enforces 2026 Frontier Generation.
 */

import registryData from "./modelAtlasRegistry.json" with { type: "json" };
import type {
  AiModelEntry,
  ModelCategory,
  ModelProvider,
  ModelTier,
} from "./modelAtlasSchema";
import {
  autoUpgradeLegacyModel,
  isModelCurrent,
  FRONTIER_MODELS_2026,
  getDefaultFrontierModel,
  assertModelCurrency,
} from "../modelCurrencyGovernor.ts";

const modelsList = registryData.models as AiModelEntry[];
const modelsById = new Map<string, AiModelEntry>();
for (const m of modelsList) {
  modelsById.set(m.id, m);
}

/**
 * Returns all verified models in the Model Atlas.
 * By default, returns ONLY active 2026 Frontier Models.
 * Pass { includeLegacy: true } to inspect deprecated historical models.
 */
export function getAllModels(options: { includeLegacy?: boolean } = {}): AiModelEntry[] {
  if (options.includeLegacy) {
    return modelsList;
  }
  return modelsList.filter((m) => !m.isLegacy);
}

/**
 * Returns strictly 2026 active frontier models.
 */
export function getActiveFrontierModels(): AiModelEntry[] {
  return modelsList.filter((m) => !m.isLegacy && m.generation === "2026-frontier");
}

/**
 * Retrieves a specific model by its canonical ID.
 * If the requested model is legacy/obsolete and autoUpgrade is true,
 * it returns the upgraded 2026 frontier model.
 */
export function getModelById(id: string, autoUpgrade: boolean = true): AiModelEntry | undefined {
  const model = modelsById.get(id);
  if (!model) {
    if (autoUpgrade) {
      const upgrade = autoUpgradeLegacyModel(id);
      return upgrade.model;
    }
    return undefined;
  }

  if (model.isLegacy && autoUpgrade) {
    const upgrade = autoUpgradeLegacyModel(id);
    return upgrade.model;
  }

  return model;
}

/**
 * Returns all models from a specific provider (e.g., Anthropic, OpenAI, Google).
 * Filters out obsolete legacy models by default.
 */
export function getModelsByProvider(
  provider: ModelProvider,
  options: { includeLegacy?: boolean } = {}
): AiModelEntry[] {
  return modelsList.filter((m) => m.provider === provider && (options.includeLegacy || !m.isLegacy));
}

/**
 * Returns all models in a specific category (e.g., frontier-reasoning, coding-specialist).
 * Filters out obsolete legacy models by default.
 */
export function getModelsByCategory(
  category: ModelCategory,
  options: { includeLegacy?: boolean } = {}
): AiModelEntry[] {
  return modelsList.filter((m) => m.category === category && (options.includeLegacy || !m.isLegacy));
}

/**
 * Returns all models matching a specific tier (e.g. free vs pro).
 * Filters out obsolete legacy models by default.
 */
export function getModelsForTier(
  tier: ModelTier,
  options: { includeLegacy?: boolean } = {}
): AiModelEntry[] {
  return modelsList.filter((m) => m.requiredTier === tier && (options.includeLegacy || !m.isLegacy));
}

/**
 * Checks if a model is gated for the user's active entitlement.
 * Pro/Team users can access all models. Free users can only access models where requiredTier === "free".
 */
export function isModelGated(modelId: string, userTier?: string | null): boolean {
  const model = getModelById(modelId, true);
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
  const model = getModelById(modelId, true);
  const estimatedTokens = Math.ceil(promptText.length / 4);
  if (!model || model.costInputPerM === 0) {
    return { estimatedTokens, inputCostUsd: 0 };
  }
  const inputCostUsd = (estimatedTokens / 1_000_000) * model.costInputPerM;
  return { estimatedTokens, inputCostUsd };
}

/**
 * Returns summary statistics for display in UI headers and SEO metadata.
 * Reports on active 2026 frontier models.
 */
export function getModelAtlasStats(): {
  totalModels: number;
  frontierCount: number;
  proCount: number;
  freeCount: number;
  reasoningCount: number;
  lastUpdated: string;
  checksum: string;
} {
  const activeModels = modelsList.filter((m) => !m.isLegacy);
  return {
    totalModels: modelsList.length,
    frontierCount: activeModels.length,
    proCount: activeModels.filter((m) => m.requiredTier === "pro").length,
    freeCount: activeModels.filter((m) => m.requiredTier === "free").length,
    reasoningCount: activeModels.filter((m) => m.capabilities.supportsThinking).length,
    lastUpdated: registryData.lastUpdated,
    checksum: registryData.checksumSha256,
  };
}

export {
  autoUpgradeLegacyModel,
  isModelCurrent,
  FRONTIER_MODELS_2026,
  getDefaultFrontierModel,
  assertModelCurrency,
};
