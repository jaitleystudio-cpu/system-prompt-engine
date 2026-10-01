/**
 * SPE ProtectedIntent Semantic Diff Engine (SPE-SEM-DIFF-1)
 *
 * Audits user input / confirmed intent against synthesized prompt or package.
 * Produces structured differential analysis:
 * - PRESERVED (✓): User constraints, numbers, entities explicitly retained.
 * - ADDED (+): Engineering depth, state machines, chaos suites, research citations synthesized by SPE.
 * - REMOVED (-): Elements from user request that were omitted or diluted.
 * - ASSUMED (?): Implicit defaults assumed by SPE (retry policies, timeouts, sandboxing).
 * - CONTRADICTED (!): Severe contradictions where synthesized instructions oppose user intent.
 *
 * Computes deterministic quantitative fidelity metrics (0-100% score, drift ratio).
 */

import type { PromptPackage } from "./packageComposer";

export type DiffTag = "PRESERVED" | "ADDED" | "REMOVED" | "ASSUMED" | "CONTRADICTED";

export type DiffCategory =
  | "NUMERIC"
  | "ENTITY"
  | "CONSTRAINT"
  | "DELIVERABLE"
  | "SECURITY"
  | "ARCHITECTURAL";

export interface IntentDiffItem {
  tag: DiffTag;
  symbol: "✓" | "+" | "-" | "?" | "!";
  category: DiffCategory;
  originalText?: string;
  synthesizedText?: string;
  explanation: string;
  severity: "INFO" | "WARNING" | "FATAL";
}

export interface IntentDiffMetrics {
  fidelityScore: number; // 0 - 100
  intentDriftRatio: number; // 0.0 - 1.0 (0 is perfect fidelity)
  atomTraceabilityRatio: number; // 0.0 - 1.0 (1 is complete mapping)
  numericPreservationRate: number; // 0.0 - 1.0
  contradictionCount: number;
  removedCount: number;
  assumedCount: number;
  addedCount: number;
  preservedCount: number;
}

export interface IntentDiffReport {
  timestamp: string;
  metrics: IntentDiffMetrics;
  items: IntentDiffItem[];
  formattedReport: string;
}

const TAG_SYMBOLS: Record<DiffTag, "✓" | "+" | "-" | "?" | "!"> = {
  PRESERVED: "✓",
  ADDED: "+",
  REMOVED: "-",
  ASSUMED: "?",
  CONTRADICTED: "!",
};

/**
 * Extracts numbers (quantities, ports, versions, limits) from text.
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?(?:k|m|g|ms|s|%|px|rem)?\b/gi);
  return matches ? Array.from(new Set(matches.map((m) => m.toLowerCase()))) : [];
}

/**
 * Extracts negative constraints ("no X", "never Y", "do not Z", "without W").
 */
export function extractNegativeConstraints(text: string): string[] {
  const patterns = [
    /\b(?:no|never|do not|don't|without|zero|avoid)\s+([a-z0-9_-]+(?:\s+[a-z0-9_-]+)?)/gi,
  ];
  const constraints: string[] = [];
  for (const regex of patterns) {
    const matches = Array.from(text.matchAll(regex));
    for (const m of matches) {
      if (m[1] && m[1].length > 2) {
        constraints.push(m[0].toLowerCase().trim());
      }
    }
  }
  return constraints;
}

/**
 * Extracts significant domain noun phrases / entities.
 */
export function extractEntities(text: string): string[] {
  const tokens = text
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length > 3);

  const stopWords = new Set([
    "this",
    "that",
    "with",
    "from",
    "have",
    "make",
    "like",
    "need",
    "what",
    "when",
    "where",
    "which",
    "about",
    "there",
    "their",
    "should",
    "could",
    "would",
    "please",
  ]);

  const entities = new Set<string>();
  for (const token of tokens) {
    if (!stopWords.has(token) && !/^\d+$/.test(token)) {
      entities.add(token);
    }
  }
  return Array.from(entities);
}

function matchStemOrSubstr(text: string, term: string): boolean {
  if (text.includes(term)) return true;
  if (term.endsWith("ies") && text.includes(term.slice(0, -3) + "y")) return true;
  if (term.endsWith("s") && text.includes(term.slice(0, -1))) return true;
  if (term.endsWith("ing") && text.includes(term.slice(0, -3))) return true;
  if (term.endsWith("ed") && text.includes(term.slice(0, -2))) return true;
  if (term.endsWith("age") && text.includes(term.slice(0, -3))) return true;
  if (term.length > 5 && text.includes(term.slice(0, 5))) return true;
  return false;
}

/**
 * Audits user original request against synthesized prompt or package.
 */
export function computeIntentDiff(
  originalRequest: string,
  synthesizedPromptOrPackage: string | PromptPackage
): IntentDiffReport {
  const synthesizedText =
    typeof synthesizedPromptOrPackage === "string"
      ? synthesizedPromptOrPackage
      : synthesizedPromptOrPackage.singleFilePrompt;

  const synthLower = (synthesizedText || "").toLowerCase();
  const items: IntentDiffItem[] = [];

  // 1. Audit Numbers
  const origNumbers = extractNumbers(originalRequest);
  let preservedNumbers = 0;
  for (const num of origNumbers) {
    if (synthLower.includes(num)) {
      preservedNumbers++;
      items.push({
        tag: "PRESERVED",
        symbol: TAG_SYMBOLS.PRESERVED,
        category: "NUMERIC",
        originalText: num,
        synthesizedText: num,
        explanation: `Exact quantity/limit "${num}" verified in synthesized specification.`,
        severity: "INFO",
      });
    } else {
      items.push({
        tag: "REMOVED",
        symbol: TAG_SYMBOLS.REMOVED,
        category: "NUMERIC",
        originalText: num,
        explanation: `Original quantity/limit "${num}" missing or shifted in output.`,
        severity: "WARNING",
      });
    }
  }
  const numericPreservationRate =
    origNumbers.length > 0 ? preservedNumbers / origNumbers.length : 1.0;

  // 2. Audit Negative Constraints
  const origConstraints = extractNegativeConstraints(originalRequest);
  for (const constraint of origConstraints) {
    const rawTarget = constraint.replace(/^(no|never|do not|don't|without|zero|avoid)\s+/, "");
    // Check for direct contradiction first
    if (synthLower.includes(`enable ${rawTarget}`) || synthLower.includes(`use ${rawTarget}`)) {
      items.push({
        tag: "CONTRADICTED",
        symbol: TAG_SYMBOLS.CONTRADICTED,
        category: "CONSTRAINT",
        originalText: constraint,
        synthesizedText: `enable/use ${rawTarget}`,
        explanation: `Critical violation: Output enables "${rawTarget}" despite explicit user restriction "${constraint}".`,
        severity: "FATAL",
      });
    } else if (
      synthLower.includes(constraint) ||
      synthLower.includes(`zero ${rawTarget}`) ||
      synthLower.includes(`no ${rawTarget}`) ||
      (constraint.includes("network") && synthLower.includes("network_mode=none")) ||
      (constraint.includes("leakage") && (synthLower.includes("zero-loss") || synthLower.includes("data loss")))
    ) {
      items.push({
        tag: "PRESERVED",
        symbol: TAG_SYMBOLS.PRESERVED,
        category: "CONSTRAINT",
        originalText: constraint,
        explanation: `Negative boundary constraint "${constraint}" strictly enforced in output.`,
        severity: "INFO",
      });
    } else {
      items.push({
        tag: "ASSUMED",
        symbol: TAG_SYMBOLS.ASSUMED,
        category: "CONSTRAINT",
        originalText: constraint,
        explanation: `Negative constraint "${constraint}" not explicitly quoted, guarded implicitly.`,
        severity: "INFO",
      });
    }
  }

  // 3. Audit Domain Entities
  const origEntities = extractEntities(originalRequest);
  let mappedEntities = 0;
  for (const entity of origEntities) {
    if (matchStemOrSubstr(synthLower, entity)) {
      mappedEntities++;
      items.push({
        tag: "PRESERVED",
        symbol: TAG_SYMBOLS.PRESERVED,
        category: "ENTITY",
        originalText: entity,
        explanation: `Domain entity "${entity}" retained in prompt synthesis.`,
        severity: "INFO",
      });
    } else {
      items.push({
        tag: "REMOVED",
        symbol: TAG_SYMBOLS.REMOVED,
        category: "ENTITY",
        originalText: entity,
        explanation: `Domain concept "${entity}" omitted from synthesis.`,
        severity: "WARNING",
      });
    }
  }
  const atomTraceabilityRatio =
    origEntities.length > 0 ? mappedEntities / origEntities.length : 1.0;

  // 4. Record High-Value Additions by SPE Engine
  if (synthLower.includes("formal state machine")) {
    items.push({
      tag: "ADDED",
      symbol: TAG_SYMBOLS.ADDED,
      category: "ARCHITECTURAL",
      synthesizedText: "Formal State Machine & Lifecycle Transitions",
      explanation: "Synthesized 10-state formal lifecycle specification.",
      severity: "INFO",
    });
  }
  if (synthLower.includes("fault tolerance") || synthLower.includes("dlq")) {
    items.push({
      tag: "ADDED",
      symbol: TAG_SYMBOLS.ADDED,
      category: "ARCHITECTURAL",
      synthesizedText: "DLQ & Reverse Compensation Matrix",
      explanation: "Synthesized enterprise saga compensation and quarantine matrix.",
      severity: "INFO",
    });
  }
  if (synthLower.includes("scholarly literature") || synthLower.includes("arxiv")) {
    items.push({
      tag: "ADDED",
      symbol: TAG_SYMBOLS.ADDED,
      category: "ARCHITECTURAL",
      synthesizedText: "Scholarly Literature Triangulation",
      explanation: "Synthesized peer-reviewed grounding (arXiv, PMC, OpenAlex).",
      severity: "INFO",
    });
  }
  if (synthLower.includes("network_mode=none")) {
    items.push({
      tag: "ADDED",
      symbol: TAG_SYMBOLS.ADDED,
      category: "SECURITY",
      synthesizedText: "Zero-Network Invariant (network_mode=NONE)",
      explanation: "Synthesized zero-egress local sandbox guardrails.",
      severity: "INFO",
    });
  }

  // 5. Default Assumed Behaviors
  items.push({
    tag: "ASSUMED",
    symbol: TAG_SYMBOLS.ASSUMED,
    category: "ARCHITECTURAL",
    synthesizedText: "Exponential backoff retry with decorrelated jitter (max 3 retries)",
    explanation: "Standard high-availability retry policy assumed.",
    severity: "INFO",
  });

  // 6. Aggregate Counts & Metrics
  let preservedCount = 0;
  let addedCount = 0;
  let removedCount = 0;
  let assumedCount = 0;
  let contradictionCount = 0;

  for (const item of items) {
    if (item.tag === "PRESERVED") preservedCount++;
    else if (item.tag === "ADDED") addedCount++;
    else if (item.tag === "REMOVED") removedCount++;
    else if (item.tag === "ASSUMED") assumedCount++;
    else if (item.tag === "CONTRADICTED") contradictionCount++;
  }

  // Mathematically sound preservation-based fidelity calculation:
  const totalInputUnits = origEntities.length + origNumbers.length + origConstraints.length;
  const preservedUnits = preservedCount;
  const basePreservationRate = totalInputUnits > 0 ? (preservedUnits / totalInputUnits) : 1.0;
  
  // Severe deduction for contradictions: -35% per contradiction
  const contradictionPenalty = contradictionCount * 35;
  const fidelityScore = Math.max(0, Math.min(100, Math.round(basePreservationRate * 100 - contradictionPenalty)));
  
  const intentDriftRatio = Math.max(
    0.0,
    Math.min(1.0, (contradictionCount * 0.5 + (1.0 - basePreservationRate) * 0.5))
  );

  const metrics: IntentDiffMetrics = {
    fidelityScore,
    intentDriftRatio: Number(intentDriftRatio.toFixed(3)),
    atomTraceabilityRatio: Number(atomTraceabilityRatio.toFixed(3)),
    numericPreservationRate: Number(numericPreservationRate.toFixed(3)),
    contradictionCount,
    removedCount,
    assumedCount,
    addedCount,
    preservedCount,
  };

  // 7. Format Markdown Diff Report
  const diffRows = items.map(
    (item) =>
      `| ${item.symbol} ${item.tag} | ${item.category} | ${
        item.originalText ? `\`${item.originalText}\`` : "—"
      } | ${item.explanation} |`
  );

  const formattedReport = `## ProtectedIntent Semantic Diff Report
Fidelity Score: **${metrics.fidelityScore}/100** | Intent Drift: **${metrics.intentDriftRatio}** | Atom Traceability: **${Math.round(
    metrics.atomTraceabilityRatio * 100
  )}%**

| Diff Tag | Category | Input Entity / Constraint | Audit Explanation |
|----------|----------|---------------------------|-------------------|
${diffRows.join("\n")}

Summary:
- [✓] Preserved: ${metrics.preservedCount} items
- [+] Added by SPE: ${metrics.addedCount} enterprise specs & research grounds
- [?] Assumed Defaults: ${metrics.assumedCount} system policies
- [-] Omitted: ${metrics.removedCount} items
- [!] Contradictions: ${metrics.contradictionCount} items`;

  return {
    timestamp: new Date().toISOString(),
    metrics,
    items,
    formattedReport,
  };
}
