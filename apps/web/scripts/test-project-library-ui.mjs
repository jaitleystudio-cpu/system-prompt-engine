#!/usr/bin/env node
/**
 * Lane A7: Project Library UI automated qualification test script.
 * Validates schema fidelity, privacy invariants, accessibility standards,
 * rollback handling, and route isolation.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const webRoot = path.resolve(__dirname, "..");

console.log("Checking Lane A7 file existence...");
const requiredFiles = [
  path.join(repoRoot, "schemas/project_library.schema.json"),
  path.join(webRoot, "src/library/projectLibraryModel.ts"),
  path.join(webRoot, "src/library/project-library.css"),
  path.join(webRoot, "src/library/ProjectLibraryView.tsx"),
];

for (const f of requiredFiles) {
  assert(fs.existsSync(f), `Missing required file: ${f}`);
}

console.log("Checking spe.project-library.v1 schema invariants...");
const schemaText = fs.readFileSync(path.join(repoRoot, "schemas/project_library.schema.json"), "utf8");
const schema = JSON.parse(schemaText);

assert.equal(schema.properties.schema.const, "spe.project-library.v1");
assert.equal(schema.properties.visibility.const, "private");
assert.equal(schema.properties.noindex.const, true);
assert.equal(schema.properties.indexing.const, "noindex");
assert.equal(schema.properties.spe_contract.const, "NOT_YET_BOUND");

console.log("Checking 6 artifact types & rollback support in model...");
const modelText = fs.readFileSync(path.join(webRoot, "src/library/projectLibraryModel.ts"), "utf8");
const expectedTypes = ["prompt", "transcript", "website", "code", "research_pack", "template"];
for (const t of expectedTypes) {
  assert(modelText.includes(`"${t}"`), `Missing artifact type: ${t}`);
}
assert(modelText.includes('kind: "HEAD_MOVE"'), "Missing HEAD_MOVE in model");
assert(modelText.includes('reason: "ROLLBACK"'), "Missing ROLLBACK in model");
assert(modelText.includes('spe_contract: "NOT_YET_BOUND"'), "Missing spe_contract NOT_YET_BOUND in model");

console.log("Checking UI accessibility & responsive CSS standards...");
const cssText = fs.readFileSync(path.join(webRoot, "src/library/project-library.css"), "utf8");
assert(cssText.includes(":focus-visible"), "Missing :focus-visible in project-library.css");
assert(cssText.includes("prefers-reduced-motion: reduce"), "Missing prefers-reduced-motion in project-library.css");
assert(cssText.includes("min-height: 44px"), "Missing 44px touch targets in project-library.css");
assert(cssText.includes("touch-action: manipulation"), "Missing touch-action: manipulation in project-library.css");
assert(cssText.includes("@media (max-width: 360px)"), "Missing 360px reflow in project-library.css");

console.log("Checking component accessibility & dialog focus trap...");
const viewText = fs.readFileSync(path.join(webRoot, "src/library/ProjectLibraryView.tsx"), "utf8");
assert(viewText.includes('role="region"'), "Missing region landmark in view");
assert(viewText.includes('role="dialog"'), "Missing modal dialog role");
assert(viewText.includes('aria-modal="true"'), "Missing aria-modal=true");
assert(viewText.includes('aria-label="SPE Project Library"'), "Missing region aria-label");
assert(viewText.includes("handleKeyDown"), "Missing modal keyboard handler");
assert(viewText.includes('e.key === "Escape"'), "Missing Escape close handler");
assert(viewText.includes('e.key === "Tab"'), "Missing Tab focus trap handler");

console.log("Checking Route Mount isolation...");
assert(modelText.includes('ROUTE_MOUNT_STATUS = "NOT_INTEGRATED"'), "ROUTE_MOUNT_STATUS must be NOT_INTEGRATED");
const appTsx = fs.readFileSync(path.join(webRoot, "src/App.tsx"), "utf8");
assert(!appTsx.includes("ProjectLibraryView"), "ProjectLibraryView must not be eagerly mounted in App.tsx");

console.log("PASS: Lane A7 Project Library UI contract verified.");
