import type { DesignDNA } from "../model/designDNA.ts";

export interface ReferenceIdentityInput {
  logo?: string;
  bodyCopy?: string;
  sourceCode?: string;
  sourceImages?: string[];
  designDNA: DesignDNA;
}

export interface SanitizedReferenceIdentity {
  designDNA: DesignDNA;
}

export function sanitizeReferenceIdentity(
  input: ReferenceIdentityInput,
): SanitizedReferenceIdentity {
  return { designDNA: structuredClone(input.designDNA) };
}
