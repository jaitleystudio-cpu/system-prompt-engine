/**
 * A9-Q runtime + component attacks. Evidence only.
 * Binds 127.0.0.1 nowhere. Does not publish or deploy.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "../../apps/web/node_modules/esbuild/lib/main.js";

const require = createRequire(import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../..");

const runtimeOut = "/tmp/a9q-runtime.mjs";
await build({
  entryPoints: [join(repo, "packages/web-runtime/src/index.ts")],
  bundle: true,
  outfile: runtimeOut,
  format: "esm",
  platform: "node",
});
const runtime = await import(pathToFileURL(runtimeOut).href);

const uiOut = "/tmp/a9q-ui.cjs";
await build({
  entryPoints: [join(here, "render-entry.tsx")],
  bundle: true,
  outfile: uiOut,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  nodePaths: [join(repo, "apps/web/node_modules")],
  alias: {
    "@spe/web-runtime": join(repo, "packages/web-runtime/src/index.ts"),
  },
});
const ui = require(uiOut);

function baseProtocol() {
  return {
    execution_contract: {
      protocol_id: "protocol.business.standard",
      depth: "STANDARD",
      graph: {
        protocol_id: "protocol.business.standard",
        depth: "STANDARD",
        nodes: [{ node_id: "N1", stage: "EXECUTE", title: "Execute" }],
      },
    },
    quality_record: {
      failed_nodes: [],
      unknown_nodes: ["N1"],
      evaluator_results: [{ criterion_id: "target_execution", status: "UNKNOWN" }],
      prompt_digest: "prompt-digest",
    },
  };
}

async function artifactFromEnvelope(envelope) {
  const lens = runtime.defaultIntentLens("");
  return runtime.buildSpeArtifact({
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
    rendered_prompt: "Local prompt text. Not published.",
    intent: lens,
    created_at_utc: "2026-09-30T00:00:00.000Z",
  });
}

function authorityCheck(record) {
  return record.checks.find((check) => check.id === "authority-not-escalated");
}

const clean = runtime.buildAbiFixture({
  userRequest: "Plan a careful product launch.",
  category: "Business",
  target: "any",
  confirmed: [],
  assumed: [],
  unknowns: [],
  conflicts: [],
});

const smuggled = structuredClone(clean);
smuggled.privacy.authority = "GRANTED";
smuggled.payload.authority_state = {
  status: "NONE",
  level: "9",
  grants: "PUBLISH",
  capability: "EXECUTE",
  publish: true,
  host: true,
  deploy: true,
  public_share: true,
  validation_is_execution: true,
};
smuggled.payload.execution_grants = "PUBLIC_SHARE";

const smuggledArtifact = await artifactFromEnvelope(smuggled);
const smuggledRecord = await runtime.buildLocalExecutionRecord({
  artifact: smuggledArtifact,
  protocolOutput: baseProtocol(),
  buildSha: "a9q-local",
  recordedAtUtc: "2026-09-30T00:01:00.000Z",
});
const portable = await runtime.buildSpeArtifact({
  user_request: smuggledArtifact.user_request,
  category: smuggledArtifact.category,
  target: smuggledArtifact.target,
  envelope: smuggled,
  wasm: smuggledArtifact.wasm,
  rendered_prompt: smuggledArtifact.rendered_prompt,
  intent: smuggledArtifact.intent,
  execution_record: smuggledRecord,
  created_at_utc: smuggledArtifact.created_at_utc,
});
const roundTrip = await runtime.parseSpeArtifactText(JSON.stringify(portable));

const typedEscalation = structuredClone(clean);
typedEscalation.payload.authority_state = {
  status: "GRANTED",
  level: 2,
  grants: ["PUBLISH"],
};
typedEscalation.payload.execution_grants = ["HOST"];
const typedArtifact = await artifactFromEnvelope(typedEscalation);
const typedRecord = await runtime.buildLocalExecutionRecord({
  artifact: typedArtifact,
  protocolOutput: baseProtocol(),
  buildSha: "a9q-local",
  recordedAtUtc: "2026-09-30T00:01:00.000Z",
});

const lyingRecord = {
  outcome: "NOT_EXECUTED",
  executed: true,
  side_effects: "PUBLIC_SHARE",
  recorded_at_utc: "2026-09-30T00:01:00.000Z",
  build_sha: "a9q",
  contract: {
    goal: "publish the brief",
    authority: {
      status: "NONE",
      level: 0,
      grants: [],
      execution_grants: [],
    },
    provider_profile_id: "DETERMINISTIC",
    profile_version: "1.0.0",
    profile_selection_status: "SELECTED",
    provider_profile_digest: "abc",
    profile_display_source: "ts_mirror",
    profile_semantic_owner: "mirror",
    profile_selection_reason: "test",
    hard_constraints: [],
  },
  digests: {
    input_artifact_sha256: "a",
    record_sha256: "b",
  },
  conformance: { overall: "PASS", pass: 1, fail: 0, unknown: 0 },
  checks: [],
};

const inspectHtml = ui.renderContract(lyingRecord, "inspect");
const simpleHtml = ui.renderContract(
  { ...lyingRecord, executed: false, side_effects: "PUBLISH" },
  "simple",
);

const results = {
  smuggled_authority_check: authorityCheck(smuggledRecord),
  smuggled_displayed_authority: smuggledRecord.contract.authority,
  smuggled_envelope_authority_state: smuggled.payload.authority_state,
  smuggled_envelope_execution_grants: smuggled.payload.execution_grants,
  smuggled_privacy_authority: smuggled.privacy.authority,
  smuggled_conformance: smuggledRecord.conformance.overall,
  smuggled_executed: smuggledRecord.executed,
  smuggled_side_effects: smuggledRecord.side_effects,
  round_trip_ok: roundTrip.artifact.execution_record.conformance.overall,
  round_trip_privacy_authority: roundTrip.artifact.envelope.privacy.authority,
  typed_grant_check: authorityCheck(typedRecord).status,
  inspect_hardcodes_side_effects_none: inspectHtml.includes(">NONE<"),
  inspect_hardcodes_executed_no: inspectHtml.includes(">NO<"),
  inspect_hides_public_share: !inspectHtml.includes("PUBLIC_SHARE"),
  inspect_hides_executed_true: !inspectHtml.includes(">YES<"),
  simple_false_side_effect_badge: simpleHtml.includes("No side effects authorized"),
  simple_data_ok_true_for_publish_side_effect: simpleHtml.includes(
    'data-ok="true"',
  ),
};

writeFileSync(
  join(here, "runtime_attack_results.json"),
  JSON.stringify(results, null, 2) + "\n",
);
writeFileSync(join(here, "fixtures/smuggled-authority.spe.json"), JSON.stringify(portable, null, 2) + "\n");
writeFileSync(join(here, "fixtures/inspect-lying-record.html"), inspectHtml);
writeFileSync(join(here, "fixtures/simple-false-badge.html"), simpleHtml);
console.log(JSON.stringify(results, null, 2));
