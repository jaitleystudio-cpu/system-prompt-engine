import type {
  EnhancementKind,
  EnhancementTruthLabel,
} from "../model/enhancementMetadata.ts";

export type EnhancementTechnique =
  | "webgl-scene"
  | "depth-composite"
  | "2.5d"
  | "css-parallax";

export function classifyEnhancementTruth(
  technique: EnhancementTechnique,
): EnhancementTruthLabel {
  if (technique === "webgl-scene") return "TRUE_3D";
  if (technique === "depth-composite") return "DEPTH_COMPOSITE";
  if (technique === "2.5d") return "2_5D";
  return "CSS_MOTION";
}

export interface EnhancementAnalysisInput {
  heroHasStaticImage: boolean;
  existingWebgl: boolean;
  semanticDom: boolean;
}

export interface EnhancementProposal {
  targetId: string;
  kind: EnhancementKind;
  currentState: string;
  proposedState: string;
  truthLabel: EnhancementTruthLabel;
  confidence: number;
  performanceImpact: "LOW" | "MEDIUM" | "HIGH";
  accessibilityImpact: "LOW" | "REVIEW_REQUIRED";
}

export function analyzeEnhancementOpportunities(
  input: EnhancementAnalysisInput,
): EnhancementProposal[] {
  const proposals: EnhancementProposal[] = [];
  if (input.heroHasStaticImage && !input.existingWebgl) {
    proposals.push({
      targetId: "hero",
      kind: "hero-3d",
      currentState: "static-image",
      proposedState: "selective-webgl-product-stage",
      truthLabel: "TRUE_3D",
      confidence: 0.85,
      performanceImpact: "MEDIUM",
      accessibilityImpact: input.semanticDom ? "LOW" : "REVIEW_REQUIRED",
    });
  }
  return proposals;
}
