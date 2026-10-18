#!/usr/bin/env node
/** SPE R7: canonical Python .spe from real Chromium fixture → read-only Studio. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import esbuild from "esbuild";
import { parseRecoverySpeForReview } from "../src/website-studio/recovery/recoveryReview.ts";

const inputPath = process.env.SPE_R7_CANONICAL_FIXTURE;
if (!inputPath) throw new Error("MISSING_PYTHON_CANONICAL_SPE_FIXTURE");
const raw = await readFile(inputPath, "utf8");
const original = JSON.parse(raw);
const review = parseRecoverySpeForReview(raw);
assert.equal(review.authority, "NONE");
assert.equal(review.independentVerification, "NOT_PERFORMED_BY_STUDIO");
assert.equal(review.modelProvenanceClaim, "FIXTURE");
assert.equal(review.attempts.length, 2);
assert.equal(review.repairPromptAvailable, true);
assert.ok(review.repairTrace);
assert.equal(review.repairTrace.promptV2Text, original.execution_record.repair_trace.prompt_v2_text);
assert.match(review.repairTrace.causalHypothesis, /sceneConfig/);
assert.ok(review.repairTrace.targetedConstraints.some(s => s.includes("sceneConfig")));
assert.ok(review.attempts[0].diagnosticExcerpts.some(s => s.includes("ReferenceError")));
assert.equal(review.attempts[1].browserPassClaim, true);
assert.equal(review.projectBinding, "NOT_BOUND_TO_ACTIVE_SITE");

const tamperCases = {
  staleFailedCandidate: art => {
    art.execution_record.repair_trace.source_candidate_digest =
      "sha256:" + "0".repeat(64);
  },
  mismatchedPromptDigest: art => {
    art.execution_record.repair_trace.prompt_v2_digest =
      "sha256:" + "0".repeat(64);
  },
  forgedReleaseAuthority: art => {
    art.execution_record.repair_trace.execution_authority = "DEPLOY";
  },
  missingDiagnosisInText: art => {
    art.execution_record.repair_trace.causal_hypothesis = "Invented root cause";
  },
  missingConstraintInText: art => {
    art.execution_record.repair_trace.targeted_constraints.push("MUST NOT fake a receipt.");
  },
  oversizedPrompt: art => {
    art.execution_record.repair_trace.prompt_v2_text = "A".repeat(17000);
  },
  invalidTraceType: art => {
    art.execution_record.repair_trace = "I hereby declare victory";
  },
  contradictoryDiagnostics: art => {
    art.execution_record.attempts[1].diagnostic_excerpts = ["Not a clean render"];
  },
  forgedObservedCount: art => {
    art.execution_record.attempts[0].diagnostic_excerpts = Array(7).fill("error");
  },
};
for (const [label, change] of Object.entries(tamperCases)) {
  const art = structuredClone(original);
  change(art);
  assert.throws(() => parseRecoverySpeForReview(JSON.stringify(art)),
    undefined, "Rejected " + label);
}
const legacy = structuredClone(original);
legacy.execution_record.repair_trace = null;
for (const item of legacy.execution_record.attempts) {
  delete item.diagnostic_excerpts;
  delete item.diagnostics_truncated;
}
const olderView = parseRecoverySpeForReview(JSON.stringify(legacy));
assert.equal(olderView.repairPromptAvailable, false);
assert.equal(olderView.repairTrace, null);
console.log("PASS R7: Python-to-JS .spe trace import and 9 hostile trace mutations");
console.log("PASS R7: previous no-trace .spe records remain readable");

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const dir = await mkdtemp(join(tmpdir(), "spe-r7-studio-"));
const browser = await chromium.launch({ headless: true });
try {
  const js = join(dir, "studio.js");
  await esbuild.build({
    absWorkingDir: webRoot,
    entryPoints: [join(here, "studio-browser-harness-entry.tsx")],
    bundle: true, format: "iife", outfile: js, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty" },
  });
  const css = await readFile(join(webRoot, "src/website-studio/studio.css"), "utf8");
  const html = join(dir, "studio.html");
  await writeFile(html, [
    '<!doctype html><html><head><meta charset="utf-8"><style>', css,
    '</style></head><body><div id="root"></div>',
    '<script>window.__studioSurface="studio";</script>',
    '<script src="' + pathToFileURL(js).href + '"></script></body></html>',
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
  await page.getByTestId("spe-recovery-evidence-panel").waitFor({ timeout: 10_000 });
  const before = await page.evaluate(() => JSON.stringify(window.__studioState.spec));
  const upload = page.getByTestId("spe-recovery-import");
  await upload.setInputFiles({
    name: "real-browser-fixture.spe", mimeType: "application/json",
    buffer: Buffer.from(raw),
  });
  await page.getByTestId("spe-recovery-review-details").waitFor();
  const trace = page.getByTestId("spe-recovery-repair-trace");
  await trace.locator("summary").click();
  assert.match(await trace.textContent(), /sceneConfig/);
  assert.match(await trace.textContent(), /MUST NOT remove/);
  assert.equal((await page.getByTestId("spe-recovery-prompt-v2").textContent()).trim(),
    review.repairTrace.promptV2Text);
  const diagnostics = page.getByTestId("spe-recovery-errors-0");
  await diagnostics.locator("summary").click();
  assert.match(await diagnostics.textContent(), /ReferenceError/);
  assert.match(await page.getByTestId("spe-recovery-review-details").textContent(),
    /NO RETRY · NO DEPLOY/);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__studioState.spec)),
    before, "Read-only import must not change Website Studio spec");

  // Even when imported prompt includes markup, React must never execute it.
  const injected = structuredClone(original);
  const marker = '<img src=x onerror="window.__speR7Injected=1">';
  injected.execution_record.repair_trace.prompt_v2_text += "\n" + marker;
  await upload.setInputFiles({
    name: "untrusted-prompt.spe", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(injected)),
  });
  const trace2 = page.getByTestId("spe-recovery-repair-trace");
  await trace2.locator("summary").click();
  assert.match(await trace2.textContent(), /onerror/);
  assert.equal(await page.evaluate(() => window.__speR7Injected), undefined);
  assert.equal(await trace2.locator("img").count(), 0);
  assert.deepEqual(errors, [], "No Studio browser exceptions");
  await ctx.close();
  console.log("PASS R7: real Studio browser displays causal error and bounded Prompt V2 as inert text");
  console.log("PASS R7: website state unchanged, injected HTML not executed, zero model calls");
  console.log("PROOF_SCOPE: REAL_BROWSER_DETERMINISTIC_FIXTURE_NO_LIVE_AI");
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
