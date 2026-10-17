#!/usr/bin/env node
/**
 * R2 kill/restart/concurrency/altered-checkpoint tests.
 * Pure local process fixture; 0 provider calls and 0 browser requirements.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runCrashRecovery } from "./spe-crash-recovery-harness.mjs";
import {
  inspectRecoveryCheckpoint, startExclusiveRecovery, finishExclusiveRecovery,
  JOURNAL_FILENAME, JOURNAL_LOCK,
} from "./spe-recovery-journal-custody.mjs";

const goal = "Build a functioning canvas app preserving the original design.";
const prompt = "Compile this protected goal into a runnable HTML application.";
const root = await mkdtemp(join(tmpdir(), "spe-r2-interruption-"));
const crashedDir = join(root, "crashed");
try {
  const url = pathToFileURL(new URL("./spe-crash-recovery-harness.mjs", import.meta.url).pathname).href;
  const worker = [
    'import { writeFile } from "node:fs/promises";',
    'import { join } from "node:path";',
    'const {runCrashRecovery}=await import(process.argv[2]);',
    'await runCrashRecovery({',
    '  goal: ' + JSON.stringify(goal) + ',',
    '  originalPrompt: ' + JSON.stringify(prompt) + ',',
    '  provenance: "FIXTURE", evidenceDirectory: process.argv[1], browser: null,',
    '  generate: async () => {',
    '    await writeFile(join(process.argv[1],"DISPATCHED_MARKER"),"1");',
    '    await new Promise(() => {});',
    '  },',
    '});',
  ].join("\n");
  const child = spawn(process.execPath, ["--input-type=module", "-e", worker, crashedDir, url],
    { stdio: ["ignore", "pipe", "pipe"] });
  const childExit = once(child, "close"); // Subscribe before SIGKILL or process exit.
  let stderr = "";
  child.stderr.on("data", b => { stderr += String(b).slice(0, 1000); });
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (existsSync(join(crashedDir, "DISPATCHED_MARKER"))) {
      started = true;
      break;
    }
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  if (!started) {
    child.kill("SIGKILL");
    throw new Error("Child never dispatched: " + stderr);
  }
  child.kill("SIGKILL");
  await childExit;
  assert.ok(existsSync(join(crashedDir, JOURNAL_FILENAME)), "checkpoint survived abrupt termination");
  assert.ok(existsSync(join(crashedDir, JOURNAL_LOCK)), "orphaned lock flags reconciliation");
  const restored = await inspectRecoveryCheckpoint(crashedDir, { goal, originalPrompt: prompt });
  assert.equal(restored.disposition, "HOLD_RECONCILIATION_REQUIRED");
  assert.equal(restored.reason, "LOCK_PRESENT_OR_INTERRUPTED");
  assert.equal(restored.phaseStatus, "INITIAL_DISPATCHING");

  let calls = 0;
  await assert.rejects(
    runCrashRecovery({
      goal, originalPrompt: prompt, provenance: "FIXTURE",
      evidenceDirectory: crashedDir, browser: null,
      generate: async () => { calls++; return { html: "<html></html>" }; },
    }), /EXISTING_RECOVERY_RECONCILIATION_REQUIRED/
  );
  assert.equal(calls, 0, "restart must never repeat an UNKNOWN external effect");

  const original = JSON.parse(await readFile(join(crashedDir, JOURNAL_FILENAME), "utf8"));
  original.phaseStatus = "FINISHED";
  await writeFile(join(crashedDir, JOURNAL_FILENAME), JSON.stringify(original));
  const edited = await inspectRecoveryCheckpoint(crashedDir, { goal, originalPrompt: prompt });
  assert.equal(edited.reason, "CHECKPOINT_INTEGRITY_MISMATCH");
  assert.equal(edited.disposition, "HOLD_RECONCILIATION_REQUIRED");

  const concurrentDir = join(root, "concurrent");
  const lock = await startExclusiveRecovery(concurrentDir);
  await assert.rejects(startExclusiveRecovery(concurrentDir),
    /EXISTING_RECOVERY_RECONCILIATION_REQUIRED/);
  await finishExclusiveRecovery(lock);

  const throwDir = join(root, "provider-error");
  let failedCalls = 0;
  const rejected = await runCrashRecovery({
    goal, originalPrompt: prompt, provenance: "FIXTURE",
    evidenceDirectory: throwDir, browser: null,
    generate: async () => { failedCalls++; throw new Error("TRANSPORT_UNKNOWN_OUTCOME"); },
  });
  assert.equal(failedCalls, 1);
  assert.equal(rejected.qualification, "INCONCLUSIVE_EXCEPTION");
  assert.equal(rejected.phaseStatus, "INCONCLUSIVE");
  const held = await inspectRecoveryCheckpoint(throwDir, { goal, originalPrompt: prompt });
  assert.equal(held.disposition, "HOLD_RECONCILIATION_REQUIRED");
  assert.equal(held.reason, "OUTCOME_OR_CONTINUATION_REQUIRES_RECONCILIATION");
  assert.equal(existsSync(join(throwDir, JOURNAL_LOCK)), false, "clean exception releases lock");

  console.log("PASS R2: SIGKILL leaves durable dispatch checkpoint and orphaned lock");
  console.log("PASS R2: restart performs zero unapproved retries and rejects tampering");
  console.log("PASS R2: concurrent runs and provider-unknown outcomes fail closed");
  console.log("PROOF_SCOPE: FIXTURE_ONLY_NO_LIVE_PROVIDER");
} finally {
  await rm(root, { recursive: true, force: true });
}
