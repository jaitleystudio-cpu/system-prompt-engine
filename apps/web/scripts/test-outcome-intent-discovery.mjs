import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { classifyOutcomeIntent, OUTCOME_CAPABILITIES } from "../src/engine/outcomeIntentClassifier.ts";

console.log("==================================================================");
console.log("🧪 BENCHMARK: SPE Outcome Intent Classifier & Discovery Trigger");
console.log("   OpenAI Plugin Discovery Standard: Positive & Negative Prompts");
console.log("==================================================================");

// 1. Positive Prompt Benchmark (The 9 Core Archetypes + Variations)
const POSITIVE_BENCHMARK = [
  {
    input: "Build me a shopping app",
    expectedCapability: "PRODUCT_APP_SPECIFICATION",
    expectedName: "Product specification and implementation prompt"
  },
  {
    input: "Design a cinematic 3D website",
    expectedCapability: "INTERACTIVE_3D_WEB_SPECIFICATION",
    expectedName: "Interactive website specification"
  },
  {
    input: "Research this scientific hypothesis",
    expectedCapability: "SCIENTIFIC_RESEARCH_PROTOCOL",
    expectedName: "Research protocol and evidence plan"
  },
  {
    input: "Create a marketing campaign",
    expectedCapability: "MARKETING_CAMPAIGN_BRIEF",
    expectedName: "Campaign brief and structured creative instructions"
  },
  {
    input: "Help me learn mathematics",
    expectedCapability: "TUTORING_INSTRUCTION_FRAMEWORK",
    expectedName: "Personalized tutoring instruction framework"
  },
  {
    input: "Create an AI agent",
    expectedCapability: "AGENT_SPECIFICATION_PLAN",
    expectedName: "Agent specification, constraints, and evaluation plan"
  },
  {
    input: "Improve this document",
    expectedCapability: "WRITING_QUALITY_AUDIT",
    expectedName: "Writing requirements and quality audit"
  },
  {
    input: "Turn this business idea into a plan",
    expectedCapability: "BUSINESS_PLANNING_SPECIFICATION",
    expectedName: "Structured business-planning specification"
  },
  {
    input: "Make this workflow automatic",
    expectedCapability: "WORKFLOW_AUTOMATION_SAFEGUARDS",
    expectedName: "Automation requirements and safeguards"
  },
  // Real-world variations
  {
    input: "Develop an e-commerce mobile store application with checkout",
    expectedCapability: "PRODUCT_APP_SPECIFICATION",
    expectedName: "Product specification and implementation prompt"
  },
  {
    input: "Design an immersive 3D landing page with Three.js and shaders",
    expectedCapability: "INTERACTIVE_3D_WEB_SPECIFICATION",
    expectedName: "Interactive website specification"
  },
  {
    input: "Formulate a research protocol to test this causal hypothesis",
    expectedCapability: "SCIENTIFIC_RESEARCH_PROTOCOL",
    expectedName: "Research protocol and evidence plan"
  },
  {
    input: "Launch a viral GTM marketing campaign for our new SaaS",
    expectedCapability: "MARKETING_CAMPAIGN_BRIEF",
    expectedName: "Campaign brief and structured creative instructions"
  },
  {
    input: "Teach me calculus from first principles",
    expectedCapability: "TUTORING_INSTRUCTION_FRAMEWORK",
    expectedName: "Personalized tutoring instruction framework"
  },
  {
    input: "Build an autonomous coding agent with MCP tools and safety firewalls",
    expectedCapability: "AGENT_SPECIFICATION_PLAN",
    expectedName: "Agent specification, constraints, and evaluation plan"
  },
  {
    input: "Polish and rewrite this executive whitepaper for maximum clarity",
    expectedCapability: "WRITING_QUALITY_AUDIT",
    expectedName: "Writing requirements and quality audit"
  },
  {
    input: "Write a business plan for an enterprise AI startup",
    expectedCapability: "BUSINESS_PLANNING_SPECIFICATION",
    expectedName: "Structured business-planning specification"
  },
  {
    input: "Automate our customer onboarding process and webhook pipeline",
    expectedCapability: "WORKFLOW_AUTOMATION_SAFEGUARDS",
    expectedName: "Automation requirements and safeguards"
  }
];

// 2. Negative Prompt Benchmark (Trivia, Greetings, Calculations, Small Syntax Lookups)
const NEGATIVE_BENCHMARK = [
  "What is the capital of France?",
  "Who was the first president of the United States?",
  "When did Apollo 11 land on the moon?",
  "Where is the Eiffel Tower located?",
  "2 + 2",
  "15 * 80",
  "What is 100 / 4?",
  "sqrt(144)",
  "calculate 25% of 300",
  "Hello",
  "Hi there",
  "Good morning",
  "How are you doing today?",
  "Tell me a joke",
  "What time is it in Tokyo?",
  "How to spell necessary",
  "Define photosynthesis in one sentence",
  "Synonym for happy",
  "How to reverse a string in Python",
  "git commit -m 'test'",
  "Translate 'thank you' to Spanish",
  "yes",
  "ok"
];

console.log(`\n[1/3] Running Positive Benchmark (${POSITIVE_BENCHMARK.length} test cases)...`);
let positivePassed = 0;
const startPos = performance.now();

for (const testCase of POSITIVE_BENCHMARK) {
  const result = classifyOutcomeIntent(testCase.input);
  
  assert.equal(
    result.decision,
    "SPECIFICATION_LIFT_AVAILABLE",
    `Positive prompt "${testCase.input}" should trigger SPECIFICATION_LIFT_AVAILABLE`
  );
  assert.equal(result.triggered, true, `Triggered flag must be true`);
  assert.equal(
    result.capabilityId,
    testCase.expectedCapability,
    `Prompt "${testCase.input}" must map to capability ${testCase.expectedCapability}`
  );
  assert.equal(
    result.capabilityName,
    testCase.expectedName,
    `Prompt "${testCase.input}" must have exact human capability name`
  );
  assert(
    result.liftedSpecificationPrompt && result.liftedSpecificationPrompt.length > 200,
    `Prompt must generate substantial 2026 specification prompt`
  );
  assert(result.confidence >= 0.70, `Confidence must be >= 0.70`);
  
  console.log(`  ✓ "${testCase.input}" -> [${result.capabilityId}] (${(result.confidence * 100).toFixed(0)}% conf)`);
  positivePassed++;
}

const posTime = (performance.now() - startPos).toFixed(2);
console.log(`✓ 100% Positive Recall: ${positivePassed}/${POSITIVE_BENCHMARK.length} in ${posTime}ms`);

console.log(`\n[2/3] Running Negative Benchmark (${NEGATIVE_BENCHMARK.length} test cases)...`);
let negativePassed = 0;
const startNeg = performance.now();

for (const query of NEGATIVE_BENCHMARK) {
  const result = classifyOutcomeIntent(query);
  
  assert.equal(
    result.decision,
    "PASS_THROUGH",
    `Negative query "${query}" MUST PASS_THROUGH without tool triggering (got ${result.decision})`
  );
  assert.equal(result.triggered, false, `Triggered flag must be false for negative query`);
  assert.equal(result.liftedSpecificationPrompt, undefined, `No lifted prompt for negative query`);
  
  console.log(`  ✓ [PASS-THROUGH] "${query}" -> Reason: ${result.reason}`);
  negativePassed++;
}

const negTime = (performance.now() - startNeg).toFixed(2);
console.log(`✓ 100% Negative Specificity: ${negativePassed}/${NEGATIVE_BENCHMARK.length} in ${negTime}ms (Zero false positives!)`);

console.log("\n[3/3] Performance & Latency Stress Test (1,000 classifications)...");
const stressStart = performance.now();
for (let i = 0; i < 500; i++) {
  classifyOutcomeIntent("Build me a shopping app");
  classifyOutcomeIntent("What is 2 + 2?");
}
const stressDuration = performance.now() - stressStart;
const avgLatencyUs = (stressDuration / 1000) * 1000; // in microseconds
console.log(`✓ 1,000 queries completed in ${stressDuration.toFixed(2)}ms (avg ${avgLatencyUs.toFixed(1)} µs / query).`);
assert(avgLatencyUs < 500, "Latency must be well below 500 microseconds for instantaneous UI responsiveness");

console.log("\n==================================================================");
console.log("🎉 ALL OUTCOME INTENT & DISCOVERY BENCHMARKS PASSED (100% SOUND)!");
console.log("==================================================================\n");
