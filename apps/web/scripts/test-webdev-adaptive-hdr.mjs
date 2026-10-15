/**
 * SPE Ω — Automated Verification Battery for web.dev-Inspired Precision Design & Adaptive HDR
 * Tests:
 * 1. CSS Design Tokens & Structural Invariants (80rem, 66ch, fluid clamps, 4px spacing, unitless line heights)
 * 2. Adaptive Display Quality Engine (5 profiles, progressive SDR fallback, comfort modes, HDR Content Harmony)
 * 3. Daily Visual Evolution System (Preapproved variant registry, WCAG AAA >= 7.0:1, CLS 0 invariant, 02:17 AM IST scheduler, safe rollback)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../../../");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

async function runBattery() {
  console.log("=== 1. Testing CSS Tokens & Structural Invariants ===");
  const cssPath = resolve(root, "apps/web/src/styles/webdevPrecision.css");
  const cssContent = readFileSync(cssPath, "utf-8");

  assert(cssContent.includes("--spe-layout-max: 80rem;"), "web.dev 80rem container constraint is defined");
  assert(cssContent.includes("--spe-reading-width: min(100%, 66ch);"), "66ch reading width is strictly specified");
  assert(cssContent.includes("clamp(2.5rem, 1.8rem + 3.2vw, 4.25rem);"), "Fluid clamp() scale for display typography");
  assert(cssContent.includes("--spe-lh-display: 1.12;"), "Unitless line-height for display heading");
  assert(cssContent.includes("--spe-lh-h1: 1.16;"), "Unitless line-height for H1 heading");
  assert(cssContent.includes("--spe-lh-body: 1.6;"), "Unitless line-height for body prose");
  assert(cssContent.includes("--spe-space-1: 0.25rem;"), "4px base spacing scale token 1 exists");
  assert(cssContent.includes("--spe-space-24: 6rem;"), "96px base spacing scale token 24 exists");
  assert(cssContent.includes("@media (color-gamut: p3)"), "Wide-gamut Display P3 media query defined");
  assert(cssContent.includes("@media (dynamic-range: high)"), "High Dynamic Range media query defined");
  assert(cssContent.includes(".spe-precision-card"), "Precision card utility class defined");

  console.log("\n=== 2. Testing Adaptive Display Quality Engine ===");
  const {
    resolveEffectiveProfile,
    detectDisplayCapabilities,
    getCurrentDisplayState,
  } = await import("../src/engine/adaptiveDisplayEngine.ts");

  // Test SDR override fallback
  const sdrProfile = resolveEffectiveProfile(
    {
      supportsHdr: true,
      supportsWideColorP3: true,
      supportsWebGpu: true,
      prefersReducedMotion: false,
      colorDepth: 30,
      devicePixelRatio: 2,
    },
    "SDR"
  );
  assert(sdrProfile === "STANDARD", "SDR comfort mode strictly forces STANDARD profile even on HDR screens");

  // Test reduced motion fallback
  const essentialProfile = resolveEffectiveProfile(
    {
      supportsHdr: true,
      supportsWideColorP3: true,
      supportsWebGpu: true,
      prefersReducedMotion: true,
      colorDepth: 30,
      devicePixelRatio: 2,
    },
    "AUTOMATIC"
  );
  assert(essentialProfile === "ESSENTIAL", "prefers-reduced-motion forces ESSENTIAL profile for accessibility");

  // Test HDR detection
  const hdrProfile = resolveEffectiveProfile(
    {
      supportsHdr: true,
      supportsWideColorP3: true,
      supportsWebGpu: false,
      prefersReducedMotion: false,
      colorDepth: 30,
      devicePixelRatio: 2,
    },
    "AUTOMATIC"
  );
  assert(hdrProfile === "HDR", "HDR media query capability maps to HDR profile");

  // Test IMMERSIVE detection
  const immersiveProfile = resolveEffectiveProfile(
    {
      supportsHdr: true,
      supportsWideColorP3: true,
      supportsWebGpu: true,
      prefersReducedMotion: false,
      colorDepth: 30,
      devicePixelRatio: 2,
    },
    "AUTOMATIC"
  );
  assert(immersiveProfile === "IMMERSIVE", "WebGPU + HDR capabilities map to IMMERSIVE profile");

  // Test BALANCED mode capping
  const balancedProfile = resolveEffectiveProfile(
    {
      supportsHdr: true,
      supportsWideColorP3: true,
      supportsWebGpu: true,
      prefersReducedMotion: false,
      colorDepth: 30,
      devicePixelRatio: 2,
    },
    "BALANCED"
  );
  assert(balancedProfile === "WIDE_COLOR", "BALANCED mode caps highlights at WIDE_COLOR to avoid HDR contrast flare");

  // Test current display state shape
  const state = getCurrentDisplayState();
  assert(state && typeof state === "object", "getCurrentDisplayState returns valid state");
  assert(typeof state.hdrHeadroom === "number" && state.hdrHeadroom >= 1.0, "HDR headroom is calibrated >= 1.0");

  console.log("\n=== 3. Testing Governed Daily Visual Evolution System ===");
  const {
    APPROVED_VISUAL_VARIANTS,
    CANONICAL_FALLBACK_VARIANT,
    verifyVariantInvariants,
    computeNextIstSchedule,
    getActiveVisualVariant,
    applyVisualVariantToDom,
    emergencyRollbackToCanonical,
  } = await import("../src/engine/dailyVisualEvolution.ts");

  assert(APPROVED_VISUAL_VARIANTS.length >= 7, `Pre-approved variant catalog contains ${APPROVED_VISUAL_VARIANTS.length} certified variants (>= 7 required)`);

  // Verify all variants pass strict invariant check
  for (const variant of APPROVED_VISUAL_VARIANTS) {
    const valid = verifyVariantInvariants(variant);
    assert(valid, `Variant "${variant.name}" (${variant.id}) passes strict invariant checks`);
    assert(variant.contrastRatio >= 7.0, `Variant "${variant.name}" satisfies WCAG AAA contrast >= 7.0:1 (actual: ${variant.contrastRatio}:1)`);
    assert(variant.clsZeroCertified === true, `Variant "${variant.name}" certifies zero cumulative layout shift (CLS 0)`);
  }

  // Test scheduled 02:17 AM IST cycle logic
  const schedule = computeNextIstSchedule();
  assert(schedule.formattedIst === "02:17:00 IST", `Scheduled evaluation is pinned to 02:17:00 IST (actual: ${schedule.formattedIst})`);
  assert(schedule.epochMs > Date.now(), "Next scheduled epoch timestamp is strictly in the future");

  // Test deterministic day mapping
  const testDateA = new Date("2026-10-15T12:00:00Z");
  const testDateB = new Date("2026-10-15T23:59:59Z");
  const variantA = getActiveVisualVariant(testDateA);
  const variantB = getActiveVisualVariant(testDateB);
  assert(variantA.id === variantB.id, "Active variant selection is deterministic across the same calendar day");

  // Test safe rollback
  const rollbackState = emergencyRollbackToCanonical();
  assert(rollbackState.activeVariant.id === CANONICAL_FALLBACK_VARIANT.id, "Emergency rollback returns canonical v0 signature cobalt");
  assert(rollbackState.invariantsPassed === true, "Rollback state passes invariants");

  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);
}

runBattery().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
