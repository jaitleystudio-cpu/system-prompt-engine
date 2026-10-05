/**
 * SPE Ω — Provider Feasibility & Long-Form Document Planner
 *
 * Implements:
 * - Section 8: Downstream output control loop with bounded retries.
 * - Section 10: Provider limits registry and feasibility check.
 * - Section 11: Chunked generation planner with strict sum(section_budgets) === target invariant.
 * - Section 12: Context/source preservation strategy selector.
 */
import type { RequestedAnswerBudget } from "./budgets";
import { countWords, type WordCountConvention } from "./wordCount";

export type ProviderProfile = {
  id: string;
  name: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  tokensPerWordEstimate: number;
  supportsStreaming: boolean;
  notes: string;
};

export const PROVIDER_REGISTRY: Record<string, ProviderProfile> = {
  "claude-3-5-sonnet": {
    id: "claude-3-5-sonnet",
    name: "Anthropic Claude 3.5 Sonnet",
    maxInputTokens: 200_000,
    maxOutputTokens: 8_192,
    tokensPerWordEstimate: 1.33,
    supportsStreaming: true,
    notes: "Verified Anthropic Claude output token limit: 8,192 tokens (~6,150 words).",
  },
  "claude-3-opus": {
    id: "claude-3-opus",
    name: "Anthropic Claude 3 Opus",
    maxInputTokens: 200_000,
    maxOutputTokens: 4_096,
    tokensPerWordEstimate: 1.33,
    supportsStreaming: true,
    notes: "Anthropic Claude 3 Opus output token limit: 4,096 tokens (~3,080 words).",
  },
  "gpt-4o": {
    id: "gpt-4o",
    name: "OpenAI GPT-4o",
    maxInputTokens: 128_000,
    maxOutputTokens: 16_384,
    tokensPerWordEstimate: 1.33,
    supportsStreaming: true,
    notes: "OpenAI GPT-4o maximum output tokens: 16,384 tokens (~12,300 words).",
  },
  "o1-preview": {
    id: "o1-preview",
    name: "OpenAI o1-preview",
    maxInputTokens: 128_000,
    maxOutputTokens: 32_768,
    tokensPerWordEstimate: 1.33,
    supportsStreaming: false,
    notes: "OpenAI o1-preview max output tokens: 32,768 tokens (~24,600 words).",
  },
  "grok-2": {
    id: "grok-2",
    name: "xAI Grok 2",
    maxInputTokens: 131_072,
    maxOutputTokens: 8_192,
    tokensPerWordEstimate: 1.33,
    supportsStreaming: true,
    notes: "xAI Grok 2 output token limit: 8,192 tokens (~6,150 words).",
  },
  "local-llama-3-8b": {
    id: "local-llama-3-8b",
    name: "Local Coder (Llama 3 8B)",
    maxInputTokens: 8_192,
    maxOutputTokens: 4_096,
    tokensPerWordEstimate: 1.33,
    supportsStreaming: true,
    notes: "Local model standard context window: 8k input, 4k output (~3,080 words).",
  },
};

export type FeasibilityVerdict =
  | {
      status: "FEASIBLE";
      provider: ProviderProfile;
      requestedTokensEstimate: number;
    }
  | {
      status: "NOT_FEASIBLE_WITH_SELECTED_PROVIDER";
      provider: ProviderProfile;
      requestedTokensEstimate: number;
      maxProviderWords: number;
      reason: string;
      proposal: string;
    }
  | {
      status: "UNKNOWN";
      reason: string;
    };

/**
 * Evaluates whether a requested downstream answer budget is physically deliverable
 * in a single execution call by the selected model provider.
 */
export function checkProviderFeasibility(
  providerId: string,
  budget: RequestedAnswerBudget,
  sourceTokens?: number,
): FeasibilityVerdict {
  const provider = PROVIDER_REGISTRY[providerId];
  if (!provider) {
    return {
      status: "UNKNOWN",
      reason: `Provider "${providerId}" is not in the verified feasibility registry.`,
    };
  }

  // Convert requested budget to token estimate
  let requestedTokens: number;
  if (budget.unit === "tokens") {
    requestedTokens = budget.target;
  } else if (budget.unit === "words") {
    requestedTokens = Math.ceil(budget.target * provider.tokensPerWordEstimate);
  } else if (budget.unit === "characters") {
    requestedTokens = Math.ceil((budget.target / 4) * 1.1); // ~4 chars per token
  } else if (budget.unit === "sentences") {
    requestedTokens = Math.ceil(budget.target * 20 * provider.tokensPerWordEstimate); // ~20 words/sentence
  } else {
    requestedTokens = budget.target;
  }

  const maxProviderWords = Math.floor(
    provider.maxOutputTokens / provider.tokensPerWordEstimate,
  );

  if (requestedTokens > provider.maxOutputTokens) {
    return {
      status: "NOT_FEASIBLE_WITH_SELECTED_PROVIDER",
      provider,
      requestedTokensEstimate: requestedTokens,
      maxProviderWords,
      reason: `Requested output of ${budget.target.toLocaleString()} ${budget.unit} (~${requestedTokens.toLocaleString()} tokens) exceeds provider maximum output of ${provider.maxOutputTokens.toLocaleString()} tokens (~${maxProviderWords.toLocaleString()} words).`,
      proposal:
        "Execute chunked document generation planner to decompose deliverable into multi-section sequence.",
    };
  }

  if (sourceTokens && sourceTokens > provider.maxInputTokens) {
    return {
      status: "NOT_FEASIBLE_WITH_SELECTED_PROVIDER",
      provider,
      requestedTokensEstimate: requestedTokens,
      maxProviderWords,
      reason: `Source document size of ${sourceTokens.toLocaleString()} tokens exceeds provider context window of ${provider.maxInputTokens.toLocaleString()} tokens.`,
      proposal:
        "Select CHUNKED_CONTEXT or RETRIEVAL strategy rather than embedding raw source directly in single prompt.",
    };
  }

  return {
    status: "FEASIBLE",
    provider,
    requestedTokensEstimate: requestedTokens,
  };
}

export type SectionBudgetPlan = {
  section_id: string;
  section_title: string;
  target_word_budget: number;
  continuity_context: string;
};

export type DocumentGenerationPlan = {
  target_total_words: number;
  sections: SectionBudgetPlan[];
  sum_section_budgets: number;
  invariant_satisfied: boolean;
};

/**
 * Plans chunked document generation for long deliverables exceeding single model output limits.
 * Guarantees invariant: sum(section_budgets) === target_total_words.
 */
export function planChunkedDocumentGeneration(
  targetTotalWords: number,
  maxWordsPerChunk = 4_000,
): DocumentGenerationPlan {
  if (targetTotalWords <= 0) {
    return {
      target_total_words: 0,
      sections: [],
      sum_section_budgets: 0,
      invariant_satisfied: true,
    };
  }

  const numSections = Math.max(1, Math.ceil(targetTotalWords / maxWordsPerChunk));
  const baseBudget = Math.floor(targetTotalWords / numSections);
  let remainder = targetTotalWords - baseBudget * numSections;

  const sections: SectionBudgetPlan[] = [];
  for (let i = 0; i < numSections; i++) {
    // Distribute remainder evenly across initial sections
    const addition = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder--;

    const sectionWords = baseBudget + addition;
    sections.push({
      section_id: `sec-${i + 1}`,
      section_title: `Section ${i + 1} of ${numSections}`,
      target_word_budget: sectionWords,
      continuity_context:
        i === 0
          ? "Initial document opening and framing."
          : `Continuation from Section ${i}. Maintain tone, style, and sequential flow.`,
    });
  }

  const sumBudgets = sections.reduce((sum, s) => sum + s.target_word_budget, 0);

  return {
    target_total_words: targetTotalWords,
    sections,
    sum_section_budgets: sumBudgets,
    invariant_satisfied: sumBudgets === targetTotalWords,
  };
}

export type SourceContextStrategy =
  | "FULL_CONTEXT"
  | "CHUNKED_CONTEXT"
  | "RETRIEVAL"
  | "HIERARCHICAL_SUMMARY"
  | "REFERENCE_ONLY";

/**
 * Selects source custody and prompt embedding strategy based on source tokens vs model context window.
 */
export function selectSourceContextStrategy(
  sourceTokens: number,
  contextWindow: number,
): SourceContextStrategy {
  if (sourceTokens <= 0.4 * contextWindow) {
    return "FULL_CONTEXT";
  }
  if (sourceTokens <= 0.85 * contextWindow) {
    return "CHUNKED_CONTEXT";
  }
  if (sourceTokens <= 2 * contextWindow) {
    return "RETRIEVAL";
  }
  return "HIERARCHICAL_SUMMARY";
}

export type OutputControlLoopResult = {
  status: "PASS" | "QUALITY_GATE_FAILED";
  targetWords: number;
  achievedWords: number;
  attempts: number;
  finalContent: string;
  auditTrail: {
    attempt: number;
    wordCount: number;
    difference: number;
  }[];
};

/**
 * Output control loop (Section 8):
 * GENERATE → COUNT → COMPARE TO TARGET → REVISE → COUNT → ACCEPT / FAIL
 * Uses bounded retries. Never infinite loops.
 */
export async function executeOutputControlLoop(
  generatePass: (promptModifier: string, attempt: number) => Promise<string>,
  targetWords: number,
  maxRetries = 3,
  convention: WordCountConvention = "WORD_COUNT_V1",
): Promise<OutputControlLoopResult> {
  const auditTrail: { attempt: number; wordCount: number; difference: number }[] = [];
  let currentContent = "";
  let promptModifier = `Deliver exactly ${targetWords} words.`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    currentContent = await generatePass(promptModifier, attempt);
    const measuredCount = countWords(currentContent, convention).count;
    const diff = measuredCount - targetWords;

    auditTrail.push({
      attempt,
      wordCount: measuredCount,
      difference: diff,
    });

    if (measuredCount === targetWords) {
      return {
        status: "PASS",
        targetWords,
        achievedWords: measuredCount,
        attempts: attempt,
        finalContent: currentContent,
        auditTrail,
      };
    }

    if (diff > 0) {
      promptModifier = `Your previous output contained ${measuredCount} words (${diff} words over the exact target of ${targetWords}). Edit and condense by exactly ${diff} words while preserving meaning.`;
    } else {
      promptModifier = `Your previous output contained ${measuredCount} words (${Math.abs(diff)} words under the exact target of ${targetWords}). Expand by exactly ${Math.abs(diff)} words with relevant detail while maintaining coherence.`;
    }
  }

  const finalCount = countWords(currentContent, convention).count;
  return {
    status: finalCount === targetWords ? "PASS" : "QUALITY_GATE_FAILED",
    targetWords,
    achievedWords: finalCount,
    attempts: maxRetries,
    finalContent: currentContent,
    auditTrail,
  };
}
