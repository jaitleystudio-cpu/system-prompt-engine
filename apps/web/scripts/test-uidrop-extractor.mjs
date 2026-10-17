#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "../node_modules/esbuild/lib/main.js";

process.env.NODE_ENV = "test";
process.env.SPE_TEST_MODE = "1";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("==================================================================");
console.log("🎨 [Web Runtime] Testing UIDrop Design System Extractor & Prompt Compiler...");
console.log("==================================================================");

// 1. Bundle TypeScript engine modules using esbuild
const bundle = await build({
  entryPoints: [join(root, "src/engine/uidrop/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  external: ["playwright"],
});

const engine = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// Bundle Route Handler
const routeBundle = await build({
  entryPoints: [join(root, "src/app/api/extract-design/route.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  external: ["playwright"],
});

const routeHandler = await import(
  `data:text/javascript;base64,${Buffer.from(routeBundle.outputFiles[0].text).toString("base64")}`
);

// [1/9] Test WCAG 2.1 Contrast Engine & Relative Luminance Invariants
console.log("[1/9] Testing WCAG 2.1 Contrast Calculations & Relative Luminance...");
{
  const lumBlack = engine.calculateRelativeLuminance("#000000");
  const lumWhite = engine.calculateRelativeLuminance("#FFFFFF");
  assert.equal(lumBlack, 0, "Pure black relative luminance must be 0");
  assert.equal(lumWhite, 1, "Pure white relative luminance must be 1");

  const ratioBlackOnWhite = engine.calculateContrastRatio("#000000", "#FFFFFF");
  assert.equal(ratioBlackOnWhite, 21.0, "Black on white contrast ratio must be 21:1");

  const ratioIdentical = engine.calculateContrastRatio("#FFFFFF", "#FFFFFF");
  assert.equal(ratioIdentical, 1.0, "Identical colors contrast ratio must be 1:1");

  // WCAG AAA / AA Threshold Evaluation
  const pairBlackWhite = engine.evaluateContrastPair("#000000", "#FFFFFF", "Text on Surface");
  assert.equal(pairBlackWhite.score, "AAA", "21:1 ratio must score AAA");
  assert.equal(pairBlackWhite.passesAAA, true);
  assert.equal(pairBlackWhite.passesAA, true);
  assert.equal(pairBlackWhite.formattedRatio, "21.00:1");

  const pairIdentical = engine.evaluateContrastPair("#FFFFFF", "#FFFFFF", "Text on Surface");
  assert.equal(pairIdentical.score, "FAIL", "1:1 ratio must FAIL WCAG");
  assert.equal(pairIdentical.passesAA, false);
  assert.equal(pairIdentical.passesAAA, false);

  // Unrounded threshold evaluation check: #FFFFFF on #647A86
  // Raw ratio: ~4.49686065... Display ratio rounds to 4.50:1, but MUST FAIL normal text AA (4.4968 < 4.5)
  const pairWhiteOnSlate = engine.evaluateContrastPair("#FFFFFF", "#647A86", "White on Slate");
  assert.equal(pairWhiteOnSlate.ratio, 4.5, "Display ratio rounds to 4.50:1");
  assert.equal(
    pairWhiteOnSlate.passesAA,
    false,
    "White on #647A86 (raw ratio ~4.49686) must evaluate to FAIL normal text AA under unrounded check"
  );
  assert.equal(pairWhiteOnSlate.score, "FAIL", "Score must be FAIL when raw ratio < 4.5");

  // W3C CSS Color 4 standard named colors
  const redRgb = engine.parseColorToRgb("red");
  assert.deepEqual([redRgb.r, redRgb.g, redRgb.b], [255, 0, 0], "Named 'red' must be W3C standard [255, 0, 0]");
  const greenRgb = engine.parseColorToRgb("green");
  assert.deepEqual([greenRgb.r, greenRgb.g, greenRgb.b], [0, 128, 0], "Named 'green' must be W3C standard [0, 128, 0]");
  const blueRgb = engine.parseColorToRgb("blue");
  assert.deepEqual([blueRgb.r, blueRgb.g, blueRgb.b], [0, 0, 255], "Named 'blue' must be W3C standard [0, 0, 255]");

  // Surface Theme determination
  assert.equal(engine.determineThemeFromSurface("#FFFFFF"), "light");
  assert.equal(engine.determineThemeFromSurface("#FAFAF9"), "light");
  assert.equal(engine.determineThemeFromSurface("#0D0E12"), "dark");
  assert.equal(engine.determineThemeFromSurface("#000000"), "dark");

  // Modern CSS Color 4 and HSL parsing
  const parsedHsl = engine.parseColorToRgb("hsl(240, 100%, 50%)");
  assert.equal(parsedHsl.r, 0);
  assert.equal(parsedHsl.g, 0);
  assert.equal(parsedHsl.b, 255);

  const parsedModernRgb = engine.parseColorToRgb("rgb(100 150 200 / 0.5)");
  assert.equal(parsedModernRgb.r, 100);
  assert.equal(parsedModernRgb.g, 150);
  assert.equal(parsedModernRgb.b, 200);
  assert.equal(parsedModernRgb.a, 0.5);

  // Alpha compositing contrast calculation: 50% black on white
  const pairAlphaMuted = engine.evaluateContrastPair("rgba(0, 0, 0, 0.5)", "#FFFFFF", "Muted on Surface");
  assert.ok(pairAlphaMuted.ratio < 4.5, "Alpha muted on white must compute true composited ratio < 4.5:1");
  assert.equal(pairAlphaMuted.score, "FAIL", "3.98:1 must fail normal text AA");

  console.log("  ✓ WCAG 2.1 relative luminance, unrounded thresholding, W3C colors, and alpha compositing verified.");
}

// [2/9] Test Offline Deterministic Extraction & Domain Signatures with Provenance
console.log("[2/9] Testing Offline Deterministic Extraction & Domain Signatures...");
{
  // Test UIDrop / StudioCMS profile
  const snapUidrop = engine.extractDesignOffline("https://uidrop.studiocms.dev");
  assert.equal(snapUidrop.domain, "uidrop.studiocms.dev");
  assert.equal(snapUidrop.classification.theme, "light");
  assert.equal(snapUidrop.classification.density, "balanced");
  assert.equal(snapUidrop.classification.shapeProfile, "rounded");
  assert.equal(snapUidrop.palette.primary, "#5E6AD2");
  assert.equal(snapUidrop.palette.surface, "#FAFAF9");
  assert.equal(snapUidrop.typography.h1.family, "Fraunces");
  assert.equal(snapUidrop.typography.h1.size, "60px");
  assert.equal(snapUidrop.typography.h1.weight, "700");
  assert.equal(snapUidrop.typography.scale, "60px / 40px / 18px");
  assert.equal(snapUidrop.tokens.buttonRadiusLabel, "pill buttons");
  assert.equal(snapUidrop.tokens.cardRadius, "16px");
  assert.equal(snapUidrop.tokens.inputRadius, "18px");
  assert.ok(snapUidrop.palette.swatches.length >= 10, "Swatches strip must have >= 10 colors");
  assert.ok(snapUidrop.screenshotBase64.startsWith("data:image/"), "Screenshot must be valid data URL");

  // Provenance marking
  assert.equal(snapUidrop.sourceMode, "LOCAL_REFERENCE_ARCHETYPE");
  assert.equal(snapUidrop.screenshotSource, "SYNTHETIC_FALLBACK_VECTOR_RENDER");
  assert.equal(snapUidrop.extractionCompleteness, 85);
  assert.ok(snapUidrop.provenanceNotice.includes("reference archetype"));

  // Verify Contrast pairs
  assert.ok(snapUidrop.palette.contrast.textOnSurface.ratio >= 4.5, "Text on surface must pass AA");
  assert.ok(snapUidrop.palette.contrast.primaryOnSurface.ratio >= 3.0, "Primary on surface must pass UI threshold");
  assert.ok(snapUidrop.palette.contrast.mutedOnSurface.ratio >= 3.0, "Muted on surface must pass threshold");

  // Test Linear Profile
  const snapLinear = engine.extractDesignOffline("https://linear.app");
  assert.equal(snapLinear.domain, "linear.app");
  assert.equal(snapLinear.classification.theme, "dark");
  assert.equal(snapLinear.classification.density, "compact");
  assert.equal(snapLinear.palette.primary, "#5E6AD2");
  assert.equal(snapLinear.palette.surface, "#0D0E12");
  assert.equal(snapLinear.typography.h1.family, "Inter");
  assert.equal(snapLinear.sourceMode, "LOCAL_REFERENCE_ARCHETYPE");

  // Test Arbitrary URL (synthetic fallback)
  const snapUnknown = engine.extractDesignOffline("https://custom-creative-agency.design/work");
  assert.equal(snapUnknown.domain, "custom-creative-agency.design");
  assert.equal(snapUnknown.sourceMode, "SYNTHETIC_PREVIEW");
  assert.equal(snapUnknown.screenshotSource, "SYNTHETIC_FALLBACK_VECTOR_RENDER");
  assert.equal(snapUnknown.extractionCompleteness, 60);
  assert.ok(snapUnknown.provenanceNotice.includes("Synthesized offline preview"));

  console.log("  ✓ Archetypes, synthetic fallback, and explicit provenance marking verified.");
}

// [3/9] Test Prompt Compiler Mode 1: Exact Anti-Cloning Natural-Language Prompt
console.log("[3/9] Testing AI Prompt Compiler Mode 1 (Exact Anti-Cloning Template)...");
{
  const snap = engine.extractDesignOffline("https://uidrop.studiocms.dev");
  const prompt = snap.compiledPrompt;

  // 1. Exact opening anti-cloning clause
  assert.ok(
    prompt.includes(
      "This is a design system extracted from a webpage I find inspiring. I want to build my own [page/UI] inspired by this design pattern. Do not copy or replicate brand assets, logos, or identity — use these tokens as a foundation to create something original for me."
    ),
    "Prompt must contain exact opening boilerplate"
  );
  assert.ok(
    prompt.includes("Match the design language, not the brand."),
    "Prompt must contain 'Match the design language, not the brand.'"
  );

  // 2. Theme & Rhythm
  assert.ok(prompt.includes("Theme: light · balanced"), "Prompt must format theme and density");
  assert.ok(
    prompt.includes("Rhythm: 4px grid · pill buttons · rounded · relaxed line-height (1.8) · soft elevated shadows"),
    "Prompt must format rhythm tokens"
  );

  // 3. Color tokens
  assert.ok(prompt.includes("Key colors: Accent: #5E6AD2 | Background: #FAFAF9 | Text: #1C1917"));
  assert.ok(
    prompt.includes("Full palette: #5E6AD2 primary, #6366F1 accent, #FAFAF9 surface, #FFFFFF elevated, #1C1917 text, #78716C muted")
  );

  // 4. Typography bullets
  assert.ok(prompt.includes("• H1 — Fraunces 60px 700, 1.1 line-height, -1px tracking"));
  assert.ok(prompt.includes("• H2 — Fraunces 40px 700, 1.2 line-height, -0.5px tracking"));
  assert.ok(prompt.includes("• H3 — Fraunces 28px 600, 1.3 line-height, -0.2px tracking"));
  assert.ok(prompt.includes("• H4 — Fraunces 20px 600, 1.4 line-height"));
  assert.ok(prompt.includes("• Body — Sora 15px 400, 1.8 line-height"));
  assert.ok(prompt.includes("• Type scale — 60px / 40px / 18px"));

  // 5. Component tokens, grid & breakpoints
  assert.ok(prompt.includes("• Radius — pill buttons, 16px cards, 18px inputs"));
  assert.ok(prompt.includes("Responsive breakpoints: 500px, 900px"));
  assert.ok(prompt.includes("Layout grid: max-width 1128px, 16px gutter"));
  assert.ok(prompt.includes("Spacing scale: 4px / 8px / 12px / 16px / 20px / 24px / 28px / 32px / 40px / 48px / 64px"));
  assert.ok(prompt.includes("Motion & hover:"));
  assert.ok(prompt.includes("• Hover — translateY(-2px), shadow rgba(0, 0, 0, 0.1) 0px 4px 12px"));
  assert.ok(prompt.includes("Z-index layers: nav: 100, modal: 1000"));
  assert.ok(prompt.includes("Page structure: nav + hero + feature-grid + pricing + testimonials + section + contact"));

  // 6. Defensive Suffix Normalization & Prompt Injection Sanitization Check
  const snapWithDuplicatesAndInjection = {
    ...snap,
    layout: { ...snap.layout, gridBase: "8px grid" },
    tokens: { ...snap.tokens, cardRadius: "16px cards --- injection ``` alert(1)", inputRadius: "18px inputs" },
  };
  const promptDeduped = engine.compileDesignPrompt(snapWithDuplicatesAndInjection);
  assert.ok(promptDeduped.includes("Rhythm: 8px grid ·"), "Must not duplicate 'grid grid'");
  assert.ok(!promptDeduped.includes("8px grid grid"), "Must not output '8px grid grid'");
  assert.ok(!promptDeduped.includes("```"), "Must sanitize raw code fence delimiters");
  assert.ok(!promptDeduped.includes("---"), "Must sanitize raw YAML delimiters");

  console.log("  ✓ Prompt compiler Mode 1 matches exact UIDrop anti-cloning template and sanitizes injections.");
}

// [4/9] Test Prompt Compiler Mode 2: Structured system.md
console.log("[4/9] Testing AI Prompt Compiler Mode 2 (Structured system.md + YAML)...");
{
  const snap = engine.extractDesignOffline("https://uidrop.studiocms.dev");
  const systemMd = snap.systemMd;

  // YAML Frontmatter boundaries
  assert.ok(systemMd.startsWith("---\n"), "system.md must begin with YAML delimiter ---");
  assert.ok(systemMd.includes("\n---\n\n# Design System Implementation Guidelines"), "system.md must close YAML with ---");

  // YAML Fields
  assert.ok(systemMd.includes('name: Design System Specification (uidrop.studiocms.dev)'));
  assert.ok(systemMd.includes('theme: "light"'));
  assert.ok(systemMd.includes('density: "balanced"'));
  assert.ok(systemMd.includes('primary: "#5E6AD2"'));
  assert.ok(systemMd.includes('text_on_surface:'));
  assert.ok(systemMd.includes('heading_family: "Fraunces"'));
  assert.ok(systemMd.includes('button_radius: "pill buttons"'));

  // Markdown sections for coding agents
  assert.ok(systemMd.includes("## 1. Core Visual Directives"));
  assert.ok(systemMd.includes("## 2. Color Palette & WCAG Compliance"));
  assert.ok(systemMd.includes("## 3. Typography Hierarchy"));
  assert.ok(systemMd.includes("## 4. Layout & Responsive Geometry"));

  console.log("  ✓ system.md YAML frontmatter and Markdown implementation rules verified.");
}

// [5/9] Test SSRF Defense Boundary & URL Sanitizer
console.log("[5/9] Testing SSRF Defense Boundary & URL Sanitizer (ssrfGuard)...");
{
  // Test blocked loopbacks and internal networks
  const blockedTargets = [
    "http://127.0.0.1",
    "http://127.0.0.1:8080/admin",
    "http://localhost",
    "http://localhost:3000",
    "http://169.254.169.254", // AWS/GCP/Azure link-local metadata
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata.google.internal",
    "http://instance-data",
    "http://10.0.0.1", // RFC 1918 Class A
    "http://172.16.0.1", // RFC 1918 Class B
    "http://192.168.1.1", // RFC 1918 Class C
    "http://0177.0.0.1", // Octal IP representation
    "http://0x7f000001", // Hex IP representation
    "http://2130706433", // Decimal integer IP representation
    "http://[::1]", // IPv6 Loopback
    "ftp://example.com/test", // Disallowed scheme
    "file:///etc/passwd", // Disallowed scheme
    "http://user:pass@example.com", // Disallowed credentials
  ];

  for (const target of blockedTargets) {
    const res = await engine.validateAndSanitizeTargetUrl(target);
    assert.equal(res.allowed, false, `SSRF target must be blocked: ${target} (Reason: ${res.reason})`);
  }

  // Test allowed public destinations
  const allowedTargets = [
    "https://linear.app",
    "https://stripe" + ".com",
    "https://uidrop.studiocms.dev",
  ];

  for (const target of allowedTargets) {
    const res = await engine.validateAndSanitizeTargetUrl(target, { allowOfflineDnsFallback: true });
    assert.equal(res.allowed, true, `Legitimate public target must be allowed: ${target}`);
    assert.ok(res.sanitizedUrl.startsWith("https://"));
  }

  console.log("  ✓ SSRF Guard blocked loopback, cloud metadata, RFC 1918, octal/hex, and non-http schemes.");
}

// [6/9] Test Playwright Runner & DOM Extraction Script Syntax
console.log("[6/9] Testing Playwright Runner & DOM Evaluator Syntax...");
{
  // Verify evaluator script evaluates without syntax errors
  assert.doesNotThrow(() => {
    new Function(engine.BROWSER_DOM_EXTRACTION_SCRIPT);
  }, "BROWSER_DOM_EXTRACTION_SCRIPT must be valid JS");

  // Verify extractDesignWithPlaywright prefers offline gracefully
  const snap = await engine.extractDesignWithPlaywright("https://uidrop.studiocms.dev", {
    preferOffline: true,
  });
  assert.ok(snap.id.startsWith("snap_"));
  assert.equal(snap.domain, "uidrop.studiocms.dev");

  // Verify extractDesignWithPlaywright rejects SSRF target before launch
  await assert.rejects(
    async () => {
      await engine.extractDesignWithPlaywright("http://169.254.169.254/latest/meta-data/");
    },
    /SSRF Prevention/,
    "extractDesignWithPlaywright must reject SSRF target"
  );

  console.log("  ✓ Playwright DOM extraction, fallback, and SSRF pre-flight rejection verified.");
}

// [7/9] Test Snap Library Serialization & LocalStorage Roundtrip Compatibility
console.log("[7/9] Testing Snap Library Serialization & LocalStorage Roundtrip...");
{
  const snap = engine.extractDesignOffline("https://stripe" + ".com");
  const serialized = JSON.stringify(snap);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.domain, "stripe" + ".com");
  assert.equal(parsed.palette.primary, "#635BFF");
  assert.equal(parsed.palette.contrast.textOnSurface.ratio, snap.palette.contrast.textOnSurface.ratio);
  assert.equal(parsed.compiledPrompt, snap.compiledPrompt);
  assert.equal(parsed.sourceMode, "LOCAL_REFERENCE_ARCHETYPE");

  console.log("  ✓ Serialization roundtrip compatibility and provenance persistence verified.");
}

// [8/9] Test Next.js App Router Microservice Endpoint (/api/extract-design)
console.log("[8/9] Testing API Route Handler (/api/extract-design)...");
{
  // 1. Test POST with preferOffline: true (Free Tier, no entitlement required)
  const postReq = new Request("http://localhost:3000/api/extract-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://linear.app", preferOffline: true }),
  });
  const postRes = await routeHandler.POST(postReq);
  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.domain, "linear.app");
  assert.equal(postData.classification.theme, "dark");
  assert.equal(postData.sourceMode, "LOCAL_REFERENCE_ARCHETYPE");
  assert.ok(postData.compiledPrompt.length > 100);

  // 2. Test POST with live Playwright request WITHOUT entitlement header -> must return 401
  const unauthReq = new Request("http://localhost:3000/api/extract-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://linear.app", preferOffline: false }),
  });
  const unauthRes = await routeHandler.POST(unauthReq);
  assert.equal(unauthRes.status, 401, "Live headless execution without entitlement key must return 401");
  const unauthData = await unauthRes.json();
  assert.equal(unauthData.code, "COMMERCIAL_ENTITLEMENT_REQUIRED");

  // 3. Test POST with live Playwright request WITH valid entitlement key
  const authReq = new Request("http://localhost:3000/api/extract-design", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-spe-entitlement-key": "spe_live_1234567890abcdef",
    },
    body: JSON.stringify({ url: "https://linear.app", preferOffline: false }),
  });
  const authRes = await routeHandler.POST(authReq);
  // Authorization check passed; status is either 200 (if Playwright installed) or 500 (if Playwright chromium binary not installed on machine)
  // But CRITICALLY it is NOT 401 / 403!
  assert.notEqual(authRes.status, 401);
  assert.notEqual(authRes.status, 403);

  // 4. Test SSRF destination in POST -> must return 400 with SSRF_BLOCKED
  const ssrfReq = new Request("http://localhost:3000/api/extract-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "http://169.254.169.254", preferOffline: true }),
  });
  const ssrfRes = await routeHandler.POST(ssrfReq);
  assert.equal(ssrfRes.status, 400);
  const ssrfData = await ssrfRes.json();
  assert.equal(ssrfData.code, "SSRF_BLOCKED");

  // 5. Test GET with query param
  const getReq = new Request("http://localhost:3000/api/extract-design?url=https://uidrop.studiocms.dev");
  const getRes = await routeHandler.GET(getReq);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.domain, "uidrop.studiocms.dev");

  // 6. Test invalid POST (missing url)
  const badReq = new Request("http://localhost:3000/api/extract-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const badRes = await routeHandler.POST(badReq);
  assert.equal(badRes.status, 400);

  // 7. Verify all canonical deliverables exist and are tracked in source tree
  const requiredFiles = [
    "src/types/design-system.ts",
    "src/app/api/extract-design/route.ts",
    "src/server/api/extract-design/route.ts",
    "src/components/DesignExtractorPanel.tsx",
    "src/engine/UiDropExtractorStudio.tsx",
    "src/pages/UiDropPage.tsx",
    "src/engine/uidrop/index.ts",
    "src/engine/uidrop/promptCompiler.ts",
    "src/engine/uidrop/extractorCore.ts",
    "src/engine/uidrop/wcagContrast.ts",
    "src/engine/uidrop/playwrightExtractor.ts",
    "src/engine/uidrop/ssrfGuard.ts",
    "src/engine/uidrop/snapStorage.ts",
    "src/lib/extractor/index.ts",
    "src/lib/prompt-compiler.ts",
  ];
  for (const rel of requiredFiles) {
    const full = join(root, rel);
    assert.ok(existsSync(full), `Required deliverable file must exist: ${rel}`);
  }

  console.log("  ✓ /api/extract-design entitlement gate, SSRF protection, and file tree verified.");
}

// [9/10] Test Multi-Format Code Compilers, Screenshot Extraction & WCAG Contrast Auto-Tuning
console.log("[9/10] Testing Multi-Format Compilers, Screenshot Extraction & WCAG Auto-Tuner...");
{
  // 1. Test WCAG AA Contrast Auto-Tuner
  const failingFg = "#777777";
  const lightBg = "#FFFFFF";
  const initialRatio = engine.calculateContrastRatio(failingFg, lightBg);
  assert.ok(initialRatio < 4.5, `Initial ratio ${initialRatio} must be < 4.5`);

  const tunedLight = engine.tuneColorToPassAA(failingFg, lightBg, 4.5);
  assert.ok(tunedLight.tunedHex, "Must return tunedHex");
  assert.ok(tunedLight.newRatio >= 4.5, `newRatio ${tunedLight.newRatio} must be >= 4.5`);
  const tunedRatioLight = engine.calculateContrastRatio(tunedLight.tunedHex, lightBg);
  assert.ok(
    tunedRatioLight >= 4.5,
    `Tuned color ${tunedLight.tunedHex} on ${lightBg} must pass AA (ratio ${tunedRatioLight} >= 4.5)`
  );

  // Dark background test
  const failingFgDark = "#888888";
  const darkBg = "#121216";
  const tunedDark = engine.tuneColorToPassAA(failingFgDark, darkBg, 4.5);
  assert.ok(tunedDark.tunedHex, "Must return tunedHex for dark bg");
  assert.ok(tunedDark.newRatio >= 4.5, `newRatio ${tunedDark.newRatio} must be >= 4.5`);
  const tunedRatioDark = engine.calculateContrastRatio(tunedDark.tunedHex, darkBg);
  assert.ok(
    tunedRatioDark >= 4.5,
    `Tuned color ${tunedDark.tunedHex} on ${darkBg} must pass AA (ratio ${tunedRatioDark} >= 4.5)`
  );

  // 2. Test Screenshot Extraction
  const dummyDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const imageSnap = engine.extractDesignFromImage(dummyDataUrl, "saas dashboard hero");
  assert.equal(imageSnap.sourceMode, "SCREENSHOT_EXTRACT");
  assert.equal(imageSnap.screenshotSource, "USER_UPLOADED_SCREENSHOT");
  assert.ok(imageSnap.screenshotBase64.startsWith("data:image/png;base64,"));
  assert.ok(imageSnap.palette.contrast.textOnSurface);
  assert.ok(imageSnap.palette.contrast.primaryOnSurface);
  assert.ok(imageSnap.palette.contrast.mutedOnSurface);
  assert.ok(imageSnap.tailwindTheme && imageSnap.tailwindTheme.includes("@theme"));
  assert.ok(imageSnap.cssVariables && imageSnap.cssVariables.includes(":root"));
  assert.ok(imageSnap.dtcgTokensJson && imageSnap.dtcgTokensJson.includes('"color"'));
  assert.ok(imageSnap.reactScaffoldTsx && imageSnap.reactScaffoldTsx.includes("export const Button"));

  // 3. Test Individual Compilers
  const sampleSnap = engine.extractDesignOffline("https://linear.app");
  
  const twTheme = engine.compileTailwindTheme(sampleSnap);
  assert.ok(twTheme.includes("@theme {"), "Tailwind theme must declare @theme block");
  assert.ok(twTheme.includes("--color-primary:"), "Tailwind theme must include primary color token");
  assert.ok(twTheme.includes("--font-heading:"), "Tailwind theme must include heading font token");

  const cssVars = engine.compileCssVariables(sampleSnap);
  assert.ok(cssVars.includes(":root {"), "CSS Variables must declare :root block");
  assert.ok(cssVars.includes("--radius-button:"), "CSS Variables must include radius token");

  const dtcgTokens = engine.compileDtcgTokens(sampleSnap);
  const parsedDtcg = JSON.parse(dtcgTokens);
  assert.ok(parsedDtcg.color && parsedDtcg.color.primary, "DTCG tokens must declare color.primary");
  assert.equal(parsedDtcg.color.primary.$type, "color");
  assert.ok(parsedDtcg.typography && parsedDtcg.typography.heading, "DTCG tokens must declare typography.heading");
  assert.equal(parsedDtcg.typography.heading.$type, "fontFamily");

  const reactScaffold = engine.compileReactScaffold(sampleSnap);
  assert.ok(reactScaffold.includes("export const Button"), "React scaffold must export Button component");
  assert.ok(reactScaffold.includes("export const Card"), "React scaffold must export Card component");
  assert.ok(reactScaffold.includes("export const Navbar"), "React scaffold must export Navbar component");

  console.log("  ✓ Multi-format code compilers, screenshot extraction & WCAG auto-tuner verified.");
}

// [10/10] Test Canonical WASM Hash & Zero-Egress Invariants
console.log("[10/10] Testing Canonical WASM Hash & Egress Invariants...");
{
  const wasmPath = join(root, "public/spe_wasm.wasm");
  const wasmBuffer = readFileSync(wasmPath);
  const actualSha256 = createHash("sha256").update(wasmBuffer).digest("hex");
  const EXPECTED_HASH = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d";

  assert.equal(
    actualSha256,
    EXPECTED_HASH,
    `Canonical WASM bytecode hash must remain pinned to ${EXPECTED_HASH}`
  );
  console.log(`  ✓ Canonical WASM hash verified: ${actualSha256}`);
}

console.log("==================================================================");
console.log("✅ All UIDrop Design System Extractor Verification Tests PASSED (100% SOUND)!");
console.log("==================================================================");
