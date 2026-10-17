import { synthesizeSystemPrompt } from "./apps/web/src/engine/promptSynthesizer.mjs";

console.log("Checking all categories across all models and depth tiers...");

const categories = [
  "AI Assistant",
  "Education",
  "Coding",
  "Website / 3D",
  "Research",
  "Business",
  "Writing",
  "Analysis",
  "Structured Data",
  "Creative",
  "Multilingual",
  "Image",
  "Video",
];
let totalChecks = 0;
let totalPasses = 0;

for (const cat of categories) {
  const prompt = `## Objective
Test objective for ${cat} systems architecture.
## Category presentation
${cat}
`;
  for (const target of ["claude", "chatgpt", "gemini", "local"]) {
    for (const depthTier of ["normal", "mid", "deep"]) {
      totalChecks++;
      const text = synthesizeSystemPrompt(prompt, { target, depthTier });
      const targetLen = depthTier === "deep" ? 30000 : depthTier === "mid" ? 15000 : 5555;
      if (text.length !== targetLen) {
        console.error(`FAILED LENGTH: [${cat}][${target}][${depthTier}] length: ${text.length} (expected ${targetLen})`);
        process.exit(1);
      }
      const lines = text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("|") && !l.startsWith("```") && l !== "---");
      const counts = {};
      let duplicates = 0;
      for (const l of lines) {
        counts[l] = (counts[l] || 0) + 1;
        if (counts[l] === 2) {
          duplicates++;
          console.error(`DUPLICATE LINE in [${cat}][${target}][${depthTier}]: "${l}"`);
        }
      }
      if (duplicates > 0) {
        console.error(`FAILED DUPLICATES: ${duplicates} duplicate lines found in [${cat}][${target}][${depthTier}]!`);
        process.exit(1);
      }
      totalPasses++;
    }
  }
}

console.log(`ALL ${totalPasses}/${totalChecks} PERMUTATIONS PASSED: EXACT LENGTHS & 0 DUPLICATE LINES!`);
