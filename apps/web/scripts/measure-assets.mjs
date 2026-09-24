#!/usr/bin/env node
/**
 * Measure built web assets + shipped WASM. Writes proof JSON when SPE_PROOF_OUT set.
 * COST ₹0. not_a_release=true.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const publicWasm = join(webRoot, "public/spe_wasm.wasm");
const distDir = join(webRoot, "dist");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push({ path: p, bytes: st.size });
  }
  return acc;
}

const wasmBytes = existsSync(publicWasm) ? statSync(publicWasm).size : 0;
const wasmSha = existsSync(publicWasm)
  ? createHash("sha256").update(readFileSync(publicWasm)).digest("hex")
  : null;
const distFiles = walk(distDir);
const distTotal = distFiles.reduce((n, f) => n + f.bytes, 0);
const isLazyPack = (p) =>
  /(?:^|\/)(?:ort|r3f|LabStage|SpeIntelligence)|onnxruntime|react-three|\/three\//i.test(p);
const jsCss = distFiles.filter((f) => /\.(js|css)$/.test(f.path));
const jsCssShell = jsCss.filter((f) => !isLazyPack(f.path));
const jsCssTotal = jsCssShell.reduce((n, f) => n + f.bytes, 0);
const jsCssLazyTotal = jsCss
  .filter((f) => isLazyPack(f.path))
  .reduce((n, f) => n + f.bytes, 0);

const budget = {
  not_a_release: true,
  new_implementation: true,
  network_mode: "NONE",
  wasm_bytes: wasmBytes,
  wasm_sha256: wasmSha,
  dist_file_count: distFiles.length,
  dist_total_bytes: distTotal,
  dist_js_css_bytes: jsCssTotal,
  dist_js_css_lazy_pack_bytes: jsCssLazyTotal,
  budgets: {
    wasm_max_bytes: 2_000_000,
    dist_js_css_max_bytes: 1_500_000,
    note: "Shell JS/CSS excludes lazy ORT + R3F/LabStage chunks; vision weights live under public/models + public/ort",
  },
  within_budget:
    wasmBytes > 0 &&
    wasmBytes <= 2_000_000 &&
    (distFiles.length === 0 || jsCssTotal <= 1_500_000),
};

const outPath =
  process.env.SPE_PROOF_OUT ||
  join(repoRoot, "proofs/generated/sprint6_web_asset_budget.json");
writeFileSync(outPath, JSON.stringify(budget, null, 2) + "\n");
console.log(JSON.stringify(budget, null, 2));
if (!budget.within_budget) process.exit(1);
