/**
 * Deterministic structured request encoding for the SPE ABI path.
 *
 * Callers supply the user request string as the goal atom.
 * This does NOT claim NLP understanding of free text.
 * Semantic evaluation happens only inside spe_wasm.wasm → spe-core-rs.
 */

import type { CategoryId, TargetId } from "./targets";

export type IntentAtom = {
  id: string;
  kind: "confirmed" | "assumed" | "unknown" | "conflict";
  label: string;
  text: string;
};

export type BuildEnvelopeInput = {
  userRequest: string;
  category: CategoryId | string;
  target: TargetId | string;
  confirmed?: IntentAtom[];
  assumed?: IntentAtom[];
  unknowns?: IntentAtom[];
  conflicts?: IntentAtom[];
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "request";
}

export function buildAbiFixture(input: BuildEnvelopeInput): Record<string, unknown> {
  const goal = input.userRequest.trim();
  if (!goal) {
    throw new Error("user request required");
  }
  const id = `web-${slug(goal)}-${Date.now().toString(36)}`;
  const hard = (input.confirmed ?? []).map((a, i) => ({
    constraint_id: a.id || `c-${i + 1}`,
    statement: a.text,
    strength: "HARD",
  }));
  const prefs = (input.assumed ?? []).map((a, i) => ({
    preference_id: a.id || `pref-${i + 1}`,
    statement: a.text,
  }));
  const uncertainties = (input.unknowns ?? []).map((a, i) => ({
    uncertainty_id: a.id || `u-${i + 1}`,
    description: a.text,
  }));
  // Conflicts are surfaced in UI; envelope carries them as hard constraints tagged in statement.
  for (const c of input.conflicts ?? []) {
    hard.push({
      constraint_id: c.id || `conflict-${hard.length + 1}`,
      statement: `[CONFLICT] ${c.text}`,
      strength: "HARD",
    });
  }

  return {
    capabilities_required: ["CORE_CONTRACT", "XCAT_HANDOFF", "PROVENANCE"],
    expect: "PASS",
    id: id.toUpperCase(),
    kind: "positive",
    network_mode: "NONE",
    payload: {
      analysis: null,
      authority_state: { grants: [], level: 0, status: "NONE" },
      category_trace: [
        {
          category: String(input.category),
          note: "UI category route — rendering hint only",
        },
      ],
      envelope_id: id,
      execution_grants: [],
      facts: [
        {
          fact_id: "f-user-request",
          provenance_ids: ["p-user"],
          statement: goal,
        },
      ],
      failures: [],
      goal_identity: `goal-${slug(goal)}`,
      hard_constraints: hard.length
        ? hard
        : [
            {
              constraint_id: "c-preserve-intent",
              statement: "Preserve the user's stated goal without inventing obligations",
              strength: "HARD",
            },
          ],
      provenance: [{ provenance_id: "p-user", source: "web-ui-user-request" }],
      recommendation: null,
      rendering: {
        target: String(input.target),
        mode: "prompt_artifact_v1",
      },
      sensitivity_labels: ["USER_PRIVATE"],
      taint_labels: [],
      uncertainties: uncertainties.length
        ? uncertainties
        : [
            {
              uncertainty_id: "u-audience",
              description: "Audience / success criteria not fully specified",
            },
          ],
      user_preferences: prefs.length
        ? prefs
        : [
            {
              preference_id: "pref-clarity",
              statement: "Prefer clear, executable instructions",
            },
          ],
    },
    privacy: {
      authority: "NONE",
      sensitivity: "USER_PRIVATE",
      trust: "TRUSTED",
    },
  };
}

export function defaultIntentLens(userRequest: string): {
  confirmed: IntentAtom[];
  assumed: IntentAtom[];
  unknowns: IntentAtom[];
  conflicts: IntentAtom[];
} {
  const goal = userRequest.trim();
  return {
    confirmed: [
      {
        id: "confirmed-goal",
        kind: "confirmed",
        label: "Goal",
        text: goal || "(empty)",
      },
    ],
    assumed: [
      {
        id: "assumed-clarity",
        kind: "assumed",
        label: "Clarity",
        text: "Prefer clear, executable instructions for the selected target AI",
      },
    ],
    unknowns: [
      {
        id: "unknown-audience",
        kind: "unknown",
        label: "Audience",
        text: "Who is the primary audience?",
      },
      {
        id: "unknown-success",
        kind: "unknown",
        label: "Success",
        text: "What does a good result look like?",
      },
    ],
    conflicts: [],
  };
}
