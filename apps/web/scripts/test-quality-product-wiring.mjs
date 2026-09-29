#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideDelivery } from "../src/engine/delivery-policy.mjs";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/App.tsx"), "utf8");
const panel = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/workspace/QualityReceiptPanel.tsx"),
  "utf8",
);

assert.match(app, /requestQualityReceipt\(/);
assert.match(app, /k3_output: k3\.rawOutput/);
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
console.log("PASS quality product wiring");
