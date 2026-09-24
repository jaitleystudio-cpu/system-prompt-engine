#!/usr/bin/env node
/**
 * Copy spe-wasm release artifact into apps/web/public/ and write SHA-256 meta.
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

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const src = resolve(
  repoRoot,
  "portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm",
);
const publicDir = join(webRoot, "public");
const dest = join(publicDir, "spe_wasm.wasm");
const metaPath = join(publicDir, "spe_wasm.sha256.json");

if (!existsSync(src)) {
  console.error(`copy-wasm: missing release artifact at ${src}`);
  console.error(
    "Build first: cargo build --manifest-path portable/spe-wasm/Cargo.toml --locked --offline --target wasm32-unknown-unknown --release",
  );
  process.exit(1);
}

mkdirSync(publicDir, { recursive: true });
const bytes = readFileSync(src);
// Do not publish developer home paths embedded by Rust panic/debug metadata.
if (
  ["/Users/", "/home/", ".codex/", ".chatgpt-projects/"].some((marker) =>
    bytes.includes(Buffer.from(marker)),
  )
) {
  throw new Error(
    "WASM contains developer home paths. Rebuild with Rust --remap-path-prefix before packaging.",
  );
}
copyFileSync(src, dest);
chmodSync(dest, 0o644);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const meta = {
  algorithm: "SHA-256",
  sha256,
  bytes: bytes.length,
  source: "portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm",
  crate: "spe-wasm",
  kernel: "spe-core-rs",
  not_a_release: true,
  new_implementation: true,
  network_mode: "NONE",
};
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log(`copy-wasm: wrote ${dest} (${bytes.length} bytes, sha256=${sha256})`);
