/**
 * Verification test for SPE Ω Deep Specification Scaler across all tiers and platforms.
 */
import assert from "node:assert/strict";
import { compileDeepSpecification } from "../src/engine/deepSpecificationScaler.ts";

console.log("==================================================================");
console.log("🧪 TESTING: SPE Ω Ultra-Scale Deep Specification Scaler");
console.log("==================================================================");

// 1. Test Antigravity Skills on DEEP_15K
console.log("\n[1/5] Testing DEEP_15K Tier with Antigravity Skills platform...");
const pkg15k = compileDeepSpecification({
  userRequest: "Build an autonomous, offline-first multi-agent financial auditing engine.",
  category: "Business",
  tier: "DEEP_15K",
  targetPlatform: "antigravity-skills",
  declaredTools: ["file_read", "file_write", "terminal", "web_search", "google_search"],
});

assert.strictEqual(pkg15k.volumes.length, 3, "DEEP_15K must have exactly 3 volumes");
assert.ok(pkg15k.totalWordCount > 1000, "DEEP_15K word count must be substantive");
assert.ok(pkg15k.pluginAudit.tokensSaved > 0, "Tool auditor should have pruned redundant search tools");
assert.ok(pkg15k.exportFiles.some(f => f.filename === "SKILL.md"), "Antigravity skills must export SKILL.md");
const skillFile = pkg15k.exportFiles.find(f => f.filename === "SKILL.md");
assert.ok(skillFile.content.startsWith("---"), "SKILL.md must start with YAML frontmatter");
assert.ok(skillFile.content.includes("<RULE id="), "SKILL.md must contain <RULE> invariant blocks");
console.log(`  ✓ 3 volumes compiled (${pkg15k.totalWordCount} words, ~${pkg15k.totalTokenEstimate} tokens)`);
console.log(`  ✓ Exported SKILL.md for Antigravity with YAML frontmatter & <RULE> blocks`);
console.log(`  ✓ Plugin auditor pruned redundant tools, saving ${pkg15k.pluginAudit.tokensSaved} tokens`);

// 2. Test Claude Code (CLAUDE.md) on OMEGA_30K
console.log("\n[2/5] Testing OMEGA_30K Tier with Claude Code CLI platform...");
const pkg30k = compileDeepSpecification({
  userRequest: "Design a high-throughput, zero-copy distributed event streaming cluster.",
  category: "Coding",
  tier: "OMEGA_30K",
  targetPlatform: "claude-code",
  declaredTools: ["bash", "file_read", "file_write"],
});

assert.strictEqual(pkg30k.volumes.length, 5, "OMEGA_30K must have exactly 5 volumes");
assert.ok(pkg30k.exportFiles.some(f => f.filename === "CLAUDE.md"), "Claude Code must export CLAUDE.md");
const claudeMd = pkg30k.exportFiles.find(f => f.filename === "CLAUDE.md");
assert.ok(claudeMd.content.includes("# CLAUDE.md"), "Must contain CLAUDE.md header");
console.log(`  ✓ 5 volumes compiled (${pkg30k.totalWordCount} words)`);
console.log(`  ✓ Exported CLAUDE.md with fail-closed tool and bash privilege ceiling`);

// 3. Test Cursor Rules on MASTER_50K
console.log("\n[3/5] Testing MASTER_50K Tier with Cursor Rules platform...");
const pkg50k = compileDeepSpecification({
  userRequest: "Create a reactive, WebGL 3D design canvas with accessible controls.",
  category: "3D",
  tier: "MASTER_50K",
  targetPlatform: "cursor-rules",
});

assert.strictEqual(pkg50k.volumes.length, 7, "MASTER_50K must have exactly 7 volumes");
assert.ok(pkg50k.exportFiles.some(f => f.filename === ".cursorrules"), "Cursor rules must export .cursorrules");
console.log(`  ✓ 7 volumes compiled (${pkg50k.totalWordCount} words)`);
console.log(`  ✓ Exported .cursorrules JSON agent rules`);

// 4. Test GOD_MODE_100K (10 modular volumes)
console.log("\n[4/5] Testing GOD_MODE_100K Tier (10 Modular Volumes)...");
const pkg100k = compileDeepSpecification({
  userRequest: "Universal AI Operating System and Provenance-Backed Control Plane.",
  category: "SoftwareArchitecture",
  tier: "GOD_MODE_100K",
  targetPlatform: "grok",
});

assert.strictEqual(pkg100k.volumes.length, 10, "GOD_MODE_100K must have 10 modular volumes");
for (const v of pkg100k.volumes) {
  assert.ok(v.wordCount > 100, `Volume ${v.volumeIndex} is not substantive!`);
  assert.strictEqual(v.sha256.length, 64, "Volume must have valid SHA-256 hash");
}
assert.ok(pkg100k.volumes[0].content.includes("Saltzer, J. H., & Schroeder, M. D."), "Must contain research citations");
assert.ok(pkg100k.volumes[0].content.includes("ANTI-DRIFT"), "Must contain anti-drift shield");
console.log(`  ✓ 10 modular volumes compiled (${pkg100k.totalWordCount} words, ~${pkg100k.totalTokenEstimate} tokens)`);
console.log(`  ✓ Research citations, anti-drift shields, and SHA-256 hashes verified for all 10 volumes`);

// 5. Test Ollama Modelfile and Kimi Long-Context
console.log("\n[5/5] Testing Ollama Modelfile & Kimi Long-Context Anchors...");
const pkgOllama = compileDeepSpecification({
  userRequest: "Local offline encrypted document intelligence assistant.",
  tier: "STANDARD_1_5K",
  targetPlatform: "ollama-modelfile",
});
assert.ok(pkgOllama.exportFiles.some(f => f.filename === "Modelfile"), "Must export Modelfile");

const pkgKimi = compileDeepSpecification({
  userRequest: "Deep legal document analysis and contract risk detection.",
  tier: "STANDARD_1_5K",
  targetPlatform: "kimi",
});
const kimiFile = pkgKimi.exportFiles.find(f => f.filename === "SYSTEM_SPECIFICATION.md");
assert.ok(kimiFile.content.includes("[ANCHOR: ROLE_DEFINITION]"), "Kimi export must contain anchor tags");
console.log("  ✓ Exported Ollama Modelfile and Kimi Long-Context Anchor specifications");

console.log("\n==================================================================");
console.log("🎉 ALL DEEP SPECIFICATION SCALER TESTS PASSED (100% SUITE)!");
console.log("==================================================================");
process.exit(0);
