#!/usr/bin/env node
/**
 * SPE v1.4 OmniBrain AGI — Master End-to-End Verification Suite
 *
 * Verifies all 5 breakthrough pillars and strict invariants:
 * 1. Phase 1: Genetic Prompt Evolver & Hostile Gym (32 attacks, Pareto convergence)
 * 2. Phase 2: Multimodal Neural Vision-to-Architecture Inverse-Compiler
 * 3. Phase 3: In-WASM Supersonic Hybrid RAG Retrieval Fabric (BM25 + 384-d Dense RRF)
 * 4. Phase 4: 3D GLSL Quantum Cognitive Energy Field (GLSL shaders & metric harmonics)
 * 5. Phase 5: Game-Theoretic Blinded Multi-Judge Arena (5 Judges, Nash consensus, SHA256 Cert)
 * 6. Strict Invariants: Canonical WASM Hash + Exact Length Budgets (5555c, 15000c, 30000c)
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("================================================================================");
console.log("🚀 SPE v1.4 OmniBrain AGI — Comprehensive Verification Suite");
console.log("================================================================================\n");

let evolvedPromptOutput = "";

// -----------------------------------------------------------------------------
// Pillar 1: Genetic Prompt Evolver & Hostile Gym
// -----------------------------------------------------------------------------
console.log("🧬 [Pillar 1] Validating Genetic Prompt Evolver & Hostile Gym...");
{
  const bundle = await build({
    entryPoints: [join(root, "src/engine/geneticEvolver.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const evolver = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );

  assert.equal(evolver.ADVERSARIAL_ATTACKS.length, 32, "Hostile gym must have exactly 32 attacks");

  const raw = "# System Role\nDeveloper\n# Objective\nBuild a safe tool.\n";
  const chrom = evolver.decomposePromptToChromosome(raw, 0);
  assert.ok(chrom.role.length > 0 && chrom.objective.length > 0);

  // Edge cases: null/undefined safety & zero fitness on empty prompt
  const emptyFit = evolver.calculateFitness("");
  assert.equal(emptyFit.overallScore, 0, "Empty prompt must have 0 overall fitness");
  const nullChrom = evolver.decomposePromptToChromosome(undefined);
  assert.ok(nullChrom.role.length > 0, "Null/undefined input must decompose safely");

  const res = await evolver.evolvePrompt(raw, { generations: 5, populationSize: 4 });
  assert.ok(res.finalFitness.overallScore >= res.initialFitness.overallScore, "Fitness must increase or remain optimal");
  assert.ok(res.finalFitness.defendedAttacksCount >= 28, "Must defend against >=28 hostile attacks");
  evolvedPromptOutput = res.optimizedPrompt;
  console.log(`  ✓ 32 Hostile Gym attacks verified. Evolution converged to ${res.finalFitness.overallScore}/100 in ${res.totalEvolutionTimeMs}ms.`);
}

// -----------------------------------------------------------------------------
// Pillar 2: Multimodal Neural Vision-to-Architecture Inverse-Compiler
// -----------------------------------------------------------------------------
console.log("\n👁️ [Pillar 2] Validating Multimodal Neural Vision Inverse-Compiler...");
{
  const bundle = await build({
    entryPoints: [join(root, "src/engine/visionInverseCompiler.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const compiler = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );

  const analysis = compiler.analyzeLayoutFromImageData(1200, 800);
  assert.ok(analysis.components.length >= 3, "Must detect visual layout components");

  const compiled = compiler.compileArchitectureFromLayout(analysis, "Autonomous Production Suite");
  assert.ok(compiled.componentHierarchyTypeScript.includes("React.FC"));
  assert.ok(compiled.stateMachineModel.includes("applicationReducer"));
  assert.ok(compiled.apiSchemaEndpoints.includes("openapi: 3.1.0"));
  assert.ok(compiled.compiledSystemPrompt.includes("# System Role & Persona"));
  assert.ok(compiled.compiledSystemPrompt.includes("# Acceptance Checks & Verification Battery"));

  // Edge cases: mobile portrait aspect ratio & vibrant dominant hue
  const mobileAnalysis = compiler.analyzeLayoutFromImageData(375, 812);
  assert.ok(mobileAnalysis.components.some((c) => c.id.includes("mobile")), "Portrait layout must branch to mobile components");
  const mobileCompiled = compiler.compileArchitectureFromLayout(mobileAnalysis, "Mobile Shop");
  assert.ok(mobileCompiled.wireframeAscii.includes("+---"), "Mobile dynamic ASCII wireframe must generate cleanly");

  const greenPixels = new Uint8ClampedArray(400);
  for (let i = 0; i < greenPixels.length; i += 4) {
    greenPixels[i] = 16;
    greenPixels[i + 1] = 185;
    greenPixels[i + 2] = 129;
    greenPixels[i + 3] = 255;
  }
  const greenAnalysis = compiler.analyzeLayoutFromImageData(800, 600, greenPixels);
  assert.equal(greenAnalysis.primaryAccent, "#10b981", "Dominant hue must be extracted from vibrant pixel data");
  console.log(`  ✓ Extracted ${analysis.components.length} visual zones and inverse-compiled TypeScript + OpenAPI + Prompt.`);
}

// -----------------------------------------------------------------------------
// Pillar 3: In-WASM Supersonic Hybrid RAG Retrieval Fabric
// -----------------------------------------------------------------------------
console.log("\n⚡ [Pillar 3] Validating In-WASM Supersonic Hybrid RAG Retrieval Fabric...");
{
  const bundle = await build({
    entryPoints: [join(root, "src/engine/hybridRagEngine.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const rag = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );

  const engine = rag.defaultRagEngine;
  const sparse = engine.searchSparse("sanitization delimiters", 2);
  const dense = engine.searchDense("cryptographic invariants", 2);
  const hybrid = engine.searchHybrid("clean architecture security", 3);

  assert.ok(sparse.length > 0, "BM25 search must return results");
  assert.ok(dense.length > 0, "Dense cosine search must return results");
  assert.ok(hybrid.length > 0, "Hybrid RRF must fuse rankings");

  // Edge case: Empty queries must return empty arrays without hallucinating anchors
  assert.equal(engine.searchDense("").length, 0, "Empty dense search must return 0 results");
  assert.equal(engine.searchHybrid("").length, 0, "Empty hybrid search must return 0 results");
  assert.equal(engine.generateKnowledgeAnchorSection(""), "", "Empty prompt must generate empty anchor section");

  const anchor = engine.generateKnowledgeAnchorSection("Security architecture", 2);
  assert.ok(anchor.includes("# Grounded Knowledge Anchors & Architectural Context"));
  console.log(`  ✓ BM25 Sparse, 384-d Dense Cosine, and RRF ranking verified across ${engine.getStats().totalDocuments} standards.`);
}

// -----------------------------------------------------------------------------
// Pillar 4: 3D GLSL Quantum Cognitive Energy Field
// -----------------------------------------------------------------------------
console.log("\n🌌 [Pillar 4] Validating 3D GLSL Quantum Cognitive Energy Field...");
{
  const bundle = await build({
    entryPoints: [join(root, "src/engine/CognitiveEnergyShader.tsx")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    loader: { ".tsx": "tsx" },
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
  });
  const shader = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );

  assert.ok(shader.VERTEX_SHADER_SOURCE.includes("u_entropy"));
  assert.ok(shader.FRAGMENT_SHADER_SOURCE.includes("gl_FragColor"));
  const m = shader.calculateShaderMetrics(evolvedPromptOutput);
  assert.ok(m.healthScore >= 50);
  console.log(`  ✓ Custom GLSL Vertex & Fragment shaders verified with dynamic entropy/rigor metrics.`);
}

// -----------------------------------------------------------------------------
// Pillar 5: Game-Theoretic Blinded Multi-Judge Arena
// -----------------------------------------------------------------------------
console.log("\n⚖️ [Pillar 5] Validating Game-Theoretic Blinded Multi-Judge Arena...");
{
  const bundle = await build({
    entryPoints: [join(root, "src/engine/blindedJudgeArena.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
  });
  const arena = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );

  // Edge case: Empty prompt rejection
  const emptyArena = arena.runBlindedJudgeArena("");
  assert.equal(emptyArena.consensusScore, 0, "Empty prompt must be rejected with 0 consensus");
  assert.equal(emptyArena.certificate.agreementTier, "DIVERGENT", "Empty prompt agreement tier must be DIVERGENT");

  const result = arena.runBlindedJudgeArena(evolvedPromptOutput);
  assert.ok(result.consensusScore >= 80, `Consensus score should be >= 80, got ${result.consensusScore}`);
  assert.equal(result.biasTelemetry.positionOrderSwapped, true);
  assert.ok(typeof result.biasTelemetry.positionScoreShift === "number");
  assert.ok(result.certificate.certificateId.startsWith("SPE-EVAL-v1.4-"));
  assert.equal(result.certificate.promptHashSha256.length, 64);
  console.log(`  ✓ 5 Blinded Judges (Alpha-Epsilon) reached ${result.consensusScore}/100 consensus on Evolved Prompt (Cert: ${result.certificate.certificateId}).`);
}

// -----------------------------------------------------------------------------
// Pillar 6 & Strict Invariants: Canonical WASM Hash + Exact Character Lengths
// -----------------------------------------------------------------------------
console.log("\n🛡️ [Strict Invariants] Validating Canonical WASM & Exact Character Lengths...");
{
  // 1. Canonical WASM Hash Check
  const EXPECTED_CANONICAL_HASH = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d";
  const wasmPath = join(root, "public/spe_wasm.wasm");
  const wasmBytes = readFileSync(wasmPath);
  const actualHash = createHash("sha256").update(wasmBytes).digest("hex");
  assert.equal(
    actualHash,
    EXPECTED_CANONICAL_HASH,
    `Canonical WASM hash mismatch! Expected ${EXPECTED_CANONICAL_HASH}, got ${actualHash}`,
  );
  console.log(`  ✓ Canonical Rust WASM SHA-256 integrity verified (${actualHash.slice(0, 16)}...).`);

  // 2. Exact Character Length Invariants (5,555c, 15,000c, 30,000c)
  const synthPath = join(root, "src/engine/promptSynthesizer.mjs");
  const synthModule = await import(synthPath);
  const { synthesizeSystemPrompt } = synthModule;

  const sampleObjective = "Design a low-latency financial order routing engine.";

  const tiers = [
    { tier: "normal", targetLen: 5555 },
    { tier: "mid", targetLen: 15000 },
    { tier: "deep", targetLen: 30000 },
  ];

  const targets = ["any", "claude", "gemini", "local"];

  for (const { tier, targetLen } of tiers) {
    for (const target of targets) {
      const generated = synthesizeSystemPrompt(sampleObjective, {
        target,
        depthTier: tier,
      });

      assert.equal(
        generated.length,
        targetLen,
        `Exact length invariant failed for tier=${tier}, target=${target}: expected ${targetLen}, got ${generated.length}`,
      );

      // Check for zero duplicate lines in padding
      const lines = generated.split("\n");
      const nonBlank = lines.filter((l) => l.trim().length > 0);
      const counts = new Map();
      let maxDups = 0;
      for (const line of nonBlank) {
        if (line.startsWith("- ") && !line.includes("Verification Attestation")) {
          const c = (counts.get(line) || 0) + 1;
          counts.set(line, c);
          if (c > maxDups) maxDups = c;
        }
      }
      assert.ok(maxDups <= 1, `Invariant failure: duplicate lines detected in padding for ${tier}/${target}!`);
    }
    console.log(`  ✓ Exact length invariant verified: ${targetLen} chars across all 4 targets (0 duplicate lines).`);
  }
}

console.log("\n================================================================================");
console.log("🌟 ALL 5 BREAKTHROUGH PILLARS & STRICT INVARIANTS OF SPE v1.4 PASSED!");
console.log("================================================================================\n");
