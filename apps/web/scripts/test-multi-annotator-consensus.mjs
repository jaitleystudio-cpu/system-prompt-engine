#!/usr/bin/env node
import { evaluateMultiSeatConsensus, STANDARD_ENTERPRISE_RUBRIC } from '../src/engine/multiAnnotatorConsensus.ts';

console.log("==================================================================");
console.log("👥 Testing SPE Enterprise Multi-Annotator Consensus Engine");
console.log("==================================================================");

const sampleReviews = [
  {
    annotatorId: 'rev_alice',
    role: 'Principal Security Architect',
    scores: {
      invariant_adherence: 95,
      factual_precision: 90,
      owasp_resilience: 98,
      token_efficiency: 85,
      instruction_followthrough: 92
    },
    feedback: 'High invariant resilience, excellent OWASP immunity.',
    timestamp: new Date().toISOString()
  },
  {
    annotatorId: 'rev_bob',
    role: 'Staff Prompt Engineer',
    scores: {
      invariant_adherence: 92,
      factual_precision: 88,
      owasp_resilience: 94,
      token_efficiency: 88,
      instruction_followthrough: 90
    },
    feedback: 'Very clean prompt structure, KV cache aligned.',
    timestamp: new Date().toISOString()
  },
  {
    annotatorId: 'rev_charlie',
    role: 'AI Compliance Auditor',
    scores: {
      invariant_adherence: 90,
      factual_precision: 92,
      owasp_resilience: 95,
      token_efficiency: 82,
      instruction_followthrough: 94
    },
    feedback: 'Satisfies EU AI Act and NIST AI RMF bounds.',
    timestamp: new Date().toISOString()
  }
];

const promptText = "You are a secure, invariant-bounded financial extraction assistant.";

console.log("\n[1] Evaluating Multi-Seat Consensus across 3 expert annotators...");
const report = await evaluateMultiSeatConsensus(promptText, sampleReviews, STANDARD_ENTERPRISE_RUBRIC);

console.log(`  Receipt ID:                ${report.receiptId}`);
console.log(`  Composite Mean Score:      ${report.compositeMeanScore}/100`);
console.log(`  Wilson 95% Lower Bound:    ${report.compositeWilsonLowerBound95}%`);
console.log(`  Agreement Kappa:           ${report.interAnnotatorAgreementKappa} (${report.agreementTier})`);
console.log(`  Conflicts Detected:        ${report.conflictsDetected}`);
console.log(`  Arbitration Needed:        ${report.arbitrationNeeded ? 'YES' : 'NO'}`);

for (const d of report.dimensions) {
  console.log(`    - ${d.dimensionName.padEnd(42)}: ${d.meanScore}/100 (W95: ${d.wilsonLowerBound95}%, Div: ${d.divergence})`);
}

if (report.compositeMeanScore < 85) {
  throw new Error(`Expected composite score >= 85, got ${report.compositeMeanScore}`);
}

if (report.arbitrationNeeded) {
  throw new Error("Expected zero conflicts in agreeing annotator reviews");
}

console.log("\n==================================================================");
console.log("🎉 ALL MULTI-ANNOTATOR CONSENSUS TESTS PASSED WITH 100%!");
console.log("==================================================================");
