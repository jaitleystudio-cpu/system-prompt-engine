#!/usr/bin/env node
/**
 * Lane A12 Test Suite: Visual / Screenshot UI Foundation Verification
 * Enforces:
 *  - Visual evidence vs Screenshot Candidate UI workflow
 *  - Canonical CODE_TARGETS usage only (no invented targets)
 *  - Mandatory truth labels:
 *    OCR: OBSERVED / UNKNOWN
 *    assets: FOUND / INFERRED / UNKNOWN
 *    responsive: OBSERVED / INFERRED / UNKNOWN
 *    visual fidelity: MEASURED / UNPROVEN
 *  - Strict ban on "100% pixel perfect" hype and fake fidelity claims
 *  - 44px touch targets, :focus-visible, prefers-reduced-motion, 360px reflow
 *  - Isolation: ROUTE_MOUNT_STATUS=NOT_INTEGRATED, PRODUCT_INTEGRATED=NO
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const workspacePath = join(root, "src/media/VisualScreenshotWorkspace.tsx");
const cssPath = join(root, "src/media/visual-workspace.css");

console.log("Checking Lane A12 file existence...");
assert.ok(existsSync(workspacePath), "VisualScreenshotWorkspace.tsx must exist");
assert.ok(existsSync(cssPath), "visual-workspace.css must exist");

const workspaceSource = readFileSync(workspacePath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

// 1. Verify Mandatory Truth Labels
console.log("Checking mandatory truth labels...");
const REQUIRED_TRUTH_LABELS = [
  /OCR:\s*(OBSERVED|UNKNOWN)/i,
  /assets:\s*(FOUND|INFERRED|UNKNOWN)/i,
  /responsive:\s*(OBSERVED|INFERRED|UNKNOWN)/i,
  /fidelity:\s*(MEASURED|UNPROVEN)/i,
];

for (const labelRegex of REQUIRED_TRUTH_LABELS) {
  assert.match(
    workspaceSource,
    labelRegex,
    `VisualScreenshotWorkspace must explicitly display truth label matching: ${labelRegex}`
  );
}

// 2. Ban on "100% pixel perfect" hype
console.log("Checking ban on 100% pixel perfect claims...");
const HYPE_PATTERNS = [
  /100%\s*pixel[\s-]*perfect/i,
  /pixel[\s-]*perfect\s*guarantee/i,
  /flawless\s*code\s*generation/i,
];

for (const pattern of HYPE_PATTERNS) {
  assert.doesNotMatch(
    workspaceSource,
    pattern,
    `VisualScreenshotWorkspace must not contain hype claim: ${pattern}`
  );
}

// 2b. Evidence semantics: pixel notes are not OCR evidence; labels must match implemented limits.
console.log("Checking visual truth semantics...");
assert.doesNotMatch(
  workspaceSource,
  /ocrStatus:\s*imageObs\s*&&\s*imageObs\.notes/i,
  "Visual workspace must not infer OCR observation from generic image notes"
);
assert.match(
  workspaceSource,
  /ocrStatus:\s*"UNKNOWN"/,
  "OCR must stay UNKNOWN until canonical OCR evidence is actually wired"
);
assert.doesNotMatch(
  workspaceSource,
  /verified compiler target generation/i,
  "Workspace must not label target generation verified without candidate-bound evidence"
);
assert.doesNotMatch(
  workspaceSource,
  /up to 20MB/i,
  "Workspace copy must not contradict the 25 MB image-bound implementation"
);

// 3. Supported Compiler Targets Only
console.log("Checking compiler targets alignment...");
assert.match(
  workspaceSource,
  /CODE_TARGETS/,
  "VisualScreenshotWorkspace must consume canonical CODE_TARGETS"
);

// 4. CSS Accessibility & Touch Target Rules
console.log("Checking CSS standards in visual-workspace.css...");
assert.match(cssSource, /44px/, "visual-workspace.css must enforce 44px minimum touch targets");
assert.match(cssSource, /:focus-visible/, "visual-workspace.css must define :focus-visible rules");
assert.match(cssSource, /prefers-reduced-motion/, "visual-workspace.css must honor prefers-reduced-motion");
assert.match(cssSource, /@media\s*\(max-width:/, "visual-workspace.css must include mobile breakpoints down to 360px");

// 5. Route Isolation & Product Integration Invariants
console.log("Checking route isolation invariants...");
const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
const routingSource = readFileSync(join(root, "src/routing.ts"), "utf8");

assert.doesNotMatch(
  appSource,
  /<VisualScreenshotWorkspace\s*\/>/,
  "VisualScreenshotWorkspace must NOT be mounted into App.tsx (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);
assert.doesNotMatch(
  routingSource,
  /visual-screenshot/,
  "routing.ts must not reference visual-screenshot route yet (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);

console.log("PASS: Lane A12 Visual / Screenshot UI Foundation verified.");
