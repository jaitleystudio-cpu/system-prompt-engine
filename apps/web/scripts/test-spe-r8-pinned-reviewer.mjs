#!/usr/bin/env node
/** R8: real R4 signature -> Python canonical .spe -> WebCrypto -> Studio UI.
 * CI EPHEMERAL KEY IS NOT A PRODUCTION TRUST ROOT. No model calls.
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import esbuild from "esbuild";
import { reviewRecoveryAndSign, getR4HarnessDigest } from "./spe-recovery-receipt.mjs";
import { verifyR8ReceiptForSpe } from "../src/website-studio/recovery/trustedReceiptReview.ts";

const sourceFile = process.env.SPE_R8_CANONICAL_FIXTURE;
const evidenceDirectory = process.env.SPE_R8_BROWSER_EVIDENCE_DIR;
if (!sourceFile || !evidenceDirectory) throw new Error("R8_REQUIRES_CANONICAL_SPE_AND_R0_OBSERVATIONS");
const raw = await readFile(sourceFile, "utf8");
const spe = JSON.parse(raw);
assert.match(spe.execution_record.checkpoint_digest, /^sha256:[0-9a-f]{64}$/);
const reviewer = generateKeyPairSync("ed25519");
const keyId = "r8-ci-independent-reviewer";
const audience = "spe-r8-studio-review";
const operationId = "r8-fixture-operation";
const dir = await mkdtemp(join(tmpdir(), "spe-r8-trust-"));
const browser = await chromium.launch({ headless: true });
try {
  const issuanceTime = new Date();
  const outcome = await reviewRecoveryAndSign({
    evidenceDirectory,
    browser,
    goal: spe.user_request,
    originalPrompt: spe.rendered_prompt,
    reviewerPrivateKey: reviewer.privateKey,
    reviewerKeyId: keyId,
    audience,
    operationId,
    now: issuanceTime,
  });
  assert.equal(outcome.disposition, "REVIEW_ONLY_SIGNED_BROWSER_REPLAY");
  assert.ok(outcome.receipt && outcome.reconciliation.browserReplay.passed);
  const signedRaw = JSON.stringify(outcome.receipt);
  const pin = Object.freeze({
    reviewerKeyId: keyId,
    reviewerPublicKeySpkiBase64: reviewer.publicKey.export({
      type: "spki", format: "der",
    }).toString("base64"),
    audience,
    operationId,
    harnessDigest: await getR4HarnessDigest(),
    browserVersion: browser.version(),
  });
  const verified = await verifyR8ReceiptForSpe(raw, signedRaw, pin, issuanceTime);
  assert.equal(verified.state, "SIGNATURE_VALID_REVIEW_ONLY", verified.reason);
  for (const key of ["authority", "modelIdentityProven", "providerOutcomeProven",
    "browserExecutedByStudio", "retryAuthorized", "deploymentAuthorized"]) {
    assert.ok(key === "authority" ? verified[key] === "NONE" : verified[key] === false);
  }
  const rejectCases = {
    noHostPin: [raw, signedRaw, undefined, issuanceTime],
    wrongReviewerKey: [raw, signedRaw, { ...pin,
      reviewerPublicKeySpkiBase64: generateKeyPairSync("ed25519").publicKey
        .export({ type: "spki", format: "der" }).toString("base64") }, issuanceTime],
    wrongAudience: [raw, signedRaw, { ...pin, audience: "another-tenant-audience" }, issuanceTime],
    wrongOperation: [raw, signedRaw, { ...pin, operationId: "another-operation" }, issuanceTime],
    stale: [raw, signedRaw, pin, new Date(issuanceTime.getTime() + 3600000)],
    futureReceipt: [raw, signedRaw, pin, new Date(issuanceTime.getTime() - 60000)],
    wrongHarness: [raw, signedRaw, { ...pin, harnessDigest: "sha256:" + "0".repeat(64) }, issuanceTime],
    wrongBrowser: [raw, signedRaw, { ...pin, browserVersion: "forged-browser-v0" }, issuanceTime],
    forgedCheckpoint: [JSON.stringify({
      ...spe, execution_record: {
        ...spe.execution_record, checkpoint_digest: "sha256:" + "0".repeat(64),
      },
    }), signedRaw, pin, issuanceTime],
    forgedGoal: [JSON.stringify({ ...spe, user_request: "different goal" }),
      signedRaw, pin, issuanceTime],
    forgedPrompt: [JSON.stringify({ ...spe, rendered_prompt: "different compiled prompt" }),
      signedRaw, pin, issuanceTime],
    forgedCandidate: [JSON.stringify({ ...spe, execution_record: {
      ...spe.execution_record,
      browser_passed_artifact_digest: "sha256:" + "0".repeat(64),
      attempts: [
        ...spe.execution_record.attempts.slice(0, -1),
        { ...spe.execution_record.attempts.at(-1),
          candidate_digest: "sha256:" + "0".repeat(64) },
      ],
    }}), signedRaw, pin, issuanceTime],
    forgedSignature: [raw, JSON.stringify({
      ...outcome.receipt, signatureBase64: "A".repeat(86) + "==",
    }), pin, issuanceTime],
    unsignedClaim: [raw, JSON.stringify({ signed: outcome.receipt.signed }),
      pin, issuanceTime],
    wrongProvenance: [JSON.stringify({
      ...spe, execution_record: {
        ...spe.execution_record, model_provenance_claim: "EXTERNAL_COMMAND_UNATTESTED",
      },
    }), signedRaw, pin, issuanceTime],
    noCheckpoint: [JSON.stringify({
      ...spe, execution_record: {
        ...spe.execution_record, checkpoint_digest: undefined,
      },
    }), signedRaw, pin, issuanceTime],
  };
  for (const [label, args] of Object.entries(rejectCases)) {
    const denial = await verifyR8ReceiptForSpe(...args);
    assert.equal(denial.state, "UNVERIFIED_HOLD", label + ":" + denial.reason);
    assert.equal(denial.deploymentAuthorized, false, label);
  }
  console.log("PASS R8: valid R4 signature verified by browser WebCrypto against pinned reviewer SPKI");
  console.log("PASS R8: 16 stale/forged/mismatched/no-root receipts denied, no execution authority");

  // Mount actual Studio under CI-only build-pinned reviewer policy.
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const compiled = join(dir, "studio.js");
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [join(root, "scripts/spe-r8-studio-test-entry.tsx")],
    bundle: true, format: "iife", outfile: compiled, jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"production"',
      "__SPE_R8_TEST_TRUST__": JSON.stringify(pin),
    },
    loader: { ".css": "empty" },
  });
  const css = await readFile(join(root, "src/website-studio/studio.css"), "utf8");
  const html = join(dir, "studio.html");
  await writeFile(html, [
    '<!doctype html><html><head><meta charset="utf-8"><style>', css,
    '</style></head><body><div id="root"></div>',
    '<script src="' + pathToFileURL(compiled).href + '"></script></body></html>',
  ].join(""));
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route("**/*", route => {
    if (route.request().url().startsWith("file:")) return route.continue();
    return route.abort("blockedbyclient");
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(pathToFileURL(html).href, { waitUntil: "domcontentloaded" });
  await page.getByTestId("spe-recovery-evidence-panel").waitFor({ timeout: 10000 });
  await page.getByTestId("spe-recovery-import").setInputFiles({
    name: "recovery.spe", mimeType: "application/json", buffer: Buffer.from(raw),
  });
  await page.getByTestId("spe-recovery-review-details").waitFor();
  await page.getByTestId("spe-r8-receipt-import").setInputFiles({
    name: "replay.json", mimeType: "application/json", buffer: Buffer.from(signedRaw),
  });
  const verdict = page.getByTestId("spe-r8-verdict");
  await verdict.waitFor();
  await assert.doesNotReject(verdict.getByText(/SIGNED BROWSER REPLAY VERIFIED/).waitFor());
  assert.match(await verdict.textContent(), /NOT AI PROVIDER PROOF/);
  assert.equal(await page.getByTestId("spe-r8-no-trust").count(), 0);

  const forgedRaw = JSON.stringify({
    ...outcome.receipt, signatureBase64: "A".repeat(86) + "==",
  });
  await page.getByTestId("spe-r8-receipt-import").setInputFiles({
    name: "forged.json", mimeType: "application/json", buffer: Buffer.from(forgedRaw),
  });
  await page.getByTestId("spe-r8-verdict").getByText(/UNVERIFIED HOLD/).waitFor();
  assert.equal(await page.getByTestId("website-studio").count(), 1);
  assert.deepEqual(errors, [], "trusted-review display should not throw page errors");
  await ctx.close();
  console.log("PASS R8: real Studio shows verified scoped signature, forged receipt returns HOLD");
  console.log("PROOF_SCOPE: CI_EPHEMERAL_PIN_NOT_PRODUCTION_TRUST_ROOT_NO_LIVE_AI");
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
