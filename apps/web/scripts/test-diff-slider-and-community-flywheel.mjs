#!/usr/bin/env node
/**
 * Test battery for:
 * 1. Gap 2: Interactive Before vs After Diff Slider
 * 2. Gap 4: Submit a Verified Workflow Community PR Flywheel
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const diffComponentPath = join(root, "src/landing/BeforeAfterDiffSlider.tsx");
const diffCssPath = join(root, "src/landing/before-after-diff.css");
const modalComponentPath = join(root, "src/components/SubmitWorkflowModal.tsx");
const modalCssPath = join(root, "src/components/submit-workflow-modal.css");
const workflowsPath = join(root, "src/pages/WorkflowsCatalog.tsx");
const navPath = join(root, "src/layout/Nav.tsx");
const appPath = join(root, "src/App.tsx");

console.log("=== Running SPE Ω Diff Slider & Community Flywheel Verification ===");

// 1. Files existence
assert.ok(existsSync(diffComponentPath), "BeforeAfterDiffSlider.tsx must exist");
assert.ok(existsSync(diffCssPath), "before-after-diff.css must exist");
assert.ok(existsSync(modalComponentPath), "SubmitWorkflowModal.tsx must exist");
assert.ok(existsSync(modalCssPath), "submit-workflow-modal.css must exist");
assert.ok(existsSync(workflowsPath), "WorkflowsCatalog.tsx must exist");
assert.ok(existsSync(navPath), "Nav.tsx must exist");
assert.ok(existsSync(appPath), "App.tsx must exist");
console.log("✓ All component and stylesheet files exist");

const diff = readFileSync(diffComponentPath, "utf8");
const diffCss = readFileSync(diffCssPath, "utf8");
const modal = readFileSync(modalComponentPath, "utf8");
const modalCss = readFileSync(modalCssPath, "utf8");
const workflows = readFileSync(workflowsPath, "utf8");
const nav = readFileSync(navPath, "utf8");
const app = readFileSync(appPath, "utf8");

// 2. Integration into App.tsx
assert.match(app, /BeforeAfterDiffSlider/, "App.tsx must import BeforeAfterDiffSlider");
assert.match(app, /<BeforeAfterDiffSlider\s+onNavigate=\{setView\}\s*\/>/, "App.tsx must render BeforeAfterDiffSlider");
assert.match(app, /SubmitWorkflowModal/, "App.tsx must import SubmitWorkflowModal");
assert.match(app, /<SubmitWorkflowModal/, "App.tsx must render SubmitWorkflowModal");
console.log("✓ Integration into App.tsx verified");

// 3. BeforeAfterDiffSlider Invariants & Slider Mechanics
assert.match(diff, /role="slider"/, "Slider must define role=slider");
assert.match(diff, /aria-valuenow/, "Slider must declare aria-valuenow");
assert.match(diff, /aria-label="Comparison slider/, "Slider must declare descriptive aria-label");
assert.match(diff, /data-copy-depth="PROOF"/, "Diff component must carry PROOF copy depth");
assert.match(diff, /API Auth Refactor/, "Scenario 1 present");
assert.match(diff, /Database Migration/, "Scenario 2 present");
assert.match(diff, /Multi-File Feature/, "Scenario 3 present");
assert.match(diff, /142,500 tokens/, "Scenario 1 waste metrics present");
assert.match(diff, /npm install -g @systempromptengine\/cli/, "Developer CLI CTA present");
console.log("✓ BeforeAfterDiffSlider mechanics and empirical scenarios verified");

// 4. CSS Accessibility & Performance
assert.match(diffCss, /translate3d/, "GPU-accelerated transforms used in diff CSS");
assert.match(diffCss, /min-height:\s*44px/, "Touch target minimum 44px enforced in diff CSS");
assert.match(diffCss, /prefers-reduced-motion:\s*reduce/, "prefers-reduced-motion override present in diff CSS");
assert.match(diffCss, /#090d16|#080c14/, "High contrast luxury dark palette used");
console.log("✓ Diff slider CSS performance & accessibility verified");

// 5. Community PR Flywheel in WorkflowsCatalog & Nav
assert.match(workflows, /Submit a Workflow \(GitHub PR\)/, "WorkflowsCatalog contains submit PR CTA");
assert.match(workflows, /SubmitWorkflowModal/, "WorkflowsCatalog imports and renders SubmitWorkflowModal");
assert.match(workflows, /spe-workflow-contribute-banner/, "WorkflowsCatalog renders contributor banner");
assert.match(nav, /Submit Workflow/, "Nav contains Submit Workflow CTA");
console.log("✓ Community PR Flywheel in WorkflowsCatalog and Nav verified");

// 6. SubmitWorkflowModal Features
assert.match(modal, /role="dialog"/, "Modal defines role=dialog");
assert.match(modal, /aria-modal="true"/, "Modal defines aria-modal=true");
assert.match(modal, /github\.com\/systempromptengine\/system-prompt-engine/, "Modal links to GitHub PR creation");
assert.match(modal, /test:workflows-audit/, "Modal references automated CI audit test pass");
assert.match(modal, /copyTextSafe/, "Modal uses safe clipboard utility");
assert.match(modal, /data-copy-depth="PROOF"/, "Modal carries PROOF copy depth");
console.log("✓ SubmitWorkflowModal verified");

// 7. Anti-Jargon Law
for (const jargon of ["Horn logic", "epistemic compilation", "counterfactual witness"]) {
  assert.ok(!diff.toLowerCase().includes(jargon.toLowerCase()), `Diff slider must not contain forbidden jargon: ${jargon}`);
  assert.ok(!modal.toLowerCase().includes(jargon.toLowerCase()), `Modal must not contain forbidden jargon: ${jargon}`);
  assert.ok(!workflows.toLowerCase().includes(jargon.toLowerCase()), `Workflows catalog must not contain forbidden jargon: ${jargon}`);
}
console.log("✓ Anti-Jargon Law verified (zero forbidden marketing jargon)");

console.log("==================================================================");
console.log("🎉 ALL DIFF SLIDER & COMMUNITY FLYWHEEL TESTS PASSED! (7/7)");
console.log("==================================================================");
