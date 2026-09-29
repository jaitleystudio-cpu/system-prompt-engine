import type { EngineClient } from "./client";

/**
 * Transport for obligation-level quality receipts.
 * Canonical quality comparison, repair choice, and validation verdicts
 * are computed only inside the WASM kernel.
 */
export async function requestQualityReceipt(
  client: EngineClient,
  request: Record<string, unknown>,
): Promise<unknown> {
  const outcome = await client.compile(
    JSON.stringify({
      ...request,
      spe_api: "quality",
    }),
    () => {},
  );
  const result = outcome.result;
  if (outcome.error || !result || result.status !== "VALID") return null;
  return result.output;
}
