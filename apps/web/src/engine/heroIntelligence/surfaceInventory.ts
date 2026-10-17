/**
 * SPE Ω — Surface Inventory & Content Governance Map
 *
 * Mandate:
 * Formally classify every visible website surface into strict governance classes.
 * Ensure that critical legal terms, cryptographic proof receipts, and SEO tags
 * are locked against automated experimentation or mutation, while permitting
 * controlled, evidence-gated optimization only on eligible dynamic surfaces.
 */

export type SurfaceClassification =
  | "LOCKED"             // Cryptographic hashes, proof receipts, source licenses
  | "LEGAL_PROTECTED"    // Privacy policy, disclaimer notices, terms
  | "SEO_PROTECTED"      // HTML title, meta description, structured JSON-LD
  | "DYNAMIC_CANDIDATE"  // Primary hero headline, hero accent, supporting subtitle
  | "EXPERIMENT_ELIGIBLE"// Primary CTA button, quick prompt chips, eyebrow badge

export interface SurfaceDefinition {
  id: string;
  name: string;
  classification: SurfaceClassification;
  experimentEligible: boolean;
  maxCharsPerLine: number;
  maxLines: number;
  maxTotalChars: number;
  minContrastRatio: number; // WCAG 2.2 criteria
  readingGradeMax: number;  // Flesch-Kincaid grade ceiling
  notes: string;
}

export const SURFACE_INVENTORY: Record<string, SurfaceDefinition> = {
  HERO_HEADLINE: {
    id: "HERO_HEADLINE",
    name: "Homepage Hero Title & Accent",
    classification: "DYNAMIC_CANDIDATE",
    experimentEligible: true,
    maxCharsPerLine: 45,
    maxLines: 2,
    maxTotalChars: 90,
    minContrastRatio: 3.0, // Large text (>= 24px)
    readingGradeMax: 8.5,
    notes: "Main promise statement. Must be plain English, grounded, and concise.",
  },
  HERO_SUPPORTING_SUBTITLE: {
    id: "HERO_SUPPORTING_SUBTITLE",
    name: "Homepage Hero Supporting Subtitle",
    classification: "DYNAMIC_CANDIDATE",
    experimentEligible: true,
    maxCharsPerLine: 70,
    maxLines: 3,
    maxTotalChars: 180,
    minContrastRatio: 4.5, // Normal text
    readingGradeMax: 9.0,
    notes: "Explains how SPE achieves the promise with 100% on-device WebAssembly.",
  },
  HERO_PRIMARY_CTA: {
    id: "HERO_PRIMARY_CTA",
    name: "Homepage Hero Primary Action Button",
    classification: "EXPERIMENT_ELIGIBLE",
    experimentEligible: true,
    maxCharsPerLine: 28,
    maxLines: 1,
    maxTotalChars: 28,
    minContrastRatio: 4.5,
    readingGradeMax: 6.0,
    notes: "Action-oriented call-to-action leading to prompt studio or adoption.",
  },
  HERO_EYEBROW: {
    id: "HERO_EYEBROW",
    name: "Homepage Hero Eyebrow Pill",
    classification: "EXPERIMENT_ELIGIBLE",
    experimentEligible: true,
    maxCharsPerLine: 35,
    maxLines: 1,
    maxTotalChars: 35,
    minContrastRatio: 4.5,
    readingGradeMax: 7.0,
    notes: "Upper context tag signaling local privacy or category orientation.",
  },
  GLOBAL_PAGE_TITLE: {
    id: "GLOBAL_PAGE_TITLE",
    name: "HTML Head Title Tag (<title>)",
    classification: "SEO_PROTECTED",
    experimentEligible: false,
    maxCharsPerLine: 65,
    maxLines: 1,
    maxTotalChars: 65,
    minContrastRatio: 0,
    readingGradeMax: 10.0,
    notes: "Critical indexable keywords (Free System Prompt Generator, AI Prompt Builder).",
  },
  GLOBAL_META_DESCRIPTION: {
    id: "GLOBAL_META_DESCRIPTION",
    name: "HTML Meta Description",
    classification: "SEO_PROTECTED",
    experimentEligible: false,
    maxCharsPerLine: 160,
    maxLines: 1,
    maxTotalChars: 160,
    minContrastRatio: 0,
    readingGradeMax: 10.0,
    notes: "SERP snippet. Protected against automated overnight rewriting to preserve SEO rank.",
  },
  LEGAL_PRIVACY_TERMS: {
    id: "LEGAL_PRIVACY_TERMS",
    name: "Privacy Proof & Local-First Disclosures",
    classification: "LOCKED",
    experimentEligible: false,
    maxCharsPerLine: 120,
    maxLines: 50,
    maxTotalChars: 5000,
    minContrastRatio: 4.5,
    readingGradeMax: 12.0,
    notes: "Legal guarantees, zero-data logging proof, and air-gap verification.",
  },
  WASM_INTEGRITY_BADGE: {
    id: "WASM_INTEGRITY_BADGE",
    name: "WASM Bytecode Digest & Attestation Hash",
    classification: "LOCKED",
    experimentEligible: false,
    maxCharsPerLine: 64,
    maxLines: 1,
    maxTotalChars: 64,
    minContrastRatio: 4.5,
    readingGradeMax: 0,
    notes: "Canonical SHA-256 hash ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d.",
  },
};

export type SurfaceId = keyof typeof SURFACE_INVENTORY;

/**
 * Returns surface constraints and boundaries for a given surface ID.
 */
export function getSurfaceConstraints(surfaceId: string): SurfaceDefinition {
  const surface = SURFACE_INVENTORY[surfaceId];
  if (!surface) {
    // Default fallback to conservative locked constraint
    return {
      id: surfaceId,
      name: "Unknown Surface",
      classification: "LOCKED",
      experimentEligible: false,
      maxCharsPerLine: 60,
      maxLines: 2,
      maxTotalChars: 120,
      minContrastRatio: 4.5,
      readingGradeMax: 8.0,
      notes: "Unregistered surface defaulting to LOCKED.",
    };
  }
  return surface;
}
