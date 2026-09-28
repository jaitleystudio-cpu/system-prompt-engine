/** Serializes a canonical effect plan. Technique choice stays in the engine. */
import type { CategoryId, TargetId } from "./targets";

export type RenderInput = {
  userRequest: string;
  target: TargetId | string;
  category?: CategoryId | string;
  envelopeOutput: unknown;
  techniques?: string[];
  effectPlan?: EffectPlan | null;
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

export type PromptReview = {
  goal: string;
  decisions: {
    title: string;
    source: "Your brief" | "Working default";
    detail: string;
    why: string;
  }[];
  questions: string[];
};

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function atoms(v: unknown, field: string): { id: string; text: string }[] {
  return Array.isArray(v)
    ? v.flatMap((item) => {
        const a = record(item),
          text = a[field];
        return typeof text === "string" && text.trim()
          ? [
              {
                id: String(
                  a.fact_id ??
                    a.preference_id ??
                    a.constraint_id ??
                    a.uncertainty_id ??
                    "",
                ),
                text: text.trim(),
              },
            ]
          : [];
      })
    : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export class PromptBriefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptBriefError";
  }
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function readBrief(input: RenderInput) {
  const output = record(input.envelopeOutput);
  if (!Array.isArray(output.facts))
    throw new Error(
      "A returned engine envelope is required to render a prompt.",
    );
  const facts = atoms(output.facts, "statement");
  const requestedGoal = input.userRequest.trim();
  const goalAtom =
    facts.find((a) => a.id === "f-user-request") ??
    facts.find((a) => a.text === requestedGoal);
  if (!goalAtom || goalAtom.text !== requestedGoal)
    throw new Error(
      "The returned engine request does not match the current brief. Please compile again.",
    );
  const goal = goalAtom.text;
  const contextFacts = facts.filter((a) => a !== goalAtom && a.text !== goal);
  const constraints = atoms(output.hard_constraints, "statement").filter(
    (a) => a.text !== goal,
  );
  const conflicts = constraints.filter((a) => a.text.startsWith("[CONFLICT]"));
  if (conflicts.length) {
    throw new PromptBriefError(
      "Resolve the marked conflict before building a prompt: " +
        conflicts
          .map((a) => a.text.slice("[CONFLICT]".length).trim())
          .join("; "),
    );
  }
  const prefs = atoms(output.user_preferences, "statement");
  const unknowns = atoms(output.uncertainties, "description");
  const brief = (id: string) =>
    prefs
      .filter((a) => a.id === id)
      .map((a) => a.text)
      .join("\n") || undefined;
  const audience = brief("brief-audience");
  const desiredOutput = constraints.find((a) => a.id === "desired-output")?.text;
  const desiredExample = brief("desired-example");
  const suppliedRole = brief("brief-role");
  const category = String(input.category ?? "unspecified");
  return {
    goal,
    contextFacts,
    constraints,
    prefs,
    unknowns,
    brief,
    audience,
    desiredOutput,
    desiredExample,
    suppliedRole,
    category,
  };
}

function refuseUnauthorized(notes: string[]): never {
  throw new PromptBriefError(
    "The engine did not authorize a compiled prompt for this brief." +
      (notes.length ? " " + notes.join(", ") : ""),
  );
}

export function renderPromptArtifact(input: RenderInput) {
  const effectPlan = input.effectPlan;
  if (!effectPlan || typeof effectPlan !== "object" || Array.isArray(effectPlan)) {
    refuseUnauthorized([]);
  }
  const brief = readBrief(input);
  const notes = stringList(effectPlan.notes);
  if (
    effectPlan.renderable !== true ||
    effectPlan.disposition !== "BOUND" ||
    typeof effectPlan.compiled_prompt !== "string" ||
    !effectPlan.compiled_prompt.includes(brief.goal)
  ) {
    refuseUnauthorized(notes);
  }
  const planGoal = effectPlan.protected_fields?.goal;
  if (typeof planGoal === "string" && planGoal !== brief.goal) {
    throw new PromptBriefError(
      "The engine prompt does not preserve the current goal.",
    );
  }
  for (const constraint of brief.constraints) {
    if (!effectPlan.compiled_prompt.includes(constraint.text)) {
      throw new PromptBriefError(
        "The engine prompt dropped a hard constraint.",
      );
    }
  }
  const techniques = stringList(effectPlan.techniques);
  const passed = input.techniques ?? [];
  if (passed.length && !sameIds(passed, techniques)) {
    throw new PromptBriefError(
      "The renderer received a technique list that does not match the engine.",
    );
  }
  const operations = stringList(effectPlan.operations);
  return {
    userRequest: brief.goal,
    speAdded: [
      `Category presentation: ${brief.category}`,
      ...operations.map((code) => `Authorized effect: ${code}`),
      ...brief.contextFacts.map((a) => `Supplied fact: ${a.text}`),
      ...brief.constraints.map((a) => `Requirement: ${a.text}`),
    ],
    finalPrompt: effectPlan.compiled_prompt,
    review: {
      goal: brief.goal,
      decisions: operations.map((code) => ({
        title: code,
        source: code === "DIRECT" ? ("Working default" as const) : ("Your brief" as const),
        detail: code,
        why: "This section is present because the engine authorized this effect.",
      })),
      questions: brief.unknowns.map((a) => a.text),
    } as PromptReview | null,
    techniques,
  };
}

/**
 * Envelope preview for tests and offline inspection.
 * Not a compiled prompt. Create and Home must not call this.
 */
export function renderNonProductionEnvelopePreview(input: RenderInput) {
  const brief = readBrief(input);
  const other = brief.prefs.filter(
    (a) =>
      !["brief-role", "brief-audience", "brief-format", "desired-example"].includes(
        a.id,
      ),
  );
  const requirements = brief.constraints.filter((a) => a.id !== "desired-output");
  const sections = [
    `## Category presentation\n${brief.category}`,
    ...(brief.suppliedRole ? [`## Role\n${brief.suppliedRole}`] : []),
    "## Objective\n" + brief.goal,
    ...(brief.audience ? ["## Audience\n" + brief.audience] : []),
    ...(brief.contextFacts.length
      ? ["## Supplied facts\n" + brief.contextFacts.map((a) => `- ${a.text}`).join("\n")]
      : []),
    ...(other.length
      ? ["## Context and preferences\n" + other.map((a) => `- ${a.text}`).join("\n")]
      : []),
    ...(requirements.length
      ? ["## Requirements\n" + requirements.map((a) => `- ${a.text}`).join("\n")]
      : []),
    ...(brief.desiredOutput ? ["## Deliverable\n" + brief.desiredOutput] : []),
    ...(brief.desiredExample
      ? ["## User-supplied example (non-authoritative)\n" + brief.desiredExample]
      : []),
    ...(brief.desiredOutput
      ? [
          "## Acceptance checks\n- The result satisfies this user-supplied outcome: " +
            brief.desiredOutput,
        ]
      : []),
    ...(brief.unknowns.length
      ? ["## Questions to resolve\n" + brief.unknowns.map((a) => `- ${a.text}`).join("\n")]
      : []),
  ];
  return {
    userRequest: brief.goal,
    speAdded: [
      `Category presentation: ${brief.category}`,
      ...brief.contextFacts.map((a) => `Supplied fact: ${a.text}`),
      ...brief.constraints.map((a) => `Requirement: ${a.text}`),
      ...brief.prefs.map((a) => `Supplied detail: ${a.text}`),
      ...brief.unknowns.map((a) => `Open question: ${a.text}`),
      `Target: ${input.target} (portable plain text)`,
    ],
    finalPrompt: sections.join("\n\n"),
    review: {
      goal: brief.goal,
      decisions: [
        ...(brief.suppliedRole
          ? [
              {
                title: "Role",
                source: "Your brief" as const,
                detail: brief.suppliedRole,
                why: "Uses the role supplied in the brief.",
              },
            ]
          : []),
        ...brief.constraints.map((constraint, index) => ({
          title:
            constraint.id === "desired-output"
              ? "Desired output"
              : `Boundary ${index + 1}`,
          source: "Your brief" as const,
          detail: constraint.text,
          why: "Keeps a supplied requirement visible.",
        })),
      ],
      questions: brief.unknowns.map((a) => a.text),
    } as PromptReview | null,
    techniques: input.techniques ?? [],
  };
}
