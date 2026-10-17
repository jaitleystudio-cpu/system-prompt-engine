import { useState } from "react";
import { usePro, usePersisted, useProAction } from "../context.ts";
import { ToolFrame, Field, commaList } from "./Frame.tsx";
import { type TestCase, type DiffReport, runSuite, diffReports } from "../core/regression.ts";
import { uid, assemble } from "../core/studio.ts";
const KEY = "spe.pro.studio.v2.regression";
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
const isState = (v: unknown): v is State => !!v && typeof v === "object" && typeof (v as State).a === "string" && Array.isArray((v as State).cases);
const LBL: Record<string, string> = { fixed: "Fixed", regressed: "Broke", "still-pass": "Still passing", "still-fail": "Still failing", new: "New", removed: "Removed" };
export default function Regression() {
  const { announce, log, active } = usePro();
  const [st, setSt] = usePersisted<State>(KEY, exampleSuite, isState);
  const [rep, setRep] = useState<DiffReport | null>(null);
  const [f, setF] = useState({ name: "", input: "", inc: "", exc: "", format: "any", max: "" });
  const [err, setErr] = useState(false);
  const run = () => { if (!st.cases.length) { announce("Add at least one test case first."); return; } const d = diffReports(runSuite(st.a, st.cases), runSuite(st.b, st.cases)); setRep(d); announce(`Simulated run finished. Version B fixed ${d.counts.fixed} and broke ${d.counts.regressed} of ${d.total} cases.`); log("regression.run", `${d.total} cases (simulated)`); };
  useProAction((id) => { if (id === "run") run(); });
  const panel = rep ? (<div className="ps-stack" data-testid="reg-report">
    <p className="ps-badge-sim">SIMULATED RUNNER — not a model. It shows how the report reads; real model runs are not connected.</p>
    <div className="ps-stats"><div><b>{rep.passA}/{rep.total}</b><span>A passing</span></div><div><b>{rep.passB}/{rep.total}</b><span>B passing</span></div><div><b className="ok">{rep.counts.fixed}</b><span>Fixed by B</span></div><div><b className={rep.counts.regressed ? "bad" : ""}>{rep.counts.regressed}</b><span>Broken by B</span></div></div>
    <table className="ps-table"><caption className="sr-only">Results per case</caption><thead><tr><th scope="col">Case</th><th scope="col">A</th><th scope="col">B</th><th scope="col">Change</th></tr></thead>
      <tbody>{rep.rows.map((r) => <tr key={r.id}><th scope="row">{r.name}<details><summary>Simulated answers</summary>{[["A", r.a], ["B", r.b]].map(([v, x]) => x && typeof x === "object" ? <div key={v as string}><p className="ps-hint">Version {v as string}</p><pre className="ps-pre ps-pre--sm">{x.output}</pre><ul className="ps-hint">{x.checks.map((c, i) => <li key={i}>{c.pass ? "✓" : "✗"} {c.kind}: {c.detail}</li>)}</ul></div> : null)}</details></th>
        <td>{r.a ? <span className={`ps-pill ps-pill--${r.a.pass ? "pass" : "fail"}`}>{r.a.pass ? "Pass" : "Fail"}</span> : "–"}</td><td>{r.b ? <span className={`ps-pill ps-pill--${r.b.pass ? "pass" : "fail"}`}>{r.b.pass ? "Pass" : "Fail"}</span> : "–"}</td><td><span className={`ps-pill ps-pill--${r.change}`}>{LBL[r.change]}</span></td></tr>)}</tbody></table>
  </div>) : <div className="ps-empty ps-empty--inline"><p>Run the suite to see the report.</p></div>;
  return (
    <ToolFrame id="regression" panel={panel} panelLabel="Report" actions={<><button type="button" className="ps-btn" onClick={() => { setSt(exampleSuite()); setRep(null); announce("Example restored"); }}>Reset example</button><button type="button" className="ps-btn ps-btn--primary" onClick={run} data-testid="reg-run">Run suite (simulated)</button></>}>
      <p className="ps-badge-sim">The runner is a deterministic simulation that only understands lines like “Never say:”, “Always include:”, “Format: json|bullets” and “Max words: N”. It is not an AI model.</p>
      <div className="ps-cols">
        <Field label="Prompt version A" id="reg-a"><textarea id="reg-a" className="ps-ta" rows={6} value={st.a} onChange={(e) => setSt({ ...st, a: e.target.value })} /></Field>
        <Field label="Prompt version B" id="reg-b"><textarea id="reg-b" className="ps-ta" rows={6} value={st.b} onChange={(e) => setSt({ ...st, b: e.target.value })} /></Field>
      </div>
      {active && <button type="button" className="ps-btn ps-btn--sm" onClick={() => { setSt({ ...st, b: assemble(active.blocks) }); announce("Version B now uses the current session"); }}>Use current session as version B</button>}
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
