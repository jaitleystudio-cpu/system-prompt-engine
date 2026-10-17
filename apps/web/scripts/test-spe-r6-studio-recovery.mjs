#!/usr/bin/env node
/** R6: fixture-only Studio review. No model calls, code execution or deploy. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import esbuild from "esbuild";
import { parseRecoverySpeForReview } from "../src/website-studio/recovery/recoveryReview.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const hash = text => "sha256:" + createHash("sha256").update(text).digest("hex");
const goal = "Build an interactive canvas without removing the original website layout.";
const initial = hash("broken app"), repaired = hash("corrected app");
const fixture = () => ({
  spe_format: "spe.artifact.v2",
  user_request: goal,
  rendered_prompt: "Precompiled and frozen goal",
  intent: { goal },
  integrity: { state: "UNTRUSTED_IMPORT_DO_NOT_ELEVATE" },
  execution_record: {
    schema: "spe.execution.browser-recovery-bridge.v0",
    disposition: "REVIEW_ONLY_UNATTESTED",
    execution_authority: "NONE",
    source_kind: "SELF_REPORTED_BROWSER_HARNESS",
    model_provenance_claim: "FIXTURE",
    qualification_claim: "FIXTURE_REPAIRED_NOT_LIVE",
    manifest_digest: hash("manifest"),
    browser_passed_artifact_digest: repaired,
    attempts: [
      { phase: "INITIAL", prompt_digest: hash("Prompt V1"), candidate_digest: initial,
        browser_pass_claim: false, observed_error_count: 1 },
      { phase: "REPAIR", prompt_digest: hash("Prompt V2"), candidate_digest: repaired,
        browser_pass_claim: true, observed_error_count: 0 },
    ],
    known_limitations: ["No independent browser attestation", "No authenticated model-provider identity"],
  },
});
const valid = JSON.stringify(fixture());
const parsed = parseRecoverySpeForReview(valid);
assert.equal(parsed.authority, "NONE");
assert.equal(parsed.independentVerification, "NOT_PERFORMED_BY_STUDIO");
assert.equal(parsed.projectBinding, "NOT_BOUND_TO_ACTIVE_SITE");
assert.equal(parsed.repairPromptAvailable, false);
assert.equal(parsed.attempts.length, 2);
assert.equal(parsed.attempts[1].browserPassClaim, true);

const attacks = {
  fakeAuthority: f => { f.execution_record.execution_authority = "ALLOW_DEPLOY"; },
  fakeSource: f => { f.execution_record.source_kind = "PRODUCTION_AUTHORITY"; },
  fakeProof: f => { f.execution_record.qualification_claim = "LIVE_VERIFIED"; },
  fakeModel: f => { f.execution_record.model_provenance_claim = "AUTHORIZED_PROVIDER"; },
  wrongHash: f => { f.execution_record.browser_passed_artifact_digest = initial; },
  falseErrorPass: f => { f.execution_record.attempts[1].observed_error_count = 5; },
  fakeSuccess: f => { f.execution_record.attempts[1].browser_pass_claim = false; },
  reorderedAttempts: f => { f.execution_record.attempts.reverse(); },
  extraAttempt: f => { f.execution_record.attempts.push(f.execution_record.attempts[1]); },
  changedQualification: f => { f.execution_record.qualification_claim = "FAILED_BOUNDED_REPAIR"; },
  missingCanonicalIntent: f => { delete f.intent; },
  incorrectFormat: f => { f.spe_format = "spe-site/1"; },
  removedLimitations: f => { delete f.execution_record.known_limitations; },
};
for (const [label, attack] of Object.entries(attacks)) {
  const data = fixture();
  attack(data);
  assert.throws(() => parseRecoverySpeForReview(JSON.stringify(data)), undefined, label);
}
assert.throws(() => parseRecoverySpeForReview("{oops"), /NOT_VALID_JSON/);
assert.throws(() => parseRecoverySpeForReview("A".repeat(257_000)), /TOO_LARGE/);
console.log("PASS R6: canonical-only, bounded, non-authoritative .spe parsing");
console.log("PASS R6: 13 forged/corrupt variants rejected");

const temp = await mkdtemp(join(tmpdir(), "spe-r6-studio-"));
const browser = await chromium.launch({ headless: true });
try {
  const compiled = join(temp, "studio.js");
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [join(here, "studio-browser-harness-entry.tsx")],
    bundle: true, format: "iife", outfile: compiled, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty" },
  });
  const html = join(temp, "studio.html");
  const css = await readFile(join(root, "src/website-studio/studio.css"), "utf8");
  await writeFile(html,
    '<!doctype html><html><head><meta charset="utf-8"><style>' + css +
    '</style></head><body><div id="root"></div>' +
    '<script>window.__studioSurface="studio";</script><script src="' +
    pathToFileURL(compiled).href + '"></script></body></html>');
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route("**/*", route => {
    if (route.request().url().startsWith("file:")) return route.continue();
    return route.abort("blockedbyclient");
  });
  const page = await ctx.newPage();
  const browserErrors = [];
  page.on("pageerror", err => browserErrors.push(err.message));
  await page.goto(pathToFileURL(html).href, { waitUntil: "domcontentloaded" });
  await page.getByTestId("spe-recovery-evidence-panel").waitFor({ timeout: 10_000 });
  const activeSpecBefore = await page.evaluate(() => JSON.stringify(window.__studioState.spec));
  await page.getByTestId("spe-recovery-empty").waitFor();
  await page.getByTestId("spe-recovery-import").setInputFiles({
    name: "fixture.spe", mimeType: "application/json", buffer: Buffer.from(valid),
  });
  const info = page.getByTestId("spe-recovery-review-details");
  await info.waitFor();
  const copy = await info.textContent();
  assert.match(copy, /UNTRUSTED IMPORT/);
  assert.match(copy, /NOT PERFORMED/);
  assert.match(copy, /Not bound to active website/);
  assert.match(copy, /Reported browser checks passed/);
  assert.match(copy, /targeted constraints are not contained/i);
  assert.match(copy, /NO RETRY · NO DEPLOY/);
  assert.doesNotMatch(copy, /LIVE_VERIFIED|AUTHORIZED TO DEPLOY/);
  assert.equal(await page.getByTestId("website-studio").count(), 1);
  const activeSpecAfter = await page.evaluate(() => JSON.stringify(window.__studioState.spec));
  assert.equal(activeSpecAfter, activeSpecBefore,
    "Evidence import must not modify the active website or editor state");

  const xss = fixture();
  xss.user_request = '<img src=x onerror="window.__speInjected=1">';
  await page.getByTestId("spe-recovery-import").setInputFiles({
    name: "display-test.spe", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(xss)),
  });
  await info.waitFor();
  assert.match(await info.textContent(), /onerror/);
  assert.equal(await page.evaluate(() => window.__speInjected), undefined);
  assert.equal(await info.locator("img").count(), 0);

  await page.getByTestId("spe-recovery-import").setInputFiles({
    name: "invalid.spe", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ execution_record: { execution_authority: "ALLOW_DEPLOY" } })),
  });
  await page.getByTestId("spe-recovery-error").waitFor();
  assert.equal(await page.getByTestId("spe-recovery-review-details").count(), 0);
  await page.getByTestId("spe-recovery-import").setInputFiles({
    name: "huge.spe", mimeType: "application/json",
    buffer: Buffer.alloc(257_000, "x"),
  });
  assert.match(await page.getByTestId("spe-recovery-error").textContent(), /TOO_LARGE/);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__studioState.spec)),
    activeSpecBefore, "Rejected imports must not mutate the Studio website spec");
  assert.deepEqual(browserErrors, [], "Studio evidence viewer must not throw");
  await ctx.close();
  console.log("PASS R6: actual Studio Intelligence sidebar shows limited evidence claims");
  console.log("PASS R6: HTML escaped, invalid imports cleared, oversize rejected");
  console.log("PROOF_SCOPE: FIXTURE_ONLY_NO_PROVIDER_OR_EXECUTION_AUTHORITY");
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
