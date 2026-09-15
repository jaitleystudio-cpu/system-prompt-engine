export type CompilePhase =
  | "idle"
  | "loading_wasm"
  | "verifying_integrity"
  | "instantiating"
  | "ready"
  | "evaluating"
  | "unavailable"
  | "done";

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

export type WorkerRequest =
  | { id: string; type: "init" }
  | { id: string; type: "evaluate"; jsonText: string };

export type WorkerResponse =
  | { id: string; type: "status"; phase: CompilePhase }
  | {
      id: string;
      type: "done";
      error: EngineError | null;
      result: EngineSuccessBody | null;
      phases: string[];
      sha256: string | null;
      imports: number | null;
      used_ts_fallback: false;
    };
