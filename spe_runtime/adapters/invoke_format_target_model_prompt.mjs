/**
 * Process bridge to the existing formatTargetModelPrompt.
 * This file does not format prompts. It only calls the canonical export.
 */
import { readFileSync } from "node:fs";

import { formatTargetModelPrompt } from "../../apps/web/src/engine/continuation/continuationCompiler.ts";

const input = JSON.parse(readFileSync(0, "utf8"));
try {
  const prompt = formatTargetModelPrompt(
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
  );
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
