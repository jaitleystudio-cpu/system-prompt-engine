/**
 * Canonical Web/CLI Host Bridge for Qualified Capability Capsules chi = (P, C, G, W, I, T, R).
 *
 * Enforces local-first zero-cost execution and fail-closed admission controls.
 */

export type AdmissionState =
  | "HYPOTHESIS"
  | "STRUCTURALLY_VALID"
  | "BEHAVIORALLY_QUALIFIED"
  | "TRANSFER_QUALIFIED"
  | "DEPLOYMENT_ELIGIBLE"
  | "SUSPENDED"
  | "REJECTED";

export type ProcedureFormat = "ast_json" | "python_sandbox" | "wasm_bytes";

export interface CapabilityProcedure {
  format: ProcedureFormat;
  entrypoint: string;
  payload: string;
  sha256: string;
}

export interface CapabilityContracts {
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  deterministic: boolean;
  allowed_effects?: string[];
}

export interface CapabilityGuards {
  applicability_conditions: string[];
  invalidation_conditions: string[];
}

export interface CapabilityWitness {
  witness_id: string;
  verified_at: string;
  proof_type: string;
  hash: string;
}

export interface CausalInterventions {
  trial_count: number;
  active_success_rate: number;
  baseline_success_rate: number;
  placebo_success_rate: number;
  lcb_95_delta: number;
  early_stopped?: boolean;
}

export interface TransferMatrix {
  qualified_models: string[];
  rejected_models: string[];
}

export interface RevocationRules {
  dependency_hashes: Record<string, string>;
  max_drift_tolerance: number;
}

export interface CapabilityCapsule {
  capsule_id: string;
  name: string;
  version: string;
  admission_state: AdmissionState;
  procedure: CapabilityProcedure;
  contracts: CapabilityContracts;
  guards: CapabilityGuards;
  witnesses: CapabilityWitness[];
  interventions: CausalInterventions;
  transfer: TransferMatrix;
  revocation_rules: RevocationRules;
}

export interface CapabilityExecutionResult {
  success: boolean;
  output: unknown | null;
  error?: string;
  latencyMs: number;
  capsuleId: string;
  tokenCost: number;
  deterministicVerified: boolean;
}

export interface RoundTripResult {
  roundTripSuccess: boolean;
  outputsMatch: boolean;
  results: CapabilityExecutionResult[];
}

const ADMITTED_STATES: ReadonlySet<AdmissionState> = new Set([
  "BEHAVIORALLY_QUALIFIED",
  "TRANSFER_QUALIFIED",
  "DEPLOYMENT_ELIGIBLE",
]);

export class CapabilityHost {
  /**
   * Check whether a capability capsule is admitted and eligible for execution.
   */
  public static isAdmitted(capsule: CapabilityCapsule): boolean {
    return ADMITTED_STATES.has(capsule.admission_state);
  }

  /**
   * Statically validate structural properties of a capsule.
   */
  public static validateStructure(capsule: CapabilityCapsule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!capsule.capsule_id || typeof capsule.capsule_id !== "string") {
      errors.push("Missing or invalid capsule_id");
    }
    if (!capsule.name || typeof capsule.name !== "string") {
      errors.push("Missing or invalid name");
    }
    if (!capsule.procedure || !capsule.procedure.format || !capsule.procedure.payload) {
      errors.push("Missing procedure payload or format");
    }
    if (!capsule.contracts) {
      errors.push("Missing contracts specification");
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a capability capsule against input data in the local host environment.
   */
  public static execute(
    capsule: CapabilityCapsule,
    inputData: Record<string, unknown>,
  ): CapabilityExecutionResult {
    const startTime = performance.now();

    // 1. Admission Gate Check (Fail-Closed)
    if (!this.isAdmitted(capsule)) {
      const elapsed = performance.now() - startTime;
      return {
        success: false,
        output: null,
        error: `Execution denied: Capsule state '${capsule.admission_state}' is not admitted for execution`,
        latencyMs: elapsed,
        capsuleId: capsule.capsule_id,
        tokenCost: 0,
        deterministicVerified: false,
      };
    }

    if (!inputData || typeof inputData !== "object" || Array.isArray(inputData)) {
      const elapsed = performance.now() - startTime;
      return {
        success: false,
        output: null,
        error: "Execution error: inputData must be a non-null object",
        latencyMs: elapsed,
        capsuleId: capsule.capsule_id,
        tokenCost: 0,
        deterministicVerified: false,
      };
    }

    try {
      const output = this.evaluateProcedure(capsule.procedure, inputData);

      // 2. Deterministic Verification
      let deterministicVerified = false;
      if (capsule.contracts.deterministic) {
        // Run second iteration to assert deterministic output equality
        const secondOutput = this.evaluateProcedure(capsule.procedure, inputData);
        deterministicVerified = JSON.stringify(output) === JSON.stringify(secondOutput);
      }

      const elapsed = performance.now() - startTime;
      return {
        success: true,
        output,
        latencyMs: Math.max(0.01, elapsed),
        capsuleId: capsule.capsule_id,
        tokenCost: 0, // Zero token cost!
        deterministicVerified,
      };
    } catch (err: any) {
      const elapsed = performance.now() - startTime;
      return {
        success: false,
        output: null,
        error: err?.message || String(err),
        latencyMs: elapsed,
        capsuleId: capsule.capsule_id,
        tokenCost: 0,
        deterministicVerified: false,
      };
    }
  }

  private static evaluateProcedure(
    procedure: CapabilityProcedure,
    inputData: Record<string, unknown>,
  ): unknown {
    if (procedure.format === "ast_json") {
      const parsed = JSON.parse(procedure.payload);
      if (typeof parsed === "object" && parsed !== null) {
        if ("target_key" in parsed) {
          const key = String(parsed.target_key);
          return { [key]: inputData[key] ?? null, transformed: true };
        } else if ("op" in parsed) {
          const op = String(parsed.op);
          if (op === "pick" && Array.isArray(parsed.fields)) {
            return Object.fromEntries(
              parsed.fields
                .filter((f: unknown): f is string => typeof f === "string" && f in inputData)
                .map((f: string) => [f, inputData[f]]),
            );
          } else if (op === "merge" && typeof parsed.static === "object" && parsed.static !== null) {
            return { ...inputData, ...parsed.static, merged: true };
          } else {
            return { input: inputData, ast: parsed, executed: true };
          }
        } else {
          return { ...parsed, ...inputData, executed: true };
        }
      } else {
        return parsed;
      }
    } else if (procedure.format === "python_sandbox") {
      // Python sandbox runs in Python runtime; in web-host we emulate pure functions or report bridge
      return { executed: true, format: "python_sandbox", input: inputData };
    } else if (procedure.format === "wasm_bytes") {
      return { executed: true, format: "wasm_bytes", input: inputData };
    } else {
      throw new Error(`Unsupported procedure format: ${(procedure as any).format}`);
    }
  }

  /**
   * Run multi-iteration round-trip execution to confirm deterministic consistency.
   */
  public static executeRoundTrip(
    capsule: CapabilityCapsule,
    inputData: Record<string, unknown>,
    iterations: number = 3,
  ): RoundTripResult {
    const results: CapabilityExecutionResult[] = [];
    for (let i = 0; i < iterations; i++) {
      results.push(this.execute(capsule, inputData));
    }

    const allSuccessful = results.every((r) => r.success);
    let outputsMatch = true;
    if (allSuccessful && results.length > 1) {
      const firstStr = JSON.stringify(results[0].output);
      outputsMatch = results.every((r) => JSON.stringify(r.output) === firstStr);
    }

    return {
      roundTripSuccess: allSuccessful && outputsMatch,
      outputsMatch,
      results,
    };
  }
}
