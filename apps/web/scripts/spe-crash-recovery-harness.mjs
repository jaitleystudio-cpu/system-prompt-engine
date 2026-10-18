/**
 * SPE Ω R0 acceptance harness, not a replacement semantic compiler.
 * Precompiled prompt -> model adapter -> HTML -> real Chromium observation ->
 * evidence-bound Prompt V2 -> model adapter -> real Chromium verification.
 *
 * No production deployment, no self-certifying model identities or outputs.
 * Chromium isolation is NOT an OS-grade sandbox for hostile HTML.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  startExclusiveRecovery, finishExclusiveRecovery, persistRecoveryCheckpoint,
} from "./spe-recovery-journal-custody.mjs";

export const TEST_SCOPE = Object.freeze({
  selectors: ["#spe-app", "canvas#spe-stage", "#spe-interact"],
  interaction: "click increments window.speInteractionCount",
  errors: "zero page exceptions and relevant console errors in test window",
  network: "all browser requests blocked",
});
const sha = value => "sha256:" + createHash("sha256").update(value).digest("hex");
const clip = (text, cap = 1200) => String(text ?? "").slice(0, cap);
const redact = value => clip(value).replace(
  /(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{16,}|Bearer\s+[A-Za-z0-9._-]+)/g, "[REDACTED]"
);

export function compileEvidenceBoundRepairPrompt({ goal, originalPrompt, observed }) {
  assert.equal(typeof goal, "string");
  assert.ok(goal.trim() && observed?.candidateDigest && Array.isArray(observed.errors));
  if (observed.passed || observed.errors.length === 0)
    throw new Error("NO_OBSERVED_FAILURE_FOR_CAUSAL_REPAIR");
  const errorText = observed.errors.map(redact).join("\n");
  const missing = errorText.match(/\bReferenceError:\s*([A-Za-z_$][\w$]*) is not defined\b/);
  const diagnosis = missing
    ? "Observed undefined identifier " + missing[1] + "; inspect its definition, import and call site."
    : "Root cause NOT PROVEN: inspect observed diagnostics, do not invent a cause.";
  const constraints = [
    missing
      ? "MUST NOT reference " + missing[1] + " without a valid definition or import in scope."
      : "MUST NOT suppress the observed error or substitute unrelated components.",
    "MUST NOT remove the app, stage/canvas or interaction to hide the error.",
    "MUST NOT weaken frozen acceptance checks or change the original human goal.",
    "MUST NOT claim success without independent browser execution evidence.",
    "MUST NOT add external network dependencies or unauthorized privileges.",
    "Prefer a minimal, causally justified change preserving existing working behavior.",
  ];
  const prompt = [
    "SPE Ω — EVIDENCE-BOUND REPAIR / R0",
    "ORIGINAL PROTECTED GOAL:\n" + goal,
    "ORIGINAL PROMPT SHA256: " + sha(originalPrompt),
    "FAILED CANDIDATE DIGEST: " + observed.candidateDigest,
    "ACTUAL BROWSER ERRORS:\n" + errorText,
    "CAUSAL HYPOTHESIS:\n" + diagnosis,
    "TARGETED NEGATIVE CONSTRAINTS:\n" +
      constraints.map((x, i) => String(i + 1) + ". " + x).join("\n"),
    "FROZEN ACCEPTANCE: standalone HTML, #spe-app, canvas#spe-stage, #spe-interact; clicking increments window.speInteractionCount; no exceptions or console errors.",
    "RETURN JSON containing a single html string; no Markdown fences.",
  ].join("\n\n");
  return { prompt, diagnosis, constraints, sourceCandidateDigest: observed.candidateDigest };
}

export async function inspectCandidateInBrowser(browser, html) {
  if (typeof html !== "string" || !html.length || html.length > 150_000)
    throw new Error("INVALID_HTML_ARTIFACT_SIZE");
  const candidateDigest = sha(html);
  const context = await browser.newContext({
    serviceWorkers: "block", permissions: [], javaScriptEnabled: true,
  });
  await context.route("**/*", route => route.abort("blockedbyclient"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(redact(err?.stack || err?.message || err)));
  page.on("console", msg => { if (msg.type() === "error") errors.push(redact(msg.text())); });
  page.on("requestfailed", req => {
    if (req.url() !== "about:blank") errors.push("NETWORK_DENIED:" + clip(req.url(), 180));
  });
  let checks = { applicationVisible: false, canvasVisible: false, interactionWorking: false };
  let screenshotDigest = null;
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 5000 });
    await page.waitForTimeout(150);
    checks.applicationVisible = await page.locator("#spe-app").isVisible();
    checks.canvasVisible = await page.locator("canvas#spe-stage").evaluate(el =>
      el.getBoundingClientRect().width > 0 &&
      el.getBoundingClientRect().height > 0 && el.width > 0 && el.height > 0
    ).catch(() => false);
    if (checks.applicationVisible && checks.canvasVisible) {
      const before = await page.evaluate(() => Number(window.speInteractionCount || 0));
      await page.locator("#spe-interact").click({ timeout: 2000 });
      await page.waitForTimeout(80);
      const after = await page.evaluate(() => Number(window.speInteractionCount || 0));
      checks.interactionWorking = after > before;
    }
    screenshotDigest = sha(await page.screenshot({ timeout: 3000 }));
  } catch (err) {
    errors.push(redact(err?.message || err));
  } finally {
    await context.close();
  }
  const unmet = Object.entries(checks)
    .filter(([, value]) => !value).map(([name]) => "ACCEPTANCE_FAILED:" + name);
  return {
    candidateDigest, screenshotDigest, checks,
    errors: [...errors, ...unmet],
    passed: errors.length === 0 && unmet.length === 0,
    testScope: TEST_SCOPE,
    evidenceKind: "REAL_EPHEMERAL_CHROMIUM_OBSERVATION",
  };
}

export async function runCrashRecovery({
  goal, originalPrompt, generate, provenance, browser, evidenceDirectory,
}) {
  if (typeof goal !== "string" || !goal.trim() || typeof originalPrompt !== "string")
    throw new Error("INVALID_PROTECTED_GOAL");
  if (typeof generate !== "function") throw new Error("MISSING_MODEL_ADAPTER");
  if (!["FIXTURE", "EXTERNAL_COMMAND_UNATTESTED"].includes(provenance))
    throw new Error("UNRECOGNIZED_PROVENANCE");
  if (!evidenceDirectory) throw new Error("MISSING_EVIDENCE_DIRECTORY");
  const record = {
    schema: "spe.live_crash_recovery.acceptance.v0",
    protectedGoal: goal, protectedGoalDigest: sha(goal),
    initialPromptDigest: sha(originalPrompt), provenance,
    qualification: "UNQUALIFIED", attempts: [], repair: null,
    artifactDigest: null, acceptance: TEST_SCOPE,
    phaseStatus: "INITIAL_DISPATCHING",
  };
  // A previous run or orphaned lock must be reconciled, never silently replayed.
  const lock = await startExclusiveRecovery(evidenceDirectory);
  const persist = async () => {
    const sealed = await persistRecoveryCheckpoint(evidenceDirectory, record);
    record.checkpointDigest = sealed.checkpointDigest;
  };
  const attempt = async (phase, prompt) => {
    record.phaseStatus = phase + "_DISPATCHING";
    record.pendingPhase = phase;
    record.pendingPromptDigest = sha(prompt);
    await persist(); // Durable before an external model can receive a request.
    const response = await generate({
      phase, prompt, protectedGoalDigest: record.protectedGoalDigest,
    });
    if (!response || typeof response.html !== "string") throw new Error("MODEL_DID_NOT_RETURN_HTML");
    record.phaseStatus = phase + "_OUTPUT_RETURNED";
    record.pendingCandidateDigest = sha(response.html);
    await persist(); // Output returned, but browser outcome remains unverified.
    const observed = await inspectCandidateInBrowser(browser, response.html);
    record.attempts.push({
      phase, promptDigest: sha(prompt),
      modelClaim: clip(response.model || "UNVERIFIED", 120),
      providerRequestIdClaim: clip(response.requestId || "UNVERIFIED", 120),
      observation: observed,
    });
    record.artifactDigest = observed.candidateDigest;
    record.phaseStatus = phase + "_BROWSER_OBSERVED";
    delete record.pendingCandidateDigest;
    delete record.pendingPhase;
    delete record.pendingPromptDigest;
    if (observed.passed) {
      // Persist exactly the browser-tested bytes. A model-supplied success
      // message cannot cause an artifact to be marked browser-passed.
      await mkdir(evidenceDirectory, { recursive: true });
      const file = "browser-passed-" + observed.candidateDigest.slice(7, 23) + ".html";
      await writeFile(join(evidenceDirectory, file), response.html, { mode: 0o600 });
      record.browserPassedArtifact = { file, digest: observed.candidateDigest };
    }
    await persist();
    return observed;
  };
  try {
    const initial = await attempt("INITIAL", originalPrompt);
    if (initial.passed) {
      record.qualification = provenance === "FIXTURE"
        ? "FIXTURE_PASS_NOT_LIVE" : "BROWSER_PASS_PROVIDER_UNATTESTED";
    } else {
      record.repair = compileEvidenceBoundRepairPrompt({
        goal, originalPrompt, observed: initial,
      });
      record.phaseStatus = "REPAIR_PREPARED";
      await persist();
      const repaired = await attempt("REPAIR", record.repair.prompt);
      record.qualification = repaired.passed
        ? (provenance === "FIXTURE" ? "FIXTURE_REPAIRED_NOT_LIVE"
          : "BROWSER_REPAIRED_PROVIDER_UNATTESTED")
        : "FAILED_BOUNDED_REPAIR";
    }
    record.phaseStatus = "FINISHED";
  } catch (err) {
    record.qualification = "INCONCLUSIVE_EXCEPTION";
    record.error = redact(err?.message || err);
    record.phaseStatus = "INCONCLUSIVE";
  } finally {
    await persist();
    await finishExclusiveRecovery(lock);
  }
  return record;
}
