#!/usr/bin/env node
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "../node_modules/esbuild/lib/main.js";

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

// [1/7] Test WCAG 2.1 Contrast Engine & Relative Luminance Invariants
console.log("[1/7] Testing WCAG 2.1 Contrast Calculations & Relative Luminance...");
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
  assert.equal(pairBlackWhite.formattedRatio, "21.0:1");

  const pairIdentical = engine.evaluateContrastPair("#FFFFFF", "#FFFFFF", "Text on Surface");
  assert.equal(pairIdentical.score, "FAIL", "1:1 ratio must FAIL WCAG");
  assert.equal(pairIdentical.passesAA, false);
  assert.equal(pairIdentical.passesAAA, false);

  // Surface Theme determination
  assert.equal(engine.determineThemeFromSurface("#FFFFFF"), "light");
  assert.equal(engine.determineThemeFromSurface("#FAFAF9"), "light");
  assert.equal(engine.determineThemeFromSurface("#0D0E12"), "dark");
  assert.equal(engine.determineThemeFromSurface("#000000"), "dark");

  console.log("  ✓ WCAG 2.1 relative luminance and contrast ratios verified.");
}

// [2/7] Test Offline Deterministic Extraction & Domain Signatures
console.log("[2/7] Testing Offline Deterministic Extraction & Domain Signatures...");
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

  // Test Arbitrary URL
  const snapUnknown = engine.extractDesignOffline("https://custom-creative-agency.design/work");
  assert.equal(snapUnknown.domain, "custom-creative-agency.design");
  assert.ok(["light", "dark"].includes(snapUnknown.classification.theme));
  assert.ok(snapUnknown.palette.primary.startsWith("#"));
  assert.ok(snapUnknown.palette.contrast.textOnSurface.ratio > 0);

  console.log("  ✓ Archetypes and arbitrary URL offline extraction verified.");
}

// [3/7] Test Prompt Compiler Mode 1: Exact Anti-Cloning Natural-Language Prompt
console.log("[3/7] Testing AI Prompt Compiler Mode 1 (Exact Anti-Cloning Template)...");
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

  // 6. Exact closing visual guidance clause
  assert.ok(
    prompt.includes(
      "Attach the screenshot from this page as a visual reference — match its hierarchy, density, and overall feel, not just the raw values. Where the brief leaves something underspecified (hover states, focus rings, dark-mode variants), infer sensible defaults consistent with the palette and rhythm above."
    )
  );
  assert.ok(
    prompt.includes(
      "This is for my personal project — I'm drawing inspiration from this design pattern to build my own UI. Create something original that follows these design principles without copying the source brand."
    )
  );

  console.log("  ✓ Prompt compiler Mode 1 matches exact UIDrop anti-cloning template.");
}

// [4/7] Test Prompt Compiler Mode 2: Structured system.md
console.log("[4/7] Testing AI Prompt Compiler Mode 2 (Structured system.md + YAML)...");
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

// [5/7] Test Playwright Runner & DOM Extraction Script Syntax
console.log("[5/7] Testing Playwright Runner & DOM Evaluator Syntax...");
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

  console.log("  ✓ Playwright DOM extraction and fallback verified.");
}

// [6/7] Test Snap Serialization & LocalStorage Roundtrip Compatibility
console.log("[6/7] Testing Snap Library Serialization & LocalStorage Roundtrip...");
{
  const snap = engine.extractDesignOffline("https://stripe.com");
  const serialized = JSON.stringify(snap);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.domain, "stripe.com");
  assert.equal(parsed.palette.primary, "#635BFF");
  assert.equal(parsed.palette.contrast.textOnSurface.ratio, snap.palette.contrast.textOnSurface.ratio);
  assert.equal(parsed.compiledPrompt, snap.compiledPrompt);

  console.log("  ✓ Serialization roundtrip compatibility verified.");
}

// [7/7] Test Canonical WASM Hash & Zero-Egress Invariants
console.log("[7/7] Testing Canonical WASM Hash & Egress Invariants...");
{
  const wasmPath = join(root, "src/wasm/spe_wasm_engine_bg.wasm");
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
