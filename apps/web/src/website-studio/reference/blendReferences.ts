import {
  validateReferenceBlend,
  type ReferenceBlendSpec,
} from "../model/referenceBlend.ts";

export interface ReferenceBlendResult {
  totalWeight: number;
  dimensionOwners: Record<string, string>;
}

export function blendReferences(spec: ReferenceBlendSpec): ReferenceBlendResult {
  validateReferenceBlend(spec);
  const owners: Record<string, { id: string; weight: number }> = {};
  for (const source of spec.sources) {
    for (const dimension of source.dimensions) {
      const existing = owners[dimension];
      if (!existing || source.weight > existing.weight) {
        owners[dimension] = { id: source.referenceId, weight: source.weight };
      } else if (
        existing.weight === source.weight &&
        existing.id !== source.referenceId
      ) {
        throw new Error("REFERENCE_BLEND_DIMENSION_CONFLICT");
      }
    }
  }
  return {
    totalWeight: spec.sources.reduce((sum, source) => sum + source.weight, 0),
    dimensionOwners: Object.fromEntries(
      Object.entries(owners).map(([dimension, owner]) => [dimension, owner.id]),
    ),
  };
}
