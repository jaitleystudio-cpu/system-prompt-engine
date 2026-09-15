export function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string>;

export type EnginePhase =
  | "idle"
  | "loading_wasm"
  | "verifying_integrity"
  | "instantiating"
  | "ready"
  | "evaluating"
  | "unavailable";

export type EngineErrorCode =
  | "ENGINE_UNAVAILABLE"
  | "WASM_INTEGRITY_MISMATCH"
  | "WASM_HOST_IMPORTS_FORBIDDEN"
  | "WASM_EXPORTS_MISSING"
  | "INVALID_JSON"
  | "WORKER_TIMEOUT";

export type EngineError = {
  code: EngineErrorCode;
  message: string;
};

export type EngineSuccessBody = {
  status: string;
  disposition: string;
  reason_code: string | null;
  output: unknown;
};

export type HostResult = {
  error: EngineError | null;
  result: EngineSuccessBody | null;
  phases: string[];
  used_ts_fallback: false;
  sha256: string | null;
  imports: number | null;
};

export function loadAndEvaluate(args: {
  wasmBytes: Uint8Array;
  expectedSha256: string | null;
  jsonText: string;
  onPhase?: (phase: string) => void;
}): Promise<HostResult>;
