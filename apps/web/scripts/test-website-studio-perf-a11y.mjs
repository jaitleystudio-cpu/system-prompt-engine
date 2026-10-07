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

// --- R9-H repair: mobile never derived from desktop; receipts outside candidate ---
const harness = read("scripts/measure-studio-perf-a11y.mjs");
assert.doesNotMatch(
  measure,
  /frameP95\s*\*\s*\d|\*\s*1\.3\b/,
  "measureScene must not derive a frame p95 by multiplying another environment's p95",
);
assert.match(measure, /validateScenePerformanceReceipt/);
assert.match(measure, /frame samples copied from another environment/);
assert.match(measure, /frame samples derived from another environment/);
assert.match(measure, /validateFieldCwv/);
assert.match(harness, /environmentClass: "MOBILE",\s*\n\s*viewport: \{ width: 390, height: 844 \}/);
assert.match(harness, /environmentClass: "DESKTOP",\s*\n\s*viewport: \{ width: 1280, height: 800 \}/);
assert.match(harness, /for \(const env of ENVIRONMENTS\)/, "each environment must be sampled by its own run");
assert.match(harness, /STUDIO_REPRESENTATIVE_SCENE/, "non-empty representative scene fixture required");
assert.match(harness, /resolveExternalReceiptDir/, "receipts must be written outside the candidate");
assert.match(harness, /assertCandidateUnchanged\(repoRoot, identity\)/);
assert.doesNotMatch(harness, /evidence\/r9-h-studio-perf-a11y/, "harness must not write receipts into the candidate tree");
assert.doesNotMatch(harness, /git rev-parse HEAD/, "receipt subject must come from the frozen identity, not live HEAD");
assert.doesNotMatch(harness, /npm install/, "harness must not install packages during measurement");
assert.ok(
  !existsSync(path.join(root, "../../evidence/r9-h-studio-perf-a11y/measure.json")),
  "withdrawn in-tree writer receipt (desktop×1.3 mobile labelled MEASURED) must not return",
);
assert.ok(existsSync(path.join(root, "scripts/test-perf-proof-mutations.mjs")));
assert.ok(existsSync(path.join(root, "../../tools/candidate-custody.mjs")));

console.log("PASS: SPE-R9-H studio perf+a11y static gate (no critical a11y blocker; no fake MEASURED).");
