#!/usr/bin/env node
/**
 * Lane A6 Test Suite: Universal Input Shell & Mode Selector Contract Verification
 * Enforces:
 *  - 7 input types: text, image, audio, video, url, screenshot, document
 *  - 6 public actions: prompt, transcribe, build, code, research, create
 *  - Zero internal jargon: no K3, XCAT, ContextCapsule, C01-C12
 *  - Mobile reflow (360px), 44px touch target rule, focus-visible, prefers-reduced-motion
 *  - Clean isolation: ROUTE_MOUNT_STATUS=NOT_INTEGRATED, PRODUCT_INTEGRATED=NO
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const shellPath = join(root, "src/landing/UniversalInputShell.tsx");
const modalPath = join(root, "src/landing/ModalModeSelector.tsx");
const cssPath = join(root, "src/landing/universal-shell.css");

console.log("Checking Lane A6 file existence...");
assert.ok(existsSync(shellPath), "UniversalInputShell.tsx must exist");
assert.ok(existsSync(modalPath), "ModalModeSelector.tsx must exist");
assert.ok(existsSync(cssPath), "universal-shell.css must exist");

const shellSource = readFileSync(shellPath, "utf8");
const modalSource = readFileSync(modalPath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

// 1. Verify 7 Input Types
console.log("Checking 7 Input Types...");
const INPUT_TYPES = ["text", "image", "audio", "video", "url", "screenshot", "document"];
for (const type of INPUT_TYPES) {
  assert.ok(
    shellSource.includes(`"${type}"`) || shellSource.includes(`'${type}'`),
    `UniversalInputShell must support input type: ${type}`
  );
}

// 2. Verify 6 Public Actions
console.log("Checking 6 Public Actions...");
const ACTIONS = ["prompt", "transcribe", "build", "code", "research", "create"];
for (const action of ACTIONS) {
  assert.ok(
    shellSource.includes(`"${action}"`) || shellSource.includes(`'${action}'`),
    `UniversalInputShell must support action: ${action}`
  );
}

// 3. Jargon Prohibition (User-facing files must never expose internal pipeline terms)
console.log("Checking zero internal jargon ban...");
const JARGON_TERMS = [
  /\bK3\b/,
  /\bXCAT\b/,
  /\bContextCapsule\b/,
  /\bC01\b/,
  /\bC02\b/,
  /\bC03\b/,
  /\bC04\b/,
  /\bC05\b/,
  /\bC06\b/,
  /\bC07\b/,
  /\bC08\b/,
  /\bC09\b/,
  /\bC10\b/,
  /\bC11\b/,
  /\bC12\b/
];

for (const term of JARGON_TERMS) {
  assert.doesNotMatch(
    shellSource,
    term,
    `UniversalInputShell must not contain internal jargon matching ${term}`
  );
  assert.doesNotMatch(
    modalSource,
    term,
    `ModalModeSelector must not contain internal jargon matching ${term}`
  );
}

// 4. Accessibility and ARIA Attributes
console.log("Checking accessibility attributes...");
assert.match(shellSource, /aria-label=/i, "Shell must use aria-label for accessibility");
assert.match(shellSource, /role=["'](region|form|toolbar|tablist|search)["']/i, "Shell must define semantic ARIA roles");
assert.match(modalSource, /role=["']dialog["']/i, "ModalModeSelector must have role='dialog'");
assert.match(modalSource, /aria-modal=["']true["']/i, "ModalModeSelector must have aria-modal='true'");
assert.match(modalSource, /aria-labelledby=/i, "ModalModeSelector must have aria-labelledby");

// 5. CSS Touch Targets, Reflow, Reduced Motion
console.log("Checking CSS requirements...");
assert.match(cssSource, /44px/, "CSS must enforce 44px minimum touch targets");
assert.match(cssSource, /:focus-visible/, "CSS must specify high-contrast :focus-visible rules");
assert.match(cssSource, /prefers-reduced-motion/, "CSS must honor prefers-reduced-motion");
assert.match(cssSource, /@media\s*\(max-width:/, "CSS must provide responsive mobile styling down to 360px");

// 6. Route Isolation & Integrity (Must NOT be integrated into App.tsx or routing.ts yet)
console.log("Checking route isolation invariants...");
const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
const routingSource = readFileSync(join(root, "src/routing.ts"), "utf8");

assert.doesNotMatch(
  appSource,
  /UniversalInputShell/,
  "App.tsx must not mount UniversalInputShell yet (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);
assert.doesNotMatch(
  routingSource,
  /UniversalInputShell/,
  "routing.ts must not reference UniversalInputShell yet (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);

console.log("PASS: Lane A6 Universal Input Shell contract verified.");
