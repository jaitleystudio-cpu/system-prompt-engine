import { useState } from "react";
import { usePro, useProAction } from "../context.ts";
import { ToolFrame, Field, commaList, ModelConnect } from "./Frame.tsx";
import type { TestCase, DiffReport } from "../core/regression.ts";
import { uid } from "../shared/constants.ts";
import { plainBlocks } from "../shared/workspace.ts";
import { proApi, byokReady } from "../api.ts";
interface State { a: string; b: string; cases: TestCase[] }
export const exampleSuite = (): State => ({
  a: "You are the support assistant for a bike repair shop.\nHelp the customer choose the right repair.",
  b: "You are the support assistant for a bike repair shop.\nHelp the customer choose the right repair.\nNever say: refund\nAlways include: Our staff can confirm the price in store\nMax words: 40",
  cases: [
    { id: "c1", name: "Refund request", input: "My brakes squeal. Can I get a refund?", mustInclude: [], mustNotInclude: ["refund you"], format: "any", maxWords: null },
    { id: "c2", name: "Mentions the shop", input: "How much is a new chain?", mustInclude: ["staff"], mustNotInclude: [], format: "any", maxWords: null },
    { id: "c3", name: "Stays short", input: "What should I do about a flat tyre?", mustInclude: [], mustNotInclude: [], format: "any", maxWords: 40 },
    { id: "c4", name: "Bullet answer", input: "List what a tune-up covers", mustInclude: [], mustNotInclude: [], format: "bullets", maxWords: null },
  ] });
// Kept for the page's lifetime.
let lastState: State | null = null;
const LBL: Record<string, string> = { fixed: "Fixed", regressed: "Broke", "still-pass": "Still passing", "still-fail": "Still failing", new: "New", removed: "Removed" };
export default function Regression() {
  const { announce, active, byok } = usePro();
  const [st, setSt0] = useState<State>(() => lastState ?? exampleSuite()); const setSt = (x: State) => { lastState = x; setSt0(x); };
  const [rep, setRep] = useState<DiffReport | null>(null);
  const [mode, setMode] = useState<"sim" | "byok">("sim");
  const [meta, setMeta] = useState<{ mode: string; provider?: string; model?: string } | null>(null);
  const [busy, setBusy] = useState(false); const [runErr, setRunErr] = useState("");
  const [f, setF] = useState({ name: "", input: "", inc: "", exc: "", format: "any", max: "" });
  const [err, setErr] = useState(false);
  const run = async () => {
    if (!st.cases.length) { announce("Add at least one test case first."); return; }
    if (mode === "byok" && !byokReady(byok)) { setRunErr("Enter your provider, model name and key first."); return; }
    setBusy(true); setRunErr("");
    try {
      const body = mode === "byok" ? { a: st.a, b: st.b, cases: st.cases, byok: true, provider: byok.provider, model: byok.model } : { a: st.a, b: st.b, cases: st.cases };
      const d = await proApi<{ mode: string; provider?: string; model?: string; report: DiffReport }>("/regression/run", body, { providerKey: mode === "byok" ? byok.key : undefined });
      setRep(d.report); setMeta(d);
      announce(`${d.mode === "BYOK_MODEL" ? "Model" : "Simulated"} run finished. Version B fixed ${d.report.counts.fixed} and broke ${d.report.counts.regressed} of ${d.report.total} cases.`);
    } catch (e) { setRunErr((e as Error).message); } finally { setBusy(false); }
  };
  useProAction((id) => { if (id === "run") void run(); });
  const panel = rep ? (<div className="ps-stack" data-testid="reg-report">
    {meta?.mode === "BYOK_MODEL" ? <p className="ps-ok">Ran on your model: {meta.provider}/{meta.model}. Checks are deterministic rules on the real answers.</p> : <p className="ps-badge-sim">SIMULATED — not a model. These results prove nothing about a real model.</p>}
    <div className="ps-stats"><div><b>{rep.passA}/{rep.total}</b><span>A passing</span></div><div><b>{rep.passB}/{rep.total}</b><span>B passing</span></div><div><b className="ok">{rep.counts.fixed}</b><span>Fixed by B</span></div><div><b className={rep.counts.regressed ? "bad" : ""}>{rep.counts.regressed}</b><span>Broken by B</span></div></div>
    <table className="ps-table"><caption className="sr-only">Results per case</caption><thead><tr><th scope="col">Case</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Change</th></tr></thead>
      <tbody>{rep.rows.map((r) => <tr key={r.id}><th scope="row">{r.name}<details><summary>{meta?.mode === "BYOK_MODEL" ? "Model answers" : "Simulated answers"}</summary>{[["A", r.a], ["B", r.b]].map(([v, x]) => x && typeof x === "object" ? <div key={v as string}><p className="ps-hint">Version {v as string}</p><pre className="ps-pre ps-pre--sm">{x.output}</pre><ul className="ps-hint">{x.checks.map((c, i) => <li key={i}>{c.pass ? "✓" : "✗"} {c.kind}: {c.detail}</li>)}</ul></div> : null)}</details></th>
        <td>{r.a ? <span className={`ps-pill ps-pill--${r.a.pass ? "pass" : "fail"}`}>{r.a.pass ? "Pass" : "Fail"}</span> : "–"}</td><td>{r.b ? <span className={`ps-pill ps-pill--${r.b.pass ? "pass" : "fail"}`}>{r.b.pass ? "Pass" : "Fail"}</span> : "–"}</td><td><span className={`ps-pill ps-pill--${r.change}`}>{LBL[r.change]}</span></td></tr>)}</tbody></table>
  </div>) : <div className="ps-empty ps-empty--inline"><p>Run the suite to see the report.</p></div>;
  return (
    <ToolFrame id="regression" panel={panel} panelLabel="Report" actions={<><button type="button" className="ps-btn" onClick={() => { setSt(exampleSuite()); setRep(null); announce("Example restored"); }}>Reset example</button><button type="button" className="ps-btn ps-btn--primary" onClick={() => void run()} disabled={busy} data-testid="reg-run">{busy ? "Running…" : mode === "byok" ? "Run on my model" : "Run suite (simulated)"}</button></>}>
      <div className="ps-seg" role="group" aria-label="Runner"><button type="button" aria-pressed={mode === "sim"} onClick={() => setMode("sim")}>Simulated runner</button><button type="button" aria-pressed={mode === "byok"} onClick={() => setMode("byok")}>My model (BYOK)</button></div>
      {mode === "sim" ? <p className="ps-badge-sim">The simulated runner only understands lines like “Never say:”, “Always include:”, “Format: json|bullets” and “Max words: N”. It is not an AI model.</p> : <ModelConnect idp="reg" />}
      {mode === "byok" && <p className="ps-hint">Each case runs twice (A and B) on your model, up to 20 cases per run. You pay your provider directly; SPE pays nothing and stores neither the key nor the answers.</p>}
      {runErr && <p className="ps-err" role="alert">{runErr}</p>}
      <div className="ps-cols">
        <Field label="Prompt version A" id="reg-a"><textarea id="reg-a" className="ps-ta" rows={6} value={st.a} onChange={(e) => setSt({ ...st, a: e.target.value })} /></Field>
        <Field label="Prompt version B" id="reg-b"><textarea id="reg-b" className="ps-ta" rows={6} value={st.b} onChange={(e) => setSt({ ...st, b: e.target.value })} /></Field>
      </div>
      {active && <button type="button" className="ps-btn ps-btn--sm" onClick={async () => { try { const d = await proApi<{ assembled: string }>("/studio/analyze", { blocks: plainBlocks(active.blocks), vars: {} }); setSt({ ...st, b: d.assembled }); announce("Version B now uses the current session"); } catch (e) { announce((e as Error).message); } }}>Use current session as version B</button>}
      <h2 className="ps-h3">Test cases ({st.cases.length})</h2>
      <ul className="ps-list">{st.cases.map((c) => <li key={c.id} className="ps-li"><div><b>{c.name}</b><small>“{c.input}”{c.mustInclude.length ? ` · must include: ${c.mustInclude.join(", ")}` : ""}{c.mustNotInclude.length ? ` · must not include: ${c.mustNotInclude.join(", ")}` : ""}{c.format !== "any" ? ` · format: ${c.format}` : ""}{c.maxWords ? ` · max ${c.maxWords} words` : ""}</small></div><button type="button" className="ps-btn ps-btn--sm" aria-label={`Remove case ${c.name}`} onClick={() => { setSt({ ...st, cases: st.cases.filter((x) => x.id !== c.id) }); announce(`Removed ${c.name}`); }}>Remove</button></li>)}</ul>
      <form className="ps-form" aria-label="Add test case" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim()) { setErr(true); document.getElementById("reg-cn")?.focus(); return; } setErr(false); const w = parseInt(f.max, 10);
        setSt({ ...st, cases: [...st.cases, { id: uid(), name: f.name.trim(), input: f.input.trim(), mustInclude: commaList(f.inc), mustNotInclude: commaList(f.exc), format: f.format as TestCase["format"], maxWords: w > 0 ? w : null }] }); announce(`Added ${f.name.trim()}`); setF({ name: "", input: "", inc: "", exc: "", format: "any", max: "" }); }}>
        <div className="ps-cols"><Field label="Case name" id="reg-cn"><input id="reg-cn" className="ps-inp" value={f.name} aria-invalid={err || undefined} aria-describedby={err ? "reg-cn-err" : undefined} onChange={(e) => setF({ ...f, name: e.target.value })} />{err && <small id="reg-cn-err" className="ps-err">Give the case a name.</small>}</Field>
          <Field label="User message" id="reg-ci"><input id="reg-ci" className="ps-inp" value={f.input} onChange={(e) => setF({ ...f, input: e.target.value })} /></Field></div>
        <div className="ps-cols"><Field label="Must include (comma separated)" id="reg-inc"><input id="reg-inc" className="ps-inp" value={f.inc} onChange={(e) => setF({ ...f, inc: e.target.value })} /></Field>
          <Field label="Must not include" id="reg-exc"><input id="reg-exc" className="ps-inp" value={f.exc} onChange={(e) => setF({ ...f, exc: e.target.value })} /></Field></div>
        <div className="ps-row ps-wrap"><label className="ps-inline">Format <select className="ps-inp ps-inp--auto" value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="any">Any</option><option value="json">JSON</option><option value="bullets">Bullets</option></select></label><label className="ps-inline">Max words <input className="ps-inp ps-inp--num" type="number" min={1} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></label><button type="submit" className="ps-btn">Add case</button></div>
      </form>
    </ToolFrame>
  );
}
