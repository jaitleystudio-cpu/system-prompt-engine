// Cross-model check: the same compiled prompt and the same deterministic checks on up to four models.
import { useEffect, useState } from "react";
import { usePro } from "../context.ts";
import { ToolFrame, Breakdown, StatusBadge, useProviders, type GroupRow, Empty, About } from "./Frame.tsx";
import { proApi } from "../api.ts";

interface Row { provider: string; model: string; key: string }
interface ModelResult { provider: string; model: string; status: "RAN" | "NOT_RUN"; reason?: string; simulated: boolean; pass: number; fail: number; notRun: number; unproven: number; results: { reqId: string; inputId: string; status: string; evidence: string }[]; byCategory: GroupRow[]; byLanguage: GroupRow[] }
interface Out { promptSha: string; checks: number; models: ModelResult[]; note: string }
export default function Portability() {
  const { byok, announce, go, runAction } = usePro(); const providers = useProviders();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]); const [pid, setPid] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...byok }, { provider: "anthropic", model: "", key: "" }]);
  const [out, setOut] = useState<Out | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { proApi<{ projects: { id: string; name: string }[] }>("/living/list").then((d) => { setProjects(d.projects); if (d.projects[0]) setPid(d.projects[0].id); }).catch((e) => setErr((e as Error).message)); }, []);
  const setRow = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const runIt = async () => {
    setErr(""); setBusy(true);
    const headers: Record<string, string> = {}; rows.forEach((r, i) => { if (r.key.trim()) headers[`x-provider-key-${i}`] = r.key.trim(); });
    try { const d = await proApi<Out>("/portability/run", { id: pid, models: rows.map((r) => ({ provider: r.provider, model: r.model })) }, { headers }); setOut(d); announce(`Cross-model check finished on ${d.models.filter((m) => m.status === "RAN").length} of ${d.models.length} models.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const panel = out ? (<div className="ps-stack" data-testid="port-out">
    <p className="ps-hint">Same prompt on every model (sha256 <code>{out.promptSha.slice(0, 16)}…</code>) · {out.checks} checks per model. {out.note}</p>
    {out.models.map((m, i) => <section key={i} className="ps-card ps-card--flat" aria-label={`${m.provider}/${m.model}`}>
      <h3 className="ps-h3">{m.provider}/{m.model || "(no model)"} {m.simulated && <span className="ps-tag ps-tag--warn">SIMULATED</span>}</h3>
      {m.status === "NOT_RUN" ? <p className="ps-warn">Not run: {m.reason}</p> : <>
        <p className="ps-hint">{m.pass} verified · {m.fail} failed · {m.unproven} unproven · {m.notRun} not run</p>
        <Breakdown title="By category" rows={m.byCategory} /><Breakdown title="By language" rows={m.byLanguage} />
        <details><summary>Every check</summary><ul className="ps-list">{m.results.map((r, j) => <li key={j} className="ps-li"><div><b>{r.reqId} · {r.inputId}</b><small>{r.evidence}</small></div><StatusBadge s={r.status} /></li>)}</ul></details>
      </>}
    </section>)}
  </div>) : <Empty>Results per model appear here, worst group first.</Empty>;
  return (
    <ToolFrame id="portability" panel={panel} panelLabel="Per model">
      {err && <p className="ps-err" role="alert">{err}</p>}
      <About label="How this works">Checks whether a Living project's prompt keeps its protected requirements on other models. Each model uses your own key for that provider; keys are sent once and not stored. Requirements that need code execution follow the server's sandbox setting.</About>
      {projects.length === 0 ? <div className="ps-empty ps-empty--inline"><p>Create a Living project first; its requirements and test inputs are what get checked.</p><button type="button" className="ps-btn ps-btn--primary" onClick={() => { go({ kind: "tool", tool: "living" }); runAction("living", "new"); }}>New Living project</button></div> : <>
        <div className="ps-field"><label htmlFor="pt-proj">Living project</label><select id="pt-proj" className="ps-inp" value={pid} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <fieldset className="ps-fieldset"><legend>Models (up to 4)</legend>
          <ol className="ps-lv-reqs">{rows.map((r, i) => <li key={i} className="ps-lv-req">
            <label className="sr-only" htmlFor={`pt-p-${i}`}>Provider {i + 1}</label><select id={`pt-p-${i}`} className="ps-inp ps-inp--auto" value={r.provider} onChange={(e) => setRow(i, { provider: e.target.value })}>{(providers.length ? providers : [{ id: "openai", label: "OpenAI", note: "" }]).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <label className="sr-only" htmlFor={`pt-m-${i}`}>Model name {i + 1}</label><input id={`pt-m-${i}`} className="ps-inp ps-mono" value={r.model} placeholder="exact model ID" onChange={(e) => setRow(i, { model: e.target.value })} autoComplete="off" />
            {r.provider !== "mock" && <><label className="sr-only" htmlFor={`pt-k-${i}`}>Provider key {i + 1}</label><input id={`pt-k-${i}`} className="ps-inp ps-mono" type="password" value={r.key} placeholder="your key for this provider" onChange={(e) => setRow(i, { key: e.target.value })} autoComplete="off" /></>}
            <button type="button" className="ps-btn ps-btn--sm" aria-label={`Remove model ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button></li>)}</ol>
          <button type="button" className="ps-btn ps-btn--sm" disabled={rows.length >= 4} onClick={() => setRows([...rows, { provider: "openai", model: "", key: "" }])}>Add model</button>
        </fieldset>
        <button type="button" className="ps-btn ps-btn--primary" disabled={busy || !pid} onClick={() => void runIt()} data-testid="port-run">{busy ? "Running on your models…" : "Run cross-model check"}</button>
      </>}
    </ToolFrame>
  );
}
