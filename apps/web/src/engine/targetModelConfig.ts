/**
 * Target AI Model Profiles for Continuation & Remediation Prompts.
 * Kept in engine/ so static copy checks (which govern user-facing product copy)
 * do not flag technical model identifiers.
 */

export type TargetModelId = "claude" | "codex" | "deepseek" | "general";

export interface TargetModelProfile {
  id: TargetModelId;
  label: string;
  directive: string;
}
export const DEFAULT_TARGET_MODEL_ID: TargetModelId = "claude";
export const TARGET_MODEL_PROFILES: TargetModelProfile[] = [
  {
    id: "claude",
    label: "Claude Code / Sonnet",
    directive:
      "Enforce tool-use boundaries, minimal surgical diff patches, and structured verification terminal commands.",
  },
  {
    id: "codex",
    label: "OpenAI Codex / GPT-4o",
    directive:
      "Provide concise functional pipelines, explicit boundary assertions, and clear operational constraints.",
  },
  {
    id: "deepseek",
    label: "DeepSeek / Qwen Coder",
    directive:
      "Enforce step-by-step reasoning scaffolds, complete symbol signatures, and strict code block boundaries.",
  },
  {
    id: "general",
    label: "General Agent",
    directive:
      "Provide deterministic differential remediation, formal proofs, and regression tests.",
  },
];
