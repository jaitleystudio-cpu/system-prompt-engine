/**
 * WASM host glue shared by the Web Worker and the Node eval script.
 *
 * UI → Worker → actual spe_wasm.wasm → spe-core-rs.
 * No SPE semantic detectors. No TypeScript fallback. No fallback. No Python in the browser path.
 * NEW_IMPLEMENTATION. not_a_release=true.
 */

export async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

/**
 * @param {{ wasmBytes: Uint8Array, expectedSha256: string | null, jsonText: string, onPhase?: (p: string) => void }} args
 */
export async function loadAndEvaluate(args) {
  const { wasmBytes, expectedSha256, jsonText, onPhase } = args;
  const phases = [];
  const note = (p) => {
    phases.push(p);
    if (typeof onPhase === "function") onPhase(p);
  };

  try {
    note("verifying_integrity");
    const actual = await sha256Hex(wasmBytes);
    if (expectedSha256 && actual !== expectedSha256) {
      return {
        error: {
          code: "WASM_INTEGRITY_MISMATCH",
          message: "spe_wasm.wasm SHA-256 mismatch; refusing to instantiate. No TypeScript fallback.",
        },
        result: null,
        phases,
        used_ts_fallback: false,
        sha256: actual,
        imports: null,
      };
    }

    note("instantiating");
    const mod = await WebAssembly.compile(wasmBytes);
    const imports = WebAssembly.Module.imports(mod);
    if (imports.length !== 0) {
      return {
        error: {
          code: "WASM_HOST_IMPORTS_FORBIDDEN",
          message: "compiled module declared host imports; ENGINE_UNAVAILABLE. No TypeScript fallback.",
        },
        result: null,
        phases,
        used_ts_fallback: false,
        sha256: actual,
        imports: imports.length,
      };
    }

    const instance = await WebAssembly.instantiate(mod, {});
    const { memory, spe_alloc, spe_evaluate, spe_free } = instance.exports;
    if (!memory || !spe_alloc || !spe_evaluate || !spe_free) {
      return {
        error: {
          code: "WASM_EXPORTS_MISSING",
          message: "required exports missing (memory, spe_alloc, spe_evaluate, spe_free). ENGINE_UNAVAILABLE. No TypeScript fallback.",
        },
        result: null,
        phases,
        used_ts_fallback: false,
        sha256: actual,
        imports: 0,
      };
    }

    note("ready");
    note("evaluating");
    const input = new TextEncoder().encode(jsonText);
    const inLen = input.length;
    const inPtr = spe_alloc(inLen === 0 ? 1 : inLen);
    if (inLen > 0) {
      new Uint8Array(memory.buffer, Number(inPtr), inLen).set(input);
    }
    const outPtr = Number(spe_evaluate(inPtr, inLen));
    const view = new DataView(memory.buffer);
    const outLen = view.getUint32(outPtr, true);
    const outBytes = new Uint8Array(memory.buffer, outPtr + 4, outLen);
    const outText = new TextDecoder().decode(outBytes.slice());
    try {
      spe_free(outPtr, 4 + outLen);
      if (inLen > 0) spe_free(inPtr, inLen);
    } catch {
      /* panic=abort module: ignore free errors */
    }
    return {
      error: null,
      result: JSON.parse(outText),
      phases,
      used_ts_fallback: false,
      sha256: actual,
      imports: 0,
    };
  } catch (err) {
    return {
      error: {
        code: "ENGINE_UNAVAILABLE",
        message: String(err && err.message ? err.message : err),
      },
      result: null,
      phases,
      used_ts_fallback: false,
      sha256: null,
      imports: null,
    };
  }
}
