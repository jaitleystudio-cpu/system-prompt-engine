#!/usr/bin/env node
/**
 * SPE Ω — Nightly Intelligence Upgrade & Controlled Qualification CLI Runner
 *
 * Runs the nightly benchmark suite, tests candidate generative intelligence against
 * frozen multi-domain holdouts, verifies 100% checkable constraint preservation,
 * and saves a cryptographic qualification artifact.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const { runNightlyIntelligenceUpgrade, FROZEN_NIGHTLY_BENCHMARK_SUITE } = await import(
  join(root, "apps/web/src/engine/nightlyIntelligenceUpgrade.ts")
);

console.log("========================================================================");
console.log("🧠 SPE Ω — NIGHTLY INTELLIGENCE UPGRADE & QUALIFICATION HARNESS");
console.log("========================================================================");
console.log(`Evaluating ${FROZEN_NIGHTLY_BENCHMARK_SUITE.length} frozen multi-domain benchmark holdouts...`);
console.log("");

const report = await runNightlyIntelligenceUpgrade();

for (const cr of report.caseResults) {
  const icon = cr.passed ? "✓" : "✗";
  console.log(`  ${icon} [${cr.caseId}] ${cr.name}`);
  console.log(`     Status: ${cr.actualStatus} (Expected: ${cr.expectedStatus}) | Latency: ${cr.latencyMs}ms`);
  if (!cr.passed) {
    console.log(`     Failure Reason: ${cr.failureReason}`);
  }
}

console.log("");
console.log("------------------------------------------------------------------------");
console.log(`Qualification Status:               ${report.qualificationStatus}`);
console.log(`Total Cases:                        ${report.totalCases}`);
console.log(`Passed Cases:                       ${report.passedCases}`);
console.log(`Pass Rate:                          ${report.passRatePercent}%`);
console.log(`Checkable Requirement Preservation: ${report.requirementPreservationPercent}%`);
console.log(`Regressions Detected:               ${report.regressionsCount}`);
console.log(`Average Execution Latency:          ${report.averageLatencyMs}ms`);
console.log(`Zero Cloud Egress Audit:            ${report.zeroEgressAuditPassed ? "PASSED (100% air-gap)" : "FAILED"}`);
console.log(`Cloud Compute Cost:                 $${report.costUsd}.00 (Local zero-cost)`);
console.log(`Release Candidate Digest:           ${report.releaseCandidateDigest}`);
console.log("========================================================================");

// Save qualification report
const outDir = join(root, "proofs/generated");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "NIGHTLY_INTELLIGENCE_UPGRADE_REPORT.json");
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(`Qualification artifact written to: ${outPath}`);

if (report.qualificationStatus !== "QUALIFIED_FOR_PROMOTION") {
  console.error("❌ Nightly upgrade failed qualification! Regressions detected.");
  process.exit(1);
}

console.log("🎉 SPE Ω Nightly Intelligence Upgrade Qualified for Staged Promotion!");
process.exit(0);
