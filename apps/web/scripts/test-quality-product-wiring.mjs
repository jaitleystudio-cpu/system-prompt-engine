#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";
import {
  bindEffectiveSurfaces,
  decideDelivery,
  selectEffectivePrompt,
} from "../src/engine/delivery-policy.mjs";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/App.tsx"), "utf8");
const panel = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/workspace/QualityReceiptPanel.tsx"),
  "utf8",
);

assert.match(app, /requestQualityReceipt\(/);
assert.match(app, /fromK3QualityRequest\(k3\.rawOutput/);
assert.equal(app.includes("disposition === \"IMPROVED\" ?"), false);
assert.equal(/function\s+scoreQuality/.test(app), false);
assert.equal(decideDelivery({ kind: "engine_unavailable", hasCanonical: false }).terminal, "SAFE_FALLBACK_PROMPT");
assert.equal(decideDelivery({ kind: "k3_unavailable", hasCanonical: false }).fallback, true);
assert.equal(decideDelivery({ kind: "prompt_brief", hasCanonical: false }).fallback, false);
assert.equal(decideDelivery({ kind: "prompt_brief", hasCanonical: false }).terminal, "CLARIFICATION_REQUIRED");
assert.equal(decideDelivery({ kind: "conflict", hasCanonical: false }).fallback, false);
assert.equal(decideDelivery({ kind: "refused", hasCanonical: false }).terminal, "REFUSED");
const unknown = decideDelivery({ kind: "quality_unavailable", hasCanonical: true });
assert.equal(unknown.terminal, "CANONICAL_PROMPT");
assert.equal(unknown.validation, "UNKNOWN");
assert.equal(unknown.fallback, false);
assert.match(app, /disabled=\{!artifact\}/);
assert.match(panel, /Safe fallback/);
assert.match(panel, /semantic verification/);
assert.equal(panel.includes("disposition ="), false);
assert.match(app, /bindEffectiveSurfaces\(prompt\.finalPrompt, qualityOut\)/);
assert.match(app, /rendered_prompt: surfaces\.artifactPrompt/);
assert.match(app, /prompt_preview: surfaces\.historyPreview/);
assert.equal(app.includes("verified better"), false);
assert.equal(/function\s+reconstruct\(/.test(app), false);

const canonical = "CANONICAL_PROMPT_TEXT";
const repaired = "REPAIRED_KERNEL_PROMPT";

function qualityOut(overrides = {}) {
  const reconstruction =
    overrides.reconstruction === null
      ? null
      : {
          kept: "repaired",
          plan: { disposition: "ACCEPTED", attempt_index: 1, max_attempts: 1 },
          quality_delta: { disposition: "IMPROVED", protected_regressions: [] },
          kept_subject: { compiled_prompt: repaired },
          ...(overrides.reconstruction || {}),
        };
  return {
    reconstruction,
    quality_delta: reconstruction ? reconstruction.quality_delta : null,
    receipt: { verdict: "PASS", ...(overrides.receipt || {}) },
    subject: { compiled_prompt: canonical },
  };
}

const accepted = decideDelivery({ kind: "quality_receipt", hasCanonical: true, receipt: qualityOut() });
assert.equal(accepted.terminal, "RECONSTRUCTED_PROMPT");
assert.equal(accepted.repairedPrompt, repaired);

const unresolved = decideDelivery({
  kind: "quality_receipt",
  hasCanonical: true,
  receipt: qualityOut({
    reconstruction: { kept: "repaired", plan: { disposition: "UNRESOLVED", attempt_index: 1, max_attempts: 1 } },
  }),
});
assert.equal(unresolved.terminal, "CANONICAL_PROMPT");
assert.equal(unresolved.repairedPrompt, null);

const original = decideDelivery({
  kind: "quality_receipt",
  hasCanonical: true,
  receipt: qualityOut({
    reconstruction: {
      kept: "original",
      plan: { disposition: "NOT_TRIGGERED", attempt_index: 1, max_attempts: 1 },
      quality_delta: { disposition: "NON_INFERIOR", protected_regressions: [] },
      kept_subject: { compiled_prompt: canonical },
    },
  }),
});
assert.equal(original.terminal, "CANONICAL_PROMPT");
assert.equal(selectEffectivePrompt(canonical, original && qualityOut({
  reconstruction: {
    kept: "original",
    plan: { disposition: "NOT_TRIGGERED" },
    quality_delta: { disposition: "NON_INFERIOR", protected_regressions: [] },
    kept_subject: { compiled_prompt: canonical },
  },
})), canonical);

const missing = decideDelivery({
  kind: "quality_receipt",
  hasCanonical: true,
  receipt: { receipt: { verdict: "PASS" }, reconstruction_eligible: true },
});
assert.equal(missing.terminal, "CANONICAL_PROMPT");
assert.equal(missing.repairedPrompt, null);
assert.equal(selectEffectivePrompt(canonical, { receipt: { verdict: "PASS" }, reconstruction_eligible: true }), canonical);

const killed = [];
const notAccepted = decideDelivery({
  kind: "quality_receipt",
  hasCanonical: true,
  receipt: qualityOut({ reconstruction: { plan: { disposition: "UNRESOLVED" } } }),
});
assert.notEqual(notAccepted.terminal, "RECONSTRUCTED_PROMPT");
killed.push("F4");
const notImproved = decideDelivery({
  kind: "quality_receipt",
  hasCanonical: true,
  receipt: qualityOut({
    reconstruction: { quality_delta: { disposition: "NON_INFERIOR", protected_regressions: [] } },
  }),
});
assert.notEqual(notImproved.terminal, "RECONSTRUCTED_PROMPT");
killed.push("F5");

const acceptedOut = qualityOut();
const surfaces = bindEffectiveSurfaces(canonical, acceptedOut);
assert.equal(surfaces.display, repaired);
assert.equal(surfaces.artifactPrompt, surfaces.display);
assert.notEqual(surfaces.artifactPrompt, canonical);
killed.push("F6");
assert.equal(surfaces.historyPreview, surfaces.display.slice(0, 240));
assert.notEqual(surfaces.historyPreview, canonical.slice(0, 240));
killed.push("F7");
assert.equal(surfaces.exportPrompt, surfaces.display);
assert.equal(surfaces.copyPrompt, surfaces.display);
killed.push("F8");
assert.equal(surfaces.display, acceptedOut.reconstruction.kept_subject.compiled_prompt);
assert.equal(surfaces.display.includes("typescript synthesized"), false);
killed.push("F9");
const regressed = bindEffectiveSurfaces(
  canonical,
  qualityOut({
    reconstruction: { quality_delta: { disposition: "IMPROVED", protected_regressions: ["hard:c1"] } },
  }),
);
assert.equal(regressed.display, canonical);
killed.push("F10");
assert.deepEqual(killed, ["F4", "F5", "F6", "F7", "F8", "F9", "F10"]);

const bundle = await build({
  entryPoints: [join(dirname(fileURLToPath(import.meta.url)), "../../../packages/web-runtime/src/speArtifact.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const artifact = await runtime.buildSpeArtifact({
  user_request: "Write the note",
  category: "Writing",
  target: "any",
  envelope: { id: "fixture" },
  wasm: {
    status: "VALID",
    disposition: "VALID",
    reason_code: null,
    sha256: "ab".repeat(32),
    imports: 0,
    network_mode: "NONE",
    used_ts_fallback: false,
  },
  rendered_prompt: surfaces.artifactPrompt,
  intent: { confirmed: [], assumed: [], unknowns: [], conflicts: [] },
});
assert.equal(artifact.rendered_prompt, surfaces.display);
assert.equal(artifact.user_request, "Write the note");
assert.equal(artifact.category, "Writing");
assert.equal(artifact.wasm.imports, 0);
const exported = JSON.parse(JSON.stringify(artifact));
assert.equal(exported.rendered_prompt, surfaces.display);
assert.equal(exported.spe_format, "spe.artifact.v1");
const history = {
  prompt_preview: surfaces.historyPreview,
  artifact,
};
assert.equal(history.artifact.rendered_prompt, surfaces.display);
assert.equal(history.prompt_preview, surfaces.display.slice(0, 240));
console.log("PASS quality product wiring");
