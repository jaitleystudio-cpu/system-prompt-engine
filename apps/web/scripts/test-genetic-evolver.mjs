#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("🧬 [Test Phase 1] Building and evaluating Neuro-Genetic Prompt Evolver & Hostile Gym...");

// Build bundle for geneticEvolver.ts
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

// 1. Verify 32 Hostile Adversary Gym attacks
assert.equal(
  evolver.ADVERSARIAL_ATTACKS.length,
  32,
  `Hostile gym must define exactly 32 attacks, found ${evolver.ADVERSARIAL_ATTACKS.length}`,
);

const categories = new Set(evolver.ADVERSARIAL_ATTACKS.map((a) => a.category));
assert.ok(categories.has("jailbreak"), "Must cover jailbreak attacks");
assert.ok(categories.has("injection"), "Must cover injection attacks");
assert.ok(categories.has("sycophancy"), "Must cover sycophancy attacks");
assert.ok(categories.has("boundary_drift"), "Must cover boundary_drift attacks");
assert.ok(categories.has("role_hijack"), "Must cover role_hijack attacks");
assert.ok(categories.has("leakage"), "Must cover leakage attacks");
assert.ok(categories.has("budget_overflow"), "Must cover budget_overflow attacks");
console.log(`✓ 32 Hostile Adversary Gym attacks verified across ${categories.size} threat categories.`);

// 2. Test Chromosome Decomposition & Reconstruction
const testRawPrompt = `
# System Role
You are a specialized distributed systems architect.

# Objective
Design a fault-tolerant message queue.

# Operational & Security Invariants
- Zero external dependencies.
- Constant-time verification.
`;

const chrom = evolver.decomposePromptToChromosome(testRawPrompt, 0);
assert.ok(chrom.role.includes("distributed systems architect"), "Decomposed role correctly");
assert.ok(chrom.objective.includes("fault-tolerant message queue"), "Decomposed objective correctly");
assert.ok(chrom.invariants.length >= 2, "Decomposed invariants correctly");

const reconstructed = evolver.reconstructPromptFromChromosome(chrom);
assert.ok(reconstructed.includes("# System Role & Persona"), "Reconstructed contains Role header");
assert.ok(reconstructed.includes("# Objective & Boundary Scope"), "Reconstructed contains Objective header");
assert.ok(reconstructed.includes("distributed systems architect"), "Reconstructed contains content");
console.log("✓ Chromosome decomposition and reconstruction verified.");

// 3. Test Baseline Fitness Calculation
const baselineFitness = evolver.calculateFitness(testRawPrompt);
console.log(`Baseline Prompt Fitness: ${baselineFitness.overallScore}/100 (Defended ${baselineFitness.defendedAttacksCount}/${baselineFitness.totalAttacksCount} attacks)`);
assert.ok(baselineFitness.overallScore >= 0 && baselineFitness.overallScore <= 100, "Fitness in valid range");

// 4. Run Multi-Generation Evolution (10 Generations)
const start = Date.now();
let progressUpdates = 0;
const evolutionResult = await evolver.evolvePrompt(
  testRawPrompt,
  {
    generations: 10,
    populationSize: 6,
  },
  ({ currentGen, totalGen, bestFitness }) => {
    progressUpdates++;
    process.stdout.write(`  Gen ${currentGen}/${totalGen} -> Best Fitness: ${bestFitness}/100\r`);
  },
);
const elapsedMs = Date.now() - start;
console.log(`\n✓ Multi-generation evolution completed in ${elapsedMs}ms (${evolutionResult.generations.length} generations).`);

// 5. Verify Fitness Improvement & Convergence
console.log(`Initial Fitness: ${evolutionResult.initialFitness.overallScore} -> Final Evolved Fitness: ${evolutionResult.finalFitness.overallScore}`);
assert.ok(
  evolutionResult.finalFitness.overallScore >= evolutionResult.initialFitness.overallScore,
  "Evolved prompt fitness must be greater than or equal to initial fitness",
);
assert.ok(
  evolutionResult.finalFitness.overallScore >= 85,
  `Evolved prompt fitness should achieve high rigor score (>=85), got ${evolutionResult.finalFitness.overallScore}`,
);
assert.ok(
  evolutionResult.finalFitness.defendedAttacksCount >= 28,
  `Evolved prompt must defend against >= 28 attacks, defended ${evolutionResult.finalFitness.defendedAttacksCount}`,
);
assert.ok(
  evolutionResult.optimizedPrompt.length > 0,
  "Optimized prompt must not be empty",
);
assert.ok(
  elapsedMs < 3000,
  `Evolution must complete well under budget, took ${elapsedMs}ms`,
);

console.log(`✓ Evolved prompt defended ${evolutionResult.finalFitness.defendedAttacksCount}/${evolutionResult.finalFitness.totalAttacksCount} hostile attacks.`);
console.log("✅ Phase 1: Genetic Prompt Evolver & Hostile Gym PASSED!");
