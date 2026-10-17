export function fromK3QualityRequest(
  k3Output: unknown,
  compiledPrompt: string,
): {
  op: string;
  k3_output: unknown;
  compiled_prompt: string;
  mode: string;
};

export function receiptWords(receipt: {
  disposition?: string | null;
  validation?: string | null;
  proofClass?: string | null;
} | null): string[];
