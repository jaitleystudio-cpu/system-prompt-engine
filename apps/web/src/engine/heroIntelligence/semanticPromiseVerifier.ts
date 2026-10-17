/**
 * SPE Ω — Semantic Promise Verifier
 *
 * Mandate:
 * Mathematically verify that prospective hero headlines and supporting copy
 * map 100% to verified shipped capabilities in the Product-Promise Contract.
 * Enforces zero-tolerance for marketing hyperbole, ungrounded features, or safety violations.
 */

import {
  verifyCopyAgainstPromiseContract,
  type PromiseVerificationResult,
} from "./productPromiseContract.ts";

export interface CandidateCopyPayload {
  title: string;
  accent: string;
  support: string;
  cta: string;
  strategy: string;
  supportedCapabilityKeys?: string[];
}

export interface SemanticVerificationReport extends PromiseVerificationResult {
  candidateStrategy: string;
  headlineCombined: string;
  wordCount: number;
}

/**
 * Validates a candidate copy package against the semantic promise contract.
 */
export function verifyCandidateCopy(
  candidate: CandidateCopyPayload,
): SemanticVerificationReport {
  const headlineCombined = `${candidate.title} ${candidate.accent}`.trim();
  const contractResult = verifyCopyAgainstPromiseContract({
    headline: headlineCombined,
    support: candidate.support,
    cta: candidate.cta,
  });

  const wordCount = `${headlineCombined} ${candidate.support} ${candidate.cta}`
    .trim()
    .split(/\s+/).length;

  return {
    ...contractResult,
    candidateStrategy: candidate.strategy,
    headlineCombined,
    wordCount,
  };
}
