#!/usr/bin/env node
/**
 * Test Suite: Real Mathematical Visual Fidelity Comparator (RED PHASE)
 * Tests all 8 contract-mandated visual perturbation cases:
 *  1. IDENTICAL → SSIM >= 0.999, delta = 0.0%
 *  2. 1px translation → measurable deterioration (delta > 0, SSIM drops)
 *  3. text replacement → deterioration
 *  4. missing CTA → deterioration
 *  5. font-size change → deterioration
 *  6. background-color change → deterioration
 *  7. wrong viewport → REFUSE / incomparable (Error thrown)
 *  8. wrong DPR → REFUSE / incomparable (Error thrown)
 *
 * STRICTLY FORBIDDEN:
 *  - hard-coded 0.985
 *  - hard-coded 0.45
 *  - hash-equality substituted for SSIM
 *  - identical reference/candidate fixture as sole proof
 */

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { compareVisualBuffers, IncomparableViewportError, IncomparableDprError } from "../src/media/realVisualComparator.mjs";

const BASE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 24px; width: 320px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  h2 { margin: 0 0 8px 0; font-size: 1.25rem; }
  p { margin: 0 0 16px 0; color: #94a3b8; font-size: 0.875rem; }
  button { background: #3b82f6; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; width: 100%; font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <h2>System Prompt Engine</h2>
    <p>Offline zero-cost prompt compilation platform.</p>
    <button>Start Session</button>
  </div>
</body>
</html>`;

const VARIANTS = {
  // 1. Identical
  identical: BASE_HTML,

  // 2. 1px translation on the card
  translated1px: BASE_HTML.replace(".card {", ".card { transform: translate(1px, 0);"),

  // 3. Text replacement
  textReplacement: BASE_HTML.replace("System Prompt Engine", "Compromised Variant Core"),

  // 4. Missing CTA button
  missingCta: BASE_HTML.replace("<button>Start Session</button>", ""),

  // 5. Font size change
  fontSizeChange: BASE_HTML.replace("font-size: 1.25rem;", "font-size: 2.25rem;"),

  // 6. Background color change
  backgroundColorChange: BASE_HTML.replace("background: #0f172a;", "background: #7f1d1d;"),
};

async function runTestSuite() {
  console.log("=== A12-R: REAL MATHEMATICAL VISUAL COMPARATOR TEST SUITE ===");

  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });

  const width = 1280;
  const height = 800;

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1.0,
  });

  const page = await context.newPage();

  // Helper to render HTML and capture screenshot buffer
  async function capture(html, customViewport = { width, height }, customDpr = 1.0) {
    const ctx = (customViewport.width !== width || customViewport.height !== height || customDpr !== 1.0)
      ? await browser.newContext({ viewport: customViewport, deviceScaleFactor: customDpr })
      : context;
    const p = ctx === context ? page : await ctx.newPage();
    await p.setContent(html, { waitUntil: "networkidle" });
    const buffer = await p.screenshot({ type: "png" });
    if (ctx !== context) await ctx.close();
    return buffer;
  }

  console.log("Rendering reference baseline screenshot...");
  const refBuf = await capture(BASE_HTML);

  // Case 1: IDENTICAL
  console.log("\n[Test 1/8] Case 1: Identical Fixture");
  const candIdentical = await capture(VARIANTS.identical);
  const res1 = compareVisualBuffers(refBuf, candIdentical, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: BASE_HTML,
    candidateSource: VARIANTS.identical,
  });
  console.log(`   SSIM: ${res1.ssimScore}, Pixel Delta: ${res1.pixelDeltaPercentage}%, Status: ${res1.status}`);
  assert.ok(res1.ssimScore >= 0.999, `Expected SSIM >= 0.999 for identical, got ${res1.ssimScore}`);
  assert.equal(res1.pixelDeltaPercentage, 0.0, "Expected delta 0.0% for identical");
  assert.equal(res1.mismatchedPixelCount, 0, "Expected 0 mismatched pixels");
  assert.equal(res1.status, "MEASURED", "Status must be MEASURED");

  // Case 2: 1px Translation
  console.log("\n[Test 2/8] Case 2: 1px Translation Perturbation");
  const candTrans = await capture(VARIANTS.translated1px);
  const res2 = compareVisualBuffers(refBuf, candTrans, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: BASE_HTML,
    candidateSource: VARIANTS.translated1px,
  });
  console.log(`   SSIM: ${res2.ssimScore}, Pixel Delta: ${res2.pixelDeltaPercentage}%, Mismatches: ${res2.mismatchedPixelCount}`);
  assert.ok(res2.pixelDeltaPercentage > 0.0, `Expected pixel delta > 0 for 1px translation, got ${res2.pixelDeltaPercentage}%`);
  assert.ok(res2.ssimScore < 0.999, `Expected SSIM drop < 0.999 for 1px translation, got ${res2.ssimScore}`);
  assert.ok(res2.mismatchedPixelCount > 0, "Expected mismatched pixels > 0");

  // Case 3: Text Replacement
  console.log("\n[Test 3/8] Case 3: Text Replacement Perturbation");
  const candText = await capture(VARIANTS.textReplacement);
  const res3 = compareVisualBuffers(refBuf, candText, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: BASE_HTML,
    candidateSource: VARIANTS.textReplacement,
  });
  console.log(`   SSIM: ${res3.ssimScore}, Pixel Delta: ${res3.pixelDeltaPercentage}%, Mismatches: ${res3.mismatchedPixelCount}`);
  assert.ok(res3.pixelDeltaPercentage > 0.0, "Expected pixel delta > 0");
  assert.ok(res3.ssimScore < 0.999, "Expected SSIM drop for text replacement");

  // Case 4: Missing CTA Element
  console.log("\n[Test 4/8] Case 4: Missing CTA Perturbation");
  const candCta = await capture(VARIANTS.missingCta);
  const res4 = compareVisualBuffers(refBuf, candCta, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: BASE_HTML,
    candidateSource: VARIANTS.missingCta,
  });
  console.log(`   SSIM: ${res4.ssimScore}, Pixel Delta: ${res4.pixelDeltaPercentage}%, Mismatches: ${res4.mismatchedPixelCount}`);
  assert.ok(res4.mismatchedPixelCount > res3.mismatchedPixelCount, "Missing CTA button should cause more pixel mismatches than text alone");
  assert.ok(res4.ssimScore < res3.ssimScore, "Missing CTA should drop SSIM lower than text substitution");

  // Case 5: Font Size Change
  console.log("\n[Test 5/8] Case 5: Font-size Change Perturbation");
  const candFont = await capture(VARIANTS.fontSizeChange);
  const res5 = compareVisualBuffers(refBuf, candFont, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: BASE_HTML,
    candidateSource: VARIANTS.fontSizeChange,
  });
  console.log(`   SSIM: ${res5.ssimScore}, Pixel Delta: ${res5.pixelDeltaPercentage}%, Mismatches: ${res5.mismatchedPixelCount}`);
  assert.ok(res5.pixelDeltaPercentage > 0.0, "Expected pixel delta > 0");
  assert.ok(res5.ssimScore < 0.999, "Expected SSIM deterioration");

  // Case 6: Background Color Change
  console.log("\n[Test 6/8] Case 6: Background-color Change Perturbation");
  const candBg = await capture(VARIANTS.backgroundColorChange);
  const res6 = compareVisualBuffers(refBuf, candBg, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: BASE_HTML,
    candidateSource: VARIANTS.backgroundColorChange,
  });
  console.log(`   SSIM: ${res6.ssimScore}, Pixel Delta: ${res6.pixelDeltaPercentage}%, Status: ${res6.status}`);
  assert.ok(res6.pixelDeltaPercentage > 20.0, `Expected massive pixel delta for bg change, got ${res6.pixelDeltaPercentage}%`);
  assert.ok(res6.ssimScore < 0.90, `Expected severe SSIM drop for bg change, got ${res6.ssimScore}`);
  assert.equal(res6.status, "UNPROVEN", "Severe deterioration must fail-closed to UNPROVEN");

  // Case 7: Wrong Viewport (Incomparable)
  console.log("\n[Test 7/8] Case 7: Viewport Mismatch Refusal");
  const candMobile = await capture(BASE_HTML, { width: 360, height: 800 });
  assert.throws(
    () => {
      compareVisualBuffers(refBuf, candMobile, {
        viewport: { width: 1280, height: 800, devicePixelRatio: 1.0 },
        candidateViewport: { width: 360, height: 800, devicePixelRatio: 1.0 },
      });
    },
    (err) => {
      return err instanceof IncomparableViewportError || /incomparable|viewport/i.test(err.message);
    },
    "Must throw IncomparableViewportError when viewports differ"
  );
  console.log("   Refused correctly: IncomparableViewportError thrown.");

  // Case 8: Wrong DPR (Incomparable)
  console.log("\n[Test 8/8] Case 8: DPR Mismatch Refusal");
  const candDpr2 = await capture(BASE_HTML, { width, height }, 2.0);
  assert.throws(
    () => {
      compareVisualBuffers(refBuf, candDpr2, {
        viewport: { width, height, devicePixelRatio: 1.0 },
        candidateDpr: 2.0,
      });
    },
    (err) => {
      return err instanceof IncomparableDprError || /incomparable|dpr/i.test(err.message);
    },
    "Must throw IncomparableDprError when DPR differs"
  );
  console.log("   Refused correctly: IncomparableDprError thrown.");

  await browser.close();

  // Verify Mandatory Receipt Schema Fields
  console.log("\nChecking Mandatory Receipt Fields on output...");
  const receiptFields = [
    "referenceSha256",
    "renderSha256",
    "referenceSourceSha256",
    "candidateSourceSha256",
    "viewportWidth",
    "viewportHeight",
    "DPR",
    "comparatorAlgorithm",
    "comparatorVersion",
    "thresholdVersion",
    "ssimScore",
    "pixelDeltaPercentage",
    "mismatchedPixelCount",
    "captureEngine",
    "browserVersion",
    "status",
  ];

  for (const field of receiptFields) {
    assert.ok(res1[field] !== undefined, `Receipt must contain field: ${field}`);
  }

  // Ensure NO hardcoded 0.985 or 0.45 exists anywhere
  assert.notEqual(res2.ssimScore, 0.985, "Must NOT be hardcoded 0.985");
  assert.notEqual(res2.pixelDeltaPercentage, 0.45, "Must NOT be hardcoded 0.45");

  console.log("\nPASS: ALL 8 RED-TO-GREEN TEST CASES PASSED MATHEMATICALLY.");
}

runTestSuite().catch((err) => {
  console.error("\nFATAL Test Failure:", err);
  process.exit(1);
});
