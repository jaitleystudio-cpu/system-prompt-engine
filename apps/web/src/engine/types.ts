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
  | "BRIEF_NEEDS_REVIEW"
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

/** Public source control — mapped in Rust/WASM, not TypeScript. */
export type SourceMode = "AUTO" | "ON" | "OFF";

/** Public depth control — mapped in Rust/WASM to protocol depth. */
export type RequestedDepth = "AUTO" | "FAST" | "SMART" | "DEEP";

export type CapabilityProfileMode = "CONDITIONAL" | "DECLARED" | "NONE";

/**
 * Transport-only request for context-protocol compile.
 * Semantic routing / depth / source policy live in spe-core-rs via WASM.
 */
export type ContextProtocolCompileRequest = {
  spe_api: "context_protocol";
  op: "compile";
  request_text: string;
  source_mode?: SourceMode;
  requested_depth?: RequestedDepth;
  domain_ids?: string[];
  domain_id?: string;
  recipe_id?: string;
  signals?: {
    complexity: number;
    stakes: number;
    uncertainty: number;
    freshness: number;
    evidence: number;
    irreversibility: number;
  };
  capability_profile?: { available: string[] } | null;
  adapter_id?: string;
};

/** Fields produced by Rust through WASM (render-only on the TS side). */
export type ContextProtocolCompileOutput = {
  source_mode: SourceMode;
  requested_depth: RequestedDepth;
  resolved_depth: string;
  context_summary: unknown;
  execution_contract: unknown;
  quality_record: unknown;
  capability_profile_mode: CapabilityProfileMode;
  rendered?: string;
};

export type EngineSuccessBody = {
  status: string;
  disposition: string;
  reason_code: string | null;
  output: unknown;
};

export type WorkerRequest =
  | { id: string; type: "init" }
  | { id: string; type: "evaluate"; jsonText: string }
  | {
      id: string;
      type: "context_protocol";
      request: ContextProtocolCompileRequest;
    };

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
