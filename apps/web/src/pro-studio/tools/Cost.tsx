import { usePro, usePersisted } from "../context.ts";
import { ToolFrame, Field } from "./Frame.tsx";
import { estimateCost, type CostInput } from "../core/cost.ts";
import { assemble, tokens } from "../core/studio.ts";
const KEY = "spe.pro.studio.v2.cost";
type Rates = Omit<CostInput, "promptTokens">;
const isRates = (v: unknown): v is Rates => !!v && typeof v === "object" && "pricePerMInput" in (v as object);
const money = (x: number) => (x < 0.01 && x > 0 ? x.toFixed(5) : x.toFixed(2));
export default function Cost() {
  const { active } = usePro();
  const [r, setR] = usePersisted<Rates>(KEY, () => ({ inputTokensPerCall: 200, outputTokensPerCall: 300, pricePerMInput: 0, pricePerMOutput: 0, callsPerDay: 1000, contextWindow: null }), isRates);
  const promptTokens = active ? tokens(assemble(active.blocks)) : 0;
  const res = estimateCost({ ...r, promptTokens });
  const num = (k: keyof Rates, label: string, hint?: string) => (<Field label={label} id={`cost-${k}`} hint={hint}><input id={`cost-${k}`} className="ps-inp" type="number" min={0} step="any" value={r[k] ?? ""} onChange={(e) => setR({ ...r, [k]: e.target.value === "" ? (k === "contextWindow" ? null : 0) : Number(e.target.value) })} /></Field>);
  return (
    <ToolFrame id="cost" panel={<div className="ps-stack" data-testid="cost-out">
      <div className="ps-stats"><div><b>{res.inputPerCall.toLocaleString()}</b><span>input tokens / call</span></div><div><b>{money(res.perCall)}</b><span>per call</span></div><div><b>{money(res.perDay)}</b><span>per day</span></div><div><b>{money(res.per30Days)}</b><span>per 30 days</span></div></div>
      <p className="ps-hint">Your system prompt is {(res.promptShareOfInput * 100).toFixed(0)}% of each call's input.{res.fitsContext !== null && (res.fitsContext ? " Fits the context window you entered." : "")}</p>
      {res.warnings.map((w, i) => <p key={i} className="ps-warn">{w}</p>)}
      <p className="ps-hint">Amounts are in whatever currency your prices use. Tokens are estimated as characters ÷ 4; real tokenizers differ.</p>
    </div>} panelLabel="Estimate">
      <p className="ps-hint">Cost model: LOCAL. Pro Studio ships no price list and calls no API. Copy the per-million-token prices from your provider's pricing page.</p>
      <p className="ps-hint">System prompt: {active ? `~${promptTokens} tokens from the current session.` : "no session open (0 tokens)."}</p>
      <div className="ps-cols">{num("pricePerMInput", "Price per 1M input tokens")}{num("pricePerMOutput", "Price per 1M output tokens")}</div>
      <div className="ps-cols">{num("inputTokensPerCall", "User input tokens per call")}{num("outputTokensPerCall", "Output tokens per call")}</div>
      <div className="ps-cols">{num("callsPerDay", "Calls per day")}{num("contextWindow", "Context window (optional)")}</div>
    </ToolFrame>
  );
}
