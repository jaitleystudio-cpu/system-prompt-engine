/**
 * SPE Canonical Continuation Compiler & Target Model Export Engine (Wave RT-D)
 *
 * Compiles canonical ContinuationIR / ContinuationContract and adapts it
 * deterministically across target coding environments:
 * - Claude Code
 * - OpenAI Codex
 * - Cursor
 * - Grok
 * - Local Open-Weights (Qwen/DeepSeek)
 * - Generic Agent
 *
 * Enforces Epistemic Invariants:
 * - MANDATORY_OBLIGATION_PRESERVATION = 100%
 * - Adapter may adjust format/tools, but NEVER goals, constraints, tests, or authority.
 * - HOLD or FAIL must NEVER generate a continuation that assumes success.
 */

import { computeSha256 } from "../hashUtils";
import type {
  ReviewSubmission,
  ReviewedReport,
  ClaimEvidenceGraph,
  ContinuationContract,
} from "./types";

export type TargetExportModel =
  | "claude"
  | "codex"
  | "cursor"
  | "grok"
  | "local_coder"
  | "generic";

/**
 * Compiles a canonical ContinuationContract from verified review state.
 */
export function compileContinuationContract(
  submission: ReviewSubmission,
  review: ReviewedReport,
  graph?: ClaimEvidenceGraph
): ContinuationContract {
  const contractId = `CTR-${submission.taskId}-${computeSha256(submission.candidateSha).slice(0, 8)}`;
  const baselineSha = submission.candidateSha;
  const targetProfile = submission.targetAgent;

  // Determine mission and ordered steps based on verified review verdict
  let mission = `Continue implementation for: ${submission.originalTask}`;
  const orderedSteps: string[] = [];
  const testGates: string[] = [];
  const stopConditions: string[] = [
    "Stop immediately if any existing regression test fails (exit code != 0).",
    "Stop if unexpected schema changes or boundary type modifications are required.",
    "Stop and HOLD if external network egress is requested.",
  ];

  if (review.verdict === "FAIL") {
    mission = `Surgically repair failing invariants and defects in candidate ${baselineSha}`;
    orderedSteps.push(
      "1. Reproduce the observed failure locally using the designated test command.",
      "2. Apply minimal non-breaking surgical patch targeting the root cause only.",
      "3. Re-run test suite and verify that all assertions pass."
    );
    testGates.push("All previously failing assertions must evaluate to true with exit code 0.");
  } else if (review.verdict === "HOLD") {
    mission = `Provide verifiable proof and resolve open unknowns for candidate ${baselineSha}`;
    orderedSteps.push(
      "1. Run existing test suite under trusted executor and capture complete exit code and stdout/stderr locators.",
      "2. Gather missing empirical benchmarks or crash recovery proofs identified in review.",
      "3. Supply independent verification receipt without modifying production code."
    );
    testGates.push("Obtain trusted executor test receipt confirming 100% assertions executed.");
  } else {
    // PASS verdict
    mission = `Execute next milestone task within approved scope for candidate ${baselineSha}`;
    orderedSteps.push(
      "1. Verify baseline candidate SHA and confirm working tree is clean.",
      "2. Implement next feature step preserving all existing contracts and protected invariants.",
      "3. Execute test suite and verify 0 regressions."
    );
    testGates.push("Maintain 100% green test pass across all regression test suites.");
  }

  // Compile verified evidence summaries
  const verifiedEvidence = review.claims
    .filter((c) => c.disposition === "SUPPORTED")
    .map((c) => `[VERIFIED] ${c.claimText} (${c.verificationRationale})`);

  if (graph) {
    for (const edge of graph.edges) {
      if (edge.relation === "SUPPORTS") {
        const src = graph.sources[edge.sourceId];
        if (src) {
          verifiedEvidence.push(`[RESEARCH_GROUNDING] ${src.title} (${src.identifier}): ${src.keyFinding}`);
        }
      }
    }
  }

  const contradictions = review.contradictions.map(
    (c) => `[CONTRADICTION] ${c.observedText} <=> ${c.conflictingEvidence}`
  );
  const unknowns = review.unknowns.map((u) => `[UNKNOWN] ${u}`);

  // Base prompt template
  const nextTaskPrompt = formatTargetModelPrompt(
    targetProfile as TargetExportModel,
    mission,
    baselineSha,
    submission.originalTask,
    orderedSteps,
    verifiedEvidence,
    contradictions,
    unknowns,
    testGates,
    stopConditions
  );

  return {
    contractId,
    taskId: submission.taskId,
    baselineSha,
    targetProfile,
    authority: "ADVISORY_ONLY",
    mission,
    immutableProtectedIntent: submission.originalTask,
    fileAllowlist: submission.diffRefs || ["src/**/*", "tests/**/*"],
    exclusions: [".git/**/*", "node_modules/**/*", "dist/**/*"],
    verifiedEvidence,
    unknowns,
    contradictions,
    orderedExecutionSteps: orderedSteps,
    requiredTestGates: testGates,
    stopConditions,
    nextTaskPrompt,
  };
}

/**
 * Formats canonical prompt for specific target AI coding model profiles.
 * Preserves 100% of mandatory obligations while adapting syntax and directives.
 */
export function formatTargetModelPrompt(
  target: TargetExportModel,
  mission: string,
  baselineSha: string,
  protectedIntent: string,
  steps: string[],
  evidence: string[],
  contradictions: string[],
  unknowns: string[],
  testGates: string[],
  stopConditions: string[]
): string {
  const profileDirectives: Record<TargetExportModel, string> = {
    claude:
      "Role: Claude Code / Anthropic Senior Systems Engineer\nDirectives: Enforce tool-use boundaries, minimal surgical diff patches, and structured verification terminal commands.",
    codex:
      "Role: OpenAI Codex / GPT-4o Lead Systems Architect\nDirectives: Provide concise functional pipelines, explicit boundary assertions, and clear operational constraints.",
    cursor:
      "Role: Cursor Autonomous Lead Agent\nDirectives: Prioritize precise symbol modifications, preserve existing file conventions, and emit verification commands.",
    grok:
      "Role: Grok Lead Verification Engineer\nDirectives: Apply rigorous first-principles reasoning, detect hidden edge cases, and enforce formal invariant proofs.",
    local_coder:
      "Role: Qwen 2.5 / DeepSeek High-Assurance Coding Specialist\nDirectives: Enforce step-by-step reasoning scaffolds, complete symbol signatures, and strict code block boundaries.",
    generic:
      "Role: Autonomous Verification & Coding Agent\nDirectives: Provide deterministic differential remediation, formal proofs, and regression tests.",
  };

  const directive = profileDirectives[target] || profileDirectives.generic;

  return `## Autonomous Continuation Task
Target Profile: ${target.toUpperCase()}
Authority Level: ADVISORY_ONLY (Zero Autonomous Deployment Authority)
Baseline Git SHA: \`${baselineSha}\`

${directive}

### ProtectedIntent (Immutable)
"${protectedIntent}"

### Mission Objective
${mission}

### Ordered Execution Plan
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

### Verified Evidence & Grounding
${evidence.length > 0 ? evidence.join("\n") : "- (No verified evidence currently attached)"}

${contradictions.length > 0 ? `### Active Contradictions to Resolve:\n${contradictions.join("\n")}\n` : ""}
${unknowns.length > 0 ? `### Open Unknowns to Verify:\n${unknowns.join("\n")}\n` : ""}

### Mandatory Acceptance Test Gates
${testGates.map((g) => `- [ ] ${g}`).join("\n")}

### Strict Stop Conditions
${stopConditions.map((c) => `- [!] ${c}`).join("\n")}`;
}
