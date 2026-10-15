/**
 * SPE Ω — Canonical Product-Promise Contract
 *
 * Mandate:
 * Ground every word of marketing and hero copy strictly in verifiable, shipped
 * software capabilities. Reject any copy that makes false promises, implies
 * capabilities SPE does not possess (e.g. running 70B LLMs inside client WASM),
 * or employs hyperbolic marketing buzzwords ("supercharge", "revolutionary", "magic").
 */

export const SHIPPED_CAPABILITIES = {
  BROWSER_WASM_COMPILATION: {
    key: "BROWSER_WASM_COMPILATION",
    title: "In-Browser WebAssembly Compiler",
    description: "Deterministic WebAssembly compiler running 100% inside your local browser with sub-50ms latency.",
    verificationCriteria: "WASM bytecode hash matches canonical SHA-256 and executes offline.",
    keywords: ["webassembly", "wasm", "on-device", "in-browser", "local", "client-side"],
  },
  AIR_GAP_ZERO_EGRESS: {
    key: "AIR_GAP_ZERO_EGRESS",
    title: "Air-Gapped Zero Data Egress",
    description: "Zero prompt bytes or intellectual property ever leave your machine; no telemetry, tracking, or cloud storage.",
    verificationCriteria: "CSP connect-src 'none' in Web Worker and 0 outgoing network packets.",
    keywords: ["air-gapped", "private", "zero data leaves", "never leave", "stays on this device", "offline"],
  },
  INVARIANT_GUARDRAILS: {
    key: "INVARIANT_GUARDRAILS",
    title: "ProtectedIntent Invariant Guardrails",
    description: "Formal logic invariants that lock your boundaries and prevent AI coding agents from hallucinating or drifting.",
    verificationCriteria: "Propositional Horn clause compiler rejects invalid witness states.",
    keywords: ["boundaries", "guardrails", "invariants", "hallucinat", "drift", "prevent", "lock", "requirements", "rules"],
  },
  CONFLICT_DETECTION: {
    key: "CONFLICT_DETECTION",
    title: "Contradiction & Conflict Resolution",
    description: "Detects and flags contradictory rules in system prompts before deployment.",
    verificationCriteria: "Kleene-3 ternary evaluation detects mutually exclusive rules.",
    keywords: ["conflict", "contradiction", "guesswork", "clear", "structured", "instructions", "review"],
  },
  MULTI_AGENT_PORTABILITY: {
    key: "MULTI_AGENT_PORTABILITY",
    title: "1-Click Multi-Agent Portability",
    description: "Exports prompt directives directly to CLAUDE.md, .cursorrules, .windsurfrules, and Custom GPTs.",
    verificationCriteria: "Deterministic AST desugaring generates valid syntax for each target IDE.",
    keywords: ["claude", "cursor", "chatgpt", "windsurf", "export", "any ai", "portable", "prompt"],
  },
  VERIFIED_WORKFLOWS: {
    key: "VERIFIED_WORKFLOWS",
    title: "Pre-Audited Business & Engineering Workflows",
    description: "Catalog of pre-tested, deterministic prompt workflows for code review, PR summaries, and planning.",
    verificationCriteria: "Evidence passports with Ed25519 signatures and test execution receipts.",
    keywords: ["workflow", "template", "recipes", "pre-audited", "code review", "plan"],
  },
  SKILL_BUILDER_TAINT_SCAN: {
    key: "SKILL_BUILDER_TAINT_SCAN",
    title: "In-Browser Skill Builder & AST Taint Scanner",
    description: "Interactive builder and security scanner for portable agent SKILL.md packages.",
    verificationCriteria: "AST taint analyzer identifies ambient authority escalations and shell injections.",
    keywords: ["skill", "builder", "scanner", "taint", "audit"],
  },
  FRONTIER_MODEL_CURRENCY: {
    key: "FRONTIER_MODEL_CURRENCY",
    title: "2026 Frontier Model Currency",
    description: "Tracks active 2026 frontier AI models and dialect parameters across Anthropic, OpenAI, Google, and xAI.",
    verificationCriteria: "Autonomous synchronizer checks daily and rejects obsolete legacy model versions.",
    keywords: ["frontier", "2026", "currency", "models", "atlas"],
  },
  ZERO_COMPUTE_COST: {
    key: "ZERO_COMPUTE_COST",
    title: "Zero Cloud Compute Cost ($0.00)",
    description: "Runs entirely on client device CPU via WebAssembly with zero server GPU bills.",
    verificationCriteria: "Zero server backend compute invoices required for compilation.",
    keywords: ["free", "zero cost", "$0", "no subscription", "on-device"],
  },
} as const;

export type ShippedCapabilityKey = keyof typeof SHIPPED_CAPABILITIES;

/**
 * Forbidden ungrounded claims that SPE does NOT support.
 * For instance, SPE is a deterministic prompt compiler, NOT an in-browser 70B LLM.
 */
export const FORBIDDEN_PROMISES = [
  {
    pattern: /run\s+(claude|gpt|gemini|grok|llama|deepseek).*(inside|in|locally\s+in)\s+(your\s+)?(browser|wasm|webassembly)/i,
    code: "ERR_UNSHIPPED_CAPABILITY",
    reason: "SPE compiles prompts deterministically; it does not host or execute large language model weights in the client browser.",
  },
  {
    pattern: /(neural\s+network\s+weights|weights\s+are\s+loaded).*(webassembly|browser|locally)/i,
    code: "ERR_UNSHIPPED_CAPABILITY",
    reason: "SPE uses symbolic propositional logic and template compilation, not in-browser LLM neural weights.",
  },
  {
    pattern: /without\s+api\s+keys?.*(generate\s+free\s+ai\s+output|run\s+frontier\s+models)/i,
    code: "ERR_UNSHIPPED_CAPABILITY",
    reason: "SPE generates system prompts for external AI models; it does not bypass provider API key requirements.",
  },
  {
    pattern: /(jailbreak|bypass\s+(safety|guardrails)|unfiltered\s+ai)/i,
    code: "ERR_SAFETY_VIOLATION",
    reason: "SPE enforces safety invariants and does not provide jailbreaking or filter bypassing capabilities.",
  },
  {
    pattern: /(scrape\s+the\s+web|crawl\s+any\s+website).*(without\s+permission|stealth)/i,
    code: "ERR_LEGAL_VIOLATION",
    reason: "SPE does not perform unauthorized web scraping or copyright infringement.",
  },
];

/**
 * Banned hyperbolic marketing buzzwords.
 * Developers and enterprise auditors reject hype; SPE speaks engineer-to-engineer with measured claims.
 */
export const BANNED_BUZZWORDS = [
  "supercharge",
  "revolutionary",
  "limitless",
  "magic",
  "magical",
  "100x",
  "1000x",
  "guaranteed #1",
  "silver bullet",
  "game-changing",
  "disrupt",
  "superhuman",
  "miracle",
  "unleash",
  "infinite possibilities",
  "transform your life",
] as const;

export interface PromiseViolation {
  code: string;
  matchedText: string;
  reason: string;
}

export interface PromiseVerificationResult {
  valid: boolean;
  violations: PromiseViolation[];
  verifiedClaims: ShippedCapabilityKey[];
  groundingScore: number;
}

/**
 * Verifies any candidate copy string (headline, support, CTA) against the Product Promise Contract.
 */
export function verifyCopyAgainstPromiseContract(copy: {
  headline: string;
  support?: string;
  cta?: string;
}): PromiseVerificationResult {
  const fullText = `${copy.headline} ${copy.support || ""} ${copy.cta || ""}`.toLowerCase();
  const violations: PromiseViolation[] = [];
  const verifiedClaims: ShippedCapabilityKey[] = [];

  // 1. Check for banned buzzwords
  for (const buzzword of BANNED_BUZZWORDS) {
    if (fullText.includes(buzzword.toLowerCase())) {
      violations.push({
        code: "ERR_FORBIDDEN_BUZZWORD",
        matchedText: buzzword,
        reason: `Copy contains banned hyperbolic buzzword: '${buzzword}'. Use factual, measured descriptions.`,
      });
    }
  }

  // 2. Check for forbidden unshipped capability claims
  for (const forbidden of FORBIDDEN_PROMISES) {
    if (forbidden.pattern.test(fullText)) {
      violations.push({
        code: forbidden.code,
        matchedText: fullText.match(forbidden.pattern)?.[0] || "",
        reason: forbidden.reason,
      });
    }
  }

  // 3. Ground against shipped capabilities
  for (const [key, cap] of Object.entries(SHIPPED_CAPABILITIES) as [ShippedCapabilityKey, typeof SHIPPED_CAPABILITIES[ShippedCapabilityKey]][]) {
    const matchedKeyword = cap.keywords.find((kw) => fullText.includes(kw.toLowerCase()));
    if (matchedKeyword) {
      verifiedClaims.push(key);
    }
  }

  const valid = violations.length === 0;
  // Grounding score is 1.0 if valid and grounded, or 0.0 if violations occur.
  const groundingScore = valid ? (verifiedClaims.length > 0 ? 1.0 : 0.8) : 0.0;

  return {
    valid,
    violations,
    verifiedClaims,
    groundingScore,
  };
}
