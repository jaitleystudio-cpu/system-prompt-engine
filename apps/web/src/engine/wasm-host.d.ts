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
  | "WORKER_TIMEOUT"
  | "TRUSTED_QUALITY_PATH_REQUIRED";

export type EngineError = {
  code: EngineErrorCode;
  message: string;
};

/** Mirrored transport enums — values are interpreted only inside Rust/WASM. */
export type SourceMode = "AUTO" | "ON" | "OFF";
export type RequestedDepth = "AUTO" | "FAST" | "SMART" | "DEEP";
export type CapabilityProfileMode = "CONDITIONAL" | "DECLARED" | "NONE";

export type EngineSuccessBody = {
  status: string;
  disposition: string;
  reason_code: string | null;
  /**
   * For spe_api=context_protocol op=compile, output carries:
   * source_mode, requested_depth, resolved_depth, context_summary,
   * execution_contract, quality_record, capability_profile_mode.
   */
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

export type VerifiedWasmSession = {
  error: EngineError | null;
  sha256: string | null;
  imports: number | null;
  verified: boolean;
  phases: string[];
  evaluate: (jsonText: string) => Promise<EngineSuccessBody>;
};

/**
 * Compute the actual SHA, compare the manifest, compile, refuse host imports,
 * and return the actual SHA plus an evaluator.
 */
export function createVerifiedWasmSession(args: {
  wasmBytes: Uint8Array;
  expectedSha256: string | null;
  onPhase?: (phase: string) => void;
}): Promise<VerifiedWasmSession>;

export function sealQualityRequest(
  request: Record<string, unknown>,
  session: { verified?: boolean; sha256?: string | null; imports?: number | null },
): Record<string, unknown> & { runtime_evidence: Record<string, unknown> };

export function resolveQualityRoute(msg: {
  type?: string;
  jsonText?: string;
  request?: Record<string, unknown>;
}): { trusted: boolean; error: string | null };

export function evaluateTrustedQuality(args: {
  wasmBytes: Uint8Array;
  expectedSha256: string | null;
  request: Record<string, unknown>;
  onPhase?: (phase: string) => void;
}): Promise<
  HostResult & {
    trusted: boolean;
    sealed: (Record<string, unknown> & { runtime_evidence?: Record<string, unknown> }) | null;
  }
>;

/**
 * Load spe_wasm.wasm, verify integrity, call spe_evaluate.
 * Never synthesizes context_summary / execution_contract / quality_record in JS.
 */
export function loadAndEvaluate(args: {
  wasmBytes: Uint8Array;
  expectedSha256: string | null;
  jsonText: string;
  onPhase?: (phase: string) => void;
}): Promise<HostResult>;
