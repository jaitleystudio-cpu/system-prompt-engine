import { build } from "../apps/web/node_modules/esbuild/lib/main.js";
import { readFileSync } from "node:fs";
import { inventory, root } from "./copy-inventory.mjs";
const bundle = await build({
  entryPoints: [`${root}/packages/human-perspective/src/index.ts`],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { reviewCopy, copyMeanings } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const approved = JSON.parse(
  readFileSync(`${root}/tests/copy/reviewed-inventory.json`),
);
const known = new Map(approved.entries.map((e) => [e.id, e]));
const violations = [];
const current = inventory();
for (const entry of current) {
  const previous = known.get(entry.id);
  if (
    !previous ||
    previous.text !== entry.text ||
    previous.depth !== entry.depth
  )
    violations.push({
      file: entry.file,
      text: entry.text,
      reason: "UNREVIEWED_COPY",
    });
  const review = reviewCopy(
    {
      id: entry.id,
      text: entry.text,
      intent: {
        purpose: "EXPLAIN",
        meaning: copyMeanings[entry.text]?.meaning ?? entry.text,
        tone: "premium_human",
        claim_refs: copyMeanings[entry.text]?.claim_refs ?? [],
      },
    },
    {
      surface: entry.depth === "EXPERIENCE" ? "WEB_HERO" : "WEB_WORKSPACE",
      audience_state: "new",
      task: "review copy",
      user_goal: "use SPE",
      emotional_moment: "exploring",
      urgency: "normal",
      expertise: "general",
      locale: "en",
      available_space: "body",
      disclosure_depth: entry.depth,
    },
  );
  if (review.risks.length)
    violations.push({
      file: entry.file,
      text: entry.text,
      reason: review.risks.join(","),
    });
}
console.log(
  JSON.stringify(
    {
      gate: "LANGUAGE_PERSPECTIVE_GATE",
      candidateCount: current.length,
      unreviewed: violations.filter((v) => v.reason === "UNREVIEWED_COPY")
        .length,
      violations,
      scope:
        "Static UI copy and shared catalog. Dynamic user text/generated professional prompts are deliberately excluded. Editorial review is not a human study.",
    },
    null,
    2,
  ),
);
if (violations.length) process.exitCode = 1;
