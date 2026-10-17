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
import {
  adapterToKernelTargetId,
  cursorPromptIsHostOnly,
  isKernelTargetId,
  measureObligationPreservation,
  type ObligationSet,
} from "./oracleGuards";

export { measureObligationPreservation, adapterToKernelTargetId, isKernelTargetId };

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
  const mustNot: string[] = [
    "MUST_NOT deploy, merge, host, release, or spend without a separate human grant.",
    "MUST_NOT paste production credentials, .env secrets, or private keys into prompts.",
    "MUST_NOT invent Cursor model capabilities from the editor name.",
    "MUST_NOT downgrade evidence requirements from MUST to should.",
  ];
  const privacy: string[] = [
    "Privacy: omit secrets from public research queries; minimize local absolute paths.",
    "Privacy: RAW_USER_DATA_EGRESS = 0 for scholarly fabric unless explicit consent and public hosts.",
  ];
  const rollback: string[] = [
    "Rollback: revert the surgical patch and restore baseline SHA if gates fail.",
  ];
  const evidenceRequirements: string[] = [
    "Evidence requirements are MUST: independent executor receipts bound to candidate SHA.",
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
    stopConditions,
    { mustNot, privacy, rollback, evidenceRequirements },
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
  stopConditions: string[],
  extras?: {
    mustNot?: string[];
    privacy?: string[];
    rollback?: string[];
    evidenceRequirements?: string[];
  },
): string {
  const mustNot = extras?.mustNot || [
    "MUST_NOT deploy, merge, host, release, or spend without a separate human grant.",
    "MUST_NOT paste production credentials, .env secrets, or private keys into prompts.",
  ];
  const privacy = extras?.privacy || [
    "Privacy: omit secrets from public research queries; minimize local absolute paths.",
  ];
  const rollback = extras?.rollback || [
    "Rollback: revert the surgical patch and restore baseline SHA if gates fail.",
  ];
  const evidenceRequirements = extras?.evidenceRequirements || [
    "Evidence requirements are MUST: independent executor receipts bound to candidate SHA.",
  ];

  const profileDirectives: Record<TargetExportModel, string> = {
    claude:
      "Role: Claude Code / Anthropic Senior Systems Engineer\nDirectives: Enforce tool-use boundaries, minimal surgical diff patches, and structured verification terminal commands. Do not invent tools beyond the continuation contract.",
    codex:
      "Role: OpenAI Codex Lead Systems Architect\nDirectives: Provide concise functional pipelines, explicit boundary assertions, and clear operational constraints.",
    cursor:
      "Role: Cursor editor host instructions only\nDirectives: Cursor is the host only. Do not attribute model capabilities to the Cursor product name. Prefer precise symbol modifications and emit verification commands.",
    grok:
      "Role: Grok Lead Verification Engineer\nDirectives: Apply rigorous first-principles reasoning, detect hidden edge cases, and keep Open Unknowns visible.",
    local_coder:
      "Role: Local open-weights coding specialist\nDirectives: Enforce step-by-step reasoning scaffolds, complete symbol signatures, preserve rollback and stop conditions.",
    generic:
      "Role: Autonomous Verification & Coding Agent\nDirectives: Provide deterministic differential remediation and keep unknowns explicit.",
  };

  const directive = profileDirectives[target] || profileDirectives.generic;
  const kernelMap = adapterToKernelTargetId(target);
  const kernelNote = kernelMap
    ? `Kernel TargetModelId mapping: ${kernelMap}`
    : `Adapter-only profile (not a kernel TargetModelId). Do not invent kernel ids such as cursor-ultimate.`;

  const prompt = `## Autonomous Continuation Task
Target Profile: ${target.toUpperCase()}
Authority Level: ADVISORY_ONLY (Zero Autonomous Deployment Authority)
Baseline Git SHA: \`${baselineSha}\`
${kernelNote}

${directive}

### ProtectedIntent (Immutable)
"${protectedIntent}"

### Mission Objective
${mission}

### Ordered Execution Plan
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

### MUST / MUST_NOT
${mustNot.map((m) => `- [!] ${m}`).join("\n")}

### Privacy Constraints
${privacy.map((m) => `- [!] ${m}`).join("\n")}

### Rollback
${rollback.map((m) => `- [!] ${m}`).join("\n")}

### Verified Evidence & Grounding
${evidence.length > 0 ? evidence.join("\n") : "- (No verified evidence currently attached)"}

${evidenceRequirements.map((m) => `- [MUST] ${m}`).join("\n")}

${contradictions.length > 0 ? `### Active Contradictions to Resolve:\n${contradictions.join("\n")}\n` : ""}
### Open Unknowns to Verify
${unknowns.length > 0 ? unknowns.join("\n") : "- (No open unknowns listed — still treat missing evidence as UNKNOWN != PASS)"}

### Mandatory Acceptance Test Gates
${testGates.map((g) => `- [ ] ${g}`).join("\n")}

### Strict Stop Conditions
${stopConditions.map((c) => `- [!] ${c}`).join("\n")}`;

  if (target === "cursor" && !cursorPromptIsHostOnly(prompt)) {
    throw new Error("Cursor export invented model capabilities; host-only invariant violated.");
  }

  const obligations: ObligationSet = {
    objective: mission,
    must: evidenceRequirements,
    mustNot,
    authority: "ADVISORY_ONLY",
    baselineSha,
    evidenceRequirements,
    unknowns,
    tests: testGates,
    stops: stopConditions,
    privacy,
    rollback,
  };
  const preservation = measureObligationPreservation(prompt, obligations);
  if (preservation.ratio < 1) {
    throw new Error(
      `MANDATORY_OBLIGATION_PRESERVATION=${preservation.ratio} missing=${preservation.missing.join("|")}`,
    );
  }

  return prompt;
}

