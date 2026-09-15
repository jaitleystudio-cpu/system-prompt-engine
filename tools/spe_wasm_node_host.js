#!/usr/bin/env node
/**
 * Zero-cost Node WebAssembly host for spe-wasm.
 * Instantiates spe_wasm.wasm and executes spe_evaluate (JSON-in → JSON-out).
 * No npm deps. License of this file: MIT OR Apache-2.0 (in-tree).
 * COST ₹0. NEW_IMPLEMENTATION. not_a_release.
 *
 * Usage: node spe_wasm_node_host.js <path-to-spe_wasm.wasm> < stdin.json > stdout.json
 * Env SPE_WASM_META=1 → also print host meta to stderr as JSON line.
 */
"use strict";

const fs = require("fs");

async function main() {
  const wasmPath = process.argv[2];
  if (!wasmPath) {
    process.stderr.write("usage: spe_wasm_node_host.js <spe_wasm.wasm>\n");
    process.exit(2);
  }
  const inputBuf = fs.readFileSync(0); // stdin
  const wasmBytes = fs.readFileSync(wasmPath);
  const mod = await WebAssembly.compile(wasmBytes);
  const imports = WebAssembly.Module.imports(mod);
  const exportsInfo = WebAssembly.Module.exports(mod);
  if (imports.length !== 0) {
    process.stderr.write(
      JSON.stringify({
        error: "WASM_HOST_IMPORTS_FORBIDDEN",
        imports,
      }) + "\n"
    );
    process.exit(3);
  }
  const instance = await WebAssembly.instantiate(mod, {});
  const { memory, spe_alloc, spe_evaluate, spe_free } = instance.exports;
  if (!memory || !spe_alloc || !spe_evaluate || !spe_free) {
    process.stderr.write(
      JSON.stringify({
        error: "WASM_EXPORTS_MISSING",
        exports: exportsInfo,
      }) + "\n"
    );
    process.exit(4);
  }

  const inLen = inputBuf.length;
  const inPtr = spe_alloc(inLen === 0 ? 1 : inLen);
  if (inLen > 0) {
    new Uint8Array(memory.buffer, inPtr, inLen).set(inputBuf);
  }
  const outPtr = spe_evaluate(inPtr, inLen);
  const view = new DataView(memory.buffer);
  const outLen = view.getUint32(outPtr, true);
  const outBytes = Buffer.from(
    new Uint8Array(memory.buffer, outPtr + 4, outLen)
  );
  // Free WASM-allocated buffers (best-effort; panic=abort module is fine).
  try {
    spe_free(outPtr, 4 + outLen);
    if (inLen > 0) spe_free(inPtr, inLen);
  } catch (_) {
    /* ignore */
  }

  if (process.env.SPE_WASM_META === "1") {
    process.stderr.write(
      JSON.stringify({
        runtime: "node-webassembly",
        node: process.version,
        wasm_path: wasmPath,
        imports: imports.length,
        exports: exportsInfo.map((e) => e.name),
        input_bytes: inLen,
        output_bytes: outLen,
      }) + "\n"
    );
  }

  process.stdout.write(outBytes);
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
});
