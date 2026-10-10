/**
 * Verification test for SPE Ω Anti-Drift Shield, Plugin Auditor, and Research Grounding Matrix.
 */
import assert from "node:assert/strict";
import { buildAntiDriftFailureShield } from "../src/engine/antiDriftFailureShield.ts";
import { auditPluginsAndSkills } from "../src/engine/pluginSkillAuditor.ts";
import { injectResearchGrounding, RESEARCH_GROUNDING_CATALOG } from "../src/engine/researchGroundingMatrix.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Ω Anti-Drift, Plugin Auditor & Research Grounding");
console.log("==================================================================");

// 1. Anti-Drift Failure Shield
console.log("\n[1/3] Testing Anti-Drift Failure Shield...");
const shield = buildAntiDriftFailureShield({
  turnResyncInterval: 5,
  failurePreemptionMode: "STRICT",
  includePreCommitAudit: true,
});
assert.ok(shield.includes("ANTI-DRIFT"), "Shield missing ANTI-DRIFT header");
assert.ok(shield.includes("FAILURE MODE PREEMPTION"), "Shield missing preemption block");
assert.ok(shield.includes("PRE-COMMIT INVARIANT SELF-AUDIT"), "Shield missing self-audit gate");
console.log("  ✓ Anti-Drift Failure Shield generated successfully (~40% drift reduction target).");

// 2. Plugin & Skill Auditor
console.log("\n[2/3] Testing Plugin & Skill Auditor...");
const rawTools = ["file_read", "file_write", "bash", "stripe", "web_search"];
const auditResult = auditPluginsAndSkills(rawTools);
console.log(`  ✓ Audited ${auditResult.totalAudited} tools:`);
console.log(`    - Overall Safety Score: ${auditResult.overallSafetyScore}/100`);
console.log(`    - Approved: ${auditResult.approvedCount}, Restricted: ${auditResult.restrictedCount}`);
console.log(`    - Tokens Saved: ${auditResult.tokensSaved}`);
assert.ok(auditResult.totalAudited === 5, "Total audited tool count mismatch");
assert.ok(auditResult.auditedTools.some(t => t.name === "file_read" && t.verdict === "APPROVED"), "file_read should be APPROVED");
assert.ok(auditResult.auditedTools.some(t => t.name === "bash" && t.riskLevel === "CRITICAL"), "bash should be CRITICAL");
assert.ok(auditResult.synthesizedToolPolicy.includes("SPE AUDITED TOOL & PLUGIN CALLING POLICY"), "Missing synthesized tool policy");
console.log("  ✓ Plugin & Skill Auditor prompt policy formatted successfully (~60% failure reduction target).");

// 3. Research Grounding Matrix
console.log("\n[3/3] Testing Research Grounding Matrix...");
assert.ok(RESEARCH_GROUNDING_CATALOG.SoftwareArchitecture, "SoftwareArchitecture catalog entry missing");
const groundedPrompt = injectResearchGrounding("Software Architecture", "You are an autonomous cloud compiler.");
assert.ok(groundedPrompt.includes("EMPIRICAL SCIENTIFIC GROUNDING"), "Missing grounding header");
assert.ok(groundedPrompt.includes("Saltzer, J. H., & Schroeder, M. D."), "Missing Saltzer & Schroeder citation");
console.log("  ✓ Peer-reviewed citations injected into prompt specification.");

console.log("\n==================================================================");
console.log("🎉 ALL UNIVERSAL SHIELD & AUDITING TESTS PASSED!");
console.log("==================================================================");
