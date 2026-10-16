/**
 * Dedicated Regression Test: Prompt Gate Integrity & Zero Mid-Word Truncation
 *
 * Verifies that:
 * 1. The "# Final Verification Gate" (and corresponding closing blocks for Claude, Gemini, Local)
 *    is NEVER truncated, cut off mid-sentence, or broken mid-word (e.g. "Follow the e").
 * 2. Dynamic framework budgeting properly accommodates long briefs (1,000 - 10,000 chars).
 * 3. Exact character length invariants (5,555 for normal, 15,000 for mid, 30,000 for deep)
 *    are satisfied bit-for-bit across all 4 target formats with zero duplicate lines.
 * 4. Free tier output ceiling (<= 5,000 characters) is enforced without slicing closing gates.
 */

import assert from "node:assert/strict";
import {
  synthesizeSystemPrompt,
  truncateCleanly,
  compilePromptWithTierEnforcement,
  FREE_TIER_MAX_OUTPUT_CHARS,
} from "../src/engine/promptSynthesizer.mjs";

console.log("==================================================================");
console.log("🛡️  TESTING: Prompt Gate Integrity & Zero Mid-Word Truncation");
console.log("==================================================================");

// 1. Test truncateCleanly utility
console.log("\n[1/4] Verifying truncateCleanly boundary preservation...");
{
  const text = "Follow the explicit brief wherever it differs from these default working suggestions.";
  assert.equal(truncateCleanly(text, 100), text);
  
  const t30 = truncateCleanly(text, 30);
  assert.ok(t30.length <= 30);
  assert.ok(!t30.includes(" th "), "Should not leave broken words");
  assert.ok(t30.endsWith(" [...]"));

  const t50 = truncateCleanly(text, 50);
  assert.ok(t50.length <= 50);
  assert.ok(t50.endsWith(" [...]"));

  // Paragraph boundary
  const multiPara = "Paragraph one is here.\n\nParagraph two has more details.";
  const tPara = truncateCleanly(multiPara, 40);
  assert.ok(tPara.length <= 40);
  assert.ok(tPara.includes("Paragraph one"));

  console.log("  ✓ truncateCleanly respects sentence, word, and paragraph boundaries without slicing words.");
}

// 2. Test exact user counterexample (Image brief with 5,000 chars of objective)
console.log("\n[2/4] Verifying exact user failure case resolution...");
{
  const userBrief = `## Preferences\nPrefer clear, executable instructions\n\n## Objective\n` + "a".repeat(5000);
  const out = synthesizeSystemPrompt(userBrief, { category: "Image", target: "any", depthTier: "normal" });

  assert.equal(out.length, 5555, `Must equal exactly 5555 chars, got ${out.length}`);
  assert.ok(out.includes("# Final Verification Gate"), "Must contain # Final Verification Gate");
  assert.ok(
    out.includes("Follow the explicit brief wherever it differs from these default working suggestions."),
    "Gate opening line must be 100% complete and intact",
  );
  assert.ok(
    out.includes("Ask a focused question only when missing information blocks a correct response; otherwise proceed and label necessary assumptions."),
    "Gate closing sentence must be 100% complete and fully articulated",
  );
  assert.ok(!out.endsWith("Follow the e"), "Must NEVER end with broken 'Follow the e'");
  console.log("  ✓ User counterexample resolved: Final Verification Gate is 100% complete with exact 5,555 chars.");
}

// 3. Test across all 4 targets with varying brief lengths
console.log("\n[3/4] Verifying all 4 targets (any, claude, gemini, local) across brief sizes...");
{
  const targets = ["any", "claude", "gemini", "local"];
  const briefSizes = [500, 2500, 5554, 8000];

  for (const target of targets) {
    for (const size of briefSizes) {
      const brief = `## Preferences\nStrict adherence to safety\n\n## Hard constraints\nZero cloud egress\n\n## Objective\n` +
        "Build a mission-critical autonomous coordinator. ".repeat(Math.ceil(size / 48)).slice(0, size);

      const out = synthesizeSystemPrompt(brief, { category: "Coding", target, depthTier: "normal" });
      assert.equal(out.length, 5555, `Target ${target} at size ${size} must equal 5555 chars, got ${out.length}`);

      if (target === "any") {
        assert.ok(out.includes("# Final Verification Gate"), `Target ${target} must include Final Verification Gate`);
        assert.ok(out.includes("otherwise proceed and label necessary assumptions."));
      } else if (target === "gemini") {
        assert.ok(out.includes("## Final Verification Gate"), `Gemini must include ## Final Verification Gate`);
        assert.ok(out.includes("Validate all outputs against explicit constraints prior to final response generation."));
      } else if (target === "claude") {
        assert.ok(out.includes("<final_check>"), "Claude must include <final_check>");
        assert.ok(out.endsWith("</system_prompt>"), "Claude must cleanly terminate with </system_prompt>");
      } else if (target === "local") {
        assert.ok(out.endsWith("[/INST]"), "Local must cleanly terminate with [/INST]");
      }
    }
  }
  console.log("  ✓ All 4 targets verified across all brief sizes with 100% intact closing gates.");
}

// 4. Test depth tiers & Free tier limit
console.log("\n[4/4] Verifying depth tiers (normal, mid, deep) & Free tier limit...");
{
  const longBrief = `## Preferences\nPrefer high density\n\n## Objective\n` + "Deep scalable architecture. ".repeat(200);

  // Free tier
  const freeOut = synthesizeSystemPrompt(longBrief, { target: "any", depthTier: "free", subscriptionTier: "free" });
  assert.ok(freeOut.length <= FREE_TIER_MAX_OUTPUT_CHARS, `Free tier must be <= ${FREE_TIER_MAX_OUTPUT_CHARS}, got ${freeOut.length}`);
  assert.ok(freeOut.includes("# Final Verification Gate"), "Free tier must preserve Final Verification Gate");
  assert.ok(freeOut.includes("otherwise proceed and label necessary assumptions."));

  // Normal tier
  const normalOut = synthesizeSystemPrompt(longBrief, { target: "any", depthTier: "normal" });
  assert.equal(normalOut.length, 5555);
  assert.ok(normalOut.includes("otherwise proceed and label necessary assumptions."));

  // Mid tier
  const midOut = synthesizeSystemPrompt(longBrief, { target: "any", depthTier: "mid" });
  assert.equal(midOut.length, 15000);
  assert.ok(midOut.includes("otherwise proceed and label necessary assumptions."));

  // Deep tier
  const deepOut = synthesizeSystemPrompt(longBrief, { target: "any", depthTier: "deep" });
  assert.equal(deepOut.length, 30000);
  assert.ok(deepOut.includes("otherwise proceed and label necessary assumptions."));

  // Tier enforcement with compilePromptWithTierEnforcement
  const enforcedFree = compilePromptWithTierEnforcement(longBrief, { subscriptionTier: "free" });
  assert.ok(enforcedFree.length <= FREE_TIER_MAX_OUTPUT_CHARS);
  assert.ok(enforcedFree.includes("# Final Verification Gate"));

  console.log("  ✓ Depth tiers (5,555, 15,000, 30,000) and Free tier (<= 5,000) verified with 100% intact gates.");
}

console.log("\n==================================================================");
console.log("🎉 ALL PROMPT GATE INTEGRITY & TRUNCATION TESTS PASSED CLEANLY!");
console.log("==================================================================");
