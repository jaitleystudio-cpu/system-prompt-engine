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
    const kept = reconstruction && reconstruction.kept;
    const plan = reconstruction && reconstruction.plan;
    if (kept === "repaired" && plan && plan.disposition === "ACCEPTED") {
      return {
        terminal: "RECONSTRUCTED_PROMPT",
        fallback: false,
        validation: event.receipt.receipt ? event.receipt.receipt.verdict : null,
        repairedPrompt:
          reconstruction.kept_subject && reconstruction.kept_subject.compiled_prompt
            ? reconstruction.kept_subject.compiled_prompt
            : null,
      };
    }
    const verdict = event.receipt && event.receipt.receipt ? event.receipt.receipt.verdict : null;
    return { terminal: "CANONICAL_PROMPT", fallback: false, validation: verdict || "UNKNOWN" };
  }
  if (hasCanonical) {
    return { terminal: "CANONICAL_PROMPT", fallback: false, validation: null };
  }
  return { terminal: "SAFE_FALLBACK_PROMPT", fallback: true, validation: null };
}
