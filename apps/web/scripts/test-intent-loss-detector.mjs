#!/usr/bin/env node
/**
 * SPE Ω — Intent Loss Detector (ILD) Test Battery
 * Crown Breakthrough Capability #1
 *
 * Mandate:
 * Grounded in ST-WebAgentBench (ICLR 2026) and Counterfactual Specification Closure.
 * Verifies that complex user requirements (required, optional, negative constraints)
 * are never silently dropped during prompt synthesis or model transcompilation.
 */

import assert from "node:assert/strict";

const { RequirementExtractor } = await import(
  "../src/engine/intentLossDetector/requirementExtractor.ts"
);
const { IntentLossDetector } = await import(
  "../src/engine/intentLossDetector/intentLossDetector.ts"
);

console.log("========================================================");
console.log("SPE Ω — INTENT LOSS DETECTOR (ILD) VERIFICATION BATTERY");
console.log("========================================================");

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

const extractor = new RequirementExtractor();
const detector = new IntentLossDetector();

// Suite 1: Requirement Extraction
console.log("\n[Suite 1: Requirement Extraction & Negative Constraint Identification]");

test("Extracts positive requirements from multi-clause text", () => {
  const reqs = extractor.extractFromText("Must implement user registration workflow; Ensure 100% offline air-gap");
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].category, "MANDATORY_POSITIVE");
  assert.equal(reqs[0].isNegative, false);
});

test("Extracts negative constraints with CRITICAL criticality", () => {
  const reqs = extractor.extractFromText("Must not use external CDNs; Never call window.eval");
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].category, "NEGATIVE_CONSTRAINT");
  assert.equal(reqs[0].isNegative, true);
  assert.equal(reqs[0].criticality, "CRITICAL");
  assert.equal(reqs[1].category, "NEGATIVE_CONSTRAINT");
  assert.equal(reqs[1].isNegative, true);
});

test("Extracts boundary conditions and format constraints", () => {
  const reqs = extractor.extractFromText("100% local offline air-gap; Format must be strict json only");
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].category, "BOUNDARY_CONDITION");
  assert.equal(reqs[1].category, "FORMAT_CONSTRAINT");
});

test("Extracts from structured IntentAtom arrays", () => {
  const atoms = [
    { id: "req-pos-1", label: "MUST FOLLOW", text: "Target node v24" },
    { id: "req-neg-2", label: "MUST NOT", text: "Do not import lodash" },
  ];
  const reqs = extractor.extractFromIntentAtoms(atoms);
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].isNegative, false);
  assert.equal(reqs[1].isNegative, true);
  assert.equal(reqs[1].category, "NEGATIVE_CONSTRAINT");
});

// Suite 2: Negative Constraint Preservation vs Dropping
console.log("\n[Suite 2: Negative Constraint Preservation & Intent Loss]");

test("Detects PRESERVED negative constraint when prohibition is articulated", () => {
  const source = "Must not use external CDNs; Never call eval";
  const output = "System directive: You must build a secure app. Do not use external CDNs under any condition. Never call eval.";
  const report = detector.evaluateIntentFidelity(source, output);
  assert.equal(report.preservedCount, 2);
  assert.equal(report.droppedNegativeConstraints, 0);
  assert.equal(report.passed, true);
  assert.equal(report.criticalDefectsDetected, false);
});

test("Detects DROPPED negative constraint when prohibition is missing", () => {
  const source = "Must not use external CDNs; Must generate TypeScript interfaces";
  const output = "System directive: Generate TypeScript interfaces for the client models.";
  const report = detector.evaluateIntentFidelity(source, output);
  assert.equal(report.droppedNegativeConstraints, 1);
  assert.equal(report.passed, false);
  assert.equal(report.criticalDefectsDetected, true);
  const droppedFinding = report.findings.find((f) => f.requirement.isNegative);
  assert.equal(droppedFinding.state, "DROPPED");
  assert.equal(droppedFinding.severity, "HIGH_RISK_DROPPED_NEGATIVE_CONSTRAINT");
});

test("Detects CONTRADICTED negative constraint when prohibited action is authorized", () => {
  const source = "Must not use eval";
  const output = "System directive: You can use eval to dynamically parse the JSON response.";
  const report = detector.evaluateIntentFidelity(source, output);
  assert.equal(report.contradictedCount, 1);
  assert.equal(report.passed, false);
  const contradictedFinding = report.findings.find((f) => f.requirement.isNegative);
  assert.equal(contradictedFinding.state, "CONTRADICTED");
  assert.equal(contradictedFinding.severity, "CRITICAL_INTENT_LOSS");
});

// Suite 3: Positive & Weakened Requirements
console.log("\n[Suite 3: Positive Requirement Weakening & Omission]");

test("Detects WEAKENED requirement when mandatory requirement is demoted to optional", () => {
  const source = "Must enforce strict TypeScript types";
  const output = "System directive: It is optional if preferred to add TypeScript types.";
  const report = detector.evaluateIntentFidelity(source, output);
  assert.equal(report.weakenedCount, 1);
  const finding = report.findings[0];
  assert.equal(finding.state, "WEAKENED");
  assert.equal(finding.severity, "MODERATE_OPTIONAL_DEGRADATION");
});

test("Detects DROPPED positive requirement when omitted", () => {
  const source = "Must implement WebAssembly cryptographic verification";
  const output = "System directive: Provide an HTML form for user registration.";
  const report = detector.evaluateIntentFidelity(source, output);
  assert.equal(report.droppedCount, 1);
  const finding = report.findings[0];
  assert.equal(finding.state, "DROPPED");
});

// Suite 4: Remediation Plan & Restored Safeguards
console.log("\n[Suite 4: Remediation Suggestions & Restoration Plan]");

test("Generates restored prompt with <restored_intent_safeguards>", () => {
  const source = "Must not leak user session tokens; Must enforce offline air-gap";
  const incompleteOutput = "System prompt: You are a coding assistant.";
  const report = detector.evaluateIntentFidelity(source, incompleteOutput);
  assert.equal(report.passed, false);
  assert.ok(report.restorationSuggestion.restoredPrompt.includes("<restored_intent_safeguards>"));
  assert.ok(report.restorationSuggestion.restoredPrompt.includes("[CRITICAL_BOUNDARY] Must not leak user session tokens"));
  assert.ok(report.restorationSuggestion.reconstructedRules.length >= 1);
});

test("Detects 3-letter acronym requirements and preserves when present, flags when dropped", () => {
  const source = "Must use JWT";
  const reportDropped = detector.evaluateIntentFidelity(source, "Create an HTML page with blue background.");
  assert.equal(reportDropped.droppedCount, 1);
  assert.equal(reportDropped.findings[0].state, "DROPPED");

  const reportPreserved = detector.evaluateIntentFidelity(source, "Enforce JWT authentication header on requests.");
  assert.equal(reportPreserved.preservedCount, 1);
  assert.equal(reportPreserved.findings[0].state, "PRESERVED");
});

test("Correctly classifies affirmative double negation without flagging contradiction", () => {
  const source = "Never fail to include external styles; Do not forget to encrypt passwords";
  const reqs = extractor.extractFromText(source);
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].isNegative, false);
  assert.equal(reqs[1].isNegative, false);

  const prompt = "Always include external styles in head. Encrypt passwords using bcrypt.";
  const report = detector.evaluateIntentFidelity(source, prompt);
  assert.equal(report.contradictedCount, 0);
  assert.equal(report.preservedCount, 2);
  assert.equal(report.passed, true);
});

test("Handles compound negative-positive constraints cleanly without false contradiction", () => {
  const source = "Must not use external CDNs, use local cache instead";
  const reqs = extractor.extractFromText(source);
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].isNegative, true);
  assert.equal(reqs[1].isNegative, false);

  const prompt = "Do not use external CDNs. Use local cache.";
  const report = detector.evaluateIntentFidelity(source, prompt);
  assert.equal(report.contradictedCount, 0);
  assert.equal(report.preservedCount, 2);
  assert.equal(report.passed, true);
});

console.log("\n========================================================");
console.log(`TOTAL ILD TESTS PASSED: ${testsPassed} / 13`);
console.log("========================================================\n");
