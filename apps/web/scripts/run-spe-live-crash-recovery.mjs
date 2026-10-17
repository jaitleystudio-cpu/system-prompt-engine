#!/usr/bin/env node
/**
 * Optional LIVE adapter invocation. Does NOT run or spend without explicit opt-in.
 *
 * Set:
 * SPE_ALLOW_MODEL_EXECUTION=YES
 * SPE_MODEL_COMMAND_JSON='["node","/trusted/path/to/model-adapter.mjs"]'
 * SPE_GOAL_FILE=/private/goal.txt
 * SPE_COMPILED_PROMPT_FILE=/private/compiled-prompt.txt
 * SPE_RECOVERY_EVIDENCE_DIR=/private/proof-dir
 *
 * Model adapter receives {phase,prompt,protectedGoalDigest} JSON on stdin and
 * returns {html,model,requestId} JSON on stdout. Execute ONLY trusted adapters;
 * the command process inherits normal OS privileges and may access credentials.
 * The resulting model identity is not cryptographically attested.
 */
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { runCrashRecovery } from "./spe-crash-recovery-harness.mjs";

if (process.env.SPE_ALLOW_MODEL_EXECUTION !== "YES")
  throw new Error("LIVE_MODEL_EXECUTION_REQUIRES_EXPLICIT_OPT_IN");
for (const key of [
  "SPE_MODEL_COMMAND_JSON",
  "SPE_GOAL_FILE",
  "SPE_COMPILED_PROMPT_FILE",
  "SPE_RECOVERY_EVIDENCE_DIR",
]) {
  if (!process.env[key]) throw new Error("MISSING_" + key);
}
const command = JSON.parse(process.env.SPE_MODEL_COMMAND_JSON);
if (!Array.isArray(command) || !command.length || !command.every(x => typeof x === "string" && x.length > 0))
  throw new Error("INVALID_MODEL_COMMAND_ARRAY");

async function generate({ phase, prompt, protectedGoalDigest }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      shell: false, stdio: ["pipe", "pipe", "pipe"], timeout: 90_000,
    });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout += chunk;
      if (stdout.length > 200_000) child.kill("SIGKILL");
    });
    child.stderr.on("data", chunk => { stderr += chunk.slice(0, 1000); });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code !== 0) return reject(new Error("MODEL_ADAPTER_FAILED:" + String(code ?? signal)));
      try {
        const result = JSON.parse(stdout);
        if (!result || typeof result.html !== "string" || !result.html.length)
          throw new Error("MISSING_MODEL_HTML");
        resolve(result);
      } catch {
        reject(new Error("MODEL_ADAPTER_INVALID_JSON_RESPONSE"));
      }
    });
    child.stdin.end(JSON.stringify({ phase, prompt, protectedGoalDigest }) + "\n");
  });
}
const goal = await readFile(process.env.SPE_GOAL_FILE, "utf8");
const originalPrompt = await readFile(process.env.SPE_COMPILED_PROMPT_FILE, "utf8");
const browser = await chromium.launch({ headless: true });
try {
  const result = await runCrashRecovery({
    goal, originalPrompt, generate,
    provenance: "EXTERNAL_COMMAND_UNATTESTED",
    browser, evidenceDirectory: process.env.SPE_RECOVERY_EVIDENCE_DIR,
  });
  console.log(JSON.stringify({
    qualification: result.qualification,
    attempted: result.attempts.length,
    finalCandidateDigest: result.artifactDigest,
    evidenceDirectory: process.env.SPE_RECOVERY_EVIDENCE_DIR,
  }));
  // Real browser pass alone does not imply independently attested provider.
  if (!result.qualification.startsWith("BROWSER_")) process.exitCode = 1;
} finally {
  await browser.close();
}
