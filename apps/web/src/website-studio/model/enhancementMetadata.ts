export type EnhancementKind =
  | "hero-3d"
  | "depth-composite"
  | "scroll-camera"
  | "product-stage"
  | "interactive-hotspots"
  | "motion-system"
  | "transition-system";

export type EnhancementTruthLabel = "TRUE_3D" | "DEPTH_COMPOSITE" | "2_5D" | "CSS_MOTION";

export interface EnhancementMetadata {
  targetId: string;
  kind: EnhancementKind;
  truthLabel: EnhancementTruthLabel;
}

const KINDS = new Set<EnhancementKind>([
  "hero-3d",
  "depth-composite",
  "scroll-camera",
  "product-stage",
  "interactive-hotspots",
  "motion-system",
  "transition-system",
]);

export function validateEnhancementMetadata(value: EnhancementMetadata): void {
  if (!value?.targetId || !KINDS.has(value.kind)) throw new Error("unknown enhancement kind");
  if (!["TRUE_3D", "DEPTH_COMPOSITE", "2_5D", "CSS_MOTION"].includes(value.truthLabel)) {
    throw new Error("unknown enhancement truth label");
  }
}
