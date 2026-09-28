import type { EngineClient } from "./client";

/**
 * Transport and display for technique ids chosen by WASM.
 * This module does not select techniques.
 */
const TECHNIQUE_LABELS: Record<string, string> = {
  ZERO_SHOT: "Direct instruction",
  FEW_SHOT: "Examples",
  ROLE_PERSONA: "Role",
  CONTEXTUAL: "Use supplied context",
  STEP_BACK: "Principles first",
  DECOMPOSE_PLAN_SOLVE: "Break into steps",
  RETRIEVE_REASON: "Use supplied evidence",
  CRITIQUE_REVISE: "Revise once",
  STRUCTURED_OUTPUT: "Structured output",
};

export function techniqueLabel(id: string): string {
  return TECHNIQUE_LABELS[id] ?? id;
}

export async function requestTechniqueIds(
  client: EngineClient,
  protectedPayload: unknown,
  displayLabel: string,
): Promise<string[]> {
  try {
    const outcome = await client.compile(
      JSON.stringify({
        spe_api: "k3",
        op: "select",
        protected: protectedPayload,
        category: { display_label: displayLabel },
        task: {},
      }),
      () => {},
    );
    const output = outcome.result?.output as
      | {
          techniques?: unknown;
          disposition?: unknown;
          claims_pass?: unknown;
        }
      | undefined;
    const ids = Array.isArray(output?.techniques)
      ? output.techniques.filter((item): item is string => typeof item === "string")
      : [];
    if (
      !outcome.error &&
      outcome.result?.status === "VALID" &&
      output?.claims_pass === false &&
      (output.disposition === "SELECTED" || output.disposition === "SAFE_DEFAULT")
    ) {
      return ids;
    }
  } catch {
    return [];
  }
  return [];
}
