/**
 * Behavior checks for the display model. Fixtures come from G11.
 * This file does not project a workflow.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { presentExportDocument } from "../src/export/workflowExportViewModel.ts";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../src/export/fixtures");
const targets = ["n8n", "make", "zapier", "generic_json"] as const;

for (const target of targets) {
  const document = JSON.parse(readFileSync(join(fixtureDir, `g11-${target}.json`), "utf8"));
  const blob = JSON.stringify(document);
  assert.equal(blob.includes("supersecretvalue"), false, `${target} fixture leaked a secret`);
  const result = presentExportDocument(document);
  assert.equal(result.ok, true, `${target} fixture should display`);
  if (!result.ok) continue;
  assert.equal(result.view.target, target);
  assert.equal(result.view.liveImportStatus, "UNVERIFIED");
  assert.equal(result.view.strippedVariableNames.includes("api_key"), true);
  assert.equal(result.view.targetDocumentText.includes("supersecretvalue"), false);
  assert.equal(result.view.promptPreview.includes("supersecretvalue"), false);
}

const unknownVersion = presentExportDocument({ export_contract_version: "spe.workflow-export.v0" });
assert.equal(unknownVersion.ok, false);
if (!unknownVersion.ok) assert.equal(unknownVersion.status, "UNKNOWN");

const malformed = presentExportDocument({ export_contract_version: "spe.workflow-export.v1" });
assert.equal(malformed.ok, false);
if (!malformed.ok) assert.equal(malformed.status, "REFUSE");

const n8n = JSON.parse(readFileSync(join(fixtureDir, "g11-n8n.json"), "utf8")) as {
  canonical: { variables: Array<{ name: string; value: string; disposition: string }> };
};
const leaked = structuredClone(n8n);
const secret = leaked.canonical.variables.find((item) => item.name === "api_key");
assert.ok(secret);
secret.value = "supersecretvalue";
secret.disposition = "STRIPPED";
const refused = presentExportDocument(leaked);
assert.equal(refused.ok, false);
if (!refused.ok) assert.equal(refused.status, "REFUSE");
assert.equal(JSON.stringify(refused).includes("supersecretvalue"), false);

console.log("PASS: workflow export view model refuses bad documents and hides stripped values.");
