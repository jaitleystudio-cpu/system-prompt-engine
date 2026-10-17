#!/usr/bin/env node
/**
 * Real Chromium, deterministic fixture: tests mechanics, NOT live model AI.
 * Run: node scripts/test-spe-crash-recovery-browser.mjs
 * Prereq: npx playwright install chromium
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  compileEvidenceBoundRepairPrompt,
  inspectCandidateInBrowser,
  runCrashRecovery,
} from "./spe-crash-recovery-harness.mjs";

const broken = [
  '<!doctype html><html><body>',
  '<main id="spe-app"><h1>Premium interactive stage</h1>',
  '<canvas id="spe-stage" width="300" height="160"></canvas>',
  '<button id="spe-interact">Rotate the scene</button></main>',
  '<script>window.speInteractionCount=0;',
  'const canvas=document.querySelector("#spe-stage");',
  'const ctx=canvas.getContext("2d");',
  'ctx.fillStyle=sceneConfig.theme;',
  'ctx.fillRect(0,0,300,160);',
  'document.querySelector("#spe-interact").addEventListener("click",()=>window.speInteractionCount++);',
  '</script></body></html>',
].join("\n");
const repaired = broken.replace(
  'ctx.fillStyle=sceneConfig.theme;',
  'const sceneConfig={theme:"#369"};\nctx.fillStyle=sceneConfig.theme;'
);
const fakeSuccess = '<!doctype html><html><body>All tests passed, application fixed!</body></html>';
const goal = 'Build an interactive canvas hero, preserving the canvas and Rotate the scene button.';
const dir = await mkdtemp(join(tmpdir(), "spe-recovery-r0-"));
const browser = await chromium.launch({ headless: true });

try {
  const failed = await inspectCandidateInBrowser(browser, broken);
  assert.equal(failed.passed, false);
  assert.ok(failed.errors.some(x => x.includes("sceneConfig")));
  assert.ok(failed.errors.some(x => x.includes("ReferenceError")));
  const repairInstruction = compileEvidenceBoundRepairPrompt({
    goal, originalPrompt: goal, observed: failed,
  });
  assert.ok(repairInstruction.constraints.some(x => x.includes("sceneConfig")));
  assert.ok(repairInstruction.prompt.includes(goal));
  assert.ok(repairInstruction.prompt.includes(failed.candidateDigest));
  assert.throws(() => compileEvidenceBoundRepairPrompt({
    goal, originalPrompt: goal, observed: { ...failed, passed: true },
  }), /NO_OBSERVED_FAILURE/);

  let calls = 0;
  const succeeded = await runCrashRecovery({
    goal, originalPrompt: goal,
    generate: async ({ phase, prompt }) => {
      calls++;
      if (phase === "REPAIR") {
        assert.ok(prompt.includes("sceneConfig"));
        assert.ok(prompt.includes("MUST NOT remove"));
      }
      return { html: phase === "INITIAL" ? broken : repaired, model: "DETERMINISTIC_FIXTURE" };
    },
    provenance: "FIXTURE", browser, evidenceDirectory: join(dir, "positive"),
  });
  assert.equal(calls, 2, "exactly one bounded retry");
  assert.equal(succeeded.qualification, "FIXTURE_REPAIRED_NOT_LIVE");
  assert.equal(succeeded.attempts[0].observation.passed, false);
  assert.equal(succeeded.attempts[1].observation.passed, true);
  assert.equal(succeeded.attempts[1].observation.errors.length, 0);
  assert.ok(succeeded.attempts[1].observation.screenshotDigest?.startsWith("sha256:"));
  assert.equal(succeeded.repair.sourceCandidateDigest,
    succeeded.attempts[0].observation.candidateDigest);
  const saved = JSON.parse(await readFile(join(dir, "positive", "living-spe-recovery.json"), "utf8"));
  assert.deepEqual(saved, succeeded, "durable JSON reopens without loss");
  const boundArtifact = await readFile(
    join(dir, "positive", succeeded.browserPassedArtifact.file), "utf8");
  const actualDigest = "sha256:" + createHash("sha256").update(boundArtifact).digest("hex");
  assert.equal(actualDigest, succeeded.browserPassedArtifact.digest);
  assert.equal(boundArtifact, repaired, "stored artifact is exactly the browser-tested candidate");

  const deceptive = await runCrashRecovery({
    goal, originalPrompt: goal,
    generate: async ({ phase }) =>
      ({ html: phase === "INITIAL" ? broken : fakeSuccess, model: "CLAIMED" }),
    provenance: "FIXTURE", browser, evidenceDirectory: join(dir, "negative"),
  });
  assert.equal(deceptive.qualification, "FAILED_BOUNDED_REPAIR");
  assert.equal(deceptive.attempts[1].observation.passed, false);
  assert.ok(deceptive.attempts[1].observation.errors.some(x => x.includes("ACCEPTANCE_FAILED")));

  const notAttested = await runCrashRecovery({
    goal, originalPrompt: goal,
    generate: async ({ phase }) => ({
      html: phase === "INITIAL" ? broken : repaired,
      model: "user_supplied_unverified_model",
      requestId: "user_supplied_unverified_call",
    }),
    provenance: "EXTERNAL_COMMAND_UNATTESTED",
    browser, evidenceDirectory: join(dir, "unattested"),
  });
  assert.equal(notAttested.qualification, "BROWSER_REPAIRED_PROVIDER_UNATTESTED");
  assert.ok(!notAttested.qualification.includes("LIVE_VERIFIED"));

  console.log("PASS: Chromium failure, targeted repair, rerender, persisted JSON.");
  console.log("PASS: fake text success rejected; model identity remains UNATTESTED.");
  console.log("PROOF_SCOPE: DETERMINISTIC_FIXTURE_NOT_LIVE_PROVIDER");
  if (process.env.SPE_R0_CHROMIUM_EVIDENCE_DIR) {
    await cp(join(dir, "positive"), process.env.SPE_R0_CHROMIUM_EVIDENCE_DIR, { recursive: true });
    console.log("EXPORTED_BROWSER_FIXTURE_EVIDENCE: review-only; no live model");
  }
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
