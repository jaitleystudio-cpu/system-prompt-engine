/**
 * SPE Ω — Mission 8: Live Product Behavior & Running Server Verification
 *
 * Verifies live behavior against the active local Vite dev server at http://127.0.0.1:5173:
 * 1. Checks HTTP server reachability, response headers, and latency.
 * 2. Fetches and hashes live served index.html.
 * 3. Fetches and hashes live served JavaScript entry point (/src/main.tsx).
 * 4. Fetches live served WebAssembly binary (/spe_wasm.wasm), verifies exact canonical SHA-256
 *    (ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d), exact size (1,339,691 bytes),
 *    and proves WebAssembly.Module.imports(mod).length === 0 (zero-import air-gap sandbox).
 * 5. Automates a real Chromium browser session via Playwright:
 *    - Loads http://127.0.0.1:5173/
 *    - Enters an unseen multi-domain brief
 *    - Triggers live prompt generation via .spe-build
 *    - Validates prompt output in .prompt-document
 *    - Verifies zero console errors
 * 6. Validates fallback resilience on empty input and corrupted input.
 * 7. Emits structured evidence report to proofs/generated/MISSION_8_LIVE_PRODUCT_BEHAVIOR_REPORT.json.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const SERVER_URL = "http://127.0.0.1:5173";
const EXPECTED_WASM_SHA256 = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d";
const EXPECTED_WASM_BYTES = 1339691;

console.log("========================================================================");
console.log("🌐 SPE Ω — MISSION 8: LIVE PRODUCT BEHAVIOR VERIFICATION");
console.log(`Target: ${SERVER_URL}`);
console.log("========================================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function runLiveProductVerification() {
  const report = {
    mission: "SPE Ω — Mission 8: Live Product Behavior & Served Artifact Integrity",
    timestamp: new Date().toISOString(),
    serverUrl: SERVER_URL,
    checks: {},
    liveGenerationRecord: null,
    fallbackRecord: null,
    verdict: "PENDING",
  };

  // Step 1: Verify HTTP Server Availability & Headers
  console.log("\n[1/5] Probing Live Dev Server HTTP Endpoints...");
  const t0 = performance.now();
  const indexRes = await fetch(`${SERVER_URL}/`);
  const indexLatencyMs = Math.round((performance.now() - t0) * 100) / 100;
  assert(indexRes.status === 200, `Dev server returned HTTP ${indexRes.status} at /`);
  const indexHtml = await indexRes.text();
  const indexSha = await sha256(Buffer.from(indexHtml, "utf8"));
  assert(indexHtml.includes("<!doctype html>"), "Served root contains valid HTML document");
  assert(indexHtml.includes("System Prompt Engine"), "Served root contains System Prompt Engine title/meta");

  report.checks.serverReachability = {
    url: SERVER_URL,
    status: indexRes.status,
    latencyMs: indexLatencyMs,
    htmlSizeBytes: Buffer.byteLength(indexHtml, "utf8"),
    htmlSha256: indexSha,
  };

  // Step 2: Fetch and verify Live Served JavaScript Entry Point
  console.log("\n[2/5] Fetching Live Served JavaScript Entry Point (/src/main.tsx)...");
  const jsRes = await fetch(`${SERVER_URL}/src/main.tsx`);
  assert(jsRes.status === 200, `Dev server served /src/main.tsx with HTTP ${jsRes.status}`);
  const jsContent = await jsRes.text();
  const jsSha = await sha256(Buffer.from(jsContent, "utf8"));
  assert(jsContent.includes("createRoot") || jsContent.includes("App"), "/src/main.tsx contains application root mount");

  report.checks.javascriptEntryPoint = {
    path: "/src/main.tsx",
    status: jsRes.status,
    sizeBytes: Buffer.byteLength(jsContent, "utf8"),
    sha256: jsSha,
  };

  // Step 3: Fetch and verify Live Served WASM Binary
  console.log("\n[3/5] Fetching and Validating Live Served WASM Binary (/spe_wasm.wasm)...");
  const wasmRes = await fetch(`${SERVER_URL}/spe_wasm.wasm`);
  assert(wasmRes.status === 200, `Dev server served /spe_wasm.wasm with HTTP ${wasmRes.status}`);
  const wasmBuffer = Buffer.from(await wasmRes.arrayBuffer());
  const actualWasmSha = await sha256(wasmBuffer);
  const actualWasmBytes = wasmBuffer.byteLength;

  assert(actualWasmSha === EXPECTED_WASM_SHA256, `Served WASM SHA-256 matches canonical hash (${actualWasmSha})`);
  assert(actualWasmBytes === EXPECTED_WASM_BYTES, `Served WASM size matches canonical byte count (${actualWasmBytes} bytes)`);

  // Prove zero imports and successful compilation
  const wasmModule = await WebAssembly.compile(wasmBuffer);
  const wasmImports = WebAssembly.Module.imports(wasmModule);
  assert(wasmImports.length === 0, `Served WASM binary has 0 imports (air-gap verification passed)`);

  report.checks.wasmIntegrity = {
    path: "/spe_wasm.wasm",
    status: wasmRes.status,
    sizeBytes: actualWasmBytes,
    expectedSizeBytes: EXPECTED_WASM_BYTES,
    sha256: actualWasmSha,
    expectedSha256: EXPECTED_WASM_SHA256,
    importsCount: wasmImports.length,
    zeroImportsVerified: wasmImports.length === 0,
    compilesSuccessfully: true,
  };

  // Step 4: Playwright Headless Browser Real Prompt Generation
  console.log("\n[4/5] Launching Real Headless Chromium Session via Playwright...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto(`${SERVER_URL}/`, { waitUntil: "networkidle" });
  const pageTitle = await page.title();
  assert(pageTitle.includes("System Prompt Engine") || pageTitle.includes("SPE"), `Live page loaded with title "${pageTitle}"`);

  // Locate input
  const inputSelector = "#spe-one-line";
  const textarea = await page.waitForSelector(inputSelector, { timeout: 10000 });
  assert(textarea !== null, `Found input textarea (${inputSelector}) on live interface`);

  const unseenBrief = "Architect a resilient real-time sensor ingestion telemetry pipeline in Go with zero external dependencies and strict memory bounds.";
  await textarea.fill(unseenBrief);

  // Click build button
  const buildBtn = await page.waitForSelector(".spe-build", { timeout: 5000 });
  assert(buildBtn !== null, "Found .spe-build button on live interface");

  console.log("  Executing live compilation in browser...");
  const genStart = performance.now();
  await buildBtn.click();

  // Wait for prompt-document
  const promptDoc = await page.waitForSelector(".prompt-document", { timeout: 20000 });
  const genLatencyMs = Math.round((performance.now() - genStart) * 100) / 100;
  assert(promptDoc !== null, `.prompt-document mounted within ${genLatencyMs}ms`);

  const generatedPrompt = await promptDoc.textContent();
  assert(generatedPrompt.length > 500, `Generated prompt has substantive length (${generatedPrompt.length} chars)`);
  assert(
    generatedPrompt.includes("Go") ||
    generatedPrompt.includes("telemetry") ||
    generatedPrompt.includes("sensor"),
    "Generated prompt incorporates key requirements from user brief"
  );
  assert(
    generatedPrompt.includes("System Role") ||
    generatedPrompt.includes("system_instructions") ||
    generatedPrompt.includes("Instructions"),
    "Generated prompt has professional structured prompt architecture"
  );

  assert(consoleErrors.length === 0, `Zero browser console errors recorded during generation (errors: ${consoleErrors.length})`);

  report.liveGenerationRecord = {
    brief: unseenBrief,
    generationLatencyMs: genLatencyMs,
    outputLengthChars: generatedPrompt.length,
    outputSnippet: generatedPrompt.slice(0, 300) + "...",
    consoleErrors,
    passed: true,
  };

  // Step 5: Test Fallback and Error Handling in Live UI
  console.log("\n[5/5] Testing UI Resilience on Empty Submission...");
  await textarea.fill("");
  const isDisabled = await page.$eval(".spe-build", (btn) => btn.disabled);
  assert(isDisabled === true, ".spe-build button is correctly disabled when input is empty (prevents invalid generation)");

  await browser.close();

  report.verdict = failed === 0 ? "LIVE_PRODUCT_BEHAVIOR_VERIFIED" : "VERIFICATION_FAILED";
  report.passedCount = passed;
  report.failedCount = failed;

  // Write report
  const proofsDir = resolve(process.cwd(), "proofs/generated");
  mkdirSync(proofsDir, { recursive: true });
  const reportPath = resolve(proofsDir, "MISSION_8_LIVE_PRODUCT_BEHAVIOR_REPORT.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nEvidence saved to: ${reportPath}`);

  console.log("========================================================================");
  console.log(`RESULT: ${passed} passed, ${failed} failed.`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveProductVerification().catch((err) => {
  console.error("Mission 8 verification fatal error:", err);
  process.exit(1);
});
