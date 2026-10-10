/**
 * Verification test for Polyglot Cross-Model Dialect Transcompiler
 */
import {
  transcompilePrompt,
  transcompileAllDialects,
  parseToCanonicalIR,
} from "../src/engine/modelTranscompiler.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Cross-Model Dialect Transcompiler");
console.log("==================================================================");

const inputPrompt = `You are an elite autonomous cloud architect.
Goal: Generate production-ready infrastructure specifications.
MUST NOT execute unvetted shell scripts.
MUST preserve all confidential API keys and database credentials.
Authority: Limit execution to terraform plan; refuse terraform apply without confirmation.
Output schema must be valid JSON with required resource definitions.`;

// Step 1: Verify Canonical IR Parsing
console.log("\n[1/3] Testing Canonical IR Parsing...");
const ir = parseToCanonicalIR(inputPrompt);
console.log(`Role:       ${ir.role}`);
console.log(`Invariants: ${ir.hardInvariants.length} captured`);
console.log(`Authority:  ${ir.authorityBoundaries.length} captured`);

if (ir.hardInvariants.length === 0) {
  throw new Error("Failed to parse hard invariants into Canonical IR");
}

// Step 2: Test Transcompilation to All 11 Dialects
console.log("\n[2/3] Testing Transcompilation across all 11 model runtimes...");
const dialects = transcompileAllDialects(inputPrompt);

const dialectKeys = [
  "claude-xml",
  "claude-code",
  "openai-markdown",
  "gemini-agent",
  "cursor-rules",
  "windsurf-rules",
  "antigravity-skills",
  "grok",
  "kimi",
  "open-weights",
  "ollama-modelfile",
];

for (const key of dialectKeys) {
  const result = dialects[key];
  if (!result || !result.compiledPrompt) {
    throw new Error(`Missing compilation result for dialect ${key}`);
  }
  console.log(`  ✓ [${result.dialect}] Target: ${result.modelTarget} | Flavor: ${result.syntaxFlavor} (~${result.tokenEstimate} tokens)`);
}

// Step 3: Verify Dialect Syntax Specifics
console.log("\n[3/3] Validating Specific Dialect Structural Boundaries...");
// Claude XML must have tags
if (!dialects["claude-xml"].compiledPrompt.includes("<system_instructions>") || !dialects["claude-xml"].compiledPrompt.includes("</system_instructions>")) {
  throw new Error("Claude XML dialect missing <system_instructions> root tag!");
}
// Claude Code must have CLAUDE.md headers
if (!dialects["claude-code"].compiledPrompt.includes("# CLAUDE.md")) {
  throw new Error("Claude Code dialect missing # CLAUDE.md header!");
}
// OpenAI must have Markdown headings
if (!dialects["openai-markdown"].compiledPrompt.includes("# SYSTEM POLICY")) {
  throw new Error("OpenAI Markdown dialect missing # SYSTEM POLICY header!");
}
// Cursor rules must be valid JSON
JSON.parse(dialects["cursor-rules"].compiledPrompt);
console.log("  ✓ Cursor rules confirmed valid JSON configuration.");

// Windsurf must have .windsurfrules header
if (!dialects["windsurf-rules"].compiledPrompt.includes("# WINDSURF")) {
  throw new Error("Windsurf dialect missing # WINDSURF header!");
}

// Antigravity Skills must have YAML frontmatter and <RULE>
if (!dialects["antigravity-skills"].compiledPrompt.startsWith("---") || !dialects["antigravity-skills"].compiledPrompt.includes("<RULE id=")) {
  throw new Error("Antigravity Skills dialect missing YAML frontmatter or <RULE> tags!");
}

// Grok must have Grok 4.9 truth-kernel directives
if (!dialects["grok"].compiledPrompt.includes("# GROK 4.9")) {
  throw new Error("Grok dialect missing # GROK 4.9 truth-kernel header!");
}

// Kimi must have Kimi 3.5 anchor markers
if (!dialects["kimi"].compiledPrompt.includes("# KIMI 3.5") || !dialects["kimi"].compiledPrompt.includes("[ANCHOR: ROLE_DEFINITION]")) {
  throw new Error("Kimi dialect missing # KIMI 3.5 header or anchor markers!");
}

// Gemini must have Gemini 3.9 Pro bracketed instructions
if (!dialects["gemini-agent"].compiledPrompt.includes("[GEMINI 3.9 PRO")) {
  throw new Error("Gemini dialect missing [GEMINI 3.9 PRO instruction tags!");
}

// Open-Weights must have DeepSeek 4.5 and ChatML tokens
if (!dialects["open-weights"].compiledPrompt.includes("DeepSeek 4.5") || !dialects["open-weights"].compiledPrompt.includes("<|start_header_id|>system<|end_header_id|>")) {
  throw new Error("Open-weights dialect missing DeepSeek 4.5 or ChatML header tags!");
}

// Ollama Modelfile must have FROM and SYSTEM
if (!dialects["ollama-modelfile"].compiledPrompt.includes("FROM llama3.3") || !dialects["ollama-modelfile"].compiledPrompt.includes("SYSTEM \"\"\"")) {
  throw new Error("Ollama Modelfile dialect missing FROM or SYSTEM definition!");
}

console.log("\n==================================================================");
console.log("🎉 ALL CROSS-MODEL TRANSCOMPILER TESTS PASSED! (11/11 DIALECTS)");
console.log("==================================================================");
process.exit(0);
