#!/usr/bin/env node
import { auditComplianceFramework, immunizeComplianceFramework } from '../src/engine/complianceFrameworks.ts';

console.log("==================================================================");
console.log("🛡️  Testing SPE Government & Defense Compliance Frameworks");
console.log("==================================================================");

const sampleRawPrompt = `
You are a helpful customer support bot for an online store.
Answer questions about orders and refunds politely.
`;

// 1. Initial Audit
console.log("\n[1] Running Initial Compliance Audit across all 4 frameworks...");
const initialAudit = await auditComplianceFramework(sampleRawPrompt, 'all');
console.log(`  Initial Compliance Score: ${initialAudit.complianceScore}% (${initialAudit.passedControls}/${initialAudit.totalControls} passed)`);
console.log(`  Failed Controls: ${initialAudit.failedControls}`);

if (initialAudit.complianceScore >= 100) {
  throw new Error("Raw prompt should not pass 100% compliance!");
}

// 2. 1-Click Immunization
console.log("\n[2] Applying 1-Click Defense Immunization...");
const immunized = await immunizeComplianceFramework(sampleRawPrompt, 'all');
console.log(`  Original Score:   ${immunized.originalScore}%`);
console.log(`  Immunized Score:  ${immunized.immunizedScore}%`);
console.log(`  Injected Clauses: ${immunized.injectedClauses.length}`);
console.log(`  Passport ID:      ${immunized.passportId}`);

if (immunized.immunizedScore !== 100) {
  throw new Error(`Expected 100% compliance after immunization, got ${immunized.immunizedScore}%`);
}

// 3. Test Specific Framework (NIST AI RMF)
console.log("\n[3] Testing Individual Framework Audit (NIST AI RMF)...");
const nistAudit = await auditComplianceFramework(immunized.immunizedPrompt, 'nist-ai-rmf');
console.log(`  NIST AI RMF Score: ${nistAudit.complianceScore}% (${nistAudit.passedControls}/${nistAudit.totalControls})`);
if (nistAudit.complianceScore !== 100) {
  throw new Error(`Expected NIST AI RMF score to be 100%, got ${nistAudit.complianceScore}%`);
}

// 4. Test MITRE ATLAS
console.log("\n[4] Testing Individual Framework Audit (MITRE ATLAS)...");
const atlasAudit = await auditComplianceFramework(immunized.immunizedPrompt, 'mitre-atlas');
console.log(`  MITRE ATLAS Score: ${atlasAudit.complianceScore}% (${atlasAudit.passedControls}/${atlasAudit.totalControls})`);
if (atlasAudit.complianceScore !== 100) {
  throw new Error(`Expected MITRE ATLAS score to be 100%, got ${atlasAudit.complianceScore}%`);
}

console.log("\n==================================================================");
console.log("🎉 ALL GOVERNMENT & DEFENSE COMPLIANCE TESTS PASSED WITH 100%!");
console.log("==================================================================");
