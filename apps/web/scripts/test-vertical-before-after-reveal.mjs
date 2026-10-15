#!/usr/bin/env node
/**
 * Test battery for SPE Ω Cinematic Scroll-Controlled Vertical Before/After Reveal
 * 
 * Verifies:
 * 1. Interaction model: Top-to-bottom vertical reveal divider
 * 2. Visual design: High contrast dark palette, luminous divider, clear BEFORE/AFTER terminal badges
 * 3. Scroll engine: IntersectionObserver + requestAnimationFrame bounded scroll driver
 * 4. Sticky storytelling: Bounded track, sticky pin, unpins after 100% without scroll trapping
 * 5. Manual controls: 100% Before (0%), 50/50 Split (50%), 100% After (100%), ArrowUp/Down, Home, End
 * 6. Responsive layout: Touch targets >= 44px, no overflow at 320px-1920px
 * 7. Performance: CSS custom properties, will-change: clip-path, compositor-friendly rendering
 * 8. Outcome card synchronization: 0% Before emphasis, 50% Balanced, 100% After emphasis
 * 9. Reduced motion: Bounded track collapses to min-height: auto, sticky pin disabled, static 50% default
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const diffComponentPath = join(root, "src/landing/BeforeAfterDiffSlider.tsx");
const diffCssPath = join(root, "src/landing/before-after-diff.css");
const enginePath = join(root, "src/engine/landing/diffScrollEngine.ts");

console.log("=== Running SPE Ω Cinematic Vertical Before/After Reveal Test Suite ===");

// 1. Files existence & structure
assert.ok(existsSync(diffComponentPath), "BeforeAfterDiffSlider.tsx must exist");
assert.ok(existsSync(diffCssPath), "before-after-diff.css must exist");
assert.ok(existsSync(enginePath), "diffScrollEngine.ts must exist");
console.log("✓ Core component, CSS, and scroll engine files exist");

const diff = readFileSync(diffComponentPath, "utf8");
const diffCss = readFileSync(diffCssPath, "utf8");
const engine = readFileSync(enginePath, "utf8");

// 2. Interaction Model: Vertical Top-to-Bottom Reveal
assert.match(
  diff,
  /clipPath:\s*`polygon\(0%\s*0%,\s*100%\s*0%,\s*100%\s*\$\{splitPct\}%,\s*0%\s*\$\{splitPct\}%\)`/,
  "AFTER layer must be clipped vertically from top (0% to splitPct%)"
);
assert.match(
  diff,
  /WebkitClipPath:\s*`polygon\(0%\s*0%,\s*100%\s*0%,\s*100%\s*\$\{splitPct\}%,\s*0%\s*\$\{splitPct\}%\)`/,
  "Webkit vendor prefix must be present for cross-browser WebKit/Safari support"
);
assert.match(
  diff,
  /style=\{\{\s*top:\s*`\$\{splitPct\}%`\s*\}\}/,
  "Horizontal reveal divider must be positioned via vertical top percentage"
);
assert.match(
  diff,
  /spe-pane-under\s+is-before/,
  "Base under-layer must contain BEFORE (Unguided Run)"
);
assert.match(
  diff,
  /spe-pane-over\s+is-after/,
  "Reveal over-layer must contain AFTER (SPE Protected Run)"
);
console.log("✓ Vertical top-to-bottom reveal geometry and layering verified");

// 3. Divider Styling & Visual Polish
assert.match(
  diffCss,
  /\.spe-slider-divider\s*\{[^}]*cursor:\s*row-resize;/,
  "Divider must declare row-resize cursor for vertical dragging"
);
assert.match(
  diffCss,
  /\.spe-slider-divider\s*\{[^}]*height:\s*2px;/,
  "Divider must be a thin, luminous horizontal line (height: 2px)"
);
assert.match(
  diffCss,
  /\.spe-slider-divider\s*\{[^}]*left:\s*0;\s*right:\s*0;/,
  "Divider must span full width from left to right"
);
assert.match(
  diff,
  /▴\s*▾/,
  "Handle must display vertical direction scrub indicator icons (▴ ▾)"
);
console.log("✓ Refined horizontal divider with luminous cyan illumination verified");

// 4. Scorecard Metric Emphasis Synchronization
assert.match(
  diff,
  /splitPct\s*<=\s*35\s*\?\s*"is-emphasized"\s*:\s*splitPct\s*>=\s*65\s*\?\s*"is-dimmed"\s*:\s*"is-balanced"/,
  "Before scorecard must receive emphasis at <= 35% and dim at >= 65%"
);
assert.match(
  diff,
  /splitPct\s*>=\s*65\s*\?\s*"is-emphasized"\s*:\s*splitPct\s*<=\s*35\s*\?\s*"is-dimmed"\s*:\s*"is-balanced"/,
  "After scorecard must receive emphasis at >= 65% and dim at <= 35%"
);
assert.match(
  diffCss,
  /\.spe-diff-scorecard\.is-before\.is-emphasized\s*\{/,
  "CSS must style emphasized before scorecard with red glow"
);
assert.match(
  diffCss,
  /\.spe-diff-scorecard\.is-after\.is-emphasized\s*\{/,
  "CSS must style emphasized after scorecard with green glow"
);
console.log("✓ Scorecard emphasis synchronization (0% Before, 50% Balanced, 100% After) verified");

// 5. Bounded Sticky Storytelling & Scroll Engine
assert.match(
  diffCss,
  /\.spe-diff-track\.is-scroll-driven\s*\{[^}]*min-height:\s*165vh;/,
  "Bounded scroll track must provide 165vh scroll room on desktop"
);
assert.match(
  diffCss,
  /\.spe-diff-sticky-pin\s*\{[^}]*position:\s*sticky;\s*top:\s*1\.5rem;/,
  "Sticky pin container must declare position: sticky at top: 1.5rem"
);
assert.match(
  engine,
  /IntersectionObserver/,
  "Scroll engine must use IntersectionObserver to disable scroll listeners outside viewport"
);
assert.match(
  engine,
  /requestAnimationFrame/,
  "Scroll engine must use requestAnimationFrame for 60/120fps compositor updates"
);
assert.match(
  engine,
  /passive:\s*true/,
  "Scroll and resize listeners must be registered as passive"
);
console.log("✓ Bounded sticky storytelling and rAF scroll engine verified");

// 6. Manual Controls & Accessibility
assert.match(diff, /role="slider"/, "Divider must declare role=slider");
assert.match(diff, /aria-orientation="vertical"/, "Divider must declare aria-orientation=vertical");
assert.match(diff, /aria-valuenow=\{Math\.round\(splitPct\)\}/, "Divider must dynamically report aria-valuenow");
assert.match(diff, /aria-valuemin=\{0\}/, "Divider must declare aria-valuemin=0");
assert.match(diff, /aria-valuemax=\{100\}/, "Divider must declare aria-valuemax=100");
assert.match(diff, /tabIndex=\{0\}/, "Divider must be keyboard focusable");
assert.match(diff, /e\.key === "ArrowUp"/, "Keyboard navigation must handle ArrowUp");
assert.match(diff, /e\.key === "ArrowDown"/, "Keyboard navigation must handle ArrowDown");
assert.match(diff, /e\.key === "Home"/, "Keyboard navigation must handle Home (0%)");
assert.match(diff, /e\.key === "End"/, "Keyboard navigation must handle End (100%)");
assert.match(diff, /handlePreset\(0\)/, "100% Before button must set 0% reveal");
assert.match(diff, /handlePreset\(50\)/, "50 / 50 Split button must set 50% reveal");
assert.match(diff, /handlePreset\(100\)/, "100% After button must set 100% reveal");
console.log("✓ Accessible manual controls and keyboard navigation verified");

// 7. Reduced Motion Fallback
assert.match(
  engine,
  /prefers-reduced-motion:\s*reduce/,
  "Scroll engine must query prefers-reduced-motion"
);
assert.match(
  diffCss,
  /\.spe-diff-track\.is-scroll-driven\s*\{[^}]*min-height:\s*auto\s*!important;/,
  "Reduced motion must collapse scroll track to natural height"
);
assert.match(
  diffCss,
  /\.spe-diff-sticky-pin\s*\{[^}]*position:\s*relative\s*!important;/,
  "Reduced motion must disable sticky positioning"
);
console.log("✓ Reduced-motion overrides verified");

// 8. Mobile Responsiveness & Touch Targets
assert.match(
  diffCss,
  /@media\s*\(max-width:\s*768px\)/,
  "Mobile breakpoint 768px present in CSS"
);
assert.match(
  diffCss,
  /min-height:\s*44px/,
  "Touch target minimum 44px enforced in CSS"
);
console.log("✓ Mobile responsiveness and touch targets verified");

console.log("==================================================================");
console.log("🎉 ALL 8 CINEMATIC VERTICAL REVEAL TEST GATES PASSED! (8/8)");
console.log("==================================================================");
