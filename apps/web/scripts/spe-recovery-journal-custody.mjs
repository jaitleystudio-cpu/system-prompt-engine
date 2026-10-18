/**
 * SPE R2 local harness journal custody, NOT a new canonical execution authority.
 *
 * - Atomic replacement of JSON (no partially truncated manifest on power loss).
 * - Exclusive per-directory local lock; a process crash leaves a lock that
 *   requires explicit reconciliation, never a silent retry.
 * - Checkpoint hashes detect accidental/tampered-bytes inconsistencies,
 *   but are NOT signatures, attestations, or proof a remote action occurred.
 * - Never automatically dispatches an external model or resumes a side effect.
 */
import { randomUUID, createHash } from "node:crypto";
import { open, lstat, mkdir, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

export const JOURNAL_FILENAME = "living-spe-recovery.json";
export const JOURNAL_LOCK = ".spe-recovery-active.lock";
const STATES = new Set([
  "INITIAL_DISPATCHING", "INITIAL_OUTPUT_RETURNED", "INITIAL_BROWSER_OBSERVED",
  "REPAIR_PREPARED", "REPAIR_DISPATCHING", "REPAIR_OUTPUT_RETURNED",
  "REPAIR_BROWSER_OBSERVED", "FINISHED", "INCONCLUSIVE",
]);
const hash = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");

async function statOrNull(path) {
  try { return await lstat(path); }
  catch (e) { if (e?.code === "ENOENT") return null; throw e; }
}
function journalBody(record) {
  const { checkpointDigest: ignored, ...body } = record;
  return body;
}
export function sealCheckpoint(record) {
  const body = journalBody(record);
  return { ...body, checkpointDigest: hash(JSON.stringify(body)) };
}

export async function inspectRecoveryCheckpoint(evidenceDirectory, { goal, originalPrompt } = {}) {
  const path = join(evidenceDirectory, JOURNAL_FILENAME);
  const file = await statOrNull(path);
  const lock = await statOrNull(join(evidenceDirectory, JOURNAL_LOCK));
  if (!file) {
    return lock
      ? { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "ORPHANED_LOCK_WITHOUT_MANIFEST" }
      : { disposition: "NOT_FOUND", reason: "NO_PRIOR_RUN" };
  }
  if (!file.isFile() || file.isSymbolicLink() || file.size > 256_000)
    return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "INVALID_MANIFEST_FILE" };
  let record;
  try { record = JSON.parse(await readFile(path, "utf8")); }
  catch { return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "UNREADABLE_MANIFEST" }; }
  if (!record || typeof record !== "object" || Array.isArray(record))
    return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "INVALID_CHECKPOINT_STRUCTURE" };
  const expected = sealCheckpoint(record).checkpointDigest;
  if (record.checkpointDigest !== expected)
    return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "CHECKPOINT_INTEGRITY_MISMATCH" };
  if (!STATES.has(record.phaseStatus))
    return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "INVALID_JOURNAL_STATE" };
  if (goal !== undefined && record.protectedGoalDigest !== hash(goal))
    return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "PROTECTED_GOAL_MISMATCH" };
  if (originalPrompt !== undefined && record.initialPromptDigest !== hash(originalPrompt))
    return { disposition: "HOLD_RECONCILIATION_REQUIRED", reason: "COMPILED_PROMPT_MISMATCH" };
  if (record.phaseStatus === "FINISHED" && !lock)
    return { disposition: "FINISHED_REVIEW_ONLY", reason: "NO_AUTOMATIC_RESTART", phaseStatus: record.phaseStatus };
  return {
    disposition: "HOLD_RECONCILIATION_REQUIRED",
    reason: lock ? "LOCK_PRESENT_OR_INTERRUPTED" : "OUTCOME_OR_CONTINUATION_REQUIRES_RECONCILIATION",
    phaseStatus: record.phaseStatus,
  };
}

export async function startExclusiveRecovery(evidenceDirectory) {
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const check = await inspectRecoveryCheckpoint(evidenceDirectory);
  if (check.disposition !== "NOT_FOUND")
    throw new Error("EXISTING_RECOVERY_RECONCILIATION_REQUIRED:" + check.reason);
  const lockPath = join(evidenceDirectory, JOURNAL_LOCK);
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (e) {
    if (e?.code === "EEXIST") throw new Error("CONCURRENT_RECOVERY_OR_STALE_LOCK");
    throw e;
  }
  try {
    await lock.writeFile(JSON.stringify({
      pid: process.pid,
      purpose: "UNTRUSTED_HARNESS_LOCK_NOT_AUTHORITY",
    }) + "\n");
    await lock.sync();
  } finally {
    await lock.close();
  }
  return { lockPath };
}

export async function finishExclusiveRecovery(lock) {
  // Ordinary clean exit only. After SIGKILL the lock persists for reconciliation.
  await unlink(lock.lockPath);
}

export async function persistRecoveryCheckpoint(evidenceDirectory, record) {
  if (!STATES.has(record.phaseStatus)) throw new Error("INVALID_JOURNAL_STATE");
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const sealed = sealCheckpoint(record);
  const bytes = JSON.stringify(sealed, null, 2) + "\n";
  if (Buffer.byteLength(bytes) > 256_000) throw new Error("OVERSIZED_JOURNAL");
  const destination = join(evidenceDirectory, JOURNAL_FILENAME);
  const old = await statOrNull(destination);
  if (old && (!old.isFile() || old.isSymbolicLink()))
    throw new Error("UNSAFE_EXISTING_CHECKPOINT");
  const temp = join(evidenceDirectory, "." + JOURNAL_FILENAME + "." + randomUUID() + ".tmp");
  let file;
  try {
    file = await open(temp, "wx", 0o600);
    await file.writeFile(bytes);
    await file.sync();
    await file.close();
    file = null;
    await rename(temp, destination);
    // Linux CI: flush the directory entry after atomic rename.
    const dir = await open(evidenceDirectory, "r");
    try { await dir.sync(); } finally { await dir.close(); }
  } finally {
    if (file) await file.close();
    await unlink(temp).catch(e => { if (e.code !== "ENOENT") throw e; });
  }
  return sealed;
}
