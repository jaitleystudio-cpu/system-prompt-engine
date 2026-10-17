/**
 * SPE R3 — read-only recovery reconciliation against existing R2/R1 custody.
 *
 * NOT a semantic compiler, credential authority, provider verifier or replay
 * executor. A locally self-sealed journal is not independent execution proof.
 * This examiner can re-run SAVED candidate bytes in a fresh browser and can
 * classify other states as needing provider-side reconciliation. It NEVER
 * executes an external model, removes stale locks, authorizes a retry, or
 * claims that a provider call happened/did not happen.
 */
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  inspectRecoveryCheckpoint,
  JOURNAL_FILENAME,
  JOURNAL_LOCK,
  sealCheckpoint,
} from "./spe-recovery-journal-custody.mjs";
import { inspectCandidateInBrowser, TEST_SCOPE } from "./spe-crash-recovery-harness.mjs";

const digest = value =>
  "sha256:" + createHash("sha256").update(value).digest("hex");
const candidateName = /^browser-passed-([0-9a-f]{16})\.html$/;
const hexDigest = /^sha256:[0-9a-f]{64}$/;
const DISPATCH_STATES = new Set(["INITIAL_DISPATCHING", "REPAIR_DISPATCHING"]);
const OUTPUT_STATES = new Set(["INITIAL_OUTPUT_RETURNED", "REPAIR_OUTPUT_RETURNED"]);
const REPLAY_STATES = new Set(["FINISHED", "INITIAL_BROWSER_OBSERVED", "REPAIR_BROWSER_OBSERVED", "REPAIR_PREPARED"]);
const decisions = Object.freeze({
  HOLD: "HOLD_RECONCILIATION_REQUIRED",
  REPLAYED: "BROWSER_REPLAYED_PROVIDER_UNATTESTED",
});
const hold = (reason, extras = {}) => Object.freeze({
  status: decisions.HOLD, reason,
  nextModelCallAuthorized: false, providerOutcomeProven: false,
  retryEligible: false, ...extras,
});

const observeSafe = async path => {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 256_000)
      return null;
    return await readFile(path);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
};

function validateAttemptStructure(record) {
  if (!Array.isArray(record.attempts) || record.attempts.length > 2) return false;
  const attempts = record.attempts;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    if (!a || typeof a !== "object" || a.phase !== (i === 0 ? "INITIAL" : "REPAIR")
      || !hexDigest.test(a.promptDigest || "")) return false;
    const obs = a.observation;
    if (!obs || typeof obs !== "object" || !hexDigest.test(obs.candidateDigest || "")
      || obs.evidenceKind !== "REAL_EPHEMERAL_CHROMIUM_OBSERVATION"
      || JSON.stringify(obs.testScope) !== JSON.stringify(TEST_SCOPE)
      || typeof obs.passed !== "boolean" || !Array.isArray(obs.errors)
      || obs.errors.some(e => typeof e !== "string") || !obs.checks
      || typeof obs.checks !== "object") return false;
    if (Object.keys(obs.checks).sort().join("|")
        !== ["applicationVisible", "canvasVisible", "interactionWorking"].sort().join("|"))
      return false;
    if (Object.values(obs.checks).some(v => typeof v !== "boolean")) return false;
    if (obs.passed && (obs.errors.length || !Object.values(obs.checks).every(Boolean))) return false;
    if (!obs.passed && !obs.errors.length && Object.values(obs.checks).every(Boolean)) return false;
  }
  if (attempts.length && record.artifactDigest !== attempts.at(-1).observation.candidateDigest)
    return false;
  if (record.initialPromptDigest !== attempts[0]?.promptDigest && attempts.length)
    return false;
  if (attempts.length === 2) {
    if (!record.repair || typeof record.repair.prompt !== "string"
      || record.repair.sourceCandidateDigest !== attempts[0].observation.candidateDigest
      || digest(record.repair.prompt) !== attempts[1].promptDigest || attempts[0].observation.passed)
      return false;
  }
  return true;
}

/**
 * Reconciliation deliberately stops at an independently rerun browser check.
 * It returns NO retry authorization even if the browser replay passes.
 *
 * A successful replay only proves the locally stored HTML passes this
 * acceptance scope in a fresh Chromium context; it does not authenticate
 * remote model identity or the original browser receipt.
 */
export async function reconcileRecoveryReadOnly({
  evidenceDirectory, goal, originalPrompt, browser,
}) {
  if (!evidenceDirectory || typeof goal !== "string" || typeof originalPrompt !== "string")
    return hold("MISSING_RECONCILIATION_INPUT");
  const status = await inspectRecoveryCheckpoint(evidenceDirectory, { goal, originalPrompt });
  if (status.disposition === "NOT_FOUND")
    return hold("NO_EXISTING_RECOVERY", { journalState: null });
  const journalBytes = await observeSafe(join(evidenceDirectory, JOURNAL_FILENAME));
  if (!journalBytes) return hold("MISSING_OR_UNSAFE_JOURNAL");
  let record;
  try { record = JSON.parse(journalBytes.toString("utf8")); }
  catch { return hold("UNREADABLE_JOURNAL"); }
  if (status.reason === "CHECKPOINT_INTEGRITY_MISMATCH"
      || sealCheckpoint(record).checkpointDigest !== record.checkpointDigest)
    return hold("CHECKPOINT_INTEGRITY_MISMATCH");
  if (record.protectedGoalDigest !== digest(goal) || record.initialPromptDigest !== digest(originalPrompt))
    return hold("PROTECTED_IDENTITY_MISMATCH");
  if (!validateAttemptStructure(record))
    return hold("INCONSISTENT_ATTEMPT_LINEAGE");
  const lock = await observeSafe(join(evidenceDirectory, JOURNAL_LOCK));
  // A lock must remain untouched: it may represent a running process, not a
  // stale one. R3 cannot remove it based on file age or process PID alone.
  if (lock) return hold("ACTIVE_OR_ORPHANED_LOCK", { journalState: record.phaseStatus });
  if (status.disposition === decisions.HOLD && !REPLAY_STATES.has(record.phaseStatus)) {
    return hold(DISPATCH_STATES.has(record.phaseStatus)
      ? "PROVIDER_OUTCOME_UNKNOWN_DO_NOT_RETRY"
      : OUTPUT_STATES.has(record.phaseStatus)
        ? "OUTPUT_RETURNED_BUT_ARTIFACT_NOT_VERIFIABLE"
        : "STATE_REQUIRES_RECONCILIATION", { journalState: record.phaseStatus });
  }
  if (DISPATCH_STATES.has(record.phaseStatus))
    return hold("PROVIDER_OUTCOME_UNKNOWN_DO_NOT_RETRY", { journalState: record.phaseStatus });
  if (OUTPUT_STATES.has(record.phaseStatus))
    return hold("OUTPUT_RETURNED_BUT_ARTIFACT_NOT_VERIFIABLE", { journalState: record.phaseStatus });
  if (record.phaseStatus === "INCONCLUSIVE")
    return hold("INCONCLUSIVE_REQUIRES_PROVIDER_RECONCILIATION", { journalState: record.phaseStatus });

  // First-run failure or prepared prompt has no qualified saved artifact.
  const last = record.attempts.at(-1);
  if (!last?.observation?.passed)
    return hold("NO_SAVED_PASSED_CANDIDATE", { journalState: record.phaseStatus });
  const saved = record.browserPassedArtifact;
  if (!saved || typeof saved.file !== "string" || !candidateName.test(saved.file)
      || !hexDigest.test(saved.digest || ""))
    return hold("INVALID_SAVED_ARTIFACT_REFERENCE");
  if (saved.file !== "browser-passed-" + saved.digest.slice(7, 23) + ".html"
      || saved.digest !== last.observation.candidateDigest)
    return hold("SAVED_ARTIFACT_DIGEST_MISMATCH");
  const fileBytes = await observeSafe(join(evidenceDirectory, saved.file));
  if (!fileBytes || fileBytes.length > 150_000 || digest(fileBytes) !== saved.digest)
    return hold("MISSING_OR_TAMPERED_ARTIFACT_BYTES");
  if (!browser || typeof browser.newContext !== "function")
    return hold("INDEPENDENT_BROWSER_REQUIRED");
  // Errors from a browser crash fail closed; no automatic model dispatch.
  let replay;
  try { replay = await inspectCandidateInBrowser(browser, fileBytes.toString("utf8")); }
  catch { return hold("INDEPENDENT_BROWSER_EXECUTION_FAILED"); }
  if (!replay.passed || replay.candidateDigest !== saved.digest)
    return hold("INDEPENDENT_BROWSER_REPLAY_FAILED", {
      browserReplay: {
        passed: false,
        candidateDigest: replay.candidateDigest,
        checks: replay.checks,
        errors: replay.errors,
      },
    });
  return Object.freeze({
    status: decisions.REPLAYED,
    reason: "ARTIFACT_BYTES_REPLAYED_IN_FRESH_BROWSER",
    journalState: record.phaseStatus,
    candidateDigest: saved.digest,
    browserReplay: {
      passed: true,
      candidateDigest: replay.candidateDigest,
      screenshotDigest: replay.screenshotDigest,
      checks: replay.checks,
      errors: replay.errors,
    },
    checkpointDigest: record.checkpointDigest,
    provenanceClaim: record.provenance,
    nextModelCallAuthorized: false,
    providerOutcomeProven: false,
    retryEligible: false,
    releaseAuthorized: false,
  });
}
