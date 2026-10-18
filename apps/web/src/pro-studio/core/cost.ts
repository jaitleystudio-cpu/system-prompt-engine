// Token budget & cost estimate. Uses ONLY prices the user types in; Pro Studio ships no price list.
// Token counts are approximate (characters ÷ 4).
export interface CostInput { promptTokens: number; inputTokensPerCall: number; outputTokensPerCall: number; pricePerMInput: number; pricePerMOutput: number; callsPerDay: number; contextWindow: number | null }
export interface CostResult { inputPerCall: number; perCall: number; perDay: number; per30Days: number; promptShareOfInput: number; fitsContext: boolean | null; warnings: string[] }
const n = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);
export function estimateCost(i: CostInput): CostResult {
  const warnings: string[] = [];
  for (const [k, v] of Object.entries(i)) if (v !== null && typeof v === "number" && (!Number.isFinite(v) || v < 0)) warnings.push(`${k} must be a number of 0 or more; treated as 0.`);
  const inputPerCall = n(i.promptTokens) + n(i.inputTokensPerCall);
  const perCall = (inputPerCall * n(i.pricePerMInput) + n(i.outputTokensPerCall) * n(i.pricePerMOutput)) / 1_000_000;
  const perDay = perCall * n(i.callsPerDay);
  const total = inputPerCall + n(i.outputTokensPerCall);
  const fitsContext = i.contextWindow ? total <= i.contextWindow : null;
  if (fitsContext === false) warnings.push(`One call needs ~${total} tokens, more than the ${i.contextWindow}-token window you entered.`);
  if (!n(i.pricePerMInput) && !n(i.pricePerMOutput)) warnings.push("Enter your provider's prices to see a cost. Pro Studio does not include any price list.");
  return { inputPerCall, perCall, perDay, per30Days: perDay * 30, promptShareOfInput: inputPerCall ? n(i.promptTokens) / inputPerCall : 0, fitsContext, warnings };
}
