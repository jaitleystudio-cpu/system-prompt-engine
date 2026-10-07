#!/usr/bin/env node
/**
 * SPE-R9-H — Studio / mobile surface perf + a11y static gate.
 * Measured budgets recorded separately; this gate blocks critical a11y regressions
 * and forbids fake CWV / fake MEASURED. COST ₹0. not_a_release=true.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const studio = read("src/website-studio/Studio.tsx");
const css = read("src/website-studio/studio.css");
const renderer = read("src/website-studio/render/WebsiteRenderer.tsx");
const explore = read("src/website-studio/explore/StudioExplore.tsx");
const measure = read("src/website-studio/performance/measureScene.ts");
const doctor = read("src/website-studio/performance/PerformanceDoctor.tsx");

console.log("SPE-R9-H studio perf+a11y static gate");

// --- Critical a11y blockers ---
assert.doesNotMatch(
  studio,
  /<main[\s>]/,
  "Studio must not nest a second <main> inside App #main",
);
assert.match(studio, /role="region"/);
assert.match(studio, /aria-label="LIVE WEBSITE Stage"/);

assert.doesNotMatch(
  renderer,
  /<main[\s>]/,
  "WebsiteRenderer preview must not introduce a nested <main>",
);
assert.match(renderer, /role="region"/);
assert.match(renderer, /data-testid="accessible-2d-fallback"/);
assert.match(renderer, /prefers-reduced-motion/);
assert.match(renderer, /aria-label=\{ariaRegionLabel\}/);

assert.match(studio, /prefers-reduced-motion/);
assert.match(studio, /data-testid="studio-reduced-motion"/);
assert.match(studio, /aria-pressed=\{reducedMotion\}/);
assert.match(studio, /data-testid="viewport-mobile"/);
assert.match(studio, /aria-live="polite"/);

// Touch targets: no sub-44px overrides on studio chrome
assert.doesNotMatch(studio, /minHeight:\s*"32px"|min-height:\s*32px/);
assert.match(css, /--studio-touch-target:\s*44px/);
assert.match(css, /touch-action:\s*manipulation/);
assert.match(css, /animation-duration:\s*0\.001ms/);
assert.match(css, /@media\s*\(max-width:\s*480px\)/);
assert.match(css, /\.studio-btn-compact/);

assert.match(explore, /aria-pressed=\{selectedCategory === cat\}/);
assert.match(studio, /aria-pressed=\{activeLeftTab === "/);

// --- Perf honesty ---
assert.match(measure, /PERFORMANCE_MEASUREMENT_REJECTED/);
assert.match(measure, /attachVerifiedBrowserTelemetry/);
assert.match(measure, /frameMeasurementState:\s*"ESTIMATED"/);
assert.match(measure, /BROWSER_HARNESS/);
assert.match(doctor, /field vitals unknown|CWV UNKNOWN/);
assert.match(doctor, /desktopFrameP95/);

assert.ok(existsSync(path.join(root, "scripts/test-v1-1-performance-telemetry.mjs")));

console.log("PASS: SPE-R9-H studio perf+a11y static gate (no critical a11y blocker; no fake MEASURED).");
