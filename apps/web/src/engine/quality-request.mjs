/** Kernel quality request shape. Transport stays in qualityTransport.ts. */
export function fromK3QualityRequest(k3Output, compiledPrompt) {
  return {
    op: "from_k3",
    k3_output: k3Output,
    compiled_prompt: compiledPrompt,
    mode: "VALIDATE_ONLY",
  };
}

export function receiptWords(receipt) {
  if (!receipt) return [];
  return [receipt.disposition, receipt.validation, receipt.proofClass].filter(
    (item) => typeof item === "string" && item.length > 0,
  );
}
