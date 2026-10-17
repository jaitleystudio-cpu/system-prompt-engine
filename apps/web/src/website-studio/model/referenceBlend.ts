export interface ReferenceBlendSource {
  referenceId: string;
  weight: number;
  dimensions: ("typography" | "layout" | "color" | "motion" | "scene" | "camera" | "navigation")[];
}

export interface ReferenceBlendSpec {
  sources: ReferenceBlendSource[];
}

export function validateReferenceBlend(spec: ReferenceBlendSpec): void {
  if (!Array.isArray(spec.sources) || spec.sources.length === 0) throw new Error("reference blend needs sources");
  const sum = spec.sources.reduce((total, source) => total + source.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) throw new Error("reference blend weights must sum to 1");
  if (spec.sources.some((source) => source.weight < 0 || source.weight > 1)) throw new Error("reference weights must be normalized");
}
