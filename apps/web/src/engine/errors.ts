/** Typed client errors. WASM failure never becomes a silent TypeScript fallback. No fallback. */

export const ENGINE_UNAVAILABLE = "ENGINE_UNAVAILABLE" as const;
export const WASM_INTEGRITY_MISMATCH = "WASM_INTEGRITY_MISMATCH" as const;
export const WASM_HOST_IMPORTS_FORBIDDEN = "WASM_HOST_IMPORTS_FORBIDDEN" as const;
export const WASM_EXPORTS_MISSING = "WASM_EXPORTS_MISSING" as const;
export const INVALID_JSON = "INVALID_JSON" as const;
export const WORKER_TIMEOUT = "WORKER_TIMEOUT" as const;

export type SpeClientErrorCode =
  | typeof ENGINE_UNAVAILABLE
  | typeof WASM_INTEGRITY_MISMATCH
  | typeof WASM_HOST_IMPORTS_FORBIDDEN
  | typeof WASM_EXPORTS_MISSING
  | typeof INVALID_JSON
  | typeof WORKER_TIMEOUT;

export class SpeClientError extends Error {
  readonly code: SpeClientErrorCode;
  constructor(code: SpeClientErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "SpeClientError";
  }
}
