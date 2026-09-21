/** Presentation only: reads the real WASM-returned envelope, never infers meaning. */
export type SemanticGroup = { label: string; key: string; items: string[] };
export function semanticGroups(output: unknown): SemanticGroup[] {
  const o =
    output && typeof output === "object"
      ? (output as Record<string, unknown>)
      : {};
  return [
    ["Facts", "facts", "statement"],
    ["Constraints", "hard_constraints", "statement"],
    ["Preferences", "user_preferences", "statement"],
    ["Unknowns", "uncertainties", "description"],
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
