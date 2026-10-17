/**
 * SPE Universal Prompt Arsenal — Core Schema & Domain Taxonomy
 * Standardized schema for 10,000+ task-specific prompt assets.
 */

export type ArsenalDomain =
  | "Software & DevOps"
  | "Digital Marketing & SEO"
  | "Business & Operations"
  | "UI/UX & Web Design"
  | "Research & Education"
  | "Image Generation"
  | "Video & Motion"
  | "Audio, Speech & Music"
  | "Sales & CRM"
  | "Finance & Analytics"
  | "Customer Support & HR"
  | "Legal & Compliance"
  | "Writing & Productivity";

export type ArsenalModality = "text" | "code" | "image" | "video" | "audio" | "multimodal";

export type ArsenalTargetPlatform =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "cursor"
  | "midjourney"
  | "flux"
  | "runway"
  | "suno"
  | "local";

export type QualityStatus = "DRAFT" | "STRUCTURE_VALIDATED" | "MODEL_TESTED" | "USER_VALIDATED";

export interface PromptVariable {
  name: string;
  label: string;
  placeholder: string;
  default?: string;
  description?: string;
}

export interface ModelAdapter {
  platform: ArsenalTargetPlatform;
  dialectNotes?: string;
  templateOverride?: string;
  customParameters?: Record<string, string | number | boolean>;
}

export interface ArsenalPromptAsset {
  id: string;
  title: string;
  tagline: string;
  domain: ArsenalDomain;
  subdomain: string;
  modality: ArsenalModality;
  icon: string;
  outcome: string;
  author: string;
  verified: boolean;
  qualityStatus: QualityStatus;
  compatiblePlatforms: ArsenalTargetPlatform[];
  requiredInputs: string[];
  requiredOutputs: string[];
  constraints: string[];
  verificationCriteria: string[];
  variables: PromptVariable[];
  canonicalPrompt: string;
  modelAdapters?: Partial<Record<ArsenalTargetPlatform, ModelAdapter>>;
  version: number;
}
