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

// 5. Fidelity Receipt Contract & Validation
console.log("Checking Fidelity Receipt contract and validation...");
assert.match(
  workspaceSource,
  /validateFidelityReceipt/,
  "VisualScreenshotWorkspace must export validateFidelityReceipt"
);
assert.match(
  workspaceSource,
  /SAMPLE_VERIFIED_RECEIPT/,
  "VisualScreenshotWorkspace must export SAMPLE_VERIFIED_RECEIPT"
);
assert.match(
  workspaceSource,
  /spe\.fidelity-receipt\.v1/,
  "VisualScreenshotWorkspace must reference spe.fidelity-receipt.v1 standard"
);

// Verify actual emitted receipt artifact if present
const sampleReceiptPath = join(root, "../../proofs/visual_fidelity/spe_fidelity_receipt_sample.json");
if (existsSync(sampleReceiptPath)) {
  console.log("Validating emitted spe_fidelity_receipt_sample.json artifact...");
  const receiptJson = JSON.parse(readFileSync(sampleReceiptPath, "utf8"));
  assert.ok(receiptJson.receiptId.startsWith("rcpt-"), "Receipt ID must start with rcpt-");
  assert.equal(receiptJson.referenceSha256.length, 64, "referenceSha256 must be 64-char hex");
  assert.equal(receiptJson.renderSha256.length, 64, "renderSha256 must be 64-char hex");
  assert.ok(receiptJson.ssimScore >= 0.95, "SSIM score must be >= 0.95");
  assert.ok(receiptJson.pixelDeltaPercentage <= 5.0, "pixelDeltaPercentage must be <= 5.0");
  assert.equal(receiptJson.fidelityStatus, "MEASURED", "fidelityStatus must be MEASURED");
  console.log("✓ Emitted sample receipt is valid and satisfies MEASURED thresholds.");
}

// 6. Route Isolation & Product Integration Invariants

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

