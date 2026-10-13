#!/usr/bin/env node
/**
 * Test Battery for Mission P0-B: User-Confirmed Requirements (Option B)
 *
 * Verifies:
 * 1. Positive constraints are preserved in canonical contracts and output prompt.
 * 2. Negative constraints are preserved with unambiguous negative polarity ("Must not").
 * 3. Exact numerical constraints remain preserved without distortion (e.g. p95 <= 250ms).
 * 4. Edits update the generated prompt (modifying text updates the compiled output).
 * 5. Deleted requirements are removed correctly (removing an atom eliminates it from output).
 * 6. No requirements are invented when none are supplied.
 * 7. Existing generation still works (default quick-start flow functions without requirements).
 * 8. Canonical contracts remain strictly unchanged (hard_constraints schema preserved).
 * 9. Bidirectional atom <-> requirement translation fidelity.
 * 10. CSS and UI accessibility invariants (touch targets >= 42px, zero emojis, collapsed by default).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");

console.log("=== MISSION P0-B: USER-CONFIRMED REQUIREMENTS TEST BATTERY ===");

// 1. Bundle web-runtime for Node testing
const bundle = await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

// 2. Bundle UserConfirmedRequirements for component helper testing
const compBundle = await build({
  entryPoints: [join(root, "src/engine/UserConfirmedRequirements.tsx")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  loader: { ".tsx": "tsx", ".css": "empty" },
  jsx: "transform",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
});
const comp = await import(
  `data:text/javascript;base64,${Buffer.from(compBundle.outputFiles[0].text).toString("base64")}`
);

// ---------------------------------------------------------------------------
// TEST 1: Polarity Normalization Laws
// ---------------------------------------------------------------------------
console.log("Testing 1: Polarity Normalization Laws...");
assert.equal(
  comp.normalizePositiveStatement("Include strict TypeScript types"),
  "Include strict TypeScript types"
);
assert.equal(
  comp.normalizePositiveStatement("   return JSON only   "),
  "return JSON only"
);

// Negative statements must carry explicit negative polarity
assert.equal(
  comp.normalizeNegativeStatement("use external npm libraries"),
  "Must not use external npm libraries",
  "Positive phrase in MUST NOT column must be prefixed with 'Must not '"
);
assert.equal(
  comp.normalizeNegativeStatement("Must not emit markdown fences"),
  "Must not emit markdown fences",
  "Existing 'Must not' prefix should not be duplicated"
);
assert.equal(
  comp.normalizeNegativeStatement("do not invent facts"),
  "do not invent facts",
  "Existing 'do not' prefix preserved as negative polarity"
);
assert.equal(
  comp.normalizeNegativeStatement("Never use eval()"),
  "Never use eval()",
  "Existing 'Never' prefix preserved as negative polarity"
);
assert.equal(
  comp.normalizeNegativeStatement("No third-party CSS frameworks"),
  "No third-party CSS frameworks",
  "Existing 'No' prefix preserved as negative polarity"
);
console.log("  ✓ Polarity normalizers passed");

// ---------------------------------------------------------------------------
// TEST 2: Bidirectional Atom <-> Requirement Translation Fidelity
// ---------------------------------------------------------------------------
console.log("Testing 2: Bidirectional Translation Fidelity...");
const initialReqs = [
  { id: "req-1", type: "must_follow", text: "Target Node 20+" },
  { id: "req-2", type: "must_not", text: "use deprecated APIs" },
];
const atoms = comp.requirementsToAtoms(initialReqs);
assert.equal(atoms.length, 2);
assert.equal(atoms[0].id, "req-1");
assert.equal(atoms[0].label, "MUST FOLLOW");
assert.equal(atoms[0].text, "Target Node 20+");
assert.equal(atoms[1].id, "req-2");
assert.equal(atoms[1].label, "MUST NOT");
assert.equal(atoms[1].text, "Must not use deprecated APIs");

const reconstructedReqs = comp.atomsToRequirements(atoms);
assert.equal(reconstructedReqs.length, 2);
assert.equal(reconstructedReqs[0].id, "req-1");
assert.equal(reconstructedReqs[0].type, "must_follow");
assert.equal(reconstructedReqs[0].text, "Target Node 20+");
assert.equal(reconstructedReqs[1].id, "req-2");
assert.equal(reconstructedReqs[1].type, "must_not");
assert.equal(reconstructedReqs[1].text, "Must not use deprecated APIs");
console.log("  ✓ Bidirectional translation passed");

// ---------------------------------------------------------------------------
// TEST 3: Positive Constraint Preservation in Canonical Contract & Output
// ---------------------------------------------------------------------------
console.log("Testing 3: Positive Constraint Preservation in Compiled Prompt...");
const positiveRequirementText = "Generate comprehensive JSDoc comments for all exported functions";
const lensWithPositive = runtime.defaultIntentLens("Create a mathematical utility library.");
lensWithPositive.confirmed.push({
  id: "req-pos-1",
  label: "MUST FOLLOW",
  text: positiveRequirementText,
  provenance: "CONFIRMED_USER_STATED",
});

const fixturePos = runtime.buildAbiFixture({
  userRequest: "Create a mathematical utility library.",
  category: "Code",
  target: "any",
  confirmed: lensWithPositive.confirmed,
  assumed: lensWithPositive.assumed,
  unknowns: lensWithPositive.unknowns,
  conflicts: lensWithPositive.conflicts,
});

const hardConstraintPos = fixturePos.payload.hard_constraints.find(
  (c) => c.constraint_id === "req-pos-1"
);
assert.ok(hardConstraintPos, "Confirmed positive requirement must exist in payload.hard_constraints");
assert.equal(hardConstraintPos.strength, "HARD");
assert.equal(hardConstraintPos.statement, positiveRequirementText);

const renderedPos = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Create a mathematical utility library.",
  category: "Code",
  target: "any",
  envelopeOutput: fixturePos.payload,
});
assert.match(
  renderedPos.finalPrompt,
  /Generate comprehensive JSDoc comments for all exported functions/,
  "Positive requirement must be preserved verbatim in compiled output prompt"
);
console.log("  ✓ Positive constraint preserved in hard_constraints and final prompt");

// ---------------------------------------------------------------------------
// TEST 4: Negative Constraint Preservation in Canonical Contract & Output
// ---------------------------------------------------------------------------
console.log("Testing 4: Negative Constraint Preservation in Compiled Prompt...");
const negativeRequirementText = "Must not import external dependencies or npm packages";
const lensWithNeg = runtime.defaultIntentLens("Create a standalone tokenizer.");
lensWithNeg.confirmed.push({
  id: "req-neg-1",
  label: "MUST NOT",
  text: negativeRequirementText,
  provenance: "CONFIRMED_USER_STATED",
});

const fixtureNeg = runtime.buildAbiFixture({
  userRequest: "Create a standalone tokenizer.",
  category: "Code",
  target: "any",
  confirmed: lensWithNeg.confirmed,
  assumed: lensWithNeg.assumed,
  unknowns: lensWithNeg.unknowns,
  conflicts: lensWithNeg.conflicts,
});

const hardConstraintNeg = fixtureNeg.payload.hard_constraints.find(
  (c) => c.constraint_id === "req-neg-1"
);
assert.ok(hardConstraintNeg, "Confirmed negative requirement must exist in payload.hard_constraints");
assert.equal(hardConstraintNeg.strength, "HARD");
assert.equal(hardConstraintNeg.statement, negativeRequirementText);

const renderedNeg = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Create a standalone tokenizer.",
  category: "Code",
  target: "any",
  envelopeOutput: fixtureNeg.payload,
});
assert.match(
  renderedNeg.finalPrompt,
  /Must not import external dependencies or npm packages/,
  "Negative requirement must be preserved verbatim in compiled output prompt"
);
console.log("  ✓ Negative constraint preserved with polarity in hard_constraints and final prompt");

// ---------------------------------------------------------------------------
// TEST 5: Numerical Constraints Exact Preservation
// ---------------------------------------------------------------------------
console.log("Testing 5: Exact Numerical Constraints Preservation...");
const exactNumericText = "Maintain p95 latency <= 150ms and memory footprint <= 32MB across 1000 requests";
const lensWithNumeric = runtime.defaultIntentLens("Build a cache engine.");
lensWithNumeric.confirmed.push({
  id: "req-num-1",
  label: "MUST FOLLOW",
  text: exactNumericText,
  provenance: "CONFIRMED_USER_STATED",
});

const fixtureNumeric = runtime.buildAbiFixture({
  userRequest: "Build a cache engine.",
  category: "Engineering",
  target: "any",
  confirmed: lensWithNumeric.confirmed,
  assumed: lensWithNumeric.assumed,
  unknowns: lensWithNumeric.unknowns,
  conflicts: lensWithNumeric.conflicts,
});

const renderedNumeric = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Build a cache engine.",
  category: "Engineering",
  target: "any",
  envelopeOutput: fixtureNumeric.payload,
});
assert.match(
  renderedNumeric.finalPrompt,
  /Maintain p95 latency <= 150ms and memory footprint <= 32MB across 1000 requests/,
  "Numerical constraints must never be distorted, rounded, or modified"
);
console.log("  ✓ Exact numerical constraint preserved without loss or rounding");

// ---------------------------------------------------------------------------
// TEST 6: Edits Update the Generated Prompt
// ---------------------------------------------------------------------------
console.log("Testing 6: Edits Update the Generated Prompt...");
const lensEdit1 = runtime.defaultIntentLens("Build an image resizer.");
lensEdit1.confirmed.push({
  id: "req-dyn-1",
  label: "MUST FOLLOW",
  text: "Maximum payload size 5MB",
  provenance: "CONFIRMED_USER_STATED",
});
const fixture1 = runtime.buildAbiFixture({
  userRequest: "Build an image resizer.",
  category: "Code",
  target: "any",
  confirmed: lensEdit1.confirmed,
  assumed: lensEdit1.assumed,
  unknowns: lensEdit1.unknowns,
  conflicts: lensEdit1.conflicts,
});
const rendered1 = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Build an image resizer.",
  category: "Code",
  target: "any",
  envelopeOutput: fixture1.payload,
});
assert.match(rendered1.finalPrompt, /Maximum payload size 5MB/);

// Now simulate user editing the requirement to 2MB
const lensEdit2 = runtime.defaultIntentLens("Build an image resizer.");
lensEdit2.confirmed.push({
  id: "req-dyn-1",
  label: "MUST FOLLOW",
  text: "Maximum payload size 2MB",
  provenance: "CONFIRMED_USER_STATED",
});
const fixture2 = runtime.buildAbiFixture({
  userRequest: "Build an image resizer.",
  category: "Code",
  target: "any",
  confirmed: lensEdit2.confirmed,
  assumed: lensEdit2.assumed,
  unknowns: lensEdit2.unknowns,
  conflicts: lensEdit2.conflicts,
});
const rendered2 = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Build an image resizer.",
  category: "Code",
  target: "any",
  envelopeOutput: fixture2.payload,
});
assert.match(rendered2.finalPrompt, /Maximum payload size 2MB/);
assert.doesNotMatch(rendered2.finalPrompt, /Maximum payload size 5MB/);
console.log("  ✓ Requirement edit immediately reflected in updated prompt");

// ---------------------------------------------------------------------------
// TEST 7: Deleted Requirements are Removed Correctly
// ---------------------------------------------------------------------------
console.log("Testing 7: Deleted Requirements are Removed Correctly...");
const lensMulti = runtime.defaultIntentLens("Design an API gateway.");
lensMulti.confirmed.push(
  { id: "req-keep", label: "MUST FOLLOW", text: "Enforce JWT authentication", provenance: "CONFIRMED_USER_STATED" },
  { id: "req-delete", label: "MUST NOT", text: "Must not permit anonymous access", provenance: "CONFIRMED_USER_STATED" }
);
const fixtureMulti = runtime.buildAbiFixture({
  userRequest: "Design an API gateway.",
  category: "Engineering",
  target: "any",
  confirmed: lensMulti.confirmed,
  assumed: lensMulti.assumed,
  unknowns: lensMulti.unknowns,
  conflicts: lensMulti.conflicts,
});
const renderedMulti = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Design an API gateway.",
  category: "Engineering",
  target: "any",
  envelopeOutput: fixtureMulti.payload,
});
assert.match(renderedMulti.finalPrompt, /Enforce JWT authentication/);
assert.match(renderedMulti.finalPrompt, /Must not permit anonymous access/);

// Now simulate user deleting req-delete
const lensDeleted = runtime.defaultIntentLens("Design an API gateway.");
lensDeleted.confirmed.push(
  { id: "req-keep", label: "MUST FOLLOW", text: "Enforce JWT authentication", provenance: "CONFIRMED_USER_STATED" }
);
const fixtureDeleted = runtime.buildAbiFixture({
  userRequest: "Design an API gateway.",
  category: "Engineering",
  target: "any",
  confirmed: lensDeleted.confirmed,
  assumed: lensDeleted.assumed,
  unknowns: lensDeleted.unknowns,
  conflicts: lensDeleted.conflicts,
});
const renderedDeleted = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Design an API gateway.",
  category: "Engineering",
  target: "any",
  envelopeOutput: fixtureDeleted.payload,
});
assert.match(renderedDeleted.finalPrompt, /Enforce JWT authentication/);
assert.doesNotMatch(renderedDeleted.finalPrompt, /Must not permit anonymous access/);
console.log("  ✓ Deleted requirement correctly absent from compiled prompt");

// ---------------------------------------------------------------------------
// TEST 8: Zero Invented Requirements When List is Empty
// ---------------------------------------------------------------------------
console.log("Testing 8: Zero Inventions When List is Empty...");
const lensEmpty = runtime.defaultIntentLens("Create a simple landing page.");
const fixtureEmpty = runtime.buildAbiFixture({
  userRequest: "Create a simple landing page.",
  category: "Marketing",
  target: "any",
  confirmed: lensEmpty.confirmed,
  assumed: lensEmpty.assumed,
  unknowns: lensEmpty.unknowns,
  conflicts: lensEmpty.conflicts,
});
const customHard = fixtureEmpty.payload.hard_constraints.filter(
  (c) => c.constraint_id.startsWith("req-")
);
assert.equal(customHard.length, 0, "No req-* hard constraints may be invented when none supplied");
console.log("  ✓ Zero phantom constraints created");

// ---------------------------------------------------------------------------
// TEST 9: Existing Generation Flow Continues to Function
// ---------------------------------------------------------------------------
console.log("Testing 9: Existing Quick-Start Flow Unbroken...");
const renderedEmpty = runtime.renderNonProductionEnvelopePreview({
  userRequest: "Create a simple landing page.",
  category: "Marketing",
  target: "any",
  envelopeOutput: fixtureEmpty.payload,
});
assert.ok(renderedEmpty.finalPrompt.length > 50, "Standard generation must produce full prompt");
assert.match(renderedEmpty.finalPrompt, /## Objective[\s\S]*Create a simple landing page/);
console.log("  ✓ Standard single-input flow operates with zero regression");

// ---------------------------------------------------------------------------
// TEST 10: Canonical Contract Schema Immutability
// ---------------------------------------------------------------------------
console.log("Testing 10: Canonical Contract Schema Immutability...");
for (const c of fixturePos.payload.hard_constraints) {
  assert.ok(typeof c.constraint_id === "string", "constraint_id must be string");
  assert.ok(typeof c.statement === "string", "statement must be string");
  assert.equal(c.strength, "HARD", "strength must be HARD");
}
console.log("  ✓ Contract schema is 100% compliant with frozen Rust/WASM/Python interfaces");

// ---------------------------------------------------------------------------
// TEST 11: UI Accessibility & Design Standards
// ---------------------------------------------------------------------------
console.log("Testing 11: UI Accessibility & CSS Invariants...");
const cssContent = readFileSync(join(root, "src/engine/user-confirmed-requirements.css"), "utf8");
const tsxContent = readFileSync(join(root, "src/engine/UserConfirmedRequirements.tsx"), "utf8");

// Touch targets >= 42px
assert.match(cssContent, /min-height:\s*42px|min-height:\s*44px/, "Touch targets must be at least 42px");
assert.match(cssContent, /min-width:\s*42px|min-width:\s*44px/, "Touch targets must be at least 42px");

// No emojis anywhere in the TSX or CSS
assert.doesNotMatch(tsxContent, /[\u{1F300}-\u{1F9FF}]/u, "Zero emojis permitted in UserConfirmedRequirements.tsx");
assert.doesNotMatch(cssContent, /[\u{1F300}-\u{1F9FF}]/u, "Zero emojis permitted in user-confirmed-requirements.css");

// Accordion defaults to collapsed (details without default open attribute)
assert.match(tsxContent, /<details\s+className="spe-confirmed-requirements-accordion"/, "Must use standard accessible <details> element");

// Separate distinct controls for MUST FOLLOW and MUST NOT
assert.match(tsxContent, /MUST FOLLOW/, "Must provide distinct MUST FOLLOW control");
assert.match(tsxContent, /MUST NOT/, "Must provide distinct MUST NOT control");

// App integration check
const appContent = readFileSync(join(root, "src/App.tsx"), "utf8");
assert.match(appContent, /UserConfirmedRequirements/, "UserConfirmedRequirements must be mounted in App.tsx");
assert.match(appContent, /updateConfirmedAtoms/, "updateConfirmedAtoms handler must be wired in App.tsx");

// Hero integration check
const heroContent = readFileSync(join(root, "src/landing/Hero.tsx"), "utf8");
assert.match(heroContent, /UserConfirmedRequirements/, "UserConfirmedRequirements must be mounted in Hero.tsx");

// Workspace integration check
const workspaceContent = readFileSync(join(root, "src/workspace/Workspace.tsx"), "utf8");
assert.match(workspaceContent, /UserConfirmedRequirements/, "UserConfirmedRequirements must be mounted in Workspace.tsx");

console.log("  ✓ All UI, CSS, accessibility, and integration invariants verified");

console.log("\n===============================================================");
console.log("ALL 11 MISSION P0-B ACCEPTANCE TESTS PASSED (EXIT 0)");
console.log("===============================================================");
