/**
 * SPE ChatGPT & Codex Plugin 120-Test Automatic Selection Evaluation Matrix
 * 
 * Verifies plugin relevance classification and discovery fidelity:
 * - 40 Explicit prompt requests
 * - 40 Indirect prompt engineering & multilingual requests
 * - 40 Negative non-prompt queries
 * 
 * Targets:
 * - Precision >= 95%
 * - Recall >= 90%
 * - Specificity >= 95%
 * - Free tier ceiling enforcement (30,000 characters)
 * - Zero unauthorized advertising or purchase pressure
 */

import { evaluatePluginRelevance } from "../../../packages/spe-plugin/src/classifier.ts";
import {
  compileSystemPrompt,
  inspectSystemPrompt,
  comparePromptLanguages,
  FREE_TIER_MAX_OUTPUT_CHARS,
} from "../../../packages/spe-plugin/src/tools.ts";

const TEST_MATRIX = [
  // ----------------------------------------------------
  // 1-40: EXPLICIT PROMPT COMPILATION REQUESTS
  // ----------------------------------------------------
  { id: 1, category: "explicit", utterance: "Create a system prompt for a financial analysis agent that analyzes 10-K filings", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 2, category: "explicit", utterance: "Compile a system prompt for a TypeScript coding assistant with strict type safety", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 3, category: "explicit", utterance: "Generate a system prompt for an autonomous customer support bot", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 4, category: "explicit", utterance: "Write a system prompt for a legal document summarizing agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 5, category: "explicit", utterance: "Draft a system prompt for an SQL optimization assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 6, category: "explicit", utterance: "Build a prompt for a healthcare triage virtual assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 7, category: "explicit", utterance: "Create a system prompt for a Python backend engineer agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 8, category: "explicit", utterance: "Compile a prompt for a DevOps Kubernetes incident responder", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 9, category: "explicit", utterance: "Generate a system prompt for a data science EDA assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 10, category: "explicit", utterance: "Write a system prompt for an educational math tutor agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 11, category: "explicit", utterance: "Draft a system prompt for an architectural design reviewer", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 12, category: "explicit", utterance: "Create a system prompt for a cybersecurity penetration testing advisor", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 13, category: "explicit", utterance: "Build a prompt template for automated code review", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 14, category: "explicit", utterance: "Generate system instructions for an AI research assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 15, category: "explicit", utterance: "Create developer prompt for a Next.js App Router expert", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 16, category: "explicit", utterance: "Compile a prompt for an agent persona specializing in creative storytelling", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 17, category: "explicit", utterance: "Write coding agent rules for a Rust embedded systems agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 18, category: "explicit", utterance: "Generate a system prompt for a QA test automation bot", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 19, category: "explicit", utterance: "Turn these requirements into a structured AI prompt for an API documentation generator", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 20, category: "explicit", utterance: "Create a system prompt for a multilingual customer onboarding agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 21, category: "explicit", utterance: "Draft system directives for an AI assistant handling sensitive HR inquiries", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 22, category: "explicit", utterance: "Generate a system prompt for a prompt engineering mentor", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 23, category: "explicit", utterance: "Write system instructions for a Docker containerization specialist", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 24, category: "explicit", utterance: "Create a system prompt for a microservices architecture advisor", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 25, category: "explicit", utterance: "Compile a system prompt for a database migration assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 26, category: "explicit", utterance: "Build a system prompt for an e-commerce catalog categorization agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 27, category: "explicit", utterance: "Create a system prompt for an executive calendar assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 28, category: "explicit", utterance: "Generate a system prompt for an accessibility (a11y) auditor", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 29, category: "explicit", utterance: "Write developer prompt directives for a GitHub Actions workflow assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 30, category: "explicit", utterance: "Draft a system prompt for a performance engineering specialist", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 31, category: "explicit", utterance: "Compile a system prompt for an ethical hacking assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 32, category: "explicit", utterance: "Create a system prompt for a travel logistics planner agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 33, category: "explicit", utterance: "Generate system prompt rules for a bioinformatics sequence analyzer", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 34, category: "explicit", utterance: "Write coding agent rules for a React Native mobile dev assistant", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 35, category: "explicit", utterance: "Build a prompt for an automated pull request reviewer", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 36, category: "explicit", utterance: "Create a system prompt for a technical writer creating API documentation", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 37, category: "explicit", utterance: "Draft system directives for a customer success chatbot", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 38, category: "explicit", utterance: "Generate a system prompt for a machine learning experiment tracker", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 39, category: "explicit", utterance: "Create a system prompt for a compliance auditing agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 40, category: "explicit", utterance: "Compile a system prompt for a cloud security posture advisor", expectedRelevant: true, expectedTool: "compile_system_prompt" },

  // ----------------------------------------------------
  // 41-80: INDIRECT PROMPT ENGINEERING & MULTILINGUAL REQUESTS
  // ----------------------------------------------------
  { id: 41, category: "indirect", utterance: "Review this prompt and tell me if it has missing invariants or security holes", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 42, category: "indirect", utterance: "Audit this system prompt for potential prompt injection vulnerabilities", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 43, category: "indirect", utterance: "Check if this prompt has adequate acceptance verification checks", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 44, category: "indirect", utterance: "Inspect my prompt rules to see if any constraints contradict each other", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 45, category: "indirect", utterance: "Evaluate this prompt against boundary discipline standards", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 46, category: "indirect", utterance: "Analyze this prompt for potential hallucination risks", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 47, category: "indirect", utterance: "Find weaknesses in this prompt and suggest improvements", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 48, category: "indirect", utterance: "Check if this prompt is safe from jailbreaks", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 49, category: "indirect", utterance: "Audit my prompt for missing role definitions", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 50, category: "indirect", utterance: "Inspect this prompt to ensure it includes fallback instructions", expectedRelevant: true, expectedTool: "inspect_system_prompt" },
  { id: 51, category: "indirect", utterance: "Compare token cost for Telugu vs English prompts in Claude Sonnet", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 52, category: "indirect", utterance: "Dual-language prompt for: నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 53, category: "indirect", utterance: "సిస్టమ్ ప్రాంప్ట్ తయారు చేయండి: స్థానిక ఆర్గానిక్ కిరాణా దుకాణం కోసం AI అసిస్టెంట్", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 54, category: "indirect", utterance: "వ్యాపార ప్రణాళిక కోసం ఒక AI ప్రాంప్ట్ సిద్ధం చేయండి", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 55, category: "indirect", utterance: "Compare prompt languages and estimated API costs between Hindi and English", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 56, category: "indirect", utterance: "सिस्टम प्रॉम्प्ट बनाएं: वित्तीय विश्लेषण और स्टॉक मार्केट सलाहकार के लिए", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 57, category: "indirect", utterance: "சிஸ்டம் பிராம்ப்ட் உருவாக்கவும்: வாடிக்கையாளர் சேவை முகவர்", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 58, category: "indirect", utterance: "Compare prompt tokens across models for this multilingual prompt", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 59, category: "indirect", utterance: "Optimize this prompt to reduce token consumption without changing behavior", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 60, category: "indirect", utterance: "Reduce prompt tokens for this draft so it fits within context window", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 61, category: "indirect", utterance: "How should I instruct Claude to act as a rigorous code reviewer?", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 62, category: "indirect", utterance: "How should I instruct ChatGPT to act as a senior database administrator?", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 63, category: "indirect", utterance: "Write instructions for ChatGPT to act as a compliance auditor", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 64, category: "indirect", utterance: "Write instructions for Claude to act as a technical proofreader", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 65, category: "indirect", utterance: "Turn these product requirements into instructions for an AI agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 66, category: "indirect", utterance: "Structure instructions for an AI that parses incoming customer tickets", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 67, category: "indirect", utterance: "Export reusable instructions for a coding agent to put in .cursorrules", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 68, category: "indirect", utterance: "Create a .cursorrules file with strict boundary guidelines", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 69, category: "indirect", utterance: "Generate CLAUDE.md guidelines for an open source repository", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 70, category: "indirect", utterance: "Compile a prompt for a customer support agent based on these FAQs", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 71, category: "indirect", utterance: "Scaffold a prompt for an automated customer onboarding agent", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 72, category: "indirect", utterance: "Optimize this prompt for GPT-6.1-Sol token efficiency", expectedRelevant: true, expectedTool: "compile_system_prompt" },
  { id: 73, category: "indirect", utterance: "Native prompt vs English prompt token cost comparison for Indian languages", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 74, category: "indirect", utterance: "Crée un prompt système pour un assistant financier", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 75, category: "indirect", utterance: "Erstelle einen System-Prompt für einen Programmierassistenten", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 76, category: "indirect", utterance: "Quiero un prompt de sistema para atención al cliente", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 77, category: "indirect", utterance: "请为智能客服代理编写系统提示词", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 78, category: "indirect", utterance: "プログラミング支援エージェントのシステムプロンプトを作成してください", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 79, category: "indirect", utterance: "أنشئ موجه نظام لوكيل الذకاء الاصطناعي", expectedRelevant: true, expectedTool: "compare_prompt_languages" },
  { id: 80, category: "indirect", utterance: "AI ఏజెంట్ సూచనలు సిద్ధం చేయండి ఫైనాన్స్ అనాలిసిస్ కోసం", expectedRelevant: true, expectedTool: "compare_prompt_languages" },

  // ----------------------------------------------------
  // 81-120: NEGATIVE NON-PROMPT QUERIES (END TASKS / FACTUAL / CHAT)
  // ----------------------------------------------------
  { id: 81, category: "negative", utterance: "What is the weather today in New York City?", expectedRelevant: false },
  { id: 82, category: "negative", utterance: "What are the primary colors in the RGB color model?", expectedRelevant: false },
  { id: 83, category: "negative", utterance: "Who was the 16th president of the United States?", expectedRelevant: false },
  { id: 84, category: "negative", utterance: "Where is the Eiffel Tower located?", expectedRelevant: false },
  { id: 85, category: "negative", utterance: "When was the Declaration of Independence signed?", expectedRelevant: false },
  { id: 86, category: "negative", utterance: "Why is the sky blue during daytime?", expectedRelevant: false },
  { id: 87, category: "negative", utterance: "How many kilometers are in a mile?", expectedRelevant: false },
  { id: 88, category: "negative", utterance: "How does cellular respiration produce ATP?", expectedRelevant: false },
  { id: 89, category: "negative", utterance: "Calculate the square root of 144", expectedRelevant: false },
  { id: 90, category: "negative", utterance: "Solve for x: 2x + 7 = 19", expectedRelevant: false },
  { id: 91, category: "negative", utterance: "Explain the difference between mitosis and meiosis", expectedRelevant: false },
  { id: 92, category: "negative", utterance: "What caused the fall of the Western Roman Empire?", expectedRelevant: false },
  { id: 93, category: "negative", utterance: "Write a poem about the sunrise over the mountains", expectedRelevant: false },
  { id: 94, category: "negative", utterance: "Write an essay about the impact of the industrial revolution", expectedRelevant: false },
  { id: 95, category: "negative", utterance: "Write a resume for a senior graphic designer", expectedRelevant: false },
  { id: 96, category: "negative", utterance: "Write a cover letter for an entry-level marketing position", expectedRelevant: false },
  { id: 97, category: "negative", utterance: "Write a polite email declining a job offer", expectedRelevant: false },
  { id: 98, category: "negative", utterance: "Write a short story about an astronaut lost in deep space", expectedRelevant: false },
  { id: 99, category: "negative", utterance: "Draft a contract for freelance graphic design services", expectedRelevant: false },
  { id: 100, category: "negative", utterance: "Draft a non-disclosure agreement for two business partners", expectedRelevant: false },
  { id: 101, category: "negative", utterance: "Create a logo for my boutique bakery", expectedRelevant: false },
  { id: 102, category: "negative", utterance: "Tell me a bedtime story about friendly woodland creatures", expectedRelevant: false },
  { id: 103, category: "negative", utterance: "Tell me a joke about computer science", expectedRelevant: false },
  { id: 104, category: "negative", utterance: "Cook a recipe for authentic Italian carbonara", expectedRelevant: false },
  { id: 105, category: "negative", utterance: "Give me a recipe for gluten-free chocolate chip cookies", expectedRelevant: false },
  { id: 106, category: "negative", utterance: "Plan a 7-day vacation to Tokyo and Kyoto", expectedRelevant: false },
  { id: 107, category: "negative", utterance: "How do I fix a leaking kitchen sink pipe?", expectedRelevant: false },
  { id: 108, category: "negative", utterance: "How do I bake sourdough bread from scratch?", expectedRelevant: false },
  { id: 109, category: "negative", utterance: "How to train for a half marathon in 12 weeks", expectedRelevant: false },
  { id: 110, category: "negative", utterance: "Suggest 10 names for my new golden retriever puppy", expectedRelevant: false },
  { id: 111, category: "negative", utterance: "Write a python script to reverse words in a string", expectedRelevant: false },
  { id: 112, category: "negative", utterance: "Write SQL query to select all active users from customer table", expectedRelevant: false },
  { id: 113, category: "negative", utterance: "How to invert a binary tree in Python", expectedRelevant: false },
  { id: 114, category: "negative", utterance: "How do I center a div using CSS flexbox?", expectedRelevant: false },
  { id: 115, category: "negative", utterance: "Create a business plan for an organic specialty coffee shop", expectedRelevant: false },
  { id: 116, category: "negative", utterance: "Write a business plan for an online vintage shoe boutique", expectedRelevant: false },
  { id: 117, category: "negative", utterance: "Calculate taxes owed on an annual salary of $95,000 in California", expectedRelevant: false },
  { id: 118, category: "negative", utterance: "Translate 'Where is the train station?' into German", expectedRelevant: false },
  { id: 119, category: "negative", utterance: "Translate this sentence to French: The weather is beautiful today", expectedRelevant: false },
  { id: 120, category: "negative", utterance: "What does 'bona fide' mean in Latin and modern law?", expectedRelevant: false },
];

console.log("===============================================================================");
console.log("   SPE PLUGIN R0 — 120-TEST CHATGPT/CODEX AUTOMATIC SELECTION EVALUATION      ");
console.log("===============================================================================\n");

let tp = 0; // True Positive
let fp = 0; // False Positive
let tn = 0; // True Negative
let fn = 0; // False Negative
const failures = [];

for (const tc of TEST_MATRIX) {
  const result = evaluatePluginRelevance(tc.utterance);
  const actualRelevant = result.isRelevant;

  if (tc.expectedRelevant && actualRelevant) {
    if (tc.expectedTool && result.selectedTool !== tc.expectedTool) {
      failures.push({
        id: tc.id,
        utterance: tc.utterance,
        expected: `${tc.expectedRelevant} (tool=${tc.expectedTool})`,
        actual: `${actualRelevant} (tool=${result.selectedTool})`,
        reason: `Mismatched Tool: Expected tool "${tc.expectedTool}" but classifier selected "${result.selectedTool}"`,
      });
    } else {
      tp++;
    }
  } else if (!tc.expectedRelevant && !actualRelevant) {
    tn++;
  } else if (!tc.expectedRelevant && actualRelevant) {
    fp++;
    failures.push({
      id: tc.id,
      utterance: tc.utterance,
      expected: tc.expectedRelevant,
      actual: actualRelevant,
      reason: `False Positive: Got relevant (tool=${result.selectedTool}) but expected non-relevant`,
    });
  } else if (tc.expectedRelevant && !actualRelevant) {
    fn++;
    failures.push({
      id: tc.id,
      utterance: tc.utterance,
      expected: tc.expectedRelevant,
      actual: actualRelevant,
      reason: `False Negative: Expected relevant but classifier rejected (${result.reason})`,
    });
  }
}

const precision = tp / (tp + fp);
const recall = tp / (tp + fn);
const specificity = tn / (tn + fp);
const accuracy = (tp + tn) / TEST_MATRIX.length;

console.log(`Evaluated ${TEST_MATRIX.length} utterances (40 Explicit, 40 Indirect, 40 Negative):`);
console.log(`- True Positives (TP):  ${tp} / 80`);
console.log(`- False Positives (FP): ${fp} / 40`);
console.log(`- True Negatives (TN):  ${tn} / 40`);
console.log(`- False Negatives (FN): ${fn} / 80`);
console.log("-------------------------------------------------------------------------------");
console.log(`- Precision:   ${(precision * 100).toFixed(2)}% (Target >= 95.00%)`);
console.log(`- Recall:      ${(recall * 100).toFixed(2)}% (Target >= 90.00%)`);
console.log(`- Specificity: ${(specificity * 100).toFixed(2)}% (Target >= 95.00%)`);
console.log(`- Accuracy:    ${(accuracy * 100).toFixed(2)}%`);
console.log("-------------------------------------------------------------------------------\n");

if (failures.length > 0) {
  console.error("FAILURES DETECTED IN CLASSIFIER:");
  for (const f of failures) {
    console.error(`[ID ${f.id}] "${f.utterance}" -> ${f.reason}`);
  }
  process.exit(1);
}

// ----------------------------------------------------
// VERIFY TOOL FUNCTIONALITY & POLICY COMPLIANCE
// ----------------------------------------------------
console.log("VERIFYING TOOL CAPACITIES & POLICY CONSTRAINTS:");

// 1. Tool 1: compileSystemPrompt Capacity & Free ceiling check
const promptOut = compileSystemPrompt({
  goal: "Autonomous financial advisor assistant",
  category: "Finance",
  constraints: ["Never offer investment advice without disclaimer", "Preserve audit trail"],
});
if (promptOut.character_count > FREE_TIER_MAX_OUTPUT_CHARS) {
  throw new Error(`Exceeded Free tier ceiling: ${promptOut.character_count} > ${FREE_TIER_MAX_OUTPUT_CHARS}`);
}
if (promptOut.capacity_limit !== 30000) {
  throw new Error(`Expected Free tier capacity limit 30,000, got ${promptOut.capacity_limit}`);
}
if (promptOut.is_token_count_exact !== false) {
  throw new Error(`Token counts must be labeled as estimated approximations, not exact`);
}
console.log(`[PASS] compileSystemPrompt: Output ${promptOut.character_count} chars <= ${FREE_TIER_MAX_OUTPUT_CHARS} ceiling. Honest token estimation verified.`);

// 2. Tool 2: inspectSystemPrompt Quality Audit
const auditOut = inspectSystemPrompt(promptOut.prompt);
if (auditOut.quality_score < 80) {
  throw new Error(`Expected compiled prompt to pass audit with score >= 80, got ${auditOut.quality_score}`);
}
if (!auditOut.has_role || !auditOut.has_objective || !auditOut.has_invariants || !auditOut.has_verification) {
  throw new Error(`Expected all core sections detected in compiled prompt`);
}
console.log(`[PASS] inspectSystemPrompt: Scored ${auditOut.quality_score}/100. Core sections verified.`);

// 3. Tool 3: comparePromptLanguages Multilingual & Token cost analysis
const dualOut = comparePromptLanguages(
  "నాకు మహిళల దుస్తుల వ్యాపారం ప్రారంభించాలని ఉంది. నాకు మంచి బిజినెస్ ప్లాన్ కావాలి.",
  "Business",
  "claude-sonnet"
);
if (dualOut.detectedLanguage.code !== "te") {
  throw new Error(`Expected detected language 'te', got ${dualOut.detectedLanguage.code}`);
}
if (!dualOut.nativePrompt || !dualOut.englishPrompt) {
  throw new Error(`Expected both nativePrompt and englishPrompt generated independently`);
}
if (dualOut.tokenSavingsPercent <= 0) {
  throw new Error(`Expected positive token efficiency savings for English version`);
}
console.log(`[PASS] comparePromptLanguages: Telugu detected (${dualOut.detectedLanguage.name}), English generated, token savings ${dualOut.tokenSavingsPercent.toFixed(1)}%.`);

// 4. Policy Check: ZERO advertising / checkout links / subscription pricing in tool outputs
const jsonStr = JSON.stringify({ promptOut, auditOut, dualOut });
if (/(subscribe now|checkout\.stripe|upgrade to pro|upgrade now|monthly subscription|credit card required)/i.test(jsonStr)) {
  throw new Error("VIOLATION: Found promotional or purchase pressure copy in tool outputs!");
}
console.log("[PASS] Policy compliance: ZERO in-chat promotional text or checkout links detected.");

// ----------------------------------------------------
// 5. INVARIANT-PRESERVING CAPACITY CEILING & BOUNDARY BATTERY
// ----------------------------------------------------
console.log("\nVERIFYING INVARIANT-PRESERVING CAPACITY CEILING & UNICODE BOUNDARIES:");

// Case A: 29,999 characters (unaltered, passes completely within Free tier ceiling)
const baseGoal29k = "Execute deterministic financial risk analysis. ".repeat(600); // ~28,200 chars
const out29k = compileSystemPrompt({
  goal: baseGoal29k.slice(0, 28500),
  category: "Finance",
  constraints: ["User Invariant Alpha: Never hallucinate balances", "User Invariant Beta: Strictly verify audit log"],
  output_format: "JSON schema with fields { status: string, score: number }",
});
if (out29k.character_count > FREE_TIER_MAX_OUTPUT_CHARS) {
  throw new Error(`Case A: Prompt exceeded Free tier ceiling: ${out29k.character_count}`);
}
if (!out29k.prompt.includes("User Invariant Alpha") || !out29k.prompt.includes("User Invariant Beta")) {
  throw new Error("Case A: Lost user constraints in 29k char prompt!");
}
if (!out29k.prompt.includes("# Acceptance Verification Battery") || !out29k.prompt.includes("# Desired Output Contract")) {
  throw new Error("Case A: Lost acceptance criteria or output contract in 29k char prompt!");
}
console.log(`[PASS] Case A (29k chars): Output ${out29k.character_count} chars <= 30,000. All invariants, acceptance criteria, and output contract intact.`);

// Case B: 30,000 characters exact boundary
const out30kExact = compileSystemPrompt({
  goal: "A".repeat(30000),
  category: "Engineering",
  constraints: ["Constraint X: Maintain zero external egress", "Constraint Y: Air-gapped execution only"],
  output_format: "Markdown report format",
});
if (out30kExact.character_count > FREE_TIER_MAX_OUTPUT_CHARS) {
  throw new Error(`Case B: Output exceeded 30,000 ceiling: ${out30kExact.character_count}`);
}
if (!out30kExact.prompt.includes("Constraint X") || !out30kExact.prompt.includes("Constraint Y")) {
  throw new Error("Case B: Lost user constraints at 30k boundary!");
}
if (!out30kExact.prompt.includes("# Acceptance Verification Battery") || !out30kExact.prompt.includes("# Desired Output Contract")) {
  throw new Error("Case B: Lost acceptance criteria or output contract at 30k boundary!");
}
console.log(`[PASS] Case B (30,000 boundary): Output ${out30kExact.character_count} chars <= 30,000. Invariants and acceptance battery preserved under trimming.`);

// Case C: 30,295 characters (ChatGPT exact reproduction scenario)
// Raw assembled prompt exceeds 30,000 characters (e.g. 30,295 chars).
// Verify that narrative was trimmed, but # Acceptance Verification Battery and # Desired Output Contract were NEVER dropped!
const chatGptReproGoal = "Detailed system analysis directive narrative with extensive background context. ".repeat(400);
const out30295 = compileSystemPrompt({
  goal: chatGptReproGoal,
  category: "Compliance",
  constraints: [
    "MANDATORY_INVARIANT_1: Zero unauthorized telemetry",
    "MANDATORY_INVARIANT_2: Preserve complete provenance ledger",
  ],
  output_format: "XML document with <audit_verdict> and <signatures>",
});
if (out30295.character_count > FREE_TIER_MAX_OUTPUT_CHARS) {
  throw new Error(`Case C (30,295 repro): Output exceeded 30,000 ceiling: ${out30295.character_count}`);
}
if (!out30295.prompt.includes("MANDATORY_INVARIANT_1") || !out30295.prompt.includes("MANDATORY_INVARIANT_2")) {
  throw new Error("Case C: CRITICAL DEFECT - User invariants were truncated!");
}
if (!out30295.prompt.includes("# Acceptance Verification Battery")) {
  throw new Error("Case C: CRITICAL DEFECT - # Acceptance Verification Battery was sliced off at the bottom!");
}
if (!out30295.prompt.includes("# Desired Output Contract") || !out30295.prompt.includes("<audit_verdict>")) {
  throw new Error("Case C: CRITICAL DEFECT - # Desired Output Contract was sliced off at the bottom!");
}
if (out30295.warnings.length === 0 || !out30295.warnings[0].includes("preserving all operational invariants")) {
  throw new Error("Case C: Warning must state that operational invariants and acceptance criteria were preserved");
}
console.log(`[PASS] Case C (ChatGPT 30,295 repro): Output ${out30295.character_count} chars <= 30,000. Invariants, Acceptance Battery, and Desired Output Contract 100% PRESERVED.`);

// Case D: Unicode Surrogate Pair Safety at Truncation Boundary
// An emoji (e.g., 🚀 "\uD83D\uDE80") consists of 2 code units.
// Position multibyte emoji right across the truncation boundary to test against orphan high surrogate slicing.
const emojiGoal = "Analysis narrative ".repeat(1500) + " 🚀🌟🔥";
const outEmoji = compileSystemPrompt({
  goal: emojiGoal,
  category: "Data",
  constraints: ["Invariant Emoji Safety: UTF-16 surrogate pairs must never be split"],
});
if (outEmoji.character_count > FREE_TIER_MAX_OUTPUT_CHARS) {
  throw new Error(`Case D: Output exceeded 30,000 ceiling: ${outEmoji.character_count}`);
}
const tailCode = outEmoji.prompt.charCodeAt(outEmoji.prompt.length - 1);
if (tailCode >= 0xd800 && tailCode <= 0xdbff) {
  throw new Error(`Case D: Orphan high surrogate 0x${tailCode.toString(16)} found at prompt boundary!`);
}
try {
  encodeURIComponent(outEmoji.prompt);
} catch (e) {
  throw new Error(`Case D: Malformed UTF-16 surrogate split detected: ${e.message}`);
}
console.log(`[PASS] Case D (Unicode surrogate boundary): Valid UTF-16 code units verified. No orphan high surrogates (tail=0x${tailCode.toString(16)}).`);

// Case E: Constraints alone exceed 30,000 characters (Fail-Closed Gate)
let failClosedTriggered = false;
try {
  compileSystemPrompt({
    goal: "Small goal",
    constraints: [
      "MEGA_CONSTRAINT_PART_1: " + "C".repeat(15000),
      "MEGA_CONSTRAINT_PART_2: " + "D".repeat(16000),
    ],
  });
} catch (e) {
  if (e.message.includes("CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING")) {
    failClosedTriggered = true;
  } else {
    throw new Error(`Case E: Unexpected error: ${e.message}`);
  }
}
if (!failClosedTriggered) {
  throw new Error("Case E: CRITICAL DEFECT - Failed to trigger fail-closed exception when constraints alone exceed 30,000 characters!");
}
console.log("[PASS] Case E (Fail-closed constraint gate): Threw CAPACITY_ERROR_PROTECTED_CONSTRAINTS_EXCEED_CEILING when protected constraints exceeded 30,000 chars.");

console.log("\n===============================================================================");
console.log("   ALL 120 AUTOMATIC SELECTION EVALUATIONS & TOOL CONSTRAINTS PASSED CLEANLY! ");
console.log("===============================================================================\n");
