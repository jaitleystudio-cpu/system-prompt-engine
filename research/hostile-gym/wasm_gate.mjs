// Package G: WASM gate. Integrity, zero imports, char-limit boundaries, determinism,
// in-process network tripwires. Pair with zero_network.sh (OS-level sandbox) for the real harness.
import net from "node:net"; import dns from "node:dns"; import http from "node:http"; import https from "node:https"; import tls from "node:tls"; import dgram from "node:dgram";
import { createHash } from "node:crypto";
import { api, wasmBytes, expectedSha256 } from "./runtime.mjs";
const { loadAndEvaluate } = await import("../../apps/web/src/engine/wasm-host.mjs");
const trips = [];
const trip = (n) => function () { trips.push(n); throw new Error("NETWORK_TRIPWIRE " + n); };
net.Socket.prototype.connect = trip("net.connect"); net.connect = trip("net.connect"); net.createConnection = trip("net.createConnection");
dns.lookup = trip("dns.lookup"); dns.resolve = trip("dns.resolve"); http.request = trip("http.request"); https.request = trip("https.request");
tls.connect = trip("tls.connect"); dgram.createSocket = trip("dgram"); globalThis.fetch = trip("fetch"); globalThis.WebSocket = trip("WebSocket");
const results = []; let failed = 0;
const check = (name, ok, detail = {}) => { results.push({ name, ok, ...detail }); if (!ok) failed++; };
const sha = createHash("sha256").update(wasmBytes).digest("hex");
check("sha256_matches_manifest", sha === expectedSha256, { sha });
const mod = new WebAssembly.Module(wasmBytes);
check("zero_host_imports", WebAssembly.Module.imports(mod).length === 0, { imports: WebAssembly.Module.imports(mod) });
check("exports_exact", JSON.stringify(WebAssembly.Module.exports(mod).map((e) => e.name).sort()) === JSON.stringify(["__data_end", "__heap_base", "memory", "spe_alloc", "spe_evaluate", "spe_free"]));
const tampered = wasmBytes.slice(); tampered[tampered.length - 1] ^= 1;
const tOut = await loadAndEvaluate({ wasmBytes: tampered, expectedSha256, jsonText: "{}" });
check("tampered_bytes_refused", tOut.error?.code === "WASM_INTEGRITY_MISMATCH");
const UI_LIMIT = 20000; // apps/web/src/landing/Hero.tsx maxLength
const lens = [1, 2, 255, 256, 1023, 1024, 4095, 4096, UI_LIMIT - 1, UI_LIMIT, UI_LIMIT + 1, 65535, 65536, 262144, 1048576];
const unit = { ascii: "a", telugu: "తె", emoji: "🧪" };
for (const [script, u] of Object.entries(unit)) for (const L of lens) {
  const goal = Array.from({ length: L }, () => u).join("").slice(0, L * u.length); // L code units of unit repeated
  const intent = api.defaultIntentLens(goal);
  const fx = api.buildAbiFixture({ category: "Writing", target: "any", userRequest: goal, ...intent });
  fx.envelope && (fx.envelope.envelope_id = "fixed");
  const jsonText = JSON.stringify(fx).replace(/web-[a-z0-9-]+-[a-z0-9]+"/, 'web-fixed"');
  const a = await loadAndEvaluate({ wasmBytes, expectedSha256, jsonText });
  const b = await loadAndEvaluate({ wasmBytes, expectedSha256, jsonText });
  const status = a.result?.status ?? a.error?.code;
  const det = JSON.stringify(a.result) === JSON.stringify(b.result);
  const goalBack = a.result?.output?.facts?.find?.((f) => f.fact_id === "f-user-request")?.statement;
  const preserved = status !== "VALID" || goalBack === goal.trim();
  check(`boundary_${script}_${L}`, !!status && status !== "ENGINE_UNAVAILABLE" && det && preserved, { status, deterministic: det, goal_preserved: preserved, input_bytes: Buffer.byteLength(jsonText) });
}
for (const [n, txt] of [["empty", ""], ["not_json", "{{{"], ["null", "null"], ["array", "[]"], ["deep_nesting", "[".repeat(5000) + "]".repeat(5000)], ["nul_bytes", '{"a":"\\u0000"}'], ["empty_object", "{}"], ["schemaless_object", '{"a":1}']]) {
  const o = await loadAndEvaluate({ wasmBytes, expectedSha256, jsonText: txt });
  const status = o.result?.status ?? o.error?.code;
  check(`malformed_${n}_fails_closed`, status !== "VALID", { status, disposition: o.result?.disposition, reason: o.result?.reason_code });
}
check("zero_network_tripwires", trips.length === 0, { trips });
const summary = { suite: "wasm-gate-r1", wasm_sha256: sha, ui_char_limit: UI_LIMIT, total: results.length, failed, results };
console.log(JSON.stringify(summary, null, 1)); process.exit(failed ? 1 : 0);
