/**
 * Process bridge to the existing formatTargetModelPrompt.
 * This file does not format prompts. It only calls the canonical export.
 */
import { readFileSync } from "node:fs";

import { formatTargetModelPrompt } from "../../apps/web/src/engine/continuation/continuationCompiler.ts";

const input = JSON.parse(readFileSync(0, "utf8"));
try {
  const args = [
    input.target,
    input.mission,
    input.baselineSha,
    input.protectedIntent,
    input.steps,
    input.evidence,
    input.contradictions,
    input.unknowns,
    input.testGates,
    input.stopConditions,
  ];
  // Existing extras argument only. Absent means the package had none.
  if (input.extras !== undefined && input.extras !== null) {
    args.push(input.extras);
  }
  const prompt = formatTargetModelPrompt(...args);
  process.stdout.write(
    JSON.stringify({
      symbol: "formatTargetModelPrompt",
      prompt,
    }),
  );
} catch (err) {
  const message = err && err.stack ? String(err.stack) : String(err);
  process.stderr.write(message);
  process.exit(2);
}
