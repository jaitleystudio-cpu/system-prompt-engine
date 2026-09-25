#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");
const bundle = await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const lens = runtime.defaultIntentLens("");
const desiredOutput = lens.confirmed.find(
  (atom) => atom.id === "desired-output",
);
const example = lens.assumed.find((atom) => atom.id === "desired-example");
assert.ok(desiredOutput, "Desired Output must be ProtectedIntent confirmed");
assert.ok(example, "Example must be ProtectedIntent assumed");

desiredOutput.text =
  "Return a launch checklist with owners, dates, and measurable success criteria.";
example.text =
  "Week 1 — Owner: Product — Outcome: approved launch brief.";

const fixture = runtime.buildAbiFixture({
  userRequest: "Plan a careful product launch.",
  category: "Business",
  target: "any",
  confirmed: lens.confirmed,
  assumed: lens.assumed,
  unknowns: lens.unknowns,
  conflicts: lens.conflicts,
});
const payload = fixture.payload;
const outputConstraint = payload.hard_constraints.find(
  (constraint) => constraint.constraint_id === "desired-output",
);
assert.equal(outputConstraint.strength, "HARD");
assert.match(outputConstraint.statement, /launch checklist/);

const examplePreference = payload.user_preferences.find(
  (preference) => preference.preference_id === "desired-example",
);
assert.match(examplePreference.statement, /EXAMPLE \/ USER_SUPPLIED/);
assert.match(examplePreference.statement, /NON-AUTHORITATIVE/);
assert.match(examplePreference.statement, /verified truth/i);

const rendered = runtime.renderPromptArtifact({
  userRequest: "Plan a careful product launch.",
  category: "Business",
  target: "any",
  envelopeOutput: payload,
});
assert.match(rendered.finalPrompt, /## Deliverable[\s\S]*launch checklist/);
assert.match(
  rendered.finalPrompt,
  /## User-supplied example \(non-authoritative\)/,
);
assert.match(rendered.finalPrompt, /Week 1 — Owner: Product/);
assert.match(rendered.finalPrompt, /## Acceptance checks[\s\S]*launch checklist/);

const composer = readFileSync(
  join(root, "src/composer/UnifiedComposer.tsx"),
  "utf8",
);
const app = readFileSync(join(root, "src/App.tsx"), "utf8");
assert.match(composer, /\| "example"/);
assert.match(composer, />Desired output</);
assert.match(composer, />Example \/ user supplied</);
assert.match(composer, /role="tablist"/);
assert.match(composer, /ArrowRight/);
assert.match(app, /preserveCreateIntentFields/);
assert.match(app, /showOutputControls=\{view === "create"\}/);

console.log("PASS Create Desired Output + Example intent contract");
