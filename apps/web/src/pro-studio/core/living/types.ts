// Living .spe project types. A Living project keeps the user's goal and protected requirements across
// attempts, runs on the customer's own model (BYOK), and records what is proven and what is not.
export type CheckKind =
  | "contains" | "not_contains" | "regex" | "not_regex" | "json_valid" | "json_keys"
  | "max_words" | "min_words" | "max_chars" | "starts_with" | "ends_with" | "line_count_max" | "manual"
  /** Executes the code in the output in a sandbox harness; passes only with 0 runtime and 0 console errors. */
  | "runs_clean";
export interface Check { kind: CheckKind; value?: string; n?: number; keys?: string[]; caseSensitive?: boolean; /** runs_clean only: "browser" (fake DOM) or "ssr" (no window/document; calls render()). */ env?: "browser" | "ssr" }
export interface Requirement { id: string; text: string; check: Check }
export interface LivingInput { id: string; text: string; category?: string; language?: string }
/** VERIFIED only ever comes from a deterministic check. HUMAN_* are human marks and are labelled as such. */
export type Status = "VERIFIED" | "FAILED" | "UNPROVEN" | "NOT_RUN" | "HUMAN_PASS" | "HUMAN_FAIL";
export interface CheckResult { reqId: string; inputId: string; status: Status; evidence: string }
export type Strategy = "direct" | "checklist" | "format-first" | "decompose";
export interface Repair { reqId: string; clause: string; attempt: number; /** The real captured error this clause was derived from, if any. */ fromError?: string }
export type DeficitKind = "MISSING_CONTENT" | "FORBIDDEN_CONTENT" | "FORMAT" | "LENGTH" | "EMPTY_OUTPUT" | "PROVIDER_ERROR" | "INTENT_LOSS" | "RUNTIME_ERROR" | "DRIFT";
export interface Deficit { reqId?: string; inputId?: string; kind: DeficitKind; detail: string }
export type Decision =
  | { kind: "verified" }
  | { kind: "E0"; reqIds: string[] }
  | { kind: "E1"; from: Strategy; to: Strategy; reqIds: string[] }
  | { kind: "retry"; why: string }
  | { kind: "pause"; reason: PauseReason };
export type PauseReason = "BUDGET_ATTEMPTS" | "BUDGET_TOKENS" | "PROVIDER_ERRORS" | "INTENT_LOSS" | "NEEDS_HUMAN_REVIEW" | "NO_INPUTS" | "NO_REQUIREMENTS" | "NO_SANDBOX";
/** What really happened when the harness executed the generated code. Recorded, never inferred from model text. */
export interface ExecEvidence {
  engine: string; codeSha: string; ok: boolean;
  /** Uncaught exceptions, syntax errors, unhandled rejections, timeouts. */
  errors: string[];
  /** Calls to console.error made by the code. */
  consoleErrors: string[];
  /** Visible text of the render root after execution (trimmed). */
  rendered: string; ms: number;
  /** Line/column of the first error in the generated code, from the real stack trace. */
  sites?: { line: number; col?: number }[];
  /** Execution environment used. */
  env?: "browser" | "ssr";
}
export interface Run { inputId: string; output: string; outputSha: string; error?: string; tokens?: number; exec?: ExecEvidence; /** Scoped-repair verification against the last crashing code for this input. */ scope?: import("./scope.ts").ScopeReport }
export interface Attempt {
  n: number; strategy: Strategy; prompt: string; promptSha: string; repairs: Repair[];
  runs: Run[]; results: CheckResult[]; deficits: Deficit[]; decision: Decision;
  tokens: number; tokenSource: "PROVIDER" | "ESTIMATED"; provider: string; model: string; at: string; simulated: boolean;
  /** Diagnosis view kept for the UI and tests. */
  diagnosis: { deficits: Deficit[] };
  /** Intent Loss Detector result on the compiled prompt (SPE engine module). Critical loss blocks the attempt. */
  intentShield?: { fidelity: number; critical: boolean; droppedNegative: number; dropped: string[] };
}
export interface Receipt {
  reason: PauseReason | "USER_STOP" | "VERIFIED"; message: string; attemptsUsed: number; maxAttempts: number;
  tokensUsed: number; maxTokens: number; tokenSource: "PROVIDER" | "ESTIMATED" | "MIXED" | "NONE";
  bestAttempt: number | null; verified: string[]; failed: string[]; unproven: string[]; notRun: string[]; at: string;
  /** Real errors the harness captured, per attempt (empty when nothing was executed). */
  capturedErrors?: { attempt: number; inputId: string; error: string }[];
  /** Line diff between the first attempt's prompt (V1) and the latest attempt's prompt. */
  promptDiff?: { from: number; to: number; added: string[]; removed: string[] } | null;
  /** Every scoped-repair verification: diff size, touched regions, preserved checks and verdict. */
  scopedRepairs?: { attempt: number; inputId: string; verdict: "ACCEPTED" | "REJECTED_DRIFT"; pin: string; changed: number; outsidePin: number; allowance: number; touchedRegions: string; importsChanged: string[]; stylingChanged: number; featuresRemoved: string[]; regressions: string[]; preserved: string[]; reasons: string[] }[];
}
export type ProjectStatus = "draft" | "running" | "verified" | "paused" | "stopped";
export interface LivingProject {
  format: "spe.living"; version: 1; id: string; name: string; intent: string;
  requirements: Requirement[]; inputs: LivingInput[]; budget: { maxAttempts: number; maxTokens: number };
  strategy: Strategy; repairs: Repair[]; attempts: Attempt[]; status: ProjectStatus; tokensUsed: number;
  humanMarks: Record<string, "pass" | "fail">; receipt: Receipt | null; createdAt: string; updatedAt: string;
}
export interface LedgerEntry { reqId: string; text: string; inputId: string; status: Status; attempt: number | null; evidenceSha: string; evidence: string }
export const MAX_ATTEMPTS_CAP = 12;
export const MAX_INPUTS = 20;
export const MAX_REQUIREMENTS = 40;
export const OUTPUT_KEEP = 24000;
