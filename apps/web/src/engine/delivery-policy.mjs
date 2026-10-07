/**
 * Delivery policy for Core A failure. This does not score quality.
 * Terminal names are routing labels. Semantic words come from the kernel receipt.
 */

export function deliveryForBrief() {
  return decideDelivery({ kind: "prompt_brief", hasCanonical: false });
}

export function deliveryForEngineDown() {
  return decideDelivery({ kind: "engine_unavailable", hasCanonical: false });
}

export function deliveryForK3Down() {
  return decideDelivery({ kind: "k3_unavailable", hasCanonical: false });
}

export function deliveryForQualityMiss() {
  return decideDelivery({ kind: "quality_unavailable", hasCanonical: true });
}

export function deliveryForReceipt(receipt) {
  return decideDelivery({ kind: "quality_receipt", hasCanonical: true, receipt });
}

export function usesRepairedPrompt(decision) {
  return Boolean(decision && decision.terminal === "RECONSTRUCTED_PROMPT" && decision.repairedPrompt);
}

function reconstructionAccepted(reconstruction, receipt) {
  if (!reconstruction || reconstruction.kept !== "repaired") return false;
  const plan = reconstruction.plan;
  const delta = reconstruction.quality_delta;
  if (!plan || plan.disposition !== "ACCEPTED") return false;
  if (!delta || delta.disposition !== "IMPROVED") return false;
  if (!Array.isArray(delta.protected_regressions) || delta.protected_regressions.length !== 0) return false;
  if (!receipt || receipt.verdict !== "PASS") return false;
  const prompt = reconstruction.kept_subject && reconstruction.kept_subject.compiled_prompt;
  return typeof prompt === "string" && prompt.length > 0;
}

import { synthesizeSystemPrompt } from "./promptSynthesizer.mjs";

export function selectEffectivePrompt(canonicalPrompt, qualityOut) {
  if (!qualityOut || !reconstructionAccepted(qualityOut.reconstruction, qualityOut.receipt)) {
    return canonicalPrompt;
  }
  return qualityOut.reconstruction.kept_subject.compiled_prompt;
}

/** One kernel-selected prompt for display, artifact, history, copy, and export. */
export function bindEffectiveSurfaces(canonicalPrompt, qualityOut, opts) {
  const prompt = selectEffectivePrompt(canonicalPrompt, qualityOut);
  const formatted = synthesizeSystemPrompt(prompt, opts);
  return {
    display: formatted,
    rawPrompt: prompt,
    artifactPrompt: formatted,
    historyPreview: typeof formatted === "string" ? formatted.slice(0, 240) : "",
    exportPrompt: formatted,
    copyPrompt: formatted,
  };
}

export function decideDelivery(event) {
  const kind = event && event.kind;
  const hasCanonical = event && event.hasCanonical === true;
  if (kind === "prompt_brief" || kind === "conflict") {
    return { terminal: "CLARIFICATION_REQUIRED", fallback: false, validation: null };
  }
  if (kind === "unsupported") {
    return { terminal: "UNSUPPORTED", fallback: false, validation: null };
  }
  if (kind === "refused") {
    return { terminal: "REFUSED", fallback: false, validation: null };
  }
  if ((kind === "engine_unavailable" || kind === "k3_unavailable") && !hasCanonical) {
    return { terminal: "SAFE_FALLBACK_PROMPT", fallback: true, validation: null };
  }
  if (kind === "quality_unavailable" && hasCanonical) {
    return { terminal: "CANONICAL_PROMPT", fallback: false, validation: "UNKNOWN" };
  }
  if (kind === "quality_receipt") {
    const reconstruction = event.receipt && event.receipt.reconstruction;
    const receipt = event.receipt && event.receipt.receipt;
    const verdict = receipt ? receipt.verdict : null;
    if (!reconstruction) {
      return { terminal: "CANONICAL_PROMPT", fallback: false, validation: verdict || "UNKNOWN", repairedPrompt: null };
    }
    if (reconstructionAccepted(reconstruction, receipt)) {
      return {
        terminal: "RECONSTRUCTED_PROMPT",
        fallback: false,
        validation: verdict,
        repairedPrompt: reconstruction.kept_subject.compiled_prompt,
      };
    }
    return { terminal: "CANONICAL_PROMPT", fallback: false, validation: verdict || "UNKNOWN", repairedPrompt: null };
  }
  if (hasCanonical) {
    return { terminal: "CANONICAL_PROMPT", fallback: false, validation: null };
  }
  return { terminal: "SAFE_FALLBACK_PROMPT", fallback: true, validation: null };
}
