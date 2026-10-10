#!/usr/bin/env node
/**
 * Test battery for SPE Ω Conversion Positioning & Value Comparison Matrix.
 * Verifies Constitutional Copywriting Laws, Formula A, Formula B, Developer CTAs,
 * Value Comparison Matrix contents, and presentation invariants.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kernelPath = join(root, "src/landing/ConversionKernel.tsx");
const matrixPath = join(root, "src/landing/ValueComparisonMatrix.tsx");
const cssPath = join(root, "src/landing/conversion-kernel.css");
const heroPath = join(root, "src/landing/Hero.tsx");
const appPath = join(root, "src/App.tsx");

console.log("=== Running SPE Ω Conversion Positioning Verification Battery ===");

// 1. Component existence
assert.ok(existsSync(kernelPath), "ConversionKernel.tsx must exist");
assert.ok(existsSync(matrixPath), "ValueComparisonMatrix.tsx must exist");
assert.ok(existsSync(cssPath), "conversion-kernel.css must exist");

const kernel = readFileSync(kernelPath, "utf8");
const matrix = readFileSync(matrixPath, "utf8");
const css = readFileSync(cssPath, "utf8");
const hero = readFileSync(heroPath, "utf8");
const app = readFileSync(appPath, "utf8");

// 2. Integration into Hero and App
assert.match(hero, /ConversionKernel/, "Hero.tsx must import ConversionKernel");
assert.match(hero, /<ConversionKernel\s+onNavigate=\{p\.onNavigate\}\s*\/>/, "Hero.tsx must render ConversionKernel with onNavigate");
assert.match(app, /ValueComparisonMatrix/, "App.tsx must import ValueComparisonMatrix");
assert.match(app, /<ValueComparisonMatrix\s+onNavigate=\{setView\}\s*\/>/, "App.tsx must render ValueComparisonMatrix on home view");
console.log("✓ Integration into Hero.tsx and App.tsx verified");

// 3. Formula A verification ($20 Subscription Killer)
assert.match(kernel, /Stop paying \$20\/month just to review AI agent error logs\./, "Formula A headline present");
assert.match(kernel, /SPE is the 100% free, offline CLI and browser workspace that reviews agent reports, catches silent regressions, and compiles the next atomic task contract at \$0 cost\./, "Formula A subheadline present");
assert.match(kernel, /Install Free CLI: npm install -g @systempromptengine\/cli/, "Formula A primary CTA present");
assert.match(kernel, /Explore 1-Click Business Workflows →/, "Formula A secondary CTA present");
console.log("✓ Formula A ($20 Subscription Killer) verified");

// 4. Formula B verification (Broken Agent & Regression Stopper)
assert.match(kernel, /Tired of your AI coding agent running in circles and breaking working code\?/, "Formula B headline present");
assert.match(kernel, /SPE locks your requirements with ProtectedIntent invariants\. If an agent hallucinates, skips tests, or touches forbidden files, SPE blocks the regression before it merges\./, "Formula B subheadline present");
assert.match(kernel, /Adopt in Your Repo \(\$ npx @systempromptengine\/cli adopt \.\)/, "Formula B primary CTA present");
assert.match(kernel, /Review Agent Logs via stdin: spe continue -/, "Formula B secondary CTA present");
console.log("✓ Formula B (Broken Agent Stopper) verified");

// 5. Value Comparison Matrix Content
assert.match(matrix, /Paying \$20\/mo to ChatGPT\/Claude just to paste terminal logs/, "Matrix row 1: Pain present");
assert.match(matrix, /Run `spe continue -` locally for \$0\.00 with instant terminal pipes/, "Matrix row 1: Solution present");
assert.match(matrix, /Agent claims \\"Task Completed!\\" but 4 unit tests are broken/, "Matrix row 2: Pain present");
assert.match(matrix, /Kleene-3 verification: tasks require tangible witness receipts/, "Matrix row 2: Solution present");
assert.match(matrix, /Prompts silently drift, leaking internal keys or system bounds/, "Matrix row 3: Pain present");
assert.match(matrix, /ProtectedIntent compiler halts pull requests on invariant violations/, "Matrix row 3: Solution present");
assert.match(matrix, /Cloud tools store your company prompts on their servers/, "Matrix row 4: Pain present");
assert.match(matrix, /100% WebAssembly in-browser sandbox — zero prompt bytes leave device/, "Matrix row 4: Solution present");
console.log("✓ Value Comparison Matrix content verified");

// 6. Developer CTAs & Commands
for (const cmd of [
  "npm install -g @systempromptengine/cli",
  "spe continue -",
  "npx @systempromptengine/cli adopt .",
]) {
  assert.ok(kernel.includes(cmd), `ConversionKernel must contain CLI command: ${cmd}`);
}
assert.match(matrix, /npm install -g @systempromptengine\/cli/, "Matrix footer contains npm install command");
assert.match(matrix, /Explore 1-Click Business Workflows →/, "Matrix footer contains workflows CTA");
console.log("✓ Developer CLI CTAs and commands verified");

// 7. Invariants & Proof Depth
assert.match(kernel, /data-copy-depth="PROOF"/, "ConversionKernel marked with PROOF depth");
assert.match(matrix, /data-copy-depth="PROOF"/, "ValueComparisonMatrix marked with PROOF depth");

// 8. Safe Clipboard & ARIA Tabpanel Contracts
assert.match(kernel, /copyTextSafe/, "ConversionKernel must use copyTextSafe helper");
assert.match(matrix, /copyTextSafe/, "ValueComparisonMatrix must use copyTextSafe helper");
assert.match(kernel, /role="tabpanel"/, "ConversionKernel must define role=tabpanel");
assert.match(kernel, /aria-controls="panel-formula-a"/, "Tab A must control panel A");
assert.match(kernel, /aria-controls="panel-formula-b"/, "Tab B must control panel B");
console.log("✓ Safe clipboard and ARIA tabpanel contracts verified");

// 9. Anti-Jargon Law Compliance
for (const jargon of ["Horn logic", "epistemic compilation", "counterfactual witness"]) {
  assert.ok(!kernel.toLowerCase().includes(jargon.toLowerCase()), `ConversionKernel must not contain forbidden jargon: ${jargon}`);
  assert.ok(!matrix.toLowerCase().includes(jargon.toLowerCase()), `ValueComparisonMatrix must not contain forbidden jargon: ${jargon}`);
}
console.log("✓ Anti-Jargon Law verified (zero forbidden marketing jargon)");

// 10. Accessibility & High-End Design
assert.match(css, /min-height:\s*44px/, "Touch target minimum 44px");
assert.match(css, /:focus-visible/, "Focus visible outlines specified");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "Reduced motion fallbacks specified");
assert.match(css, /#090d16|#080c14/, "High-contrast dark-mode backgrounds specified");
console.log("✓ A11y, touch target, and high-end styling contracts verified");

console.log("================================================================");
console.log("🎉 ALL SPE Ω CONVERSION POSITIONING VERIFICATIONS PASSED!");
console.log("================================================================");
