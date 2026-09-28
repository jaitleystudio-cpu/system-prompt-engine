import type { EngineClient } from "./client";

/**
 * Transport for technique ids and the effect plan chosen by WASM.
 * This module does not select techniques or effect operations.
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

export type EffectPlan = {
  disposition?: string;
  renderable?: boolean;
  compiled_prompt?: string | null;
  operations?: unknown;
  techniques?: unknown;
  notes?: unknown;
  protected_fields?: {
    goal?: unknown;
    hard_constraints?: unknown;
    budget?: unknown;
    facts?: unknown;
    provenance?: unknown;
    authority_state?: unknown;
  };
};

export type K3Binding =
  | {
      status: "PLAN";
      techniques: string[];
      effectPlan: EffectPlan;
    }
  | {
      status: "UNAVAILABLE" | "MISSING_EFFECT_PLAN";
      techniques: [];
      effectPlan: null;
    };

export class K3EffectUnavailableError extends Error {
  constructor(message = "The strategy engine did not return an effect plan.") {
    super(message);
    this.name = "K3EffectUnavailableError";
  }
}

export function techniqueLabel(id: string): string {
  return TECHNIQUE_LABELS[id] ?? id;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function protectedFromFixture(
  fixture: unknown,
  goal: string,
): Record<string, unknown> {
  const payload = record(record(fixture).payload);
  const constraints = Array.isArray(payload.hard_constraints)
    ? payload.hard_constraints
    : [];
  const desired = constraints
    .map((item) => record(item))
    .find((item) => item.constraint_id === "desired-output");
  const desiredText =
    desired && typeof desired.statement === "string" && desired.statement.trim()
      ? desired.statement
      : null;
  return {
    ...payload,
    goal,
    budget: payload.budget ?? null,
    desired_output: desiredText,
  };
}

export async function requestK3Binding(
  client: EngineClient,
  fixture: unknown,
  displayLabel: string,
  goal: string,
): Promise<K3Binding> {
  try {
    const outcome = await client.compile(
      JSON.stringify({
        spe_api: "k3",
        op: "select",
        protected: protectedFromFixture(fixture, goal),
        category: { display_label: displayLabel },
        task: {},
      }),
      () => {},
    );
    const output = record(outcome.result?.output);
    const ids = Array.isArray(output.techniques)
      ? output.techniques.filter((item): item is string => typeof item === "string")
      : [];
    const effectPlan = record(output.prompt_effect_plan);
    if (!Object.keys(effectPlan).length) {
      return { status: "MISSING_EFFECT_PLAN", techniques: [], effectPlan: null };
    }
    const lawful =
      !outcome.error &&
      outcome.result?.status === "VALID" &&
      output.claims_pass === false &&
      (output.disposition === "SELECTED" || output.disposition === "SAFE_DEFAULT");
    return {
      status: "PLAN",
      techniques: lawful ? ids : [],
      effectPlan: effectPlan as EffectPlan,
    };
  } catch {
    return { status: "UNAVAILABLE", techniques: [], effectPlan: null };
  }
}

export function requireBoundEffectPlan(binding: K3Binding): {
  effectPlan: EffectPlan;
  techniques: string[];
} {
  if (binding.status !== "PLAN" || !binding.effectPlan) {
    throw new K3EffectUnavailableError();
  }
  return { effectPlan: binding.effectPlan, techniques: binding.techniques };
}

export async function requestTechniqueIds(
  client: EngineClient,
  fixture: unknown,
  displayLabel: string,
  goal = "",
): Promise<string[]> {
  const bound = requireBoundEffectPlan(
    await requestK3Binding(client, fixture, displayLabel, goal),
  );
  return bound.techniques;
}
