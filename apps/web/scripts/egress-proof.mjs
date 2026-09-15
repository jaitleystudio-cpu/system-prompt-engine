#!/usr/bin/env node
/**
 * Prove zero external network egress during SPE evaluate via wasm-host.
 * Writes proofs/generated/sprint6_network_egress.json when SPE_PROOF_OUT set.
 * COST ₹0. network_mode=NONE. not_a_release=true.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const evalScript = join(webRoot, "scripts/eval-fixture.mjs");

const env = {
  ...process.env,
  SPE_FIXTURE_ID: "POS-001",
  SPE_PROOF_EGRESS: "1",
};
const proc = spawnSync(process.execPath, [evalScript], {
  cwd: webRoot,
  env,
  encoding: "utf8",
});
if (proc.status !== 0) {
  console.error(proc.stderr || proc.stdout);
  process.exit(proc.status || 1);
}
const result = JSON.parse(proc.stdout);
const egress = result.egress || {};
const proof = {
  not_a_release: true,
  new_implementation: true,
  network_mode: "NONE",
  fixture_id: "POS-001",
  fetch_during_evaluate: egress.fetch_during_evaluate ?? -1,
  websocket_during_evaluate: egress.websocket_during_evaluate ?? -1,
  external_hosts: [],
  zero_egress: (egress.fetch_during_evaluate ?? 1) === 0 && (egress.websocket_during_evaluate ?? 1) === 0,
  engine_error: result.error,
  used_ts_fallback: result.used_ts_fallback === true,
};

const outPath =
  process.env.SPE_PROOF_OUT ||
  join(repoRoot, "proofs/generated/sprint6_network_egress.json");
writeFileSync(outPath, JSON.stringify(proof, null, 2) + "\n");
console.log(JSON.stringify(proof, null, 2));
if (!proof.zero_egress || proof.used_ts_fallback) process.exit(1);
