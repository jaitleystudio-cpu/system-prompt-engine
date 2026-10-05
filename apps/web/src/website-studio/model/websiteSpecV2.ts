import { createDefaultAgentPolicy, validateAgentPolicy, type AgentPolicy } from "./agentPolicy.ts";
import { createEmptyBehaviorGraph, validateBehaviorGraph, type BehaviorGraph } from "./behaviorGraph.ts";
import { validateCameraPlan, type CameraPlan } from "./cameraPlan.ts";
import { validateDataBinding, type DataBinding } from "./dataBinding.ts";
import { createDefaultDesignDNA, type DesignDNA } from "./designDNA.ts";
import { validateEnhancementMetadata, type EnhancementMetadata } from "./enhancementMetadata.ts";
import { validateMotionBlock, type NarrativeMotionBlock } from "./motionBlock.ts";
import type { MotionSpec } from "./timeline.ts";
import type { ProvenanceGraph } from "./provenance.ts";
import type { SceneIR } from "./sceneIR.ts";

export interface SiteMetadata {
  title: string;
  language: string;
}

export interface PageSpec {
  id: string;
  path: string;
  title: string;
}

export interface ResponsiveSpec {
  desktop: { enabled: true };
  tablet: { enabled: true };
  mobile: { enabled: true };
}

export interface AccessibilitySpec {
  keyboard: boolean;
  reducedMotion: boolean;
  semanticDom: boolean;
}

export interface PerformanceBudget {
  tier: "A" | "B" | "C";
}

export interface AssetManifest {
  items: { id: string; sha256?: string }[];
}

export interface WebsiteSpecV2 {
  spec_version: "website-spec/2";
  metadata: SiteMetadata;
  designDNA: DesignDNA;
  pages: PageSpec[];
  scene?: SceneIR;
  behaviorGraph: BehaviorGraph;
  motion: MotionSpec;
  motionBlocks: NarrativeMotionBlock[];
  cameraPlan?: CameraPlan;
  dataBindings: DataBinding[];
  responsive: ResponsiveSpec;
  accessibility: AccessibilitySpec;
  performanceBudget: PerformanceBudget;
  enhancement?: EnhancementMetadata;
  agentPolicy: AgentPolicy;
  assets: AssetManifest;
  provenance: ProvenanceGraph;
}

export class WebsiteSpecV2ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebsiteSpecV2ValidationError";
  }
}

function wrapValidation(label: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WebsiteSpecV2ValidationError(label + ": " + message);
  }
}

export function createDefaultWebsiteSpecV2(): WebsiteSpecV2 {
  return {
    spec_version: "website-spec/2",
    metadata: { title: "Untitled SPE Website", language: "en" },
    designDNA: createDefaultDesignDNA(),
    pages: [{ id: "home", path: "index.html", title: "Home" }],
    behaviorGraph: createEmptyBehaviorGraph(),
    motion: { tracks: [] },
    motionBlocks: [],
    dataBindings: [],
    responsive: {
      desktop: { enabled: true },
      tablet: { enabled: true },
      mobile: { enabled: true },
    },
    accessibility: {
      keyboard: true,
      reducedMotion: true,
      semanticDom: true,
    },
    performanceBudget: { tier: "B" },
    agentPolicy: createDefaultAgentPolicy(),
    assets: { items: [] },
    provenance: { entries: [] },
  };
}

export function validateWebsiteSpecV2(spec: WebsiteSpecV2): WebsiteSpecV2 {
  if (!spec || spec.spec_version !== "website-spec/2") {
    throw new WebsiteSpecV2ValidationError("spec_version must be website-spec/2");
  }
  if (!spec.metadata?.title || !Array.isArray(spec.pages) || spec.pages.length === 0) {
    throw new WebsiteSpecV2ValidationError("metadata title and at least one page are required");
  }

  wrapValidation("behaviorGraph", () => validateBehaviorGraph(spec.behaviorGraph));

  if (!Array.isArray(spec.motionBlocks)) throw new WebsiteSpecV2ValidationError("motionBlocks must be an array");
  for (const block of spec.motionBlocks) wrapValidation("motionBlock", () => validateMotionBlock(block));

  if (spec.cameraPlan) wrapValidation("cameraPlan", () => validateCameraPlan(spec.cameraPlan));

  if (!Array.isArray(spec.dataBindings)) throw new WebsiteSpecV2ValidationError("dataBindings must be an array");
  for (const binding of spec.dataBindings) wrapValidation("dataBinding", () => validateDataBinding(binding));

  if (spec.enhancement) wrapValidation("enhancement", () => validateEnhancementMetadata(spec.enhancement));

  wrapValidation("agentPolicy", () => validateAgentPolicy(spec.agentPolicy));

  return spec;
}
