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
  "A launch checklist with owners and measurable success criteria.";
lens.assumed.find((atom) => atom.id === "desired-example").text =
  "Week 1 — Owner: Product — Outcome: approved brief.";
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
    sha256: "engine-sha",
    imports: 0,
    network_mode: "NONE",
    used_ts_fallback: false,
  },
  rendered_prompt: rendered.finalPrompt,
  intent: lens,
  created_at_utc: "2026-09-25T00:00:00.000Z",
});
const protocolOutput = {
  source_mode: "OFF",
  requested_depth: "SMART",
  resolved_depth: "STANDARD",
  capability_profile_mode: "CONDITIONAL",
  context_summary: {
    reason_codes: ["NO_EXTERNAL_CONTEXT_REQUIRED"],
  },
  execution_contract: {
    protocol_id: "protocol.business.standard",
    depth: "STANDARD",
    domain_ids: ["business"],
    graph: {
      protocol_id: "protocol.business.standard",
      depth: "STANDARD",
      nodes: [
        { node_id: "BUSINESS.MISSION", stage: "MISSION", title: "Mission" },
        { node_id: "BUSINESS.EXECUTE", stage: "EXECUTE", title: "Execute" },
      ],
    },
  },
  quality_record: {
    protocol_id: "protocol.business.standard",
    protocol_version: "1",
    depth: "STANDARD",
    required_nodes: ["BUSINESS.MISSION", "BUSINESS.EXECUTE"],
    completed_nodes: [],
    skipped_nodes: [],
    failed_nodes: [],
    unknown_nodes: ["BUSINESS.MISSION", "BUSINESS.EXECUTE"],
    context_capsule_ids: [],
    evaluator_results: [
      { criterion_id: "contract_present", status: "PASS" },
      { criterion_id: "target_execution", status: "UNKNOWN" },
    ],
    unverified_claims: [],
    known_limitations: ["No target AI or side-effect tool was run."],
    freshness_state: "NOT_REQUIRED",
    adapter_id: "ANY_AI",
    prompt_digest: "prompt-digest",
  },
};

const input = {
  artifact,
  protocolOutput,
  buildSha: "tip-sha-123",
  recordedAtUtc: "2026-09-25T00:01:00.000Z",
};
const recordA = await runtime.buildLocalExecutionRecord(input);
const recordB = await runtime.buildLocalExecutionRecord(input);
assert.deepEqual(recordA, recordB, "record digests must be stable");
assert.equal(recordA.record_format, "spe.local-execution-record.v1");
assert.equal(recordA.mode, "LOCAL_DRY_RUN");
assert.equal(recordA.executed, false);
assert.equal(recordA.outcome, "NOT_EXECUTED");
assert.equal(recordA.build_sha, "tip-sha-123");
assert.equal(recordA.contract.authority.status, "NONE");
assert.equal(recordA.contract.authority.level, 0);
assert.equal(recordA.contract.example.classification, "EXAMPLE / USER_SUPPLIED");
assert.equal(recordA.contract.example.non_authoritative, true);
assert.match(
  recordA.contract.hard_constraints.find(
    (constraint) => constraint.id === "desired-output",
  ).statement,
  /success criteria/,
);
assert.equal(
  recordA.checks.find((check) => check.id === "constraints-preserved").status,
  "PASS",
);
assert.equal(
  recordA.checks.find((check) => check.id === "authority-not-escalated").status,
  "PASS",
);
assert.equal(
  recordA.checks.find((check) => check.id === "example-non-authoritative").status,
  "PASS",
);
assert.equal(recordA.conformance.overall, "UNKNOWN");
assert.doesNotMatch(JSON.stringify(recordA), /"receipt"/);

const weakened = structuredClone(artifact);
weakened.envelope.payload.hard_constraints.find(
  (constraint) => constraint.constraint_id === "desired-output",
).statement = "Any output is acceptable.";
const weakenedRecord = await runtime.buildLocalExecutionRecord({
  ...input,
  artifact: weakened,
});
assert.equal(
  weakenedRecord.checks.find(
    (check) => check.id === "constraints-preserved",
  ).status,
  "FAIL",
);
assert.equal(weakenedRecord.conformance.overall, "FAIL");

const escalated = structuredClone(artifact);
escalated.envelope.payload.authority_state = {
  status: "ACTIVE",
  level: 1,
  grants: ["self-minted"],
};
const escalatedRecord = await runtime.buildLocalExecutionRecord({
  ...input,
  artifact: escalated,
});
assert.equal(
  escalatedRecord.checks.find(
    (check) => check.id === "authority-not-escalated",
  ).status,
  "FAIL",
);

const promoted = structuredClone(artifact);
promoted.envelope.payload.hard_constraints.push({
  constraint_id: "desired-example",
  statement: "Example promoted",
  strength: "HARD",
});
const promotedRecord = await runtime.buildLocalExecutionRecord({
  ...input,
  artifact: promoted,
});
assert.equal(
  promotedRecord.checks.find(
    (check) => check.id === "example-non-authoritative",
  ).status,
  "FAIL",
);

assert.equal(
  runtime.summarizeConformance(["PASS", "UNKNOWN"]),
  "UNKNOWN",
);
assert.equal(runtime.summarizeConformance(["PASS", "FAIL"]), "FAIL");
assert.equal(runtime.summarizeConformance(["PASS", "PASS"]), "PASS");

const durable = await runtime.buildSpeArtifact({
  ...artifact,
  execution_record: recordA,
  created_at_utc: artifact.created_at_utc,
});
const roundTrip = await runtime.parseSpeArtifactText(JSON.stringify(durable));
assert.equal(roundTrip.artifact.execution_record.digests.record_sha256, recordA.digests.record_sha256);

const launderedRecord = structuredClone(recordA);
launderedRecord.conformance.overall = "PASS";
const launderedArtifact = await runtime.buildSpeArtifact({
  ...artifact,
  execution_record: launderedRecord,
  created_at_utc: artifact.created_at_utc,
});
await assert.rejects(
  runtime.parseSpeArtifactText(JSON.stringify(launderedArtifact)),
  (error) => error.code === "MISSING_FIELDS",
);

const panel = readFileSync(
  join(root, "src/workspace/ExecutionContractPanel.tsx"),
  "utf8",
);
assert.match(panel, /Execution Contract/);
assert.match(panel, /CONTRACT/);
assert.match(panel, /AUTHORITY/);
assert.match(panel, /LOCAL RUN RECORD/);
assert.match(panel, /recommend ≠ authorize ≠ execute/);
assert.match(panel, /Run local dry-run/);

console.log("PASS execution contract + local record + conformance laws");
