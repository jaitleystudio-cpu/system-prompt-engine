/**
 * WASM host glue shared by the Web Worker and the Node eval script.
 *
 * UI → Worker → actual spe_wasm.wasm → spe-core-rs.
 * No SPE semantic detectors. No TypeScript fallback. No fallback. No Python in the browser path.
 * Context-protocol fields (source_mode, requested_depth, context_summary,
 * execution_contract, quality_record, capability_profile_mode) are produced only
 * by Rust through spe_evaluate — this host never synthesizes them locally.
 * Quality verification is host-observed. Caller proof fields are not evidence.
 * NEW_IMPLEMENTATION. not_a_release=true.
 */

const CALLER_ATTESTATION_FIELDS = ["proof_class", "wasm_available", "wasm_sha256", "enforcement"];

export async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function notePhase(phases, onPhase, phase) {
  phases.push(phase);
  if (typeof onPhase === "function") onPhase(phase);
}

/**
 * Verify bytes, refuse host imports, and return an evaluator bound to that module.
 * @param {{ wasmBytes: Uint8Array, expectedSha256: string | null, onPhase?: (p: string) => void }} args
 */
export async function createVerifiedWasmSession(args) {
  const { wasmBytes, expectedSha256, onPhase } = args;
  const phases = [];
  const note = (phase) => notePhase(phases, onPhase, phase);
  const unverified = (error, sha256, imports) => ({
    error,
    sha256,
    imports,
    verified: false,
    phases,
    evaluate: async () => {
      throw new Error(error.message);
    },
  });

  try {
    note("verifying_integrity");
    const actual = await sha256Hex(wasmBytes);
    if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256) || actual !== expectedSha256) {
      return unverified(
        {
          code: "WASM_INTEGRITY_MISMATCH",
          message: "spe_wasm.wasm SHA-256 mismatch; refusing to instantiate. No TypeScript fallback.",
        },
        actual,
        null,
      );
    }

    note("instantiating");
    const mod = await WebAssembly.compile(wasmBytes);
    const imports = WebAssembly.Module.imports(mod);
    if (imports.length !== 0) {
      return unverified(
        {
          code: "WASM_HOST_IMPORTS_FORBIDDEN",
          message: "compiled module declared host imports; ENGINE_UNAVAILABLE. No TypeScript fallback.",
        },
        actual,
        imports.length,
      );
    }

    const instance = await WebAssembly.instantiate(mod, {});
    const { memory, spe_alloc, spe_evaluate, spe_free } = instance.exports;
    if (!memory || !spe_alloc || !spe_evaluate || !spe_free) {
      return unverified(
        {
          code: "WASM_EXPORTS_MISSING",
          message:
            "required exports missing (memory, spe_alloc, spe_evaluate, spe_free). ENGINE_UNAVAILABLE. No TypeScript fallback.",
        },
        actual,
        0,
      );
    }

    note("ready");
    return {
      error: null,
      sha256: actual,
      imports: 0,
      verified: true,
      phases,
      evaluate: async (jsonText) => {
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
        return JSON.parse(outText);
      },
    };
  } catch (err) {
    return unverified(
      {
        code: "ENGINE_UNAVAILABLE",
        message: String(err && err.message ? err.message : err),
      },
      null,
      null,
    );
  }
}

/**
 * Drop caller attestation and attach only host-observed runtime evidence.
 * proof_class is never copied from the request.
 */
export function sealQualityRequest(request, session) {
  const sealed = { ...(request && typeof request === "object" ? request : {}) };
  for (const field of CALLER_ATTESTATION_FIELDS) delete sealed[field];
  const verified = session?.verified === true;
  sealed.runtime_evidence = {
    runtime_path: "worker-wasm",
    wasm_sha256: session?.sha256 ?? null,
    imports: session?.imports ?? null,
    integrity_state: verified ? "VERIFIED" : "UNVERIFIED",
    verified,
  };
  if (verified) {
    sealed.wasm_available = true;
    sealed.enforcement = "AVAILABLE";
    sealed.wasm_sha256 = session.sha256;
  } else {
    sealed.wasm_available = false;
  }
  return sealed;
}

/**
 * @param {{ type?: string, jsonText?: string, request?: Record<string, unknown> }} msg
 */
export function resolveQualityRoute(msg) {
  let body = null;
  if (msg && msg.type === "quality") {
    body = msg.request ?? null;
  } else if (msg && msg.type === "evaluate" && typeof msg.jsonText === "string") {
    try {
      body = JSON.parse(msg.jsonText);
    } catch {
      body = null;
    }
  }
  const isQuality = !!body && body.spe_api === "quality";
  if (msg && msg.type === "quality" && isQuality) return { trusted: true, error: null };
  if (isQuality) return { trusted: false, error: "TRUSTED_QUALITY_PATH_REQUIRED" };
  return { trusted: false, error: null };
}

/**
 * @param {{ wasmBytes: Uint8Array, expectedSha256: string | null, request: Record<string, unknown>, onPhase?: (p: string) => void }} args
 */
export async function evaluateTrustedQuality(args) {
  const session = await createVerifiedWasmSession({
    wasmBytes: args.wasmBytes,
    expectedSha256: args.expectedSha256,
    onPhase: args.onPhase,
  });
  if (!session.verified) {
    return {
      trusted: false,
      error: session.error,
      result: null,
      phases: session.phases,
      sha256: session.sha256,
      imports: session.imports,
      used_ts_fallback: false,
      sealed: null,
    };
  }
  const sealed = sealQualityRequest(args.request, session);
  try {
    const result = await session.evaluate(JSON.stringify(sealed));
    return {
      trusted: true,
      error: null,
      result,
      phases: session.phases,
      sha256: session.sha256,
      imports: 0,
      used_ts_fallback: false,
      sealed,
    };
  } catch (err) {
    return {
      trusted: false,
      error: {
        code: "ENGINE_UNAVAILABLE",
        message: String(err && err.message ? err.message : err),
      },
      result: null,
      phases: session.phases,
      sha256: null,
      imports: null,
      used_ts_fallback: false,
      sealed,
    };
  }
}

/**
 * Compatibility wrapper over the verified session. Existing callers keep the same result shape.
 * @param {{ wasmBytes: Uint8Array, expectedSha256: string | null, jsonText: string, onPhase?: (p: string) => void }} args
 */
export async function loadAndEvaluate(args) {
  const session = await createVerifiedWasmSession(args);
  if (!session.verified) {
    return {
      error: session.error,
      result: null,
      phases: session.phases,
      used_ts_fallback: false,
      sha256: session.sha256,
      imports: session.imports,
    };
  }
  try {
    const result = await session.evaluate(args.jsonText);
    return {
      error: null,
      result,
      phases: session.phases,
      used_ts_fallback: false,
      sha256: session.sha256,
      imports: 0,
    };
  } catch (err) {
    return {
      error: {
        code: "ENGINE_UNAVAILABLE",
        message: String(err && err.message ? err.message : err),
      },
      result: null,
      phases: session.phases,
      used_ts_fallback: false,
      sha256: null,
      imports: null,
    };
  }
}
