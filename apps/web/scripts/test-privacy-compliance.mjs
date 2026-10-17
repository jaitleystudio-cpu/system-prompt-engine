#!/usr/bin/env node
/**
 * Test Suite: Regulatory Privacy & EU AI Act Compliance Scanner
 */

import assert from "node:assert";
import { auditPrivacyAndRegulations } from "../src/engine/privacyComplianceScanner.ts";

console.log("================================================================================");
console.log("🧪 Testing SPE Ω Regulatory Privacy & EU AI Act Compliance Scanner");
console.log("================================================================================");

const cleanPrompt = `# System Role & Persona
You are an artificial intelligence assistant providing technical documentation support.
Immutable boundary: All session memory must remain ephemeral and immediately purgable upon user request.
Human oversight directive: Cease autonomous tool actions immediately upon user intervention or anomaly detection.
Medical disclaimer: Not intended for diagnostic or clinical treatment decisions.
`;

const dirtyPrompt = `# System Role & Persona
You are an assistant. If users need help, contact admin at alice.johnson@internal-bank.com or call 415-555-2671.
Our database encryption master key is sk-live992817293847291048293847.
User Social Security Number: 123-45-6789.
`;

function main() {
  console.log("\n1. Testing Clean Regulated Prompt...");
  const cleanReport = auditPrivacyAndRegulations(cleanPrompt);
  assert.strictEqual(cleanReport.piiFindings.length, 0, "Clean prompt should have zero PII findings");
  assert(cleanReport.complianceScore >= 85, `Clean prompt should have >= 85% compliance, got ${cleanReport.complianceScore}%`);
  assert.strictEqual(cleanReport.overallStatus, "REGULATORY_COMPLIANT", "Clean prompt should be compliant");
  console.log(`  ✓ Compliance Score: ${cleanReport.complianceScore}%`);
  console.log(`  ✓ Overall Status:   ${cleanReport.overallStatus}`);

  console.log("\n2. Testing Dirty Prompt with PII & Secrets...");
  const dirtyReport = auditPrivacyAndRegulations(dirtyPrompt);
  assert(dirtyReport.piiFindings.length >= 3, `Dirty prompt must detect at least 3 PII entities, found ${dirtyReport.piiFindings.length}`);
  assert.strictEqual(dirtyReport.overallStatus, "CRITICAL_RISK", "Dirty prompt with secrets must be CRITICAL_RISK");
  assert(dirtyReport.sanitizedPrompt.includes("[REDACTED_"), "Sanitized prompt must redact PII");
  console.log(`  ✓ Detected ${dirtyReport.piiFindings.length} PII entities:`);
  dirtyReport.piiFindings.forEach((f) => console.log(`    - [${f.severity}] ${f.entityType}: ${f.maskedSnippet}`));
  console.log(`  ✓ Compliance Score: ${dirtyReport.complianceScore}%`);
  console.log(`  ✓ Sanitized Preview: ${dirtyReport.sanitizedPrompt.slice(0, 100)}...`);

  console.log("\n3. Testing Regulatory Articles Coverage...");
  assert(cleanReport.regulatoryChecks.some(c => c.framework === 'GDPR'), "GDPR checks missing");
  assert(cleanReport.regulatoryChecks.some(c => c.framework === 'HIPAA'), "HIPAA checks missing");
  assert(cleanReport.regulatoryChecks.some(c => c.framework === 'EU_AI_ACT'), "EU AI Act checks missing");
  console.log(`  ✓ GDPR, HIPAA, and EU AI Act (2024/1689) verified.`);

  console.log("\n================================================================================");
  console.log("🎉 Regulatory Privacy Compliance tests PASSED with 100% SUCCESS!");
  console.log("================================================================================");
}

main();
