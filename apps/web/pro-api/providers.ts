// BYOK model calls. The customer's provider key is used for one request and never stored, logged or
// echoed. SPE pays nothing: the provider bills the customer (or the customer uses a no-card free tier).
// Only allowlisted hosts are reachable (SSRF guard): no custom base URLs.
export type ProviderId = "openai" | "anthropic" | "groq" | "openrouter" | "gemini" | "mistral" | "mock";
interface Def { label: string; style: "openai" | "anthropic"; url: string; note: string }
export const PROVIDERS: Record<Exclude<ProviderId, "mock">, Def> = {
  openai: { label: "OpenAI", style: "openai", url: "https://api.openai.com/v1/chat/completions", note: "Paid by your OpenAI account." },
  anthropic: { label: "Anthropic", style: "anthropic", url: "https://api.anthropic.com/v1/messages", note: "Paid by your Anthropic account." },
  groq: { label: "Groq (OpenAI-compatible)", style: "openai", url: "https://api.groq.com/openai/v1/chat/completions", note: "Groq offers a free tier; check its current terms." },
  openrouter: { label: "OpenRouter (OpenAI-compatible)", style: "openai", url: "https://openrouter.ai/api/v1/chat/completions", note: "Some OpenRouter models are free; check its current terms." },
  gemini: { label: "Google Gemini (OpenAI-compatible endpoint)", style: "openai", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", note: "Google AI Studio offers a free tier; check its current terms." },
  mistral: { label: "Mistral", style: "openai", url: "https://api.mistral.ai/v1/chat/completions", note: "Check Mistral's current plans." },
};
export const PROVIDER_IDS = Object.keys(PROVIDERS) as Exclude<ProviderId, "mock">[];
export class ProviderError extends Error { constructor(message: string, public status = 502) { super(message); } }
export interface CallCfg { provider: string; model: string; apiKey: string; maxTokens?: number; allowMock?: boolean }
export interface CallOut { text: string; usage?: { total?: number }; simulated: boolean }
/** Validates provider + model before any call. Returns a user-facing error string or null. */
export function checkProvider(provider: string, model: string, opts: { allowMock: boolean }): string | null {
  if (provider === "mock") return opts.allowMock ? null : "The simulated provider is only available on development servers with a test key.";
  if (!(provider in PROVIDERS)) return `Unknown provider “${String(provider).slice(0, 40)}”. Use one of: ${PROVIDER_IDS.join(", ")}. Custom URLs are not accepted.`;
  if (!model || model.length > 120 || !/^[\w.:/@+-]+$/.test(model)) return "Type the model name your provider gives you (letters, digits and . : / @ + - only).";
  return null;
}
export async function callModel(cfg: CallCfg, system: string, user: string, f: typeof fetch = fetch): Promise<CallOut> {
  if (cfg.provider === "mock") { if (!cfg.allowMock) throw new ProviderError("Simulated provider is disabled.", 400); return { text: mockAnswer(system, user), usage: undefined, simulated: true }; }
  const d = PROVIDERS[cfg.provider as keyof typeof PROVIDERS]; if (!d) throw new ProviderError("Unknown provider.", 400);
  if (!cfg.apiKey) throw new ProviderError("Missing provider key.", 400);
  const max = Math.min(Math.max(16, cfg.maxTokens ?? 600), 4000);
  let r: Response;
  try {
    r = d.style === "anthropic"
      ? await f(d.url, { method: "POST", headers: { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: cfg.model, max_tokens: max, system, messages: [{ role: "user", content: user }] }) })
      : await f(d.url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` }, body: JSON.stringify({ model: cfg.model, max_tokens: max, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  } catch { throw new ProviderError(`Could not reach ${d.label}.`); }
  // Never forward the provider's error body: it can echo the key or account details.
  if (!r.ok) throw new ProviderError(`${d.label} returned HTTP ${r.status}.`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any; try { j = await r.json(); } catch { throw new ProviderError(`${d.label} returned a response that is not JSON.`); }
  if (d.style === "anthropic") { const text = Array.isArray(j?.content) ? j.content.filter((c: { type?: string }) => c?.type === "text").map((c: { text?: string }) => c.text ?? "").join("") : ""; const t = Number(j?.usage?.input_tokens ?? 0) + Number(j?.usage?.output_tokens ?? 0); return { text, usage: t > 0 ? { total: t } : undefined, simulated: false }; }
  const text = String(j?.choices?.[0]?.message?.content ?? ""); const t = Number(j?.usage?.total_tokens ?? 0);
  return { text, usage: t > 0 ? { total: t } : undefined, simulated: false };
}
/** Deterministic stand-in used ONLY on dev servers with a test key, for demos and e2e tests. Labelled SIMULATED.
 * It follows explicit repair clauses so the loop can be exercised, and it always claims to be "done" to show
 * that such claims are ignored by the verifier. */
// Flagship demo scripts (deterministic). The generated code is real JavaScript that the harness really runs;
// only the "model" is scripted. crash-then-fix: crashes (undefined `todos`) until the prompt carries the
// targeted repair for that exact error. always-crash: keeps crashing no matter what the prompt says.
const DEMO_CRASH = (claim: string) => "```js\nconst root = document.getElementById(\"root\");\nroot.innerHTML = \"<h1>My todos</h1><ul>\" + todos.map((t) => \"<li>\" + t + \"</li>\").join(\"\") + \"</ul>\";\nconsole.log(\"" + claim + "\");\n```\n" + claim;
const DEMO_FIXED = "```js\nconst todos = [\"Buy milk\", \"Ship the release\"];\nconst root = document.getElementById(\"root\");\nroot.innerHTML = \"<h1>My todos</h1><ul>\" + todos.map((t) => \"<li>\" + t + \"</li>\").join(\"\") + \"</ul>\";\n```\nDone — the app renders.";
export function demoAnswer(system: string, user: string): string | null {
  if (user.includes("[demo:always-crash]")) return DEMO_CRASH("Done — fixed, all requirements met.");
  if (user.includes("[demo:crash-then-fix]")) return /Do not reference `todos` unless you declare and initialise it first/.test(system) ? DEMO_FIXED : DEMO_CRASH("Done — all requirements met.");
  return null;
}
export function mockAnswer(system: string, user: string): string {
  const demo = demoAnswer(system, user); if (demo) return demo;
  const fixes = system.split("## Fixes from earlier attempts")[1] ?? "";
  const must = [...fixes.matchAll(/must include the exact text "([^"]{1,200})"/g)].map((m) => m[1]);
  const not = [...fixes.matchAll(/must not contain "([^"]{1,200})"/g)].map((m) => m[1]);
  const keys = fixes.match(/JSON object with these keys: ([^.\n]+)\./);
  if (keys) return JSON.stringify(Object.fromEntries(keys[1].split(",").map((k) => [k.trim(), `simulated ${k.trim()}`])));
  if (/Output only valid JSON/.test(fixes)) return JSON.stringify({ answer: `Simulated answer to: ${user.slice(0, 80)}` });
  let t = `[SIMULATED] Here is a draft answer to: ${user.slice(0, 200)}. We will call you back soon. Done — all requirements are met.`;
  for (const n of not) t = t.split(n).join("");
  if (must.length) t += " " + must.join(" ");
  return t;
}
