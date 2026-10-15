/**
 * SPE Ω — Requirement Extractor
 * Deterministic parser for atomic user intentions, negative constraints,
 * and boundary conditions.
 */

import type { ExtractedRequirement, RequirementCategory, RequirementCriticality } from "./types.ts";

const NEGATIVE_PATTERNS = [
  /\b(must\s+not|must\s+never)\s+([^.,;\n]+)/i,
  /\b(never|do\s+not|don't|cannot|can't)\s+([^.,;\n]+)/i,
  /\b(forbidden|prohibited|disallowed):\s*([^.,;\n]+)/i,
  /\b(avoid|refrain\s+from)\s+([^.,;\n]+)/i,
  /\bwithout\s+(using\s+|adding\s+|any\s+)?([^.,;\n]+)/i,
  /\bno\s+(external|eval|dependencies|inline|telemetry|cloud|tracking|leakage)\b([^.,;\n]*)/i,
];

const BOUNDARY_PATTERNS = [
  /\b(air-?gap|offline|zero\s+cloud|100%\s+local)\b/i,
  /\b(token\s+budget|token\s+limit|max\s+tokens?|under\s+\d+\s+tokens?)\b/i,
  /\b(latency\s*<\s*\d+|under\s+\d+ms|fast|real-?time)\b/i,
  /\b(memory\s+budget|under\s+\d+mb)\b/i,
];

const FORMAT_PATTERNS = [
  /\b(json\s+only|valid\s+json|strict\s+json|rfc\s+8785)\b/i,
  /\b(markdown\s+table|markdown\s+only)\b/i,
  /\b(typescript|pure\s+css|vanilla\s+js)\b/i,
];

const OPTIONAL_PATTERNS = [
  /\b(optional|prefer|if\s+possible|nice\s+to\s+have|ideally|could\s+also)\b/i,
];

export class RequirementExtractor {
  /**
   * Extracts atomic requirements from free-form user prompt text or conversation.
   */
  public extractFromText(rawText: string, origin: ExtractedRequirement["sourceOrigin"] = "USER_INPUT"): ExtractedRequirement[] {
    if (!rawText || !rawText.trim()) return [];

    // Split by lines, semicolons, and clear bullet delimiters
    const clauses = rawText
      .split(/[\n;•\u2022]|\band\s+also\b/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 3);

    const requirements: ExtractedRequirement[] = [];
    let counter = 1;

    for (const clause of clauses) {
      const lower = clause.toLowerCase();

      // Check Negative Constraint
      const isNegative = NEGATIVE_PATTERNS.some((p) => p.test(clause)) ||
        lower.includes("must not") ||
        lower.includes("never") ||
        lower.includes("forbidden") ||
        lower.startsWith("no ") ||
        lower.includes("do not");

      let category: RequirementCategory = "MANDATORY_POSITIVE";
      let criticality: RequirementCriticality = "HIGH";

      if (isNegative) {
        category = "NEGATIVE_CONSTRAINT";
        criticality = "CRITICAL"; // Negative constraints default to CRITICAL
      } else if (BOUNDARY_PATTERNS.some((p) => p.test(clause))) {
        category = "BOUNDARY_CONDITION";
        criticality = "CRITICAL";
      } else if (FORMAT_PATTERNS.some((p) => p.test(clause))) {
        category = "FORMAT_CONSTRAINT";
        criticality = "HIGH";
      } else if (OPTIONAL_PATTERNS.some((p) => p.test(clause))) {
        category = "OPTIONAL_PREFERENCE";
        criticality = "MEDIUM";
      }

      // Extract keywords
      const words = lower
        .replace(/[^a-z0-9_\-\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["the", "and", "for", "with", "that", "this", "from", "must", "should"].includes(w));

      const forbiddenKeywords: string[] = isNegative ? words : [];
      const requiredKeywords: string[] = isNegative ? [] : words;

      requirements.push({
        id: `req-${counter.toString().padStart(3, "0")}`,
        category,
        originalText: clause,
        normalizedSubject: words.slice(0, 3).join(" ") || clause,
        normalizedPredicate: clause,
        isNegative,
        criticality,
        forbiddenKeywords,
        requiredKeywords,
        sourceOrigin: origin,
      });

      counter++;
    }

    return requirements;
  }

  /**
   * Extracts requirements from existing IntentAtom structures.
   */
  public extractFromIntentAtoms(
    atoms: Array<{ id: string; label?: string; text: string; kind?: string }>
  ): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = [];

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      if (!atom.text || !atom.text.trim()) continue;

      const lower = atom.text.toLowerCase();
      const isNegative =
        atom.id.startsWith("req-neg-") ||
        atom.label === "MUST NOT" ||
        lower.startsWith("must not") ||
        lower.startsWith("never") ||
        lower.startsWith("do not") ||
        lower.startsWith("forbidden") ||
        lower.includes("must never");

      const category: RequirementCategory = isNegative
        ? "NEGATIVE_CONSTRAINT"
        : atom.id === "confirmed-boundaries"
        ? "BOUNDARY_CONDITION"
        : "MANDATORY_POSITIVE";

      const criticality: RequirementCriticality = isNegative ? "CRITICAL" : "HIGH";

      const words = lower
        .replace(/[^a-z0-9_\-\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      requirements.push({
        id: atom.id || `atom-req-${(i + 1).toString().padStart(3, "0")}`,
        category,
        originalText: atom.text,
        normalizedSubject: words.slice(0, 3).join(" ") || atom.text,
        normalizedPredicate: atom.text,
        isNegative,
        criticality,
        forbiddenKeywords: isNegative ? words : [],
        requiredKeywords: isNegative ? [] : words,
        sourceOrigin: "INTENT_ATOM",
      });
    }

    return requirements;
  }
}
