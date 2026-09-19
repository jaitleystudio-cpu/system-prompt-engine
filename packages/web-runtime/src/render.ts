/**
 * Target adapter rendering — changes presentation only, not protected intent.
 * Uses WASM-validated envelope output when available.
 */

import type { TargetId } from "./targets";

export type RenderInput = {
  userRequest: string;
  target: TargetId | string;
  envelopeOutput: unknown;
  techniques?: string[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function extractConstraints(output: unknown): string[] {
  const o = asRecord(output);
  if (!o) return [];
  const hard = o.hard_constraints;
  if (!Array.isArray(hard)) return [];
  return hard
    .map((c) => asRecord(c)?.statement)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

function extractUncertainties(output: unknown): string[] {
  const o = asRecord(output);
  if (!o) return [];
  const u = o.uncertainties;
  if (!Array.isArray(u)) return [];
  return u
    .map((x) => asRecord(x)?.description)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

function extractPrefs(output: unknown): string[] {
  const o = asRecord(output);
  if (!o) return [];
  const p = o.user_preferences;
  if (!Array.isArray(p)) return [];
  return p
    .map((x) => asRecord(x)?.statement)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
}

const TARGET_PREAMBLE: Record<string, string> = {
  any: "You are a capable assistant.",
  chatgpt: "You are ChatGPT. Follow the instructions carefully.",
  claude: "You are Claude. Be precise and careful with constraints.",
  gemini: "You are Gemini. Produce a clear, structured response.",
  copilot: "You are GitHub Copilot Chat. Prefer actionable steps.",
  local: "You are a local model. Stay within the provided constraints.",
  custom: "You are the selected custom model.",
};

export function renderPromptArtifact(input: RenderInput): {
  userRequest: string;
  speAdded: string[];
  finalPrompt: string;
  techniques: string[];
} {
  const constraints = extractConstraints(input.envelopeOutput);
  const unknowns = extractUncertainties(input.envelopeOutput);
  const prefs = extractPrefs(input.envelopeOutput);
  const techniques =
    input.techniques ??
    [
      "Goal locking",
      "Constraint elevation",
      "Unknown surfacing",
      "Target-aware phrasing",
    ];

  const speAdded = [
    ...constraints.map((c) => `MUST: ${c}`),
    ...prefs.map((p) => `PREFER: ${p}`),
    ...unknowns.map((u) => `UNKNOWN: ${u}`),
    `TARGET: ${input.target}`,
  ];

  const preamble =
    TARGET_PREAMBLE[String(input.target)] ?? TARGET_PREAMBLE.any;

  const finalPrompt = [
    preamble,
    "",
    "## User request",
    input.userRequest.trim(),
    "",
    "## Protected constraints",
    ...(constraints.length ? constraints.map((c) => `- ${c}`) : ["- (none beyond the user request)"]),
    "",
    "## Preferences",
    ...(prefs.length ? prefs.map((p) => `- ${p}`) : ["- (none)"]),
    "",
    "## Open unknowns (ask if needed)",
    ...(unknowns.length ? unknowns.map((u) => `- ${u}`) : ["- (none)"]),
    "",
    "## Techniques",
    ...techniques.map((t) => `- ${t}`),
    "",
    "Produce the best response that satisfies the constraints without inventing unstated obligations.",
  ].join("\n");

  return {
    userRequest: input.userRequest.trim(),
    speAdded,
    finalPrompt,
    techniques,
  };
}
