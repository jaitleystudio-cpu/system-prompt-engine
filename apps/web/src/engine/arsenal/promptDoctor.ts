/**
 * Prompt Doctor & Slop X-Ray Diagnostic Engine (SPE Pro Invention)
 * Real-time linguistic, cognitive, and structural diagnostics that eliminate AI slop,
 * detect placeholder vulnerabilities, enforce anti-tamper invariants, and upgrade
 * any prompt into the UFCK-100X Frontier Cognition Kernel with one click.
 */

export interface SlopMatch {
  word: string;
  index: number;
  replacement: string;
  reason: string;
}

export interface PromptDoctorReport {
  cognitiveScore: number; // 0 - 100
  grade: "A+" | "A" | "B" | "C" | "F (Severe Slop)";
  slopCount: number;
  slopMatches: SlopMatch[];
  weakPhrases: string[];
  placeholderRisks: string[];
  hasActionBias: boolean;
  hasAntiTamper: boolean;
  hasZeroPlaceholderRule: boolean;
  hasDeterministicVerification: boolean;
  wordCount: number;
  estimatedTokens: number;
  recommendations: string[];
  enhancedPrompt?: string;
}

export const BANNED_SLOP_DICTIONARY: Record<string, string> = {
  delve: "examine / inspect / analyze",
  foster: "establish / build",
  leverage: "utilize / execute with",
  tapestry: "system architecture",
  testament: "evidence / proof",
  beacon: "benchmark / standard",
  "it is worth noting": "specifically / note that",
  "it's worth noting": "specifically / note that",
  "question? answer.": "direct factual statement",
  "bottom line:": "final requirement:",
  "in conclusion": "final verification summary",
  "first and foremost": "primary invariant",
  pivotal: "critical",
  revolutionize: "re-architect",
  "game-changer": "frontier improvement",
};

export const WEAK_CONVERSATIONAL_PHRASES = [
  "i want you to",
  "can you please",
  "could you kindly",
  "please try to",
  "help me with",
  "act as a",
  "pretend you are",
  "do your best",
  "in a friendly way",
  "feel free to",
];

export const PLACEHOLDER_PATTERNS = [
  "// todo",
  "// to-do",
  "# todo",
  "pass",
  "...",
  "/* todo",
  "/* implement later",
  "// implement later",
];

/**
 * Diagnoses a prompt across 6 frontier cognitive axes.
 */
export function diagnosePrompt(promptText: string): PromptDoctorReport {
  if (!promptText || promptText.trim().length === 0) {
    return {
      cognitiveScore: 0,
      grade: "F (Severe Slop)",
      slopCount: 0,
      slopMatches: [],
      weakPhrases: [],
      placeholderRisks: [],
      hasActionBias: false,
      hasAntiTamper: false,
      hasZeroPlaceholderRule: false,
      hasDeterministicVerification: false,
      wordCount: 0,
      estimatedTokens: 0,
      recommendations: ["Input a prompt to run Prompt Doctor diagnostics."],
    };
  }

  const lower = promptText.toLowerCase();
  const words = promptText.trim().split(/\s+/);
  const wordCount = words.length;
  const estimatedTokens = Math.ceil(promptText.length / 3.8);

  // Strip rule declarations to prevent meta-rule collisions when prompt enforces bans
  const textForAudit = lower
    .replace(/strictly ban verbal filler[^.\n]+/g, "")
    .replace(/eliminate all ai clichés[^.\n]+/g, "")
    .replace(/strictly prohibited from outputting[^.\n]+/g, "")
    .replace(/zero placeholder code[^.\n]+/g, "")
    .replace(/prohibited from outputting[^.\n]+/g, "");

  // 1. Scan for AI slop words
  const slopMatches: SlopMatch[] = [];
  for (const [slopWord, replacement] of Object.entries(BANNED_SLOP_DICTIONARY)) {
    const regex = new RegExp(`\\b${slopWord}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(textForAudit)) !== null) {
      slopMatches.push({
        word: match[0],
        index: match.index,
        replacement,
        reason: `AI cliché detected: '${match[0]}' reduces precision and authority.`,
      });
    }
  }

  // 2. Scan for weak conversational framing
  const weakPhrasesFound: string[] = [];
  for (const phrase of WEAK_CONVERSATIONAL_PHRASES) {
    if (textForAudit.includes(phrase)) {
      weakPhrasesFound.push(phrase);
    }
  }

  // 3. Scan for placeholder risks
  const placeholderRisks: string[] = [];
  for (const p of PLACEHOLDER_PATTERNS) {
    if (textForAudit.includes(p)) {
      placeholderRisks.push(p);
    }
  }

  // 4. Invariant checks
  const hasActionBias =
    lower.includes("action bias") ||
    lower.includes("proceed immediately") ||
    lower.includes("do not stall") ||
    lower.includes("without pausing");

  const hasAntiTamper =
    lower.includes("anti-tamper") ||
    lower.includes("never modify tests") ||
    lower.includes("do not weaken test assertions");

  const hasZeroPlaceholderRule =
    lower.includes("zero placeholder") ||
    lower.includes("strictly prohibited from outputting // todo") ||
    lower.includes("100% complete and directly usable");

  const hasDeterministicVerification =
    lower.includes("verification battery") ||
    lower.includes("acceptance criteria") ||
    lower.includes("verifiable deliverables") ||
    lower.includes("- [ ]");

  // 5. Score calculation
  let score = 100;
  score -= slopMatches.length * 12;
  score -= weakPhrasesFound.length * 8;
  score -= placeholderRisks.length * 15;

  if (!hasActionBias) score -= 10;
  if (!hasAntiTamper) score -= 12;
  if (!hasZeroPlaceholderRule) score -= 15;
  if (!hasDeterministicVerification) score -= 10;

  // Clamp score
  score = Math.max(5, Math.min(100, score));

  // Determine Grade
  let grade: PromptDoctorReport["grade"] = "F (Severe Slop)";
  if (score >= 95) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 50) grade = "C";

  // Formulate recommendations
  const recommendations: string[] = [];
  if (slopMatches.length > 0) {
    recommendations.push(
      `Eliminate ${slopMatches.length} AI slop word(s) (${slopMatches.map((s) => `'${s.word}'`).join(", ")}).`
    );
  }
  if (weakPhrasesFound.length > 0) {
    recommendations.push(
      `Replace conversational hedging (${weakPhrasesFound.map((p) => `'${p}'`).join(", ")}) with imperative executive directives.`
    );
  }
  if (!hasZeroPlaceholderRule) {
    recommendations.push(
      "Inject explicit Zero-Placeholder rule to prevent models from truncating code with `// TODO` or `pass`."
    );
  }
  if (!hasAntiTamper) {
    recommendations.push(
      "Add Devin Anti-Tamper Invariant: forbid models from altering test assertions when code fails."
    );
  }
  if (!hasActionBias) {
    recommendations.push(
      "Add Codex Action Bias directive: command the AI to execute reviewable deliverables without asking permission."
    );
  }
  if (!hasDeterministicVerification) {
    recommendations.push(
      "Define observable checklist acceptance criteria (- [ ] assertions) for automated falsification."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Prompt passes all UFCK-100X Frontier Cognition standards with zero slop!");
  }

  return {
    cognitiveScore: score,
    grade,
    slopCount: slopMatches.length,
    slopMatches,
    weakPhrases: weakPhrasesFound,
    placeholderRisks,
    hasActionBias,
    hasAntiTamper,
    hasZeroPlaceholderRule,
    hasDeterministicVerification,
    wordCount,
    estimatedTokens,
    recommendations,
  };
}

/**
 * Upgrades any prompt into the UFCK-100X Frontier Cognition Kernel with 1 click.
 */
export function enhancePromptWithDoctor(rawPrompt: string): string {
  let cleaned = rawPrompt;

  // 1. Replace all slop words with precise equivalents
  for (const [slopWord, replacement] of Object.entries(BANNED_SLOP_DICTIONARY)) {
    const regex = new RegExp(`\\b${slopWord}\\b`, "gi");
    cleaned = cleaned.replace(regex, replacement.split(" / ")[0]);
  }

  // 3. Remove placeholder code patterns from raw text
  cleaned = cleaned
    .replace(/\/\/\s*todo[^\n]*/gi, "")
    .replace(/\/\/\s*to-do[^\n]*/gi, "")
    .replace(/\/\/\s*implement later[^\n]*/gi, "")
    .replace(/\bpass\b/gi, "")
    .replace(/\.\.\./g, "")
    .trim();

  // 4. Inject UFCK-100X Frontier Cognition Kernel Header & Non-Negotiables
  const enhanced = `[EXECUTIVE COGNITIVE SPECIFICATION // UFCK-100X ENHANCED KERNEL]
Standard: SATSS v1 Enterprise Production Protocol | Optimization: Prompt Doctor Pro

### 1. EXECUTIVE COGNITIVE GOVERNANCE & AUTONOMOUS BIAS
You operate as the Principal Executive Specialist and Master Architect.
- ACTION BIAS (Codex Directive): Proceed immediately to full execution. Do not stall, ask permission for standard implementation details, or provide conversational filler. Deliver the complete, reviewable end-to-end production asset in your first response.
- EPISTEMIC INTEGRITY: Distinguish rigorously between mathematically proven/verified facts and probabilistic heuristics. Do not flatter, hedge, or apologize. Never make unverified assumptions about system state.
- ZERO AI SLOP: Strictly ban verbal filler ('delve', 'foster', 'leverage', 'tapestry', 'testament', 'beacon', 'it is worth noting', 'Question? Answer.', 'Bottom Line:'). No contrastive framing ('do X, not Y'). Speak with direct imperative clarity.

### 2. PRIMARY OBJECTIVE
${cleaned.trim()}

### 3. IMMUTABLE OPERATIONAL INVARIANTS (NON-NEGOTIABLE)
- ZERO PLACEHOLDER CODE: Strictly prohibited from outputting \`// TODO\`, \`pass\`, \`...\`, or truncated blocks. Every single function, data contract, error handler, and config must be 100% complete and directly usable.
- ANTI-TAMPER INVARIANT (Devin): If a test or validation check breaks, NEVER modify or weaken test assertions to make flawed code pass. Diagnose and resolve the underlying root cause.
- DEPENDENCY GROUNDING (Cursor): Never assume external libraries or APIs exist without verifying project manifests.
- MINIMAL INVASIVE FOOTPRINT: Eliminate dead code, avoid unnecessary files, and never add trivial comments that narrate the obvious.

### 4. DETERMINISTIC VERIFICATION BATTERY
- [ ] VERIFIED: All stated functional requirements execute end-to-end without unhandled exceptions.
- [ ] VERIFIED: Edge cases, empty bounds, and network interruptions handle gracefully.
- [ ] VERIFIED: Zero security leakage, memory degradation, or unverified claims.
`;

  return enhanced.trim();
}
