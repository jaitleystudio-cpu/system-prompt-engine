#!/usr/bin/env node
/**
 * Copy the verified canonical SPE WASM candidate into apps/web/public/.
 *
 * Fail-closed: never publishes arbitrary target bytes. The only accepted
 * input is the canonical candidate produced by
 * `node tools/wasm_canonical_build.mjs`, and it must match the reviewed
 * canonical hash before copy.
 *
 * COST ₹0. NEW_IMPLEMENTATION. not_a_release=true. No network.
 */
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const EXPECTED_SHA256 =
  "8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f";
const EXPECTED_BYTES = 785148;
const PREVIOUS_CANONICAL_SHA256 =
  "9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6";
const PREVIOUS_CANONICAL_BYTES = 671621;
const LEGACY_SHA256 =
  "8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830";
const CANONICAL_SOURCE =
  "portable/spe-wasm/target-canonical/wasm32-unknown-unknown/release/spe_wasm.wasm";
const FORBIDDEN_ARBITRARY_SOURCE =
  "portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm";
const PATH_MARKERS = ["/Users/", "/home/", "/workspace", ".codex/", ".chatgpt-projects/"];

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const src = resolve(repoRoot, CANONICAL_SOURCE);
const forbiddenSrc = resolve(repoRoot, FORBIDDEN_ARBITRARY_SOURCE);
const publicDir = join(webRoot, "public");
const dest = join(publicDir, "spe_wasm.wasm");
const metaPath = join(publicDir, "spe_wasm.sha256.json");
const candidateManifest = join(
  repoRoot,
  "proofs/k3_runtime_closure_20260929/candidate-manifest.json",
);
const historicalManifest = join(
  repoRoot,
  "proofs/wasm_rebaseline_candidate_20260928/candidate-manifest.json",
);

function fail(message) {
  console.error(`copy-wasm: ${message}`);
  process.exit(1);
}

function inspectModule(artifact) {
  const script = `
const fs = require("fs");
WebAssembly.compile(fs.readFileSync(process.argv[1])).then((mod) => {
  const imports = WebAssembly.Module.imports(mod).map((item) => item.module + "." + item.name);
  const exports = WebAssembly.Module.exports(mod).map((item) => item.name).sort();
  process.stdout.write(JSON.stringify({ imports, exports }));
}).catch((error) => {
  process.stderr.write(String(error && error.stack || error));
  process.exit(1);
});
`;
  const result = spawnSync(process.execPath, ["-e", script, artifact], { encoding: "utf8" });
  if (result.status !== 0) fail(`wasm inspection failed: ${(result.stderr || "").trim()}`);
  return JSON.parse(result.stdout);
}

function expectedMeta() {
  return {
    algorithm: "SHA-256",
    sha256: EXPECTED_SHA256,
    bytes: EXPECTED_BYTES,
    source: CANONICAL_SOURCE,
    crate: "spe-wasm",
    kernel: "spe-core-rs",
    not_a_release: true,
    new_implementation: true,
    network_mode: "NONE",
    qualification: "canonical-v1-promoted",
    legacy_sha256: LEGACY_SHA256,
    legacy_bytes: 671614,
    previous_canonical_sha256: PREVIOUS_CANONICAL_SHA256,
    previous_canonical_bytes: PREVIOUS_CANONICAL_BYTES,
    semantic_source_sha: "98bc160184afa0cf95f17ff23392645c16ccc516",
    semantic_source_note: "K3 selector implementation commit. WASM bytes were built from that tree before this proof-SHA record.",
    build_command: "node tools/wasm_canonical_build.mjs",
  };
}

if (src === forbiddenSrc) {
  fail("refusing to publish from the arbitrary default cargo target path");
}

if (!existsSync(src)) {
  fail(
    `missing canonical candidate at ${CANONICAL_SOURCE}. Build first: node tools/wasm_canonical_build.mjs`,
  );
}

if (!existsSync(candidateManifest)) {
  fail("candidate manifest missing; cannot verify promotion inputs");
}
if (!existsSync(historicalManifest)) {
  fail("historical canonical manifest missing");
}
const historical = JSON.parse(readFileSync(historicalManifest, "utf8"));
if (historical.artifact_sha256 !== PREVIOUS_CANONICAL_SHA256) {
  fail("historical canonical manifest no longer records the pre-K3 WASM hash");
}
if (historical.artifact_size !== PREVIOUS_CANONICAL_BYTES) {
  fail("historical canonical manifest size changed");
}

const manifest = JSON.parse(readFileSync(candidateManifest, "utf8"));
if (manifest.artifact_sha256 !== EXPECTED_SHA256) {
  fail("candidate manifest artifact_sha256 does not match reviewed canonical hash");
}
if (manifest.artifact_size !== EXPECTED_BYTES) {
  fail("candidate manifest artifact_size does not match reviewed canonical size");
}
if (manifest.imports !== 0) {
  fail("candidate manifest imports must be 0");
}

mkdirSync(publicDir, { recursive: true });
const bytes = readFileSync(src);
if (bytes.length !== EXPECTED_BYTES) {
  fail(`candidate size ${bytes.length} != expected ${EXPECTED_BYTES}`);
}
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== EXPECTED_SHA256) {
  fail(`candidate sha256 ${sha256} != expected ${EXPECTED_SHA256}`);
}
if (PATH_MARKERS.some((marker) => bytes.includes(Buffer.from(marker)))) {
  fail("candidate contains forbidden absolute or developer path markers");
}

const inspected = inspectModule(src);
if (inspected.imports.length !== 0) {
  fail(`imports must be 0, found ${inspected.imports.length}`);
}
const requiredExports = ["memory", "spe_alloc", "spe_evaluate", "spe_free"];
for (const name of requiredExports) {
  if (!inspected.exports.includes(name)) fail(`missing required export: ${name}`);
}

copyFileSync(src, dest);
chmodSync(dest, 0o644);
const after = createHash("sha256").update(readFileSync(dest)).digest("hex");
if (after !== EXPECTED_SHA256) {
  fail("post-copy public artifact hash mismatch");
}

const meta = expectedMeta();
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
const writtenMeta = JSON.parse(readFileSync(metaPath, "utf8"));
if (writtenMeta.sha256 !== EXPECTED_SHA256 || writtenMeta.bytes !== EXPECTED_BYTES) {
  fail("public hash manifest does not match canonical expectation");
}

console.log(
  `copy-wasm: wrote ${dest} (${bytes.length} bytes, sha256=${sha256}, imports=0, verified=canonical)`,
);
