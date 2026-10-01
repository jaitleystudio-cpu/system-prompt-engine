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
      rawOutput: unknown;
    }
  | {
      status: "UNAVAILABLE" | "MISSING_EFFECT_PLAN";
      techniques: [];
      effectPlan: null;
      rawOutput: null;
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

export interface CategoryMeta {
  displayLabel: string;
  xcatId: string;
  domainId: string;
  defaultRole: string;
}

export const CATEGORY_MAP: Record<string, CategoryMeta> = {
  Coding: {
    displayLabel: "Coding",
    xcatId: "CAT:C09",
    domainId: "coding",
    defaultRole: "Principal Software Architect & Systems Engineer",
  },
  Research: {
    displayLabel: "Research",
    xcatId: "CAT:C02",
    domainId: "research",
    defaultRole: "Rigorous Research Scientist & Evidence Analyst",
  },
  Writing: {
    displayLabel: "Writing",
    xcatId: "CAT:C03",
    domainId: "writing_communication",
    defaultRole: "Expert Technical Writer & Communications Strategist",
  },
  Business: {
    displayLabel: "Business",
    xcatId: "CAT:C08",
    domainId: "business_strategy",
    defaultRole: "Strategic Business Analyst & Operations Architect",
  },
  Education: {
    displayLabel: "Education",
    xcatId: "CAT:C05",
    domainId: "education",
    defaultRole: "Subject-Matter Educator & Curriculum Designer",
  },
  Analysis: {
    displayLabel: "Analysis",
    xcatId: "CAT:C06",
    domainId: "data_statistics",
    defaultRole: "Lead Quantitative Analyst & Data Scientist",
  },
  "Structured Data": {
    displayLabel: "Structured Data",
    xcatId: "CAT:C06",
    domainId: "data_statistics",
    defaultRole: "Data Systems Architect & Schema Specialist",
  },
  Creative: {
    displayLabel: "Creative",
    xcatId: "CAT:C12",
    domainId: "creative_media",
    defaultRole: "Creative Director & Conceptual Writer",
  },
  Multilingual: {
    displayLabel: "Multilingual",
    xcatId: "CAT:C04",
    domainId: "translation_localization",
    defaultRole: "Master Translator & Localization Specialist",
  },
  "Website / 3D": {
    displayLabel: "Website / 3D",
    xcatId: "CAT:C09",
    domainId: "ux_ui_web_design",
    defaultRole: "Principal Frontend Architect & 3D WebGL Specialist",
  },
  Image: {
    displayLabel: "Image",
    xcatId: "CAT:C10",
    domainId: "image_generation",
    defaultRole: "Art Director & Visual Generation Specialist",
  },
  Video: {
    displayLabel: "Video",
    xcatId: "CAT:C10",
    domainId: "video_generation",
    defaultRole: "Director of Cinematography & Video Producer",
  },
};

export function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();
  if (
    /code|rust|python|typescript|react|sql|function|api|orchestrator|bug|compile|database|sqlite|wasm|backend|frontend|crate|build|saga/.test(
      lower,
    )
  ) {
    return "Coding";
  }
  if (/research|study|paper|literature|citation|evidence|academic|science|comparative/.test(lower)) {
    return "Research";
  }
  if (/data|csv|statistic|distribution|variance|dataset|metric|regression|analytics/.test(lower)) {
    return "Analysis";
  }
  if (/business|market|startup|revenue|pricing|roadmap|product|customer|sales|budget/.test(lower)) {
    return "Business";
  }
  if (/teach|student|course|learn|lesson|exam|tutor|syllabus/.test(lower)) {
    return "Education";
  }
  if (/translate|language|spanish|french|german|telugu|hindi|tamil|japanese|localization/.test(lower)) {
    return "Multilingual";
  }
  if (/story|plot|fiction|poem|novel|character|screenplay|dialogue/.test(lower)) {
    return "Creative";
  }
  if (/3d|threejs|webgl|canvas|shader|viewport|css|responsive/.test(lower)) {
    return "Website / 3D";
  }
  if (/image|photo|illustration|render|lighting|visual prompt|camera/.test(lower)) {
    return "Image";
  }
  if (/video|footage|shot|cinematic|scene|b-roll|timeline|storyboard/.test(lower)) {
    return "Video";
  }
  return "Writing";
}

export function resolveCategoryMetadata(displayLabel: string, goal: string): CategoryMeta {
  let label = displayLabel;
  if (!label || label === "AI Assistant") {
    label = detectCategoryFromText(goal);
  }
  return CATEGORY_MAP[label] || CATEGORY_MAP["Writing"];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function protectedFromFixture(
  fixture: unknown,
  goal: string,
  xcatId: string,
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
    category: xcatId,
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
    const meta = resolveCategoryMetadata(displayLabel, goal);
    const prot = protectedFromFixture(fixture, goal, meta.xcatId);
    const words = goal.trim().split(/\s+/).length;

    const taskPayload = {
      role_label: meta.defaultRole,
      needs_structured_output: Boolean(prot.desired_output),
      needs_decomposition: words > 8 || meta.domainId === "coding" || meta.domainId === "research",
      has_context: Array.isArray(prot.facts) && prot.facts.length > 0,
      complexity_class: words > 15 ? "COMPLEX" : "STANDARD",
    };

    const outcome = await client.compile(
      JSON.stringify({
        spe_api: "k3",
        op: "select",
        protected: prot,
        category: {
          display_label: meta.displayLabel,
          xcat_id: meta.xcatId,
          protocol_domain_id: meta.domainId,
        },
        task: taskPayload,
      }),
      () => {},
    );
    const output = record(outcome.result?.output);
    const ids = Array.isArray(output.techniques)
      ? output.techniques.filter((item): item is string => typeof item === "string")
      : [];
    const effectPlan = record(output.prompt_effect_plan);
    if (!Object.keys(effectPlan).length) {
      return { status: "MISSING_EFFECT_PLAN", techniques: [], effectPlan: null, rawOutput: null };
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
      rawOutput: outcome.result?.output ?? null,
    };
  } catch {
    return { status: "UNAVAILABLE", techniques: [], effectPlan: null, rawOutput: null };
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
