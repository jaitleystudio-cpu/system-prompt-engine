#!/usr/bin/env node
/** R22 pure local-failure intake: adversarial constraints and false-proof checks. */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  entryPoints: [join(root, "src/pages/incidentIntake.ts")],
  bundle: true, write: false, format: "esm", platform: "node", target: "es2022",
});
const library = await import(
  "data:text/javascript;base64," +
  Buffer.from(result.outputFiles[0].text).toString("base64")
);
const {
  INTAKE_PROVIDERS, INTAKE_TYPES, INTAKE_SCHEMA, INTAKE_SCOPE,
  reviewLocalIntake, buildPrivateIntakeExport,
} = library;

const baseline = {
  provider: INTAKE_PROVIDERS[0],
  modelRevision: "model-test-v1",
  failureType: INTAKE_TYPES[0],
  expectedSummary: "A grounded answer with a short source citation.",
  observedSummary: "The answer omitted the source citation.",
  reviewedForPrivateDetails: true,
};
const get = (changes={}) => ({ ...baseline, ...changes });
const good = reviewLocalIntake(baseline);
assert.equal(good.state, "READY_FOR_USER_INITIATED_PRIVATE_EXPORT");
assert.equal(good.private_export_eligible, true);
assert.equal(good.evidence_state, "USER_REPORTED_NOT_VERIFIED");
assert.equal(good.publication_authorized, false);
assert.equal(good.real_model_reproduction_verified, false);
const output = buildPrivateIntakeExport(baseline);
assert.equal(output.schema, INTAKE_SCHEMA);
assert.equal(output.scope, INTAKE_SCOPE);
assert.equal(output.provenance, "USER_SELF_REPORT_UNVERIFIED");
assert.equal(output.manual_privacy_review_acknowledged, true);
assert.equal(output.model_revision_claimed_by_user, baseline.modelRevision);
assert.equal(output.source_independently_authenticated, false);
for (const key of [
  "model_replay_performed", "cause_independently_verified", "repair_validated",
  "publication_authorized", "network_execution_authorized",
  "model_api_execution_authorized", "owner_signed_receipt_present",
]) assert.equal(output[key], false, key);
assert.equal(Object.hasOwn(output, "raw_prompt"), false);
assert.equal(Object.hasOwn(output, "raw_model_response"), false);
assert.equal(Object.hasOwn(output, "personally_identifying_data"), false);
assert.deepEqual(Object.keys(output).sort(), [
  "schema", "scope", "provenance", "model_provider_claimed_by_user",
  "model_revision_claimed_by_user", "failure_type_claimed_by_user",
  "expected_outcome_user_summary", "observed_outcome_user_summary",
  "missing_evidence", "manual_privacy_review_acknowledged",
  "source_independently_authenticated", "model_replay_performed",
  "cause_independently_verified", "repair_validated",
  "publication_authorized", "network_execution_authorized",
  "model_api_execution_authorized", "owner_signed_receipt_present",
].sort());

function mustHold(changes, reason) {
  const reviewed = reviewLocalIntake(get(changes));
  assert.equal(reviewed.state, "HOLD", JSON.stringify(changes));
  assert.ok(reviewed.reasons.includes(reason), reason);
  assert.equal(reviewed.private_export_eligible, false);
  assert.equal(reviewed.publication_authorized, false);
  assert.throws(() => buildPrivateIntakeExport(get(changes)), /PRIVATE_INTAKE_REVIEW_HOLD/);
}
mustHold({ reviewedForPrivateDetails: false }, "USER_PRIVACY_REVIEW_REQUIRED");
mustHold({ provider: "attack.example.com" }, "UNRECOGNIZED_PROVIDER");
mustHold({ failureType: "MODEL_REPAIRED_AND_PROVEN" }, "UNRECOGNIZED_FAILURE_TYPE");
mustHold({ expectedSummary: "" }, "EXPECTED_OUTCOME_REQUIRED");
mustHold({ observedSummary: "  " }, "OBSERVED_OUTCOME_REQUIRED");
mustHold({ expectedSummary: "x".repeat(501) }, "TEXT_TOO_LONG");
mustHold({ observedSummary: "x".repeat(501) }, "TEXT_TOO_LONG");
mustHold({ modelRevision: "version" + "x".repeat(101) }, "TEXT_TOO_LONG");
mustHold({ expectedSummary: "safe\u0007unsafe" }, "CONTROL_CHARACTER_PRESENT");
mustHold({ observedSummary: "Contact person@example.com" }, "SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER");
mustHold({ observedSummary: "Bearer abcdefghijklmno12345" }, "SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER");
mustHold({ observedSummary: "api_key = very-secret-token" }, "SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER");
mustHold({ observedSummary: "sk-proj-secret-bearer-123" }, "SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER");
mustHold({ observedSummary: "-----BEGIN PRIVATE KEY-----" }, "SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER");
mustHold({ observedSummary: "1234567812345678" }, "SUSPECTED_SECRET_OR_PERSONAL_IDENTIFIER");

for (const bad of [undefined, null, [], "text", 7, false]) {
  const review = reviewLocalIntake(bad);
  assert.equal(review.state, "HOLD");
  assert.ok(review.reasons.includes("INVALID_DRAFT"));
}

for (const unknown of ["", "unknown", "UNKNOWN"]) {
  const review = reviewLocalIntake(get({ modelRevision: unknown }));
  assert.equal(review.state, "READY_FOR_USER_INITIATED_PRIVATE_EXPORT");
  assert.ok(review.reasons.includes("MODEL_REVISION_UNPINNED"));
  const report = buildPrivateIntakeExport(get({ modelRevision: unknown }));
  assert.ok(report.missing_evidence.includes("MODEL_REVISION_NOT_PINNED"));
  assert.equal(report.model_replay_performed, false);
  assert.equal(report.publication_authorized, false);
}

// The local form must not send, persist, or export automatically.
const component = readFileSync(join(root, "src/pages/PrivateFailureIntake.tsx"), "utf8");
const page = readFileSync(join(root, "src/pages/IncidentIntelligence.tsx"), "utf8");
const formCode = component.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const libraryCode = readFileSync(join(root, "src/pages/incidentIntake.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const source of [formCode, libraryCode]) {
  for (const forbidden of [
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/,
    /\blocalStorage\b/, /\bsessionStorage\b/, /navigator\.sendBeacon/,
    /document\.cookie/, /import\s*\(\s*["']https?:/, /analytics\.track/,
  ]) {
    assert.doesNotMatch(source, forbidden, "R22 forbidden network or storage capability: " + forbidden);
  }
}
assert.match(page, /<PrivateFailureIntake\s*\/>/);
assert.match(component, /data-intake-scope="LOCAL_ONLY_UNVERIFIED"/);
assert.match(component, /disabled=\{!review\.private_export_eligible\}/);
assert.match(component, /onClick=\{downloadPrivateReport\}/);
assert.match(component, /reviewedForPrivateDetails:\s*next\.reviewedForPrivateDetails\s*\?\?\s*false/);
assert.match(component, /new Blob\(\[bytes\]/);
assert.match(component, /link\.download\s*=\s*"spe-private-ai-failure-report\.json"/);
assert.match(component, /URL\.revokeObjectURL\(href\)/);
assert.doesNotMatch(component, /useEffect/);
console.log("PASS R22 private failure intake: constraints, user consent, privacy signals, no network or false proof");
