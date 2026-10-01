#!/usr/bin/env node
/**
 * Lane A8 ownership tests.
 * The UI consumes spe.workflow-export.v1. It does not project n8n, Make, or Zapier.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viewModelPath = join(root, "src/export/workflowExportViewModel.ts");
const fixturesPath = join(root, "src/export/workflowExportFixtures.ts");
const modalPath = join(root, "src/export/WorkflowExportModal.tsx");
const cssPath = join(root, "src/export/workflow-export.css");
const exporterPath = join(root, "src/export/workflowExporters.ts");

assert.equal(existsSync(exporterPath), false, "workflowExporters.ts must not exist");
assert.ok(existsSync(viewModelPath), "workflowExportViewModel.ts must exist");
assert.ok(existsSync(fixturesPath), "workflowExportFixtures.ts must exist");
assert.ok(existsSync(modalPath), "WorkflowExportModal.tsx must exist");
assert.ok(existsSync(cssPath), "workflow-export.css must exist");

const viewModel = readFileSync(viewModelPath, "utf8");
const fixtures = readFileSync(fixturesPath, "utf8");
const modal = readFileSync(modalPath, "utf8");
const css = readFileSync(cssPath, "utf8");

assert.match(viewModel, /spe\.workflow-export\.v1/);
assert.match(viewModel, /LIVE_IMPORT_STATUS = "UNVERIFIED"/);
assert.match(viewModel, /RUNTIME_BINDING = "NOT_INTEGRATED"/);
assert.match(fixtures, /TEST_FIXTURES_ONLY/);
assert.match(fixtures, /4c916d77b211e2fee33ec1be69c389a8687128a7/);
assert.doesNotMatch(modal, /workflowExporters/);
assert.doesNotMatch(modal, /generateWorkflowExport/);
assert.match(modal, /presentExportDocument/);
assert.match(modal, /LIVE_IMPORT_STATUS/);

const projectionMarkers = [
  "exportToN8n",
  "exportToMake",
  "exportToZapier",
  "n8n-nodes-base.webhook",
  "openai-gpt3:createCompletion",
  "losslessnessScore",
  "works in n8n",
  "ready for Make",
  "Zapier compatible",
];
for (const marker of projectionMarkers) {
  assert.equal(viewModel.includes(marker), false, `view model must not contain ${marker}`);
  assert.equal(modal.includes(marker), false, `modal must not contain ${marker}`);
}

for (const field of ["loss_state", "fidelity", "warnings", "stripped_paths", "target_document"]) {
  assert.ok(viewModel.includes(field), `view model must read ${field}`);
}
assert.match(modal, /strippedPaths/);
assert.match(modal, /lossState/);
assert.match(modal, /warnings/);

for (const term of [/\boauth\b/i, /\bclient_secret\b/i, /\bfetch\(/]) {
  assert.doesNotMatch(viewModel, term, `view model must not contain ${term}`);
  assert.doesNotMatch(modal, term, `modal must not contain ${term}`);
}

assert.match(css, /44px/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /@media\s*\(max-width:/);

const appSource = readFileSync(join(root, "src/App.tsx"), "utf8");
const routingSource = readFileSync(join(root, "src/routing.ts"), "utf8");
assert.doesNotMatch(appSource, /<WorkflowExportModal/);
assert.doesNotMatch(routingSource, /workflow-export/);

console.log("PASS: Lane A8 workflow export UI is display-only.");
