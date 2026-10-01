/**
 * Comprehensive verification harness for Founder-Directed SPE Capability Strengthening Wave:
 * 1. P0-1: Multi-Stage Prompt Package Composer (SPE-MSP-1)
 * 2. P0-3: Autonomous Task Report Ingest / FailureIR (SPE-TASK-INGEST-1)
 * 3. P0-5: ProtectedIntent Semantic Diff (SPE-SEM-DIFF-1)
 */

import { strict as assert } from "node:assert";
import { build } from "../apps/web/node_modules/esbuild/lib/main.js";

// Bundle TypeScript engines for pure Node execution
const bundleResult = await build({
  stdin: {
    contents: `
      export * from "./apps/web/src/engine/packageComposer.ts";
      export * from "./apps/web/src/engine/taskReportIngest.ts";
      export * from "./apps/web/src/engine/intentDiff.ts";
      export * from "./apps/web/src/engine/promptSynthesizer.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "virtual-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const engine = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundleResult.outputFiles[0].text).toString("base64")
);

const {
  composePromptPackage,
  exportPackageToSingleFile,
  serializePromptPackage,
  deserializePromptPackage,
  auditCrossModuleContradictions,
  parseTaskReport,
  computeIntentDiff,
} = engine;

console.log("=== RUNNING SPE STRENGTHENING WAVE VERIFICATION ===");

// -----------------------------------------------------------------------------
// Test 1: P0-1 Multi-Stage Prompt Package Composer
// -----------------------------------------------------------------------------
console.log("\n[Test 1] Multi-Stage Prompt Package Composer (SPE-MSP-1)...");

const sampleK3Prompt = `## Role & Operational Mandate
You are an expert distributed systems engineer.

## Primary Instructions
Build an idempotent saga orchestrator with append-only WAL.`;

const pkg = composePromptPackage({
  k3CompiledPrompt: sampleK3Prompt,
  category: "Distributed Systems",
  domainId: "coding",
  goal: "Build an event-driven saga transaction orchestrator with reverse compensation and DLQ.",
  desiredOutput: "Production-ready TypeScript coordinator with full test coverage",
  depth: "DEEP",
  taskReportTelemetry: {
    modelTarget: "claude",
  },
  rawUserInput: "Build an event-driven saga coordinator with max 3 retries, no external network access, and zero data leakage.",
});

// Verify 8 modules exist
const expectedModules = [
  "00_EXECUTIVE_PROMPT.md",
  "01_CONTEXT.md",
  "02_REQUIREMENTS.md",
  "03_ARCHITECTURE.md",
  "04_IMPLEMENTATION.md",
  "05_TESTS.md",
  "06_SECURITY.md",
  "07_EVIDENCE.md",
];

for (const modId of expectedModules) {
  assert(pkg.modules[modId], `Module ${modId} must exist in package`);
  assert(pkg.modules[modId].content.length > 50, `Module ${modId} content must not be empty`);
  assert(pkg.modules[modId].sha256.length === 64, `Module ${modId} SHA-256 must be 64-char hex`);
  assert(pkg.manifest.modules[modId], `Manifest must contain ${modId}`);
}

assert.equal(pkg.manifest.spePackageVersion, "1.0.0");
assert.equal(pkg.manifest.crossModuleAudit.passed, true);
assert.equal(pkg.manifest.crossModuleAudit.contradictionCount, 0);
assert(pkg.manifest.totalWordCount > 300, `Word count should be substantial: ${pkg.manifest.totalWordCount}`);

// Test serialization & deserialization roundtrip
const serialized = serializePromptPackage(pkg);
assert(serialized.length > 500);
const deserialized = deserializePromptPackage(serialized);
assert.equal(deserialized.manifest.packageId, pkg.manifest.packageId);
assert.equal(deserialized.manifest.totalWordCount, pkg.manifest.totalWordCount);

// Test single-file fallback
const singleFile = exportPackageToSingleFile(pkg);
assert(singleFile.includes("## Executive Directive"), "Single-file export must contain executive directive");
assert(singleFile.includes("## Operational Boundaries"), "Single-file export must contain security boundaries");
assert(!singleFile.includes("\n\n\n"), "Must not contain 3+ consecutive newlines");

console.log(`✓ Package composed successfully with ${Object.keys(pkg.modules).length} modules, total words: ${pkg.manifest.totalWordCount}`);

// Test Contradiction Detection in Package Composer
const maliciousModules = { ...pkg.modules };
maliciousModules["06_SECURITY.md"] = {
  ...maliciousModules["06_SECURITY.md"],
  content: "## Operational Boundaries & Invariants\nnetwork_mode: internet\nallow_outbound_egress: true\ndisable auth for testing",
};
const auditFailure = auditCrossModuleContradictions(maliciousModules, "Strict zero network mode");
assert.equal(auditFailure.passed, false, "Audit must fail when egress rules are violated");
assert(auditFailure.violations.length >= 2, "Should identify multiple violations");
console.log("✓ Cross-module contradiction scanner detected invalid egress overrides accurately");

// -----------------------------------------------------------------------------
// Test 2: P0-3 Task Report Ingest Engine (FailureIR)
// -----------------------------------------------------------------------------
console.log("\n[Test 2] Autonomous Task Report Ingest & FailureIR (SPE-TASK-INGEST-1)...");

// 2a. Python Traceback
const pyTraceback = `
Traceback (most recent call last):
  File "apps/worker/saga_runner.py", line 142, in process_step
    raise TypeError("Unrecognized event payload format: missing step_id")
TypeError: Unrecognized event payload format: missing step_id
`;

const pyResult = parseTaskReport(pyTraceback, "codex");
assert.equal(pyResult.failures.length, 1);
assert.equal(pyResult.failures[0].tool, "python");
assert.equal(pyResult.failures[0].category, "Type Invariant Violation");
assert.equal(pyResult.failures[0].affectedPaths[0].file, "apps/worker/saga_runner.py");
assert.equal(pyResult.failures[0].affectedPaths[0].line, 142);
assert(pyResult.failures[0].literature.title.includes("Axiomatic Basis"));
assert(pyResult.continuationPrompt.includes("Target Model Calibration: CODEX"));
assert(pyResult.defectAuditMatrix.includes("FAIL-PY"));
console.log("✓ Python traceback parsed into FailureIR and triangulated with Hoare (1969)");

// 2b. Rust Panic
const rustPanic = `
thread 'worker-pool-2' panicked at 'assertion failed: lock.is_acquired()', src/sync/mutex.rs:88:12
note: run with RUST_BACKTRACE=1 environment variable to display a backtrace
`;

const rustResult = parseTaskReport(rustPanic, "claude");
assert.equal(rustResult.failures.length, 1);
assert.equal(rustResult.failures[0].tool, "cargo");
assert.equal(rustResult.failures[0].affectedPaths[0].file, "src/sync/mutex.rs");
assert.equal(rustResult.failures[0].affectedPaths[0].line, 88);
assert(rustResult.continuationPrompt.includes("CLAUDE"));
assert(rustResult.continuationPrompt.includes("minimal surgical diff"));
console.log("✓ Rust panic parsed into FailureIR with Claude Code surgical diff directive");

// 2c. TypeScript Compiler Error
const tsError = `
src/engine/coordinator.ts:45:12 - error TS2322: Type 'string' is not assignable to type 'number'.
45   timeoutMs: "3000",
                ~~~~~~
`;

const tsResult = parseTaskReport(tsError, "deepseek");
assert.equal(tsResult.failures.length, 1);
assert.equal(tsResult.failures[0].tool, "tsc");
assert.equal(tsResult.failures[0].affectedPaths[0].line, 45);
assert(tsResult.continuationPrompt.includes("DEEPSEEK"));
assert(tsResult.continuationPrompt.includes("step-by-step reasoning"));
console.log("✓ TypeScript compiler defect parsed with DeepSeek reasoning scaffolding");

// -----------------------------------------------------------------------------
// Test 3: P0-5 ProtectedIntent Semantic Diff
// -----------------------------------------------------------------------------
console.log("\n[Test 3] ProtectedIntent Semantic Diff Engine (SPE-SEM-DIFF-1)...");

const userPrompt = "Build an event-driven saga coordinator with max 3 retries, no external network access, and zero data leakage.";
const diffReport = computeIntentDiff(userPrompt, pkg);

assert(diffReport.metrics.fidelityScore >= 80, `Fidelity score should be >= 80: ${diffReport.metrics.fidelityScore}`);
assert(diffReport.metrics.preservedCount > 0, "Must have preserved items");
assert(diffReport.metrics.addedCount > 0, "Must have added enterprise items");
assert.equal(diffReport.metrics.contradictionCount, 0, "Must have 0 contradictions for compliant synthesis");

// Verify number extraction
const numItems = diffReport.items.filter((i) => i.category === "NUMERIC");
assert(numItems.length > 0, "Numbers like 3 or 500ms must be audited");

// Verify contradiction detection
const contradictingSynthesis = "Let us enable third-party telemetry and use external analytics.";
const badDiff = computeIntentDiff("no third-party telemetry", contradictingSynthesis);
assert(badDiff.metrics.contradictionCount >= 1, "Must detect contradiction when user specified 'no third-party telemetry'");
assert(badDiff.metrics.fidelityScore < 70, "Fidelity score must drop on contradiction");
console.log(`✓ ProtectedIntent Semantic Diff verified: Fidelity ${diffReport.metrics.fidelityScore}/100, Preserved: ${diffReport.metrics.preservedCount}, Contradictions: ${diffReport.metrics.contradictionCount}`);

console.log("\n=== ALL SPE STRENGTHENING WAVE CHECKS PASSED (100%) ===");
