#!/usr/bin/env node
/**
 * Canonical rustc wrapper for the SPE WASM release candidate.
 *
 * spe-wasm is its own Cargo workspace. The sibling path dependency
 * spe-core-rs lives outside that workspace root, so Cargo 1.98 hashes the
 * absolute file URL into `-C metadata` (source_id stable_hash). That hash
 * changes when the checkout directory changes and makes the wasm bytes
 * path-dependent. RUSTFLAGS are not part of that hash, and rustc 1.98
 * concatenates extra `-C metadata` values instead of replacing Cargo's.
 *
 * This wrapper replaces `-C metadata` only for the two path crates
 * (spe_core_rs, spe_wasm) with a repository constant. Registry crates keep
 * Cargo's metadata, which is already independent of the checkout path.
 * extra-filename is left untouched: it names the rlib on disk and is not
 * embedded in the wasm module.
 *
 * This is not a search for a historical hash.
 */
import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PINNED = new Set(["spe_core_rs", "spe_wasm"]);
const CANONICAL_HOST = "x86_64-unknown-linux-gnu";

const rustc = process.argv[2];
const args = process.argv.slice(3);
if (!rustc) {
  process.stderr.write("spe-wasm rustc wrapper: missing rustc\n");
  process.exit(2);
}

const isVerboseVersion =
  !args.includes("--crate-name") &&
  (args.includes("-vV") ||
    args.includes("-Vv") ||
    ((args.includes("-v") || args.includes("--verbose")) &&
      (args.includes("-V") || args.includes("--version"))));

if (isVerboseVersion) {
  const result = spawnSync(rustc, args, { encoding: "utf8" });
  if (result.error) {
    process.stderr.write(`spe-wasm rustc wrapper: ${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status === null ? 1 : result.status);
  }
  const lines = (result.stdout || "").split("\n");
  const normalized = lines.map((line) => {
    if (line.startsWith("host:")) {
      return `host: ${CANONICAL_HOST}`;
    }
    return line;
  });
  process.stdout.write(normalized.join("\n"));
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(0);
}

let crate = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--crate-name" && i + 1 < args.length) {
    crate = args[i + 1];
    break;
  }
}

const out = [];
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  const next = i + 1 < args.length ? args[i + 1] : "";
  if (arg === "-C" && next.startsWith("metadata=")) {
    if (PINNED.has(crate)) {
      out.push("-C", `metadata=spe-canonical-v1-${crate}`);
    } else {
      out.push(arg, next);
    }
    i += 1;
    continue;
  }
  if (arg.startsWith("-Cmetadata=")) {
    if (PINNED.has(crate)) {
      out.push(`-Cmetadata=spe-canonical-v1-${crate}`);
    } else {
      out.push(arg);
    }
    continue;
  }
  out.push(arg);
}

const logPath = process.env.SPE_WASM_RUSTC_LOG;
if (logPath && crate && PINNED.has(crate)) {
  appendFileSync(logPath, `${JSON.stringify({ crate, metadata: `spe-canonical-v1-${crate}` })}\n`);
}

const cleanEnv = { ...process.env };
delete cleanEnv.CARGO_MAKEFLAGS;
delete cleanEnv.MAKEFLAGS;
delete cleanEnv.MFLAGS;

const result = spawnSync(rustc, out, { stdio: "inherit", env: cleanEnv });
if (result.error) {
  process.stderr.write(`spe-wasm rustc wrapper: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
