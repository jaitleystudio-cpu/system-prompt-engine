#!/usr/bin/env node
/**
 * Canonical SPE WASM release build.
 *
 * Builds a deterministic wasm artifact under portable/spe-wasm/target-canonical.
 * Never copies into apps/web/public. The separate copy-wasm npm script performs
 * fail-closed promotion of a hash-verified candidate after this build.
 *
 *   npm run wasm:build-canonical
 *   node tools/wasm_canonical_build.mjs
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_CHANNEL = "1.98.1";
const EXPECTED_COMMIT = "48a229ceaefd4985c50990b14116b6d856af0985";
const EXPECTED_TARGET = "wasm32-unknown-unknown";
const LEGACY_SHA256 = "8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830";
const PREVIOUS_CANONICAL_SHA256 =
  "9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6";
const PREVIOUS_CANONICAL_BYTES = 671621;
const PRE_GRAPH_K3_SHA256 =
  "8b49bf3ce7ee98258f1c13da0253c0b872ff94f6183b3e825108c7022c85653f";
const PRE_GRAPH_K3_BYTES = 785148;
const EXPECTED_CANONICAL_SHA256 =
  "48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33";
const EXPECTED_CANONICAL_BYTES = 937763;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const wrapperPath = join(here, "spe_wasm_rustc_wrapper.mjs");
const publicWasm = join(repoRoot, "apps/web/public/spe_wasm.wasm");
const defaultTarget = join(repoRoot, "portable/spe-wasm/target-canonical");
const arbitraryTarget = join(repoRoot, "portable/spe-wasm/target");
const publicDir = join(repoRoot, "apps/web/public");

function policy(message) {
  process.stderr.write(`canonical-wasm: policy: ${message}\n`);
  process.exit(2);
}

function fail(message) {
  process.stderr.write(`canonical-wasm: ${message}\n`);
  process.exit(1);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function underDir(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function toolchainFile() {
  const override = process.env.SPE_WASM_TOOLCHAIN_FILE;
  if (override && override.length > 0) {
    return isAbsolute(override) ? override : resolve(repoRoot, override);
  }
  return join(repoRoot, "rust-toolchain.toml");
}

function assertToolchainFile(path) {
  if (!existsSync(path)) policy(`toolchain file missing: declared file not found`);
  const text = readFileSync(path, "utf8");
  const channel = text.match(/^\s*channel\s*=\s*"([^"]+)"/m);
  if (!channel) policy("toolchain file has no pinned channel");
  if (channel[1] !== EXPECTED_CHANNEL) {
    policy(`floating or non-canonical Rust channel rejected: ${channel[1]}`);
  }
  if (channel[1] === "stable" || channel[1] === "beta" || channel[1] === "nightly" || channel[1] === "latest") {
    policy(`floating Rust channel rejected: ${channel[1]}`);
  }
  if (!text.includes(EXPECTED_TARGET)) {
    policy(`toolchain file must include target ${EXPECTED_TARGET}`);
  }
}

function assertRequestedTarget() {
  const requested = process.env.SPE_WASM_TARGET;
  if (requested && requested !== EXPECTED_TARGET) {
    policy(`wrong target rejected: ${requested}`);
  }
}

function cargoHome() {
  return process.env.CARGO_HOME && process.env.CARGO_HOME.length > 0
    ? process.env.CARGO_HOME
    : join(homedir(), ".cargo");
}

function baseEnv() {
  const keep = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "LC_ALL",
    "TMPDIR",
    "TMP",
    "TEMP",
    "RUSTUP_HOME",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "http_proxy",
    "https_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "no_proxy",
    "NO_PROXY",
  ];
  const env = {};
  for (const key of keep) {
    if (process.env[key]) env[key] = process.env[key];
  }
  env.CARGO_HOME = cargoHome();
  if (process.env.RUSTUP_HOME) env.RUSTUP_HOME = process.env.RUSTUP_HOME;
  return env;
}

function runChecked(cmd, args, cwd, env) {
  const result = spawnSync(cmd, args, { cwd, env, encoding: "utf8" });
  if (result.error) fail(`${cmd} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    fail(`${cmd} ${args.join(" ")} exited ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout || "";
}

function assertCompiler(env) {
  const rustc = runChecked("rustc", ["-Vv"], repoRoot, env);
  if (!rustc.includes(`release: ${EXPECTED_CHANNEL}`)) {
    policy(`rustc release is not ${EXPECTED_CHANNEL}`);
  }
  if (!rustc.includes(`commit-hash: ${EXPECTED_COMMIT}`)) {
    policy(`rustc commit is not ${EXPECTED_COMMIT}`);
  }
  const cargo = runChecked("cargo", ["--version"], repoRoot, env).trim();
  if (!cargo.startsWith(`cargo ${EXPECTED_CHANNEL}`)) {
    policy(`cargo is not ${EXPECTED_CHANNEL}: ${cargo.split("\n")[0]}`);
  }
  const targets = runChecked("rustup", ["target", "list", "--installed"], repoRoot, env);
  if (!targets.split("\n").some((line) => line.trim() === EXPECTED_TARGET)) {
    policy(`installed targets do not include ${EXPECTED_TARGET}`);
  }
  const active = runChecked("rustup", ["show", "active-toolchain"], repoRoot, env).trim();
  const activeFirst = active.split("\n")[0];
  if (!activeFirst.startsWith(EXPECTED_CHANNEL)) {
    policy(`active toolchain is not ${EXPECTED_CHANNEL}`);
  }
  return {
    rustc,
    cargo: cargo.split("\n")[0],
    active: `${EXPECTED_CHANNEL} (overridden by repository rust-toolchain.toml)`,
  };
}

function resolveTargetDir() {
  const override = process.env.SPE_WASM_CANDIDATE_TARGET_DIR;
  const targetDir = override && override.length > 0 ? resolve(override) : defaultTarget;
  // Reject the historical arbitrary cargo target used by the broken copy path.
  if (resolve(targetDir) === resolve(arbitraryTarget) || underDir(targetDir, arbitraryTarget)) {
    policy("target dir overlaps the arbitrary cargo target; canonical output must use target-canonical or an external clean dir");
  }
  if (underDir(targetDir, publicDir)) {
    policy("target dir is inside apps/web/public; build does not promote");
  }
  return targetDir;
}

function artifactLabel(targetDir, artifact) {
  if (underDir(artifact, repoRoot)) return relative(repoRoot, artifact).split(sep).join("/");
  return "path_class=external-clean-target";
}

function assertNoAbsoluteMarkers(bytes, home) {
  const needles = [
    Buffer.from(repoRoot),
    Buffer.from(home),
    Buffer.from("/Users/"),
    Buffer.from("/home/"),
    Buffer.from("/workspace"),
    Buffer.from(".codex/"),
    Buffer.from(".chatgpt-projects/"),
  ];
  for (const needle of needles) {
    if (needle.length > 0 && bytes.includes(needle)) {
      fail("candidate contains an absolute or developer path marker");
    }
  }
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

function main() {
  assertRequestedTarget();
  const declared = toolchainFile();
  assertToolchainFile(declared);
  const targetDir = resolveTargetDir();
  const env = baseEnv();
  const compiler = assertCompiler(env);
  const before = sha256File(publicWasm);
  if (before !== EXPECTED_CANONICAL_SHA256) {
    policy(
      `tracked public WASM must be the reviewed canonical artifact (${EXPECTED_CANONICAL_SHA256}); refusing to build beside a divergent file`,
    );
  }

  rmSync(targetDir, { recursive: true, force: true });

  const home = env.CARGO_HOME;
  const rustflags = `--remap-path-prefix=${repoRoot}/=./ --remap-path-prefix=${home}=./.cargo`;
  const buildEnv = {
    ...env,
    CARGO_INCREMENTAL: "0",
    CARGO_TARGET_DIR: targetDir,
    RUSTC_WRAPPER: wrapperPath,
    RUSTFLAGS: rustflags,
  };
  if (process.env.SPE_WASM_RUSTC_LOG) {
    buildEnv.SPE_WASM_RUSTC_LOG = process.env.SPE_WASM_RUSTC_LOG;
  }
  const build = spawnSync(
    "cargo",
    [
      "build",
      "--manifest-path",
      "portable/spe-wasm/Cargo.toml",
      "--locked",
      "--target",
      EXPECTED_TARGET,
      "--release",
    ],
    { cwd: repoRoot, env: buildEnv, encoding: "utf8" },
  );
  if (build.error) fail(`cargo failed to start: ${build.error.message}`);
  if (build.status !== 0) {
    process.stderr.write(build.stderr || build.stdout || "");
    fail(`cargo build exited ${build.status}`);
  }

  const artifact = join(targetDir, EXPECTED_TARGET, "release", "spe_wasm.wasm");
  if (!existsSync(artifact)) fail("cargo exited 0 but the release artifact is missing");
  const bytes = readFileSync(artifact);
  assertNoAbsoluteMarkers(bytes, home);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== EXPECTED_CANONICAL_BYTES) {
    fail(`canonical candidate size ${bytes.length} != expected ${EXPECTED_CANONICAL_BYTES}`);
  }
  if (digest !== EXPECTED_CANONICAL_SHA256) {
    fail(`canonical candidate sha256 ${digest} != expected ${EXPECTED_CANONICAL_SHA256}`);
  }
  const inspected = inspectModule(artifact);
  if (inspected.imports.length !== 0) policy(`imports must be 0, found ${inspected.imports.length}`);

  const after = sha256File(publicWasm);
  if (after !== before || after !== EXPECTED_CANONICAL_SHA256) {
    policy("tracked public WASM changed during candidate build");
  }
  // Legacy bytes remain in git history only; they must not equal the canonical artifact.
  if (digest === LEGACY_SHA256) {
    fail("canonical candidate unexpectedly equals legacy public bytes");
  }
  if (digest === PREVIOUS_CANONICAL_SHA256) {
    fail("canonical candidate still matches the pre-K3 semantic WASM");
  }

  const label = artifactLabel(targetDir, artifact);
  process.stdout.write(`canonical-wasm: ok\n`);
  process.stdout.write(`artifact=${label}\n`);
  process.stdout.write(`bytes=${bytes.length}\n`);
  process.stdout.write(`sha256=${digest}\n`);
  process.stdout.write(`imports=${inspected.imports.length}\n`);
  process.stdout.write(`exports=${inspected.exports.join(",")}\n`);
  process.stdout.write(`rustc=${EXPECTED_CHANNEL}\n`);
  process.stdout.write(`rustc_commit=${EXPECTED_COMMIT}\n`);
  process.stdout.write(`cargo=${compiler.cargo}\n`);
  process.stdout.write(`active_toolchain=${compiler.active}\n`);
  process.stdout.write(`target=${EXPECTED_TARGET}\n`);
  process.stdout.write(`promoted=no\n`);
  process.stdout.write(`legacy_sha256=${LEGACY_SHA256}\n`);
  process.stdout.write(`previous_canonical_sha256=${PREVIOUS_CANONICAL_SHA256}\n`);
  process.stdout.write(`previous_canonical_bytes=${PREVIOUS_CANONICAL_BYTES}\n`);
  process.stdout.write(`pre_graph_k3_sha256=${PRE_GRAPH_K3_SHA256}\n`);
  process.stdout.write(`pre_graph_k3_bytes=${PRE_GRAPH_K3_BYTES}\n`);
  process.stdout.write(`canonical_sha256=${EXPECTED_CANONICAL_SHA256}\n`);
}

main();
