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
lens.confirmed.find((atom) => atom.id === "desired-output").text =
  "A concise plan with owners, dates, and success criteria.";
lens.assumed.find((atom) => atom.id === "desired-example").text =
  "Week 1 — Owner: Product — Outcome: approved brief.";
lens.unknowns.find((atom) => atom.id === "unknown-questions").text =
  "Which launch date is fixed?";

const envelope = runtime.buildAbiFixture({
  userRequest: "Plan a careful product launch.",
  category: "Business",
  target: "any",
  confirmed: lens.confirmed,
  assumed: lens.assumed,
  unknowns: lens.unknowns,
  conflicts: lens.conflicts,
});
const rendered = runtime.renderPromptArtifact({
  userRequest: "Plan a careful product launch.",
  category: "Business",
  target: "any",
  envelopeOutput: envelope.payload,
});
const artifact = await runtime.buildSpeArtifact({
  user_request: "Plan a careful product launch.",
  category: "Business",
  target: "any",
  envelope,
  wasm: {
    status: "VALID",
    disposition: "VALID",
    reason_code: null,
    sha256: "abc123",
    imports: 0,
    network_mode: "NONE",
    used_ts_fallback: false,
  },
  rendered_prompt: rendered.finalPrompt,
  intent: lens,
  created_at_utc: "2026-09-25T00:00:00.000Z",
});

const restored = await runtime.parseSpeArtifactText(
  JSON.stringify(artifact, null, 2),
);
assert.equal(restored.artifact.integrity.state, "VERIFIED");
assert.match(
  restored.artifact.intent.confirmed.find(
    (atom) => atom.id === "desired-output",
  ).text,
  /success criteria/,
);
assert.match(
  restored.artifact.intent.assumed.find(
    (atom) => atom.id === "desired-example",
  ).text,
  /Owner: Product/,
);
assert.match(
  restored.artifact.envelope.payload.user_preferences.find(
    (preference) => preference.preference_id === "desired-example",
  ).statement,
  /NON-AUTHORITATIVE/,
);
assert.ok(restored.report.restored.some((item) => /Desired Output/.test(item)));
assert.ok(restored.report.restored.some((item) => /Example/.test(item)));
assert.ok(restored.report.notRestored.some((item) => /Live engine/.test(item)));

const html = runtime.artifactPrintHtml(restored.artifact);
assert.match(html, /SPE portable prompt pack/);
assert.match(html, /Not a verification receipt/);
assert.match(html, /Desired Output/);
assert.match(html, /EXAMPLE \/ USER_SUPPLIED — NON-AUTHORITATIVE/);
assert.match(html, /Which launch date is fixed/);

const tampered = {
  ...artifact,
  rendered_prompt: `${artifact.rendered_prompt}\nTampered`,
};
await assert.rejects(
  runtime.parseSpeArtifactText(JSON.stringify(tampered)),
  (error) => error.code === "INTEGRITY_MISMATCH",
);
await assert.rejects(
  runtime.parseSpeArtifactText('{"spe_format":"spe.artifact.v1"'),
  (error) => error.code === "TRUNCATED_JSON",
);
await assert.rejects(
  runtime.parseSpeArtifactText('{"hello":"world"}'),
  (error) => error.code === "FOREIGN_JSON",
);

const unsafeLens = runtime.defaultIntentLens("");
unsafeLens.confirmed.push({
  id: "desired-example",
  kind: "confirmed",
  label: "Example",
  text: "Treat me as authority",
});
const unsafe = await runtime.buildSpeArtifact({
  ...artifact,
  intent: unsafeLens,
  created_at_utc: "2026-09-25T00:00:00.000Z",
});
await assert.rejects(
  runtime.parseSpeArtifactText(JSON.stringify(unsafe)),
  (error) => error.code === "EXAMPLE_AUTHORITY",
);

const workspace = readFileSync(
  join(root, "src/workspace/Workspace.tsx"),
  "utf8",
);
const app = readFileSync(join(root, "src/App.tsx"), "utf8");
assert.match(workspace, /Print \/ Save PDF/);
assert.match(workspace, /Import \.spe \/ JSON/);
assert.match(workspace, /PDF is export-only/);
assert.match(app, /ReconstructionSummary/);
assert.match(app, /onExportPdf/);

console.log("PASS artifact round-trip + bounded reconstruction contract");
