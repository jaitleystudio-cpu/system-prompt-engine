/// <reference lib="webworker" />
/**
 * Web Worker: load actual spe_wasm.wasm, verify SHA-256, call spe_evaluate.
 * Uses WebAssembly via wasm-host (exports: memory, spe_alloc, spe_evaluate, spe_free).
 * No SPE semantic detectors. No TypeScript fallback. No Python. No fallback evaluator.
 * Context-protocol compile is transport-only: JSON in → WASM → JSON out.
 */
import { loadAndEvaluate } from "./wasm-host.mjs";
import type {
  CompilePhase,
  EngineError,
  EngineSuccessBody,
  WorkerRequest,
  WorkerResponse,
} from "./types";

const ctx = self as DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse): void {
  ctx.postMessage(msg);
}

async function readWasm(): Promise<{ bytes: Uint8Array; sha: string }> {
  const wasmResp = await fetch(new URL("/spe_wasm.wasm", ctx.location.origin));
  if (!wasmResp.ok) {
    throw new Error(`wasm fetch failed: ${wasmResp.status}`);
  }
  const bytes = new Uint8Array(await wasmResp.arrayBuffer());
  const metaResp = await fetch(new URL("/spe_wasm.sha256.json", ctx.location.origin));
  if (!metaResp.ok) {
    throw new Error(`integrity manifest fetch failed: ${metaResp.status}`);
  }
  const meta = (await metaResp.json()) as { sha256: string };
  return { bytes, sha: meta.sha256 };
}

function requestJsonText(msg: WorkerRequest): string {
  if (msg.type === "init") return "{}";
  if (msg.type === "context_protocol") {
    // Transport only — do not interpret or synthesize protocol fields here.
    return JSON.stringify(msg.request);
  }
  return msg.jsonText;
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  const onPhase = (phase: string) => {
    post({ id: msg.id, type: "status", phase: phase as CompilePhase });
  };
  try {
    post({ id: msg.id, type: "status", phase: "loading_wasm" });
    const { bytes, sha } = await readWasm();
    const jsonText = requestJsonText(msg);
    const out = await loadAndEvaluate({
      wasmBytes: bytes,
      expectedSha256: sha,
      jsonText,
      onPhase,
    });
    post({
      id: msg.id,
      type: "done",
      error: out.error as EngineError | null,
      result: out.result as EngineSuccessBody | null,
      phases: ["loading_wasm", ...out.phases],
      sha256: out.sha256,
      imports: out.imports,
      used_ts_fallback: false,
    });
  } catch (err) {
    post({
      id: msg.id,
      type: "done",
      error: {
        code: "ENGINE_UNAVAILABLE",
        message: String(err && (err as Error).message ? (err as Error).message : err),
      },
      result: null,
      phases: ["loading_wasm", "unavailable"],
      sha256: null,
      imports: null,
      used_ts_fallback: false,
    });
  }
};
