/** Presentation only: reads the real WASM-returned envelope, never infers meaning. */
export type SemanticGroup = { label: string; key: string; items: string[] };
export function semanticGroups(output: unknown): SemanticGroup[] {
  const o =
    output && typeof output === "object"
      ? (output as Record<string, unknown>)
      : {};
  return [
    ["What you supplied", "facts", "statement"],
    ["What must stay true", "hard_constraints", "statement"],
    ["Your preferences", "user_preferences", "statement"],
    ["Questions still open", "uncertainties", "description"],
  ].map(([label, key, field]) => ({
    label,
    key,
    items: Array.isArray(o[key])
      ? (o[key] as unknown[]).flatMap((v) => {
          if (!v || typeof v !== "object") return [];
          const s = (v as Record<string, unknown>)[field];
          return typeof s === "string" ? [s] : [];
        })
      : [],
  }));
}
