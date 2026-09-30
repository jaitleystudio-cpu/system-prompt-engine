#!/usr/bin/env node
/**
 * Lane A8 Test Suite: Workflow Export UX & Offline Contracts Verification
 * Enforces:
 *  - 4 destination platforms: n8n, make, zapier, generic
 *  - Preservation / Degradation receipt fields:
 *    preservedFields, transformedFields, unsupportedFields, manualStepsRequired
 *  - Zero credential / OAuth / token prompts (strictly offline file export)
 *  - Mobile reflow (360px), 44px touch targets, prefers-reduced-motion
 *  - Isolation: ROUTE_MOUNT_STATUS=NOT_INTEGRATED, PRODUCT_INTEGRATED=NO
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const exportersPath = join(root, "src/export/workflowExporters.ts");
const modalPath = join(root, "src/export/WorkflowExportModal.tsx");
const cssPath = join(root, "src/export/workflow-export.css");

console.log("Checking Lane A8 file existence...");
assert.ok(existsSync(exportersPath), "workflowExporters.ts must exist");
assert.ok(existsSync(modalPath), "WorkflowExportModal.tsx must exist");
assert.ok(existsSync(cssPath), "workflow-export.css must exist");

const exportersSource = readFileSync(exportersPath, "utf8");
const modalSource = readFileSync(modalPath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

// 1. Verify 4 Destination Platforms
console.log("Checking 4 Destination Platforms...");
const PLATFORMS = ["n8n", "make", "zapier", "generic"];
for (const p of PLATFORMS) {
  assert.ok(
    exportersSource.includes(`"${p}"`) || exportersSource.includes(`'${p}'`),
    `workflowExporters.ts must support platform: ${p}`
  );
  assert.ok(
    modalSource.includes(`"${p}"`) || modalSource.includes(`'${p}'`),
    `WorkflowExportModal.tsx must support platform: ${p}`
  );
}

// 2. Verify Preservation / Degradation Receipt Standards
console.log("Checking Preservation / Degradation Receipt Standard...");
const RECEIPT_FIELDS = [
  "preservedFields",
  "transformedFields",
  "unsupportedFields",
  "manualStepsRequired"
];
for (const rf of RECEIPT_FIELDS) {
  assert.ok(
    exportersSource.includes(rf),
    `workflowExporters.ts must define receipt field: ${rf}`
  );
  assert.ok(
    modalSource.includes(rf),
    `WorkflowExportModal.tsx must display receipt field: ${rf}`
  );
}

// 3. No OAuth / Credential Prompt Invariant
console.log("Checking zero OAuth / credential request ban...");
const FORBIDDEN_AUTH_TERMS = [
  /\boauth\b/i,
  /\bclient_secret\b/i,
  /\bapi_key\s*input\b/i,
  /\bpassword\s*field\b/i,
  /\blogin\s*to\s*export\b/i
];
for (const term of FORBIDDEN_AUTH_TERMS) {
  assert.doesNotMatch(
    exportersSource,
    term,
    `workflowExporters must not contain auth terms: ${term}`
  );
  assert.doesNotMatch(
    modalSource,
    term,
    `WorkflowExportModal must not contain auth terms: ${term}`
  );
}

// 4. CSS Accessibility & Touch Target Rules
console.log("Checking CSS standards in workflow-export.css...");
assert.match(cssSource, /44px/, "workflow-export.css must enforce 44px minimum touch targets");
assert.match(cssSource, /:focus-visible/, "workflow-export.css must define :focus-visible rules");
assert.match(cssSource, /prefers-reduced-motion/, "workflow-export.css must honor prefers-reduced-motion");
assert.match(cssSource, /@media\s*\(max-width:/, "workflow-export.css must include responsive breakpoints down to 360px");

// 5. Route Isolation & Product Integration Invariants
console.log("Checking route isolation invariants...");
const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
const routingSource = readFileSync(join(root, "src/routing.ts"), "utf8");

assert.doesNotMatch(
  appSource,
  /<WorkflowExportModal\s*\/>/,
  "WorkflowExportModal must NOT be mounted into App.tsx (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);
assert.doesNotMatch(
  routingSource,
  /workflow-export/,
  "routing.ts must not reference workflow-export route yet (ROUTE_MOUNT_STATUS=NOT_INTEGRATED)"
);

console.log("PASS: Lane A8 Workflow Export UX & Offline Contracts verified.");
