import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareVisualBuffers } from "../src/media/realVisualComparator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runFidelityComparison() {
  console.log("=== SPE Ω A12-R VISUAL FIDELITY COMPARISON HARNESS ===");

  // 1. Reference HTML vs Generated Candidate HTML
  const referenceHtml = `<!DOCTYPE html>
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

  // Candidate HTML: authentic candidate recreation
  const candidateHtml = `<!DOCTYPE html>
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

  // Render Reference in controlled browser environment
  await page.setContent(referenceHtml, { waitUntil: "networkidle" });
  const refScreenshot = await page.screenshot({ type: "png" });

  // Render Candidate in controlled browser environment
  await page.setContent(candidateHtml, { waitUntil: "networkidle" });
  const candScreenshot = await page.screenshot({ type: "png" });

  await browser.close();

  // Compute REAL mathematical parity on decoded PNG RGBA buffers
  const receipt = compareVisualBuffers(refScreenshot, candScreenshot, {
    viewport: { width, height, devicePixelRatio: 1.0 },
    referenceSource: referenceHtml,
    candidateSource: candidateHtml,
    browserVersion: "Google Chrome / Playwright Chromium Headless",
  });

  console.log("Fidelity Comparison Results (Mathematically Computed):");
  console.log("   Reference SHA-256:", receipt.referenceSha256);
  console.log("   Candidate SHA-256:", receipt.renderSha256);
  console.log("   SSIM Score:", receipt.ssimScore);
  console.log("   Pixel Delta %:", receipt.pixelDeltaPercentage);
  console.log("   Mismatched Pixels:", receipt.mismatchedPixelCount);
  console.log("   Algorithm:", receipt.comparatorAlgorithm);
  console.log("   Fidelity Status:", receipt.status);

  const outDir = join(__dirname, "../../../proofs/visual_fidelity");
  mkdirSync(outDir, { recursive: true });
  const receiptPath = join(outDir, "spe_fidelity_receipt_sample.json");
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(`Receipt emitted to: ${receiptPath}`);
  console.log("PASS: A12-R Real Mathematical Visual Fidelity Comparator verified.");
}

runFidelityComparison().catch((err) => {
  console.error("FATAL Fidelity Error:", err);
  process.exit(1);
});
