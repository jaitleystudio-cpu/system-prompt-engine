#!/usr/bin/env node
/**
 * Real Chromium, deterministic fixture: tests mechanics, NOT live model AI.
 * Run: node scripts/test-spe-crash-recovery-browser.mjs
 * Prereq: npx playwright install chromium
 */
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  compileEvidenceBoundRepairPrompt,
  inspectCandidateInBrowser,
  runCrashRecovery,
} from "./spe-crash-recovery-harness.mjs";
import { inspectRecoveryCheckpoint, sealCheckpoint } from "./spe-recovery-journal-custody.mjs";
import { reconcileRecoveryReadOnly } from "./spe-recovery-reconciliation.mjs";
import {
  getR4HarnessDigest, reviewRecoveryAndSign, verifyBrowserReplayReceipt,
} from "./spe-recovery-receipt.mjs";

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
  assert.equal(saved.phaseStatus, "FINISHED");
  const complete = await inspectRecoveryCheckpoint(join(dir, "positive"), {
    goal, originalPrompt: goal,
  });
  assert.equal(complete.disposition, "FINISHED_REVIEW_ONLY");
  let forbiddenRetries = 0;
  await assert.rejects(runCrashRecovery({
    goal, originalPrompt: goal, provenance: "FIXTURE",
    browser, evidenceDirectory: join(dir, "positive"),
    generate: async () => { forbiddenRetries++; return { html: repaired }; },
  }), /EXISTING_RECOVERY_RECONCILIATION_REQUIRED/);
  assert.equal(forbiddenRetries, 0, "completed jobs cannot be blindly replayed");

  const reconciled = await reconcileRecoveryReadOnly({
    evidenceDirectory: join(dir, "positive"), goal, originalPrompt: goal, browser,
  });
  assert.equal(reconciled.status, "BROWSER_REPLAYED_PROVIDER_UNATTESTED");
  assert.equal(reconciled.browserReplay.passed, true);
  assert.equal(reconciled.browserReplay.candidateDigest, succeeded.browserPassedArtifact.digest);
  assert.equal(reconciled.nextModelCallAuthorized, false);
  assert.equal(reconciled.retryEligible, false);
  assert.equal(reconciled.providerOutcomeProven, false);
  assert.equal(reconciled.releaseAuthorized, false);

  // R4 pinned-key review: the CI test's ephemeral key is a fixture,
  // NOT an independently operated production root of trust.
  const reviewer = generateKeyPairSync("ed25519");
  const otherReviewer = generateKeyPairSync("ed25519");
  const reviewerKeyId = "spe-r4-ci-reviewer";
  const audience = "spe-r4-acceptance";
  const operationId = "spe-r4-replay-fixture";
  const browserVersion = browser.version();
  const harnessDigest = await getR4HarnessDigest();
  const issuedTime = new Date();
  const actualReview = await reviewRecoveryAndSign({
    evidenceDirectory: join(dir, "positive"), browser,
    goal, originalPrompt: goal,
    reviewerPrivateKey: reviewer.privateKey,
    reviewerKeyId, audience, operationId, now: issuedTime,
  });
  assert.equal(actualReview.disposition, "REVIEW_ONLY_SIGNED_BROWSER_REPLAY");
  assert.equal(actualReview.reconciliation.browserReplay.passed, true);
  const receipt = actualReview.receipt;
  const pin = {
    pinnedReviewerPublicKey: reviewer.publicKey,
    reviewerKeyId, audience, operationId,
    goal, originalPrompt: goal,
    candidateDigest: reconciled.candidateDigest,
    checkpointDigest: reconciled.checkpointDigest,
    harnessDigest, browserVersion, now: issuedTime,
  };
  const validReceipt = verifyBrowserReplayReceipt(receipt, pin);
  assert.equal(validReceipt.valid, true, validReceipt.reason);
  assert.equal(validReceipt.authority, "REVIEW_ONLY_NO_MODEL_OR_RELEASE_AUTHORITY");
  assert.equal(validReceipt.nextModelCallAuthorized, false);
  assert.equal(validReceipt.retryEligible, false);
  assert.equal(validReceipt.providerOutcomeProven, false);
  assert.equal(validReceipt.releaseAuthorized, false);

  const wrongKey = verifyBrowserReplayReceipt(receipt, {
    ...pin, pinnedReviewerPublicKey: otherReviewer.publicKey,
  });
  assert.equal(wrongKey.valid, false);
  assert.equal(wrongKey.reason, "BAD_REVIEWER_SIGNATURE");
  assert.equal(verifyBrowserReplayReceipt(receipt, {
    ...pin, pinnedReviewerPublicKey: undefined,
  }).reason, "UNPINNED_REVIEWER_KEY");
  for (const [mutation, changed] of Object.entries({
    crossOperation: { operationId: "a-different-operation" },
    wrongAudience: { audience: "a-different-audience" },
    wrongReviewer: { reviewerKeyId: "a-different-reviewer" },
    differentGoal: { goal: "Different user goal" },
    differentPrompt: { originalPrompt: "Tampered Prompt" },
    differentArtifact: { candidateDigest: "sha256:" + "0".repeat(64) },
    differentJournal: { checkpointDigest: "sha256:" + "0".repeat(64) },
    differentHarness: { harnessDigest: "sha256:" + "0".repeat(64) },
    differentBrowser: { browserVersion: "Fake browser v0" },
    expired: { now: new Date(issuedTime.getTime() + 10 * 60_000) },
  })) {
    const attack = verifyBrowserReplayReceipt(receipt, { ...pin, ...changed });
    assert.equal(attack.valid, false, mutation + " should not verify");
    assert.equal(attack.nextModelCallAuthorized, false, mutation + " must not authorize a model");
  }
  const forgedReceipt = structuredClone(receipt);
  forgedReceipt.signed.observations.tests.interactionWorking = false;
  assert.equal(verifyBrowserReplayReceipt(forgedReceipt, pin).valid, false);
  const replayForgery = structuredClone(receipt);
  replayForgery.signed.receiptNonce = "attacker-changed-nonce";
  assert.equal(verifyBrowserReplayReceipt(replayForgery, pin).reason, "BAD_REVIEWER_SIGNATURE");
  const authorizationForgery = structuredClone(receipt);
  authorizationForgery.signed.authority = "ALLOW_DEPLOY";
  assert.equal(verifyBrowserReplayReceipt(authorizationForgery, pin).valid, false);

  const deniedReview = await reviewRecoveryAndSign({
    evidenceDirectory: join(dir, "positive"), browser: null,
    goal, originalPrompt: goal, reviewerPrivateKey: reviewer.privateKey,
    reviewerKeyId, audience, operationId,
  });
  assert.equal(deniedReview.disposition, "HOLD_RECONCILIATION_REQUIRED");
  assert.equal(deniedReview.receipt, null);
  const badIdentityReview = await reviewRecoveryAndSign({
    evidenceDirectory: join(dir, "positive"), browser,
    goal: "wrong goal", originalPrompt: goal,
    reviewerPrivateKey: reviewer.privateKey,
    reviewerKeyId, audience, operationId,
  });
  assert.equal(badIdentityReview.receipt, null);
  console.log("PASS R4: pinned Ed25519 reviewer signature bound to browser/candidate/intent/scope");
  console.log("PASS R4: forged, stale, reused, and mismatched receipts rejected; authority NONE");

  // R5 defense in depth: even within the browser, remote beacons must not
  // succeed. A forbidden request is itself a negative execution observation.
  const beacon = [
    '<!doctype html><main id="spe-app">',
    '<canvas id="spe-stage" width="300" height="160"></canvas>',
    '<button id="spe-interact">Click</button></main>',
    '<script>window.speInteractionCount=0;',
    'document.querySelector("#spe-interact").onclick=()=>window.speInteractionCount++;',
    'fetch("https://example.invalid/spe-beacon").catch(()=>{});',
    '</script>',
  ].join("\n");
  const beaconResult = await inspectCandidateInBrowser(browser, beacon);
  assert.equal(beaconResult.passed, false);
  assert.ok(beaconResult.errors.some(e => e.includes("NETWORK_DENIED:")),
    "External request must be denied and visible as a test failure");
  console.log("PASS R5: browser-level forbidden egress fails qualification");


  const fakeGoal = await reconcileRecoveryReadOnly({
    evidenceDirectory: join(dir, "positive"), goal: "different goal", originalPrompt: goal, browser,
  });
  assert.equal(fakeGoal.status, "HOLD_RECONCILIATION_REQUIRED");
  assert.equal(fakeGoal.nextModelCallAuthorized, false);

  const tamperDir = join(dir, "tamper");
  await cp(join(dir, "positive"), tamperDir, { recursive: true });
  const tamperedPath = join(tamperDir, succeeded.browserPassedArtifact.file);
  await writeFile(tamperedPath, "<html><body>Fake PASS</body></html>");
  const tampered = await reconcileRecoveryReadOnly({
    evidenceDirectory: tamperDir, goal, originalPrompt: goal, browser,
  });
  assert.equal(tampered.reason, "MISSING_OR_TAMPERED_ARTIFACT_BYTES");

  // Even self-resealing a forged local PASS cannot bypass fresh-browser replay.
  const forgedDir = join(dir, "forged");
  await cp(join(dir, "positive"), forgedDir, { recursive: true });
  const forgedPath = join(forgedDir, "living-spe-recovery.json");
  const forgedRecord = JSON.parse(await readFile(forgedPath, "utf8"));
  forgedRecord.attempts[1].observation.checks.interactionWorking = false;
  await writeFile(forgedPath, JSON.stringify(sealCheckpoint(forgedRecord)));
  const forged = await reconcileRecoveryReadOnly({
    evidenceDirectory: forgedDir, goal, originalPrompt: goal, browser,
  });
  assert.equal(forged.status, "HOLD_RECONCILIATION_REQUIRED");
  assert.equal(forged.reason, "INCONSISTENT_ATTEMPT_LINEAGE");

  const conflictingDir = join(dir, "conflicting");
  await cp(join(dir, "positive"), conflictingDir, { recursive: true });
  const conflictingPath = join(conflictingDir, "living-spe-recovery.json");
  const conflictingRecord = JSON.parse(await readFile(conflictingPath, "utf8"));
  conflictingRecord.qualification = "FAILED_BOUNDED_REPAIR";
  await writeFile(conflictingPath, JSON.stringify(sealCheckpoint(conflictingRecord)));
  const conflicting = await reconcileRecoveryReadOnly({
    evidenceDirectory: conflictingDir, goal, originalPrompt: goal, browser,
  });
  assert.equal(conflicting.reason, "QUALIFICATION_CONTRADICTS_OBSERVED_ATTEMPTS");

  const scopeDir = join(dir, "weakened-scope");
  await cp(join(dir, "positive"), scopeDir, { recursive: true });
  const scopePath = join(scopeDir, "living-spe-recovery.json");
  const scopeRecord = JSON.parse(await readFile(scopePath, "utf8"));
  scopeRecord.acceptance.selectors = ["#spe-app"];
  await writeFile(scopePath, JSON.stringify(sealCheckpoint(scopeRecord)));
  const scopeVerdict = await reconcileRecoveryReadOnly({
    evidenceDirectory: scopeDir, goal, originalPrompt: goal, browser,
  });
  assert.equal(scopeVerdict.reason, "FROZEN_ACCEPTANCE_CONTRACT_MISMATCH");

  const noBrowser = await reconcileRecoveryReadOnly({
    evidenceDirectory: join(dir, "positive"), goal, originalPrompt: goal,
  });
  assert.equal(noBrowser.reason, "INDEPENDENT_BROWSER_REQUIRED");

  console.log("PASS R3: independent fresh-browser replay; no implicit provider or retry authority");
  console.log("PASS R3: tampered HTML, fake goal, and forged self-resealed observation held");


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
