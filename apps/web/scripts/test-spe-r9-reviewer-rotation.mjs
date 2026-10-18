#!/usr/bin/env node
/**
 * SPE R9 acceptance: local test-only root key, real R4 browser evidence,
 * offline-root policy signature, monotonic host pin and reviewer rotation.
 * No production root, provider, network egress, retry or deployment.
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as nodeSign, createHash } from "node:crypto";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import esbuild from "esbuild";
import { reviewRecoveryAndSign, getR4HarnessDigest } from "./spe-recovery-receipt.mjs";
import {
  canonicalR9SignedPolicy, verifyR9ReceiptForSpe,
} from "../src/website-studio/recovery/reviewerTrustPolicy.ts";

const sourceFile = process.env.SPE_R9_CANONICAL_FIXTURE;
const evidenceDirectory = process.env.SPE_R9_BROWSER_EVIDENCE_DIR;
if (!sourceFile || !evidenceDirectory) throw new Error("MISSING_R9_BROWSER_EVIDENCE_OR_CANONICAL_SPE");
const speText = await readFile(sourceFile, "utf8");
const spe = JSON.parse(speText);
const keys = { root: generateKeyPairSync("ed25519"),
  old: generateKeyPairSync("ed25519"), next: generateKeyPairSync("ed25519"),
  attacker: generateKeyPairSync("ed25519") };
const spki = k => k.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const sha = s => "sha256:" + createHash("sha256").update(s).digest("hex");
const policyId = "spe-r9-test-recovery-reviewers";
const audience = "spe-r9-studio-review";
const operationId = "spe-r9-rotation-fixture";
const now = new Date();
const validFrom = new Date(now.getTime() - 60000).toISOString();
const validUntil = new Date(now.getTime() + 24 * 3600000).toISOString();
const reviewer = (id, key, status) => ({
  keyId: id, publicSpkiBase64: spki(key), status,
  validFrom, validUntil,
});
const oldId = "spe-r9-reviewer-old", newId = "spe-r9-reviewer-new";
const makePolicy = ({ epoch, previousPolicyDigest, reviewers, root = keys.root }) => {
  const signed = {
    schema: "spe.reviewer-trust-policy.v1", policyId, audience,
    epoch, previousPolicyDigest, validFrom, validUntil, reviewers,
  };
  const canonical = canonicalR9SignedPolicy(signed);
  return {
    raw: JSON.stringify({
      signed, signatureAlgorithm: "Ed25519",
      signatureBase64: nodeSign(null, Buffer.from(canonical), root.privateKey).toString("base64"),
    }),
    digest: sha(canonical),
  };
};
const first = makePolicy({ epoch: 1, previousPolicyDigest: null,
  reviewers: [reviewer(oldId, keys.old, "ACTIVE")] });
const rotated = makePolicy({ epoch: 2, previousPolicyDigest: first.digest,
  reviewers: [
    reviewer(oldId, keys.old, "REVOKED"),
    reviewer(newId, keys.next, "ACTIVE"),
  ] });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
assert.ok(Number(browser.version().split(".")[0]) >= 137);
const dir = await mkdtemp(join(tmpdir(), "spe-r9-review-"));
try {
  const harnessDigest = await getR4HarnessDigest();
  const common = {
    policyId, audience, operationId, harnessDigest,
    browserVersion: browser.version(),
    offlineRootPublicSpkiBase64: spki(keys.root),
  };
  const firstAnchor = Object.freeze({
    ...common, currentSignedPolicyDigest: first.digest,
    requiredPredecessorDigest: null, minimumEpoch: 1,
  });
  const secondAnchor = Object.freeze({
    ...common, currentSignedPolicyDigest: rotated.digest,
    requiredPredecessorDigest: first.digest, minimumEpoch: 2,
  });
  const issue = async (id, privateKey) => {
    const result = await reviewRecoveryAndSign({
      evidenceDirectory, browser, goal: spe.user_request,
      originalPrompt: spe.rendered_prompt, reviewerPrivateKey: privateKey,
      reviewerKeyId: id, audience, operationId, now,
    });
    assert.equal(result.disposition, "REVIEW_ONLY_SIGNED_BROWSER_REPLAY");
    return JSON.stringify(result.receipt);
  };
  const oldReceipt = await issue(oldId, keys.old.privateKey);
  const newReceipt = await issue(newId, keys.next.privateKey);
  const check = (receipt, policy, anchor, at = now) =>
    verifyR9ReceiptForSpe(speText, receipt, policy.raw, anchor, at);
  const oldBefore = await check(oldReceipt, first, firstAnchor);
  assert.equal(oldBefore.state, "SIGNATURE_VALID_REVIEW_ONLY", oldBefore.reason);
  const newAfter = await check(newReceipt, rotated, secondAnchor);
  assert.equal(newAfter.state, "SIGNATURE_VALID_REVIEW_ONLY", newAfter.reason);
  assert.equal(newAfter.authority, "NONE");
  assert.equal(newAfter.retryAuthorized, false);
  assert.equal(newAfter.deploymentAuthorized, false);
  assert.equal(newAfter.providerOutcomeProven, false);
  const revoked = await check(oldReceipt, rotated, secondAnchor);
  assert.equal(revoked.state, "UNVERIFIED_HOLD");
  assert.equal(revoked.reason, "REVIEWER_KEY_REVOKED");

  const tamperSigned = (policy, patch) => {
    const p = JSON.parse(policy.raw);
    patch(p);
    return { raw: JSON.stringify(p), digest: policy.digest };
  };
  const rogueRoot = makePolicy({
    epoch: 2, previousPolicyDigest: first.digest,
    reviewers: [reviewer(newId, keys.next, "ACTIVE")],
    root: keys.attacker,
  });
  const negative = {
    noAnchor: [newReceipt, rotated, undefined, now],
    rollbackOldPolicy: [oldReceipt, first, secondAnchor, now],
    wrongRootPin: [newReceipt, rotated, { ...secondAnchor,
      offlineRootPublicSpkiBase64: spki(keys.attacker) }, now],
    replacedPolicyDigest: [newReceipt, rotated, { ...secondAnchor,
      currentSignedPolicyDigest: sha("another policy") }, now],
    lowerEpoch: [newReceipt, rotated, { ...secondAnchor, minimumEpoch: 3 }, now],
    predecessorMismatch: [newReceipt, rotated, { ...secondAnchor,
      requiredPredecessorDigest: sha("not its predecessor") }, now],
    changedAudience: [newReceipt, rotated, { ...secondAnchor, audience: "another-audience" }, now],
    changedOperation: [newReceipt, rotated, { ...secondAnchor,
      operationId: "another-operation" }, now],
    futureClock: [newReceipt, rotated, secondAnchor,
      new Date(now.getTime() - 3600000)],
    expiredPolicy: [newReceipt, rotated, secondAnchor,
      new Date(now.getTime() + 2 * 86400000)],
    revokedOldReceipt: [oldReceipt, rotated, secondAnchor, now],
    unknownKey: [newReceipt, first, firstAnchor, now],
    tamperedPolicy: [newReceipt, tamperSigned(rotated,
      p => { p.signed.reviewers[1].publicSpkiBase64 = spki(keys.attacker); }),
      secondAnchor, now],
    tamperedRootSignature: [newReceipt, tamperSigned(rotated,
      p => { p.signatureBase64 = "A".repeat(86) + "=="; }),
      secondAnchor, now],
    duplicateKeyId: [newReceipt, tamperSigned(rotated,
      p => { p.signed.reviewers[0].keyId = newId; }), secondAnchor, now],
    duplicateKeyMaterial: [newReceipt, tamperSigned(rotated,
      p => { p.signed.reviewers[0].publicSpkiBase64 = spki(keys.next); }), secondAnchor, now],
    expiredReviewer: [newReceipt, tamperSigned(rotated,
      p => { p.signed.reviewers[1].validUntil = validFrom; }), secondAnchor, now],
    noReceipt: ["{}", rotated, secondAnchor, now],
    malformedPolicy: [newReceipt, { raw: '{"bad":true}' }, secondAnchor, now],
    adversarialSelfSigned: [newReceipt, rogueRoot, secondAnchor, now],
  };
  for (const [label, [receipt, policy, anchor, time]] of Object.entries(negative)) {
    const result = await verifyR9ReceiptForSpe(speText, receipt, policy.raw, anchor, time);
    assert.equal(result.state, "UNVERIFIED_HOLD", label + ": " + result.reason);
    assert.equal(result.authority, "NONE", label);
    assert.equal(result.retryAuthorized, false, label);
    assert.equal(result.deploymentAuthorized, false, label);
  }
  console.log("PASS R9: offline-root signed policy, epoch-1 reviewer, epoch-2 rotated reviewer");
  console.log("PASS R9: revoked prior reviewer held; 20 mutation/rollback/trust-root attacks held");

  // Mount actual React Studio with HOST-PINNED root+epoch policy. No user key
  // can independently create a trusted root through a file upload.
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const bundle = join(dir, "studio-r9.js");
  await esbuild.build({
    absWorkingDir: webRoot,
    entryPoints: [join(webRoot, "scripts/spe-r9-studio-test-entry.tsx")],
    bundle: true, format: "iife", outfile: bundle, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"',
      "__SPE_R9_CI_ANCHOR__": JSON.stringify(secondAnchor) },
    loader: { ".css": "empty" },
  });
  const html = join(dir, "studio-r9.html");
  const css = await readFile(join(webRoot, "src/website-studio/studio.css"), "utf8");
  await writeFile(html, '<!doctype html><html><head><meta charset="utf-8"><style>' + css +
    '</style></head><body><div id="root"></div><script src="' +
    pathToFileURL(bundle).href + '"></script></body></html>');
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.route("**/*", route =>
    route.request().url().startsWith("file:") ? route.continue() : route.abort("blockedbyclient"));
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", e => runtimeErrors.push(e.message));
  await page.goto(pathToFileURL(html).href, { waitUntil: "domcontentloaded" });
  await page.getByTestId("spe-recovery-evidence-panel").waitFor();
  const initialSite = await page.evaluate(() => JSON.stringify(window.__studioState.spec));
  const file = (testId, name, raw) => page.getByTestId(testId).setInputFiles({
    name, mimeType: "application/json", buffer: Buffer.from(raw),
  });
  await file("spe-recovery-import", "recovered.spe", speText);
  await page.getByTestId("spe-recovery-review-details").waitFor();
  await file("spe-r8-receipt-import", "new-reviewer.json", newReceipt);
  assert.equal(await page.getByTestId("spe-r8-verdict").count(), 0,
    "Uploading receipt alone must not create trusted verification under R9");
  await file("spe-r9-policy-import", "current-policy.json", rotated.raw);
  const verdict = page.getByTestId("spe-r8-verdict");
  await verdict.waitFor();
  assert.match(await verdict.textContent(), /HOST-ANCHORED CURRENT POLICY/);
  assert.match(await verdict.textContent(), /NOT AI PROVIDER PROOF/);
  await file("spe-r8-receipt-import", "revoked-reviewer.json", oldReceipt);
  // onReceipt clears policy, so re-supply the signed current policy.
  await file("spe-r9-policy-import", "current-policy-again.json", rotated.raw);
  const hold = await verdict.textContent();
  assert.match(hold, /UNVERIFIED HOLD · REVIEWER_KEY_REVOKED/);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__studioState.spec)), initialSite);
  assert.deepEqual(runtimeErrors, []);
  await context.close();
  console.log("PASS R9: real Studio verifies current reviewer, revokes old, leaves website untouched");
  console.log("PROOF_SCOPE: EPHEMERAL_CI_ROOT_NOT_PRODUCTION_OR_PROVIDER_ATTESTATION");
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
