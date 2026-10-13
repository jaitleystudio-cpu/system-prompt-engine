#!/usr/bin/env node
/**
 * SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1) Universal Verification Suite
 *
 * Verifies all 5 intelligence-efficiency mechanisms and core invariants:
 * 1. Exact Canonical WASM Hash Pinning
 * 2. Mechanism A: 5 Information Classes & Semantic Conservation
 * 3. Mechanism B: Exact NanoUSD Integer Accounting & Value-of-Information (VOI) Score
 * 4. Mechanism C: Counterfactual Optimization (CSC Integration) Adversarial Boundary Probes
 * 5. 8 Optimization Techniques & EGAC-E01 Controlled Experiment
 * 6. Scientific Breakthrough Metric: Verified Successful Outcomes per Dollar (VSOD)
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("================================================================================");
console.log("⚡ SPE Ω (EGAC-1) — Intelligence–Efficiency Breakthrough Verification Suite");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// Check 1: Canonical WASM Hash Pinning
// -----------------------------------------------------------------------------
console.log("🔒 [Invariant 1] Verifying Canonical WASM Hash Pinning...");
{
  const wasmBuf = readFileSync(join(root, "public/spe_wasm.wasm"));
  const actualHash = createHash("sha256").update(wasmBuf).digest("hex");
  const expectedHash = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d";

  assert.equal(actualHash, expectedHash, "Canonical WASM hash mismatch!");
  console.log(`   ✅ Pinned WASM SHA256 verified: ${actualHash}`);
}

// Bundle and dynamically import EGAC-1 TypeScript Kernel
const bundle = await build({
  entryPoints: [join(root, "src/engine/speEgacKernel.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const kernel = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// -----------------------------------------------------------------------------
// Check 2: Mechanism A — Semantic Conservation System (5 Information Classes)
// -----------------------------------------------------------------------------
console.log("\n🛡️ [Mechanism A] Validating 5 Information Classes & Semantic Conservation...");
{
  const rawPrompt = `
  # Security Mandate
  You must never transmit customer data externally.
  { "schema_id": "sha256:4a8b1c", "strict": true }
  Empirical measurements showed a 42.5% increase in verified throughput (doi:10.1000/182).
  Current session token: session_xyz_9981 expires at timestamp 1728777600.
  Please summarize the background context for the user in polite prose.
  `;

  const nodes = kernel.classifyInformationNodes(rawPrompt);
  assert.ok(nodes.length >= 5, "Must classify at least 5 nodes");

  const classes = new Set(nodes.map((n) => n.classification));
  assert.ok(classes.has("PROTECTED_REQUIREMENTS"), "Missing PROTECTED_REQUIREMENTS");
  assert.ok(classes.has("EXACT_BYTE_MATERIAL"), "Missing EXACT_BYTE_MATERIAL");
  assert.ok(classes.has("EVIDENCE_BEARING_MATERIAL"), "Missing EVIDENCE_BEARING_MATERIAL");
  assert.ok(classes.has("VOLATILE_INFORMATION"), "Missing VOLATILE_INFORMATION");
  assert.ok(classes.has("REPLACEABLE_CONTEXT"), "Missing REPLACEABLE_CONTEXT");
  console.log(`   ✅ All 5 canonical Information Classes classified correctly across ${nodes.length} nodes`);

  // Test conservation invariant: stripping protected requirement must fail
  const naiveCandidate = {
    candidateId: "test-naive-cand",
    technique: "WHITESPACE_NORMALIZATION",
    sourceContent: rawPrompt,
    transformedContent: "Please summarize the background context for the user in polite prose.",
    diff: {
      addedTokens: 0,
      removedTokens: 30,
      preservedInvariants: [],
      violatedInvariants: [],
      informationLossScore: 0,
      isConservative: true,
      explanation: "",
    },
    status: "CONSERVED",
  };

  const validated = kernel.validateSemanticConservation(naiveCandidate, nodes);
  assert.equal(validated.status, "VIOLATED", "Stripping protected requirements must trigger VIOLATED status");
  assert.equal(validated.diff.isConservative, false, "Must mark isConservative=false");
  assert.ok(validated.diff.violatedInvariants.length > 0, "Must record violated invariants");
  // Test multilingual protected requirement classification
  const jpPrompt = "機密データを外部に送信してはならない。必ずローカルで実行すること。";
  const jpNodes = kernel.classifyInformationNodes(jpPrompt);
  assert.ok(
    jpNodes.some((n) => n.classification === "PROTECTED_REQUIREMENTS"),
    "Must classify Japanese protected requirements",
  );
  console.log("   ✅ Multilingual (Japanese) protected requirement correctly classified");
}

// -----------------------------------------------------------------------------
// Check 3: Mechanism B — Value-of-Information (VOI) Decision Engine & NanoUSD
// -----------------------------------------------------------------------------
console.log("\n🧮 [Mechanism B] Validating VOI Decision Score & Exact NanoUSD Math...");
{
  assert.equal(kernel.NANOS_PER_USD, 1_000_000_000, "NanoUSD constant must equal exactly 10^9 nanos per $1.00 USD");

  // V(a) = E[Delta Q | a] * 10^9 / (C_a + lambda * T_a)
  // Action 1: Delta Q = 0.8, Cost = $0.05 (50,000,000 nanos), Latency = 100ms, lambda = 0
  const voi1 = kernel.computeVoiScore(0.8, 50_000_000, 100, 0);
  // Expected: 0.8 * 10^9 / 50*10^6 = 16.0
  assert.equal(voi1, 16.0, "VOI score calculation mismatch for Action 1");

  // Action 2: Delta Q = 0.2, Cost = $0.50 (500,000,000 nanos), Latency = 2000ms, lambda = 0
  const voi2 = kernel.computeVoiScore(0.2, 500_000_000, 2000, 0);
  // Expected: 0.2 * 10^9 / 500*10^6 = 0.4
  assert.equal(voi2, 0.4, "VOI score calculation mismatch for Action 2");

  assert.ok(voi1 > voi2, "High-efficiency action must have higher VOI than expensive low-gain action");
  console.log(`   ✅ Exact VOI formula verified: Action 1 (${voi1} pts/$) > Action 2 (${voi2} pts/$)`);

  // Test execution planner across experience levels
  const stratImmediate = kernel.planExecutionStrategy("Short factual question", "IMMEDIATE");
  assert.equal(stratImmediate.experienceLevel, "IMMEDIATE");
  assert.equal(stratImmediate.reasoningBudget, 1);
  assert.ok(stratImmediate.estimatedCostNanos <= 15_000_000);

  const stratDiscovery = kernel.planExecutionStrategy("Discovery thesis", "DISCOVERY");
  assert.equal(stratDiscovery.experienceLevel, "DISCOVERY");
  assert.equal(stratDiscovery.techniquesEnabled.OUTPUT_TOKEN_BUDGET_2048, "FORCE_OFF");
  assert.equal(stratDiscovery.techniquesEnabled.CONCISE_OUTPUT_INSTRUCTION, "FORCE_OFF");
  assert.ok(stratDiscovery.reasoningBudget >= 12);

  // Test constrained execution planner infeasibility fallback
  const infeasiblePlan = kernel.planExecutionStrategy("Short text", "IMMEDIATE", 0.5, {
    minQuality: 0.99, // Impossible with IMMEDIATE level (quality max is 0.88)
    maxCostNanos: 1_000_000,
    maxLatencyMs: 100,
  });
  assert.equal(infeasiblePlan.isFeasible, false, "Must flag infeasible constraints");
  assert.ok(infeasiblePlan.infeasibilityReason.includes("Infeasible"), "Must provide infeasibility reason");
  console.log("   ✅ Adaptive execution planner & constrained feasibility fallback verified");
}

// -----------------------------------------------------------------------------
// Check 4: Mechanism C — Counterfactual Optimization (CSC Integration)
// -----------------------------------------------------------------------------
console.log("\n🔬 [Mechanism C] Validating Counterfactual Adversarial Boundary Probes...");
{
  const src = "Build an offline ledger. You must never transmit data externally. Store records in SQLite.";
  // Candidate dropped egress rule
  const strippedCand = {
    candidateId: "cand-strip",
    technique: "WHITESPACE_NORMALIZATION",
    sourceContent: src,
    transformedContent: "Build an offline ledger. Store records in SQLite.",
    diff: {
      addedTokens: 0,
      removedTokens: 5,
      preservedInvariants: [],
      violatedInvariants: [],
      informationLossScore: 0,
      isConservative: true,
      explanation: "",
    },
    status: "CONSERVED",
  };

  const scenarios = kernel.runAdversarialCounterfactuals(strippedCand);
  assert.equal(scenarios.length, 5, "Must generate 5 adversarial counterfactual scenarios");

  const secProbe = scenarios.find((s) => s.testType === "SECURITY_EGRESS");
  assert.ok(secProbe, "Security egress probe must be present");
  assert.equal(secProbe.passed, false, "Security egress probe must catch stripped transmission prohibition!");
  assert.ok(secProbe.details.includes("SECURITY BREACH"), "Must record breach explanation");

  // Test German multilingual egress counterfactual probe
  const deSrc = "System initialisieren. Niemals Kundendaten an externe Server übertragen. Lokal speichern.";
  const deCand = {
    candidateId: "de-cand",
    technique: "WHITESPACE_NORMALIZATION",
    sourceContent: deSrc,
    transformedContent: "System initialisieren. Lokal speichern.",
    diff: { addedTokens: 0, removedTokens: 5, preservedInvariants: [], violatedInvariants: [], informationLossScore: 0, isConservative: true, explanation: "" },
    status: "CONSERVED",
  };
  const deScenarios = kernel.runAdversarialCounterfactuals(deCand);
  const deSecProbe = deScenarios.find((s) => s.testType === "SECURITY_EGRESS");
  assert.ok(deSecProbe && !deSecProbe.passed, "Must catch German egress violation in counterfactuals");
  console.log("   ✅ Multilingual (English & German) adversarial boundary probes caught unauthorized egress deletion");
}

// -----------------------------------------------------------------------------
// Check 5: 8-Technique Lab & EGAC-E01 Controlled Experiment
// -----------------------------------------------------------------------------
console.log("\n🧪 [Techniques & E01] Validating 8 Techniques & EGAC-E01 Controlled Experiment...");
{
  const manuscriptPrompt = "Write a complete 100,000-word comprehensive treatise on topological quantum field theory.";
  const budgetCand = kernel.applyTechnique("OUTPUT_TOKEN_BUDGET_2048", manuscriptPrompt, true);
  assert.equal(budgetCand.status, "VIOLATED", "Output Token Budget 2048 must be rejected on 100,000-word manuscripts");
  assert.ok(budgetCand.rejectionReason.includes("REJECTED"), "Must contain explicit rejection reason");
  console.log("   ✅ 2048 token cap safely rejected on long-form 100k-word manuscript");

  // Test lexical minification preserving duplicate keys and 64-bit integers
  const dupJson = '{\n  "id": 9007199254740993,\n  "tag": "first",\n  "tag": "second"\n}';
  const dupMinCand = kernel.applyTechnique("JSON_MINIFICATION", dupJson, false);
  assert.equal(
    dupMinCand.transformedContent,
    '{"id":9007199254740993,"tag":"first","tag":"second"}',
    "Must preserve duplicate keys and 64-bit int without precision loss or key collapse",
  );
  console.log("   ✅ Lexical JSON minification strictly preserves duplicate keys and 64-bit integers");

  // Run EGAC-E01 Experiment
  const e01 = kernel.runEgacE01Experiment();
  assert.equal(e01.experimentName, "SPE-PRO-EGAC-E01-JSON");
  assert.equal(e01.nTrials, 120, "Must run all 120 workloads in the EGAC-E01 battery");
  assert.ok(e01.tokenReductionPct > 0, "Must demonstrate positive token reduction");
  assert.ok(e01.netSavingsNanos > 0, "Must achieve net positive NanoUSD financial savings");
  assert.equal(e01.canaryFailures, 0, "Safety canary tolerance must be exactly ZERO failures!");
  assert.equal(e01.passedPromotionGate, true, "Must pass research promotion gate");
  assert.ok(e01.categoryStats, "Must have categoryStats breakdown across all 8 domains");

  const expectedCategories = [
    "nested_structured_json",
    "unicode_and_escapes",
    "large_integers",
    "duplicate_object_keys",
    "scientific_numerical_data",
    "api_contract",
    "mixed_prose_and_json",
    "literal_string_spaces",
  ];
  for (const cat of expectedCategories) {
    assert.ok(e01.categoryStats[cat], `Missing category stats for ${cat}`);
    assert.equal(e01.categoryStats[cat].trials, 15, `Expected 15 trials for ${cat}`);
    assert.equal(e01.categoryStats[cat].canaryFailures, 0, `Canary failures in ${cat} must be 0`);
  }
  console.log(`   ✅ EGAC-E01 JSON Minification verified: 120 trials across 8 categories, ${e01.tokenReductionPct}% token reduction, 0 canary failures, PROMOTED`);
}

// -----------------------------------------------------------------------------
// Check 6: Scientific Breakthrough Metric: VSOD
// -----------------------------------------------------------------------------
console.log("\n📈 [Metric: VSOD] Validating Verified Successful Outcomes per Dollar...");
{
  // System A: 65 successes, $10.00 cost (10 * 10^9 nanos) -> VSOD = 6.5
  const sysA = kernel.calculateVsod(65, 10 * kernel.NANOS_PER_USD);
  assert.equal(sysA.vsodScore, 6.5);
  assert.equal(sysA.totalCostUsd, 10.0);

  // System B: 85 successes, $8.00 cost (8 * 10^9 nanos) -> VSOD = 10.625
  const sysB = kernel.calculateVsod(85, 8 * kernel.NANOS_PER_USD);
  assert.equal(sysB.vsodScore, 10.625);
  assert.equal(sysB.totalCostUsd, 8.0);

  const comp = kernel.compareVsodSystems(sysA, sysB);
  assert.equal(comp.isSuperior, true, "System B must be superior");
  assert.ok(comp.vsodGainPct > 60.0, "VSOD gain must be > 60%");
  assert.equal(comp.costSavingsNanos, 2 * kernel.NANOS_PER_USD, "Cost savings must equal $2.00 (2*10^9 nanos)");
  console.log(`   ✅ VSOD comparative engine verified: +${comp.vsodGainPct}% gain, $${(comp.costSavingsNanos / kernel.NANOS_PER_USD).toFixed(2)} savings`);
}

console.log("\n================================================================================");
console.log("🌟 ALL SPE Ω (EGAC-1) UNIVERSAL CHECKS PASSED FLAWLESSLY");
console.log("================================================================================\n");
