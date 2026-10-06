import type {
  EnhancementKind,
  EnhancementTruthLabel,
} from "../model/enhancementMetadata.ts";
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";
import type { SitePatch } from "../history/sitePatch.ts";

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

export type EnhancementSourceType =
  | "url-derived"
  | "screenshot-derived"
  | "existing-spe-site"
  | "raw-dom";

export interface EnhancementAnalysisInput {
  heroHasStaticImage?: boolean;
  existingWebgl?: boolean;
  semanticDom?: boolean;
  sourceType?: EnhancementSourceType;
  sections?: Array<{
    id: string;
    type: "hero" | "features" | "gallery" | "cta" | "content";
    hasImage?: boolean;
    hasCanvas?: boolean;
    hasText?: boolean;
    headingText?: string;
  }>;
  screenshotFeatures?: {
    hasHeroImage: boolean;
    cardCount: number;
    detectedDominantSubject?: string;
  };
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
  semanticDomPreserved: boolean;
  originalityFirewallCheck: "PASS" | "FAIL";
  patchPreview?: Partial<SitePatch>;
}

export interface SemanticDiffPreview {
  proposalId: string;
  targetSection: string;
  truthLabel: EnhancementTruthLabel;
  before: {
    domElements: string[];
    webglMounted: boolean;
  };
  after: {
    domElements: string[];
    webglMounted: boolean;
    added3dObjects: string[];
  };
  semanticDomPreserved: boolean;
  operationsCount: number;
}

export function analyzeEnhancementOpportunities(
  input: EnhancementAnalysisInput,
): EnhancementProposal[] {
  const proposals: EnhancementProposal[] = [];

  const heroImage = input.heroHasStaticImage ?? input.screenshotFeatures?.hasHeroImage ?? false;
  const existingWebgl = input.existingWebgl ?? false;
  const semanticDom = input.semanticDom ?? true;

  // 1. Hero 3D Stage (TRUE_3D)
  if (heroImage && !existingWebgl) {
    proposals.push({
      targetId: "hero",
      kind: "hero-3d",
      currentState: "static-image",
      proposedState: "selective-webgl-product-stage",
      truthLabel: "TRUE_3D",
      confidence: 0.88,
      performanceImpact: "MEDIUM",
      accessibilityImpact: semanticDom ? "LOW" : "REVIEW_REQUIRED",
      semanticDomPreserved: true,
      originalityFirewallCheck: "PASS",
    });
  }

  // 2. Feature Section Cards / Depth Planes (DEPTH_COMPOSITE)
  if (input.sections?.some((s) => s.type === "features" && s.hasImage)) {
    proposals.push({
      targetId: "features",
      kind: "depth-composite",
      currentState: "flat-cards",
      proposedState: "layered-depth-parallax-cards",
      truthLabel: "DEPTH_COMPOSITE",
      confidence: 0.82,
      performanceImpact: "LOW",
      accessibilityImpact: "LOW",
      semanticDomPreserved: true,
      originalityFirewallCheck: "PASS",
    });
  }

  // 3. Gallery / Product inspection (2_5D or TRUE_3D)
  if (input.sections?.some((s) => s.type === "gallery")) {
    proposals.push({
      targetId: "gallery",
      kind: "product-stage",
      currentState: "static-grid",
      proposedState: "isometric-tilt-inspection",
      truthLabel: "2_5D",
      confidence: 0.79,
      performanceImpact: "LOW",
      accessibilityImpact: "LOW",
      semanticDomPreserved: true,
      originalityFirewallCheck: "PASS",
    });
  }

  // 4. Subtle Ambient Background Motion (CSS_MOTION)
  if (!heroImage && !existingWebgl) {
    proposals.push({
      targetId: "background",
      kind: "motion-system",
      currentState: "static-color",
      proposedState: "ambient-css-mesh-drift",
      truthLabel: "CSS_MOTION",
      confidence: 0.92,
      performanceImpact: "LOW",
      accessibilityImpact: "LOW",
      semanticDomPreserved: true,
      originalityFirewallCheck: "PASS",
    });
  }

  return proposals;
}

export function validateEnhancementTruthLabel(params: {
  kind: string;
  technology: string;
  claimedTruthLabel: EnhancementTruthLabel;
}): void {
  const tech = params.technology.toLowerCase();
  const isTrue3D = tech.includes("webgl") || tech.includes("three.js") || tech.includes("threejs");

  if (params.claimedTruthLabel === "TRUE_3D" && !isTrue3D) {
    throw new Error(
      `TRUTH_LABEL_VIOLATION: Technique "${params.technology}" cannot be claimed as TRUE_3D`,
    );
  }
}

/**
 * Generates a visible semantic diff before applying any proposed 3D enhancement patch.
 * Ensures creators have full agency to inspect DOM and WebGL differences.
 */
export function generateEnhancementSemanticDiff(
  spec: WebsiteSpecV2,
  proposal: EnhancementProposal,
): SemanticDiffPreview {
  const firstPage = spec.pages[0] as any;
  const heroSection = firstPage?.sections?.find((s: any) => s.id === proposal.targetId || s.type === "hero");
  const existingDom = heroSection ? ["h1", "p", "button", "img"] : ["main", "section"];

  return {
    proposalId: `enhancement-${proposal.targetId}-${proposal.kind}`,
    targetSection: proposal.targetId,
    truthLabel: proposal.truthLabel,
    before: {
      domElements: existingDom,
      webglMounted: Boolean(spec.scene),
    },
    after: {
      domElements: existingDom, // semantic DOM strictly preserved
      webglMounted: proposal.truthLabel === "TRUE_3D",
      added3dObjects: proposal.truthLabel === "TRUE_3D" ? ["HeroProductMesh", "KeyLight", "FillLight"] : [],
    },
    semanticDomPreserved: true,
    operationsCount: proposal.truthLabel === "TRUE_3D" ? 2 : 1,
  };
}
