#!/usr/bin/env node
import assert from "node:assert/strict";
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

const { CapabilityHost } = runtime;
assert.ok(CapabilityHost, "CapabilityHost must be exported from web-runtime");

const admittedCapsule = {
  capsule_id: "capsule_host_admitted_01",
  name: "Deterministic Field Extractor",
  version: "1.0.0",
  admission_state: "DEPLOYMENT_ELIGIBLE",
  procedure: {
    format: "ast_json",
    entrypoint: "transform",
    payload: JSON.stringify({ target_key: "diagnostic_metric" }),
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  },
  contracts: {
    input_schema: { type: "object" },
    output_schema: { type: "object" },
    deterministic: true,
  },
  guards: {
    applicability_conditions: ["always"],
    invalidation_conditions: ["schema_drift"],
  },
  witnesses: [],
  interventions: {
    trial_count: 10,
    active_success_rate: 1.0,
    baseline_success_rate: 0.0,
    placebo_success_rate: 0.0,
    lcb_95_delta: 0.85,
  },
  transfer: {
    qualified_models: ["claude-3-7-sonnet", "openai-o3"],
    rejected_models: [],
  },
  revocation_rules: {
    dependency_hashes: { ast: "h1" },
    max_drift_tolerance: 0.05,
  },
};

// 1. Test Admission States
assert.equal(CapabilityHost.isAdmitted(admittedCapsule), true);
assert.equal(
  CapabilityHost.isAdmitted({ ...admittedCapsule, admission_state: "BEHAVIORALLY_QUALIFIED" }),
  true,
);
assert.equal(
  CapabilityHost.isAdmitted({ ...admittedCapsule, admission_state: "TRANSFER_QUALIFIED" }),
  true,
);
assert.equal(
  CapabilityHost.isAdmitted({ ...admittedCapsule, admission_state: "HYPOTHESIS" }),
  false,
);
assert.equal(
  CapabilityHost.isAdmitted({ ...admittedCapsule, admission_state: "STRUCTURALLY_VALID" }),
  false,
);
assert.equal(
  CapabilityHost.isAdmitted({ ...admittedCapsule, admission_state: "SUSPENDED" }),
  false,
);
assert.equal(
  CapabilityHost.isAdmitted({ ...admittedCapsule, admission_state: "REJECTED" }),
  false,
);

// 2. Test Fail-Closed Admission Gate
const suspendedExecution = CapabilityHost.execute(
  { ...admittedCapsule, admission_state: "SUSPENDED" },
  { diagnostic_metric: 42 },
);
assert.equal(suspendedExecution.success, false);
assert.equal(suspendedExecution.tokenCost, 0);
assert.match(suspendedExecution.error, /not admitted/i);

// 3. Test Admitted Execution
const singleExecution = CapabilityHost.execute(admittedCapsule, {
  diagnostic_metric: 42,
  other: "ignore",
});
assert.equal(singleExecution.success, true);
assert.deepEqual(singleExecution.output, {
  diagnostic_metric: 42,
  transformed: true,
});
assert.equal(singleExecution.tokenCost, 0);
assert.equal(singleExecution.deterministicVerified, true);
assert.ok(singleExecution.latencyMs >= 0);

// 4. Test Deterministic Round-Trip Execution
const roundTrip = CapabilityHost.executeRoundTrip(
  admittedCapsule,
  { diagnostic_metric: "cpu_burn_rate" },
  5,
);
assert.equal(roundTrip.roundTripSuccess, true);
assert.equal(roundTrip.outputsMatch, true);
assert.equal(roundTrip.results.length, 5);
for (const r of roundTrip.results) {
  assert.equal(r.success, true);
  assert.equal(r.tokenCost, 0);
  assert.deepEqual(r.output, {
    diagnostic_metric: "cpu_burn_rate",
    transformed: true,
  });
}

// 5. Test Op Pick & Merge Procedure
const opCapsule = {
  ...admittedCapsule,
  procedure: {
    format: "ast_json",
    entrypoint: "pick",
    payload: JSON.stringify({ op: "pick", fields: ["a", "b"] }),
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  },
};
const opExec = CapabilityHost.execute(opCapsule, { a: 1, b: 2, c: 3 });
assert.equal(opExec.success, true);
assert.deepEqual(opExec.output, { a: 1, b: 2 });
assert.equal(opExec.deterministicVerified, true);

// 6. Test Op Merge Procedure
const mergeCapsule = {
  ...admittedCapsule,
  procedure: {
    format: "ast_json",
    entrypoint: "merge",
    payload: JSON.stringify({ op: "merge", static: { env: "prod", version: "v2" } }),
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  },
};
const mergeExec = CapabilityHost.execute(mergeCapsule, { user: "operator_01" });
assert.equal(mergeExec.success, true);
assert.deepEqual(mergeExec.output, { user: "operator_01", env: "prod", version: "v2", merged: true });
assert.equal(mergeExec.deterministicVerified, true);

// 7. Test Custom Op Determinism (Unrecognized OP must maintain determinism)
const customOpCapsule = {
  ...admittedCapsule,
  procedure: {
    format: "ast_json",
    entrypoint: "custom",
    payload: JSON.stringify({ op: "custom_transform", rules: [1, 2, 3] }),
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  },
};
const customExec = CapabilityHost.execute(customOpCapsule, { x: 10 });
assert.equal(customExec.success, true);
assert.equal(customExec.deterministicVerified, true);

// 8. Test Null / Non-object Input Rejection (Fail-Closed)
const nullExec = CapabilityHost.execute(admittedCapsule, null);
assert.equal(nullExec.success, false);
assert.match(nullExec.error, /inputData must be a non-null object/i);

const arrExec = CapabilityHost.execute(admittedCapsule, [1, 2, 3]);
assert.equal(arrExec.success, false);
assert.match(arrExec.error, /inputData must be a non-null object/i);

// 9. Test Structure Validation
const validStruct = CapabilityHost.validateStructure(admittedCapsule);
assert.equal(validStruct.valid, true);
assert.equal(validStruct.errors.length, 0);

const invalidStruct = CapabilityHost.validateStructure({});
assert.equal(invalidStruct.valid, false);
assert.ok(invalidStruct.errors.length > 0);

console.log("capabilityHost tests passed successfully.");

