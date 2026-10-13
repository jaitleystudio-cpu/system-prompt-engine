#!/usr/bin/env node
/**
 * SPE Ω PRO — Scientific Discovery Engine (RGD-1) Universal Verification Suite
 *
 * Verifies all 8 core discovery mechanisms and governance invariants:
 * 1. Canonical WASM Hash Pinning
 * 2. Mechanism 1: Research Mission Compiler & Unresolved Assumption Isolation
 * 3. Mechanism 2: 400M+ Scholarly Catalog & 3-Tier Access Levels (Metadata, Abstract, Full Text)
 * 4. Mechanism 3: 11-Field Structured Evidence Schema & Contradiction/Support Graph
 * 5. Mechanism 4: Counterfactual Discovery Compilation & Bayesian VOI Optimization in Exact NanoUSD
 * 6. Mechanism 5: Research Verification Certificates (RVC), SHA-256 Seals & Law of Truth Conservation
 * 7. Mechanism 6: Compounding Capability Lifecycle & Automatic Assumption Invalidation
 * 8. Mechanism 7: Persistent 100,000-Word Deep Research Job Coordinator & Truncation Guard
 * 9. Mechanism 8: Web Studio UI & FeaturesHub Integration
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("================================================================================");
console.log("⚡ SPE Ω PRO (RGD-1) — Reality-Grounded Discovery Universal Verification Suite");
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

// Bundle and dynamically import RGD-1 TypeScript Kernel
console.log("\n📦 Bundling and importing speRgdKernel.ts via esbuild...");
const bundle = await build({
  entryPoints: [join(root, "src/engine/speRgdKernel.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const kernel = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
console.log("   ✅ RGD-1 TypeScript Kernel compiled and loaded successfully.");

// -----------------------------------------------------------------------------
// Check 2: Mechanism 1 — Research Mission Compiler & Unresolved Assumption Isolation
// -----------------------------------------------------------------------------
console.log("\n🎯 [Mechanism 1] Validating Research Mission Compilation & Domain Detection...");
{
  const rawPrompt = "Invent a radically more efficient mobile audio codec with low latency.";
  const mission = kernel.compileResearchMission(rawPrompt, undefined, "EVIDENCE_ANSWER", 10_000_000_000);

  assert.ok(mission.missionId.startsWith("mission_"), "Mission ID format invalid");
  assert.equal(mission.targetDomain, "AUDIO_ENGINEERING", "Domain detection failed for audio codec");
  assert.equal(mission.speedClass, "EVIDENCE_ANSWER", "Speed class mismatch");

  // Measurable constraints
  assert.ok(mission.measurableConstraints.length >= 4, "Must extract at least 4 measurable constraints");
  assert.ok(
    mission.measurableConstraints.some((c) => c.toLowerCase().includes("latency")),
    "Missing latency constraint",
  );
  assert.ok(
    mission.measurableConstraints.some((c) => c.toLowerCase().includes("bit rate") || c.toLowerCase().includes("efficiency")),
    "Missing bitrate/efficiency constraint",
  );

  // Unresolved assumptions (flagged as assumptions, never fabricated as established truth)
  assert.ok(mission.unresolvedAssumptions.length >= 2, "Must identify unresolved assumptions");
  assert.ok(
    mission.unresolvedAssumptions.some((a) => a.toLowerCase().includes("sample rate")),
    "Missing sample rate assumption",
  );

  console.log(`   ✅ Compiled mission: Domain=${mission.targetDomain}, Constraints=${mission.measurableConstraints.length}, Assumptions=${mission.unresolvedAssumptions.length}`);
}

// -----------------------------------------------------------------------------
// Check 3: Mechanism 2 — 400M+ Scholarly Catalog & 3-Tier Access Levels
// -----------------------------------------------------------------------------
console.log("\n📚 [Mechanism 2] Validating 400M+ Catalog Scale & 3 Access Levels (Metadata, Abstract, Full Text)...");
{
  assert.equal(kernel.DOCUMENTED_TOTAL_CATALOG_COUNT, 510_000_000, "Catalog total count mismatch");
  assert.equal(kernel.DOCUMENTED_CURATED_CORE_COUNT, 320_000_000, "Curated core count mismatch");
  assert.equal(kernel.DOCUMENTED_EXPANSION_COUNT, 190_000_000, "Expansion count mismatch");
  assert.equal(kernel.DOCUMENTED_CACHED_FULL_TEXT_COUNT, 50_000_000, "Cached full text count mismatch");
  assert.ok(kernel.DOCUMENTED_CACHED_FULL_TEXT_COUNT < kernel.DOCUMENTED_TOTAL_CATALOG_COUNT, "Full text must not equal full catalog");

  // Search catalog with retractions excluded
  const audioRecords = kernel.searchScholarlyCatalog("audio", undefined, "METADATA", true, 10);
  assert.ok(audioRecords.length >= 3, "Expected at least 3 audio records");
  assert.ok(!audioRecords.some((r) => r.isRetracted), "Retracted records must be excluded when flag is true");

  // Search including retractions
  const allAudio = kernel.searchScholarlyCatalog("audio", undefined, "METADATA", false, 10);
  assert.ok(allAudio.some((r) => r.isRetracted), "Must find retracted record when excludeRetracted is false");

  // Test extraction across 3 distinct access levels
  const recFull = audioRecords.find((r) => r.accessLevel === "FULL_TEXT");
  const recAbs = audioRecords.find((r) => r.accessLevel === "ABSTRACT");
  const recMeta = audioRecords.find((r) => r.accessLevel === "METADATA");

  assert.ok(recFull, "Must have FULL_TEXT record");
  assert.ok(recAbs, "Must have ABSTRACT record");
  assert.ok(recMeta, "Must have METADATA record");

  const evFull = kernel.extractStructuredEvidence(recFull);
  const evAbs = kernel.extractStructuredEvidence(recAbs);
  const evMeta = kernel.extractStructuredEvidence(recMeta);

  assert.equal(evFull.accessLevel, "FULL_TEXT");
  assert.ok(evFull.statisticalEvidence.includes("MUSHRA"), "Full text must contain deep statistical evidence");

  assert.equal(evAbs.accessLevel, "ABSTRACT");
  assert.ok(evAbs.limitations.includes("Abstract lacks full control-group breakdown"), "Abstract must note limitations");

  assert.equal(evMeta.accessLevel, "METADATA");
  assert.ok(evMeta.results.includes("unavailable without text access"), "Metadata-only must flag missing results");

  console.log(`   ✅ 400M+ catalog scale documented: 510M works cataloged, 50M open full text.`);
  console.log(`   ✅ 3 access tiers (METADATA, ABSTRACT, FULL_TEXT) enforced with strict extraction fidelity.`);
}

// -----------------------------------------------------------------------------
// Check 4: Mechanism 3 — 11-Field Structured Evidence Schema & Graph
// -----------------------------------------------------------------------------
console.log("\n🕸️ [Mechanism 3] Validating 11-Field Evidence Schema & Contradiction Mapping...");
{
  const recSupport = kernel.CANONICAL_SCHOLARLY_RECORDS.find((r) => r.recordId === "rec_audio_01");
  const recContra = kernel.CANONICAL_SCHOLARLY_RECORDS.find((r) => r.recordId === "rec_audio_02");

  const evSupport = kernel.extractStructuredEvidence(recSupport);
  const evContra = kernel.extractStructuredEvidence(recContra);

  assert.equal(evSupport.scientificRelationship, "SUPPORT");
  assert.equal(evContra.scientificRelationship, "CONTRADICTION");

  // 11 fields presence check
  const required11Fields = [
    "researchQuestion", "hypothesis", "method", "populationOrMaterial",
    "interventionOrMechanism", "results", "statisticalEvidence",
    "limitations", "reproducibility", "provenance", "scientificRelationship"
  ];
  for (const f of required11Fields) {
    assert.ok(f in evSupport, `Missing field ${f} in StructuredEvidence`);
  }

  // Graph synthesis
  const graph = kernel.buildEvidenceGraph([evSupport, evContra]);
  assert.equal(Object.keys(graph.nodes).length, 2);
  assert.equal(graph.contradictionEdges.length, 1, "Must detect contradiction between gain and phase distortion");
  assert.ok(graph.unresolvedUncertainties.length >= 1, "Must record unresolved decision-relevant uncertainty");

  console.log(`   ✅ 11 fields extracted across all evidence nodes.`);
  console.log(`   ✅ Contradiction detected: ${graph.contradictionEdges[0].note.slice(0, 75)}...`);
}

// -----------------------------------------------------------------------------
// Check 5: Mechanism 4 — Counterfactual VOI Optimization in Exact NanoUSD
// -----------------------------------------------------------------------------
console.log("\n🧮 [Mechanism 4] Validating Counterfactual VOI U(e) & Exact NanoUSD Math...");
{
  assert.equal(kernel.NANOS_PER_USD, 1_000_000_000, "NanoUSD definition mismatch ($1 = 10^9 nanos)");

  // Test formula: U(e) = E[Delta R] / (C(e) + lambda * T(e))
  // Exp A: Delta R = 0.8, Cost = $0.50 (500,000,000 nanos), Time = 2s, lambda = 10,000,000 nanos/s
  // Denom = 500M + 20M = 520M nanos.
  // VOI = (0.8 * 1e9) / 520e6 = 1.53846
  const voiA = kernel.calculateVoiScore(0.8, 500_000_000, 2.0, 10_000_000.0);
  assert.ok(Math.abs(voiA - 1.53846) < 0.001, `VOI calculation error: expected ~1.538, got ${voiA}`);

  // Test competing theories formulation: Theories A, B, C
  const mission = kernel.compileResearchMission("Invent an efficient neural audio codec");
  const graph = kernel.buildEvidenceGraph([
    kernel.extractStructuredEvidence(kernel.CANONICAL_SCHOLARLY_RECORDS[0]),
    kernel.extractStructuredEvidence(kernel.CANONICAL_SCHOLARLY_RECORDS[1]),
  ]);
  const theories = kernel.compileCompetingTheories(mission, graph);

  assert.equal(theories.length, 3, "Must formulate exactly 3 competing theories (Theories A, B, C)");
  const totalPrior = theories.reduce((acc, t) => acc + t.priorProbability, 0);
  assert.ok(Math.abs(totalPrior - 1.0) < 0.001, "Theory prior probabilities must sum to 1.0");

  // Minimal discriminating set under budget constraint
  const experiments = kernel.generateCandidateExperiments(theories, mission);
  assert.ok(experiments.length >= 2, "Must generate at least 2 candidate experiments");

  const budget = 1_500_000_000; // $1.50 USD
  const minimalSet = kernel.selectMinimalDiscriminatingSet(experiments, budget, 0.75);
  const totalCost = minimalSet.reduce((acc, e) => acc + e.expectedCostNanos, 0);

  assert.ok(totalCost <= budget, "Selected experiments must not exceed budget constraint");
  assert.ok(minimalSet.length >= 1, "Must select at least 1 experiment in minimal set");

  // Zero/negative budget boundary checks
  assert.equal(kernel.selectMinimalDiscriminatingSet(experiments, 0).length, 0);
  assert.equal(kernel.selectMinimalDiscriminatingSet(experiments, -100).length, 0);

  // Clamped VOI checks
  assert.equal(kernel.calculateVoiScore(-0.5, 500_000_000, 2.0), 0);
  assert.ok(kernel.calculateVoiScore(1.0, 0, 0.0, 0.0) > 0);

  console.log(`   ✅ Exact VOI formula verified: U(e) = ${voiA.toFixed(4)} points/$.`);
  console.log(`   ✅ 3 Competing Theories compiled (Priors: ${theories.map(t => (t.priorProbability * 100).toFixed(0) + '%').join(', ')}).`);
  console.log(`   ✅ Minimal Discriminating Set selected: ${minimalSet.length} exps costing $${(totalCost / 1e9).toFixed(2)} USD.`);
}

// -----------------------------------------------------------------------------
// Check 6: Mechanism 5 — Research Verification Certificates & Truth Conservation
// -----------------------------------------------------------------------------
console.log("\n🛡️ [Mechanism 5] Validating Research Verification Certificates & Truth Conservation...");
{
  const recFull = kernel.CANONICAL_SCHOLARLY_RECORDS.find((r) => r.recordId === "rec_audio_01");
  const evFull = kernel.extractStructuredEvidence(recFull);

  // 1. Legitimate supported certificate with authentic reproduction
  const certSupported = kernel.issueVerificationCertificate(
    "RVQ achieves 44.8mW on ARM Cortex-A55",
    recFull,
    evFull,
    "REPRODUCED",
  );
  assert.equal(certSupported.qualification, "SUPPORTED_WITHIN_TESTED_SCOPE");
  assert.equal(kernel.verifyCertificateIntegrity(certSupported), true, "Valid certificate must verify");

  // Tampering check: altering claim invalidates SHA-256 seal
  const tampered = { ...certSupported, claim: "Altered proposition without resigning" };
  assert.equal(kernel.verifyCertificateIntegrity(tampered), false, "Tampered certificate must fail verification");

  // 2. Truth conservation: retracted paper must be CONTRADICTED
  const recRetracted = kernel.CANONICAL_SCHOLARLY_RECORDS.find((r) => r.isRetracted);
  const evRetracted = kernel.extractStructuredEvidence(recRetracted);
  const certRetracted = kernel.issueVerificationCertificate(
    "Lossless zero-latency compression claim",
    recRetracted,
    evRetracted,
  );
  assert.equal(certRetracted.qualification, "CONTRADICTED", "Retracted paper must be CONTRADICTED");

  // 3. Truth conservation: metadata-only paper must be NOT_VERIFIED
  const recMeta = kernel.CANONICAL_SCHOLARLY_RECORDS.find((r) => r.accessLevel === "METADATA");
  const evMeta = kernel.extractStructuredEvidence(recMeta);
  const certMeta = kernel.issueVerificationCertificate("Preprint claim", recMeta, evMeta);
  assert.equal(certMeta.qualification, "NOT_VERIFIED", "Metadata record must be NOT_VERIFIED");

  // 4. Anti-Self-Promotion Invariant: cannot promote NOT_VERIFIED via self-assessment without proof
  const promotedAttempt = kernel.preventSelfAssessmentPromotion(
    certMeta,
    "SUPPORTED_WITHIN_TESTED_SCOPE",
    false, // No external reproduction artifact!
  );
  assert.equal(promotedAttempt.qualification, "NOT_VERIFIED", "Self-promotion without reproduction artifact must be blocked!");

  // 5. Authentic external reproduction artifact promotes and reseals
  const authenticPromotion = kernel.preventSelfAssessmentPromotion(
    certMeta,
    "SUPPORTED_WITHIN_TESTED_SCOPE",
    true, // Authentic external reproduction witness provided!
  );
  assert.equal(authenticPromotion.qualification, "SUPPORTED_WITHIN_TESTED_SCOPE");
  assert.equal(authenticPromotion.reproductionState, "REPRODUCED");
  assert.equal(kernel.verifyCertificateIntegrity(authenticPromotion), true, "Resealed promoted certificate must be valid");

  // 6. Retracted claim cannot be promoted even with alleged artifact
  const blockedRetractedPromotion = kernel.preventSelfAssessmentPromotion(
    certRetracted,
    "SUPPORTED_WITHIN_TESTED_SCOPE",
    true,
  );
  assert.equal(blockedRetractedPromotion.qualification, "CONTRADICTED");

  console.log(`   ✅ SHA-256 Cryptographic Seal verified: ${certSupported.sha256Seal}`);
  console.log(`   ✅ Law of Truth Conservation: Retraction -> CONTRADICTED, Metadata -> NOT_VERIFIED.`);
  console.log(`   ✅ Anti-Self-Promotion Invariant strictly enforced: Unverified cannot become SUPPORTED via self-assessment.`);
  console.log(`   ✅ Authentic external witness promotion and cryptographic resealing verified.`);
}

// -----------------------------------------------------------------------------
// Check 7: Mechanism 6 — Compounding Capability Lifecycle & Invalidation
// -----------------------------------------------------------------------------
console.log("\n🔄 [Mechanism 6] Validating Compounding Capability Lifecycle & Assumption Invalidation...");
{
  const registry = new kernel.CompoundingCapabilityRegistry();
  assert.ok(registry.getAllProcedures().length >= 2, "Canonical registry must seed at least 2 procedures");

  const proc = registry.registerProcedure(
    "AUDIO_ENGINEERING",
    "Neural Audio ViSQOL Benchmark Harness",
    ["ALSA audio buffer <= 5ms", "Sample rate == 48000Hz"],
    4,
    true,
    true,
    45.5,
  );
  assert.equal(proc.isValid, true);
  assert.equal(proc.qualificationVerdict, "QUALIFIED_REUSABLE_CAPABILITY");
  assert.equal(proc.costSavingsPct, 45.5);
  const initialSeal = proc.sha256Seal;
  assert.equal(kernel.verifyProcedureSeal(proc), true, "Procedure seal must verify initially");

  // Invalidate assumption
  const invResult = registry.invalidateAssumption(proc.procedureId, "ALSA audio buffer");
  assert.equal(invResult.ok, true);
  assert.equal(proc.isValid, false);
  assert.equal(proc.qualificationVerdict, "INVALIDATED_REQUIRES_REQUALIFICATION");
  assert.notEqual(proc.sha256Seal, initialSeal, "Seal must update on invalidation");
  assert.equal(kernel.verifyProcedureSeal(proc), true, "Updated invalidation seal must verify");

  // Tampering check
  const tamperedProc = { ...proc, qualificationVerdict: "QUALIFIED_REUSABLE_CAPABILITY" };
  assert.equal(kernel.verifyProcedureSeal(tamperedProc), false, "Tampered procedure must fail verification");

  // Requalify procedure
  const reqResult = registry.requalifyProcedure(proc.procedureId, true, true);
  assert.equal(reqResult.ok, true);
  assert.equal(proc.isValid, true);
  assert.equal(proc.qualificationVerdict, "QUALIFIED_REUSABLE_CAPABILITY");
  assert.equal(kernel.verifyProcedureSeal(proc), true, "Requalified seal must verify");

  console.log(`   ✅ Compounding Procedure registered with 45.5% verified cost savings.`);
  console.log(`   ✅ Assumption invalidation tested: buffer failure -> INVALIDATED.`);
  console.log(`   ✅ Procedure cryptographic seal verified across lifecycle state transitions.`);
  console.log(`   ✅ LVT requalification tested: transfer pass -> QUALIFIED.`);
}

// -----------------------------------------------------------------------------
// Check 8: Mechanism 7 — Persistent 100,000-Word Deep Research Job Coordinator
// -----------------------------------------------------------------------------
console.log("\n📖 [Mechanism 7] Validating Persistent 100,000-Word Deep Research Job Coordinator...");
{
  const mission = kernel.compileResearchMission("Ultra-Low Bitrate Neural Audio Monograph");
  const job = kernel.createDeepResearchJob(mission, undefined, 100_000);

  assert.equal(job.targetTotalWords, 100_000);
  assert.equal(job.sections.length, 8, "Expected canonical 8 chapters");
  assert.equal(job.sections.reduce((a, s) => a + s.targetWordCount, 0), 100_000, "Chapters must sum to 100k");

  // Checkpoint chapter 1
  const ch1Result = kernel.checkpointSection(
    job,
    1,
    "Chapter 1 introduces mathematical foundations for multi-scale residual vector quantization under mobile latency constraints.",
    { "MOS": "Mean Opinion Score", "RVQ": "Residual Vector Quantization" },
    ["10.1109/TASLP.2024.330192"],
  );
  assert.equal(ch1Result.ok, true);
  assert.equal(job.sections[0].isCheckpointed, true);
  assert.ok(job.globalReferenceRegistry.includes("10.1109/TASLP.2024.330192"));

  // Check symbol conflict guard
  const conflictResult = kernel.checkpointSection(
    job,
    2,
    "Chapter 2 conflicting text",
    { "MOS": "Conflicting definition: Metal Oxide Semiconductor" },
  );
  assert.equal(conflictResult.ok, false, "Symbol conflict must be caught");
  // Crucial invariant: Section 2 must remain untouched
  assert.equal(job.sections[1].isCheckpointed, false);
  assert.equal(job.sections[1].content, "");
  assert.equal(job.sections[1].generatedWordCount, 0);

  console.log(`   ✅ Persistent 100k-word job initialized: 8 chapters, 100,000 target words.`);
  console.log(`   ✅ Symbol registry conflict guard and DOI reference registry verified.`);
}

// -----------------------------------------------------------------------------
// Check 9: Mechanism 8 — Web Studio UI & FeaturesHub Integration
// -----------------------------------------------------------------------------
console.log("\n🎨 [Mechanism 8] Validating Universal Web Studio UI & FeaturesHub Integration...");
{
  const featuresHubPath = join(root, "src/engine/FeaturesHub.tsx");
  const featuresHubContent = readFileSync(featuresHubPath, "utf-8");

  assert.ok(
    featuresHubContent.includes("SpeRgdUniversalStudio"),
    "FeaturesHub must import SpeRgdUniversalStudio",
  );
  assert.ok(
    featuresHubContent.includes("spe-rgd-universal"),
    "FeaturesHub FEATURES list must register spe-rgd-universal",
  );
  assert.ok(
    featuresHubContent.includes("<SpeRgdUniversalStudio"),
    "FeaturesHub must render SpeRgdUniversalStudio modal",
  );

  const studioPath = join(root, "src/engine/SpeRgdUniversalStudio.tsx");
  const studioContent = readFileSync(studioPath, "utf-8");

  assert.ok(studioContent.includes("RGD Studio Views"), "Studio must include accessible tablist");
  assert.ok(studioContent.includes("400M+ Scholarly Explorer"), "Studio must include 400M+ explorer");
  assert.ok(studioContent.includes("Counterfactual VOI"), "Studio must include counterfactual VOI planner");
  assert.ok(studioContent.includes("Research Verification Certificates"), "Studio must include RVC certificates");

  console.log(`   ✅ FeaturesHub correctly wired to spe-rgd-universal.`);
  console.log(`   ✅ SpeRgdUniversalStudio.tsx passes all component inspections.`);
}

console.log("\n================================================================================");
console.log("🌟 ALL SPE Ω PRO (RGD-1) VERIFICATION CHECKS PASSED WITH 100% SUCCESS!");
console.log("================================================================================\n");
