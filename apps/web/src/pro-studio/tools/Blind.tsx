// Blind A/B: both prompts run on the customer's model; outputs are shown in a random order (decided on the
// server with crypto randomness) so the reviewer cannot tell which prompt wrote which answer.
import { useState } from "react";
import { usePro } from "../context.ts";
import { ToolFrame, Field, ModelConnect } from "./Frame.tsx";
import { proApi, byokReady } from "../api.ts";
import { plainBlocks } from "../shared/workspace.ts";

interface Case { id: string; text: string; category: string; language: string }
interface View { caseId: string; x: string; y: string; input: string }
interface GroupRow { group: string; A: number; B: number; tie: number; unpicked: number; n: number }
interface Reveal { rows: { caseId: string; xIs: "A" | "B"; pick: string | null; winner: string }[]; totals: { A: number; B: number; tie: number; unpicked: number }; byCategory: GroupRow[]; byLanguage: GroupRow[]; simulated: boolean; note: string }
const PREF: Record<string, string> = { x: "Answer 1", y: "Answer 2", tie: "No preference" };

export default function Blind() {
  const { active, byok, announce } = usePro();
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [cases, setCases] = useState<Case[]>([{ id: "c1", text: "", category: "", language: "" }]);
  const [run, setRun] = useState<{ id: string; view: View[]; simulated: boolean; provider: string; model: string } | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [rev, setRev] = useState<Reveal | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const fromSession = async (which: "a" | "b") => { if (!active) return; try { const blocks = which === "b" || !active.versions.length ? active.blocks : active.versions[active.versions.length - 1].blocks; const d = await proApi<{ assembled: string }>("/studio/analyze", { blocks: plainBlocks(blocks as never), vars: {} }); (which === "a" ? setA : setB)(d.assembled); } catch (e) { setErr((e as Error).message); } };
  const start = async () => {
    setErr(""); if (!byokReady(byok)) { setErr("Connect your model first."); return; }
    setBusy(true); setRev(null); setPicks({});
    try { const d = await proApi<{ id: string; view: View[]; simulated: boolean; provider: string; model: string }>("/ab/create", { a, b, inputs: cases.map((c) => ({ id: c.id, text: c.text, category: c.category || undefined, language: c.language || undefined })), provider: byok.provider, model: byok.model }, { providerKey: byok.provider === "mock" ? undefined : byok.key });
      setRun(d); announce(`${d.view.length} pairs ready. The order of each pair is random.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const reveal = async () => { if (!run) return; try { const d = await proApi<Reveal>("/ab/reveal", { id: run.id, picks }); setRev(d); announce(`Revealed: A ${d.totals.A}, B ${d.totals.B}, no preference ${d.totals.tie}`); } catch (e) { setErr((e as Error).message); } };
  const setCase = (i: number, p: Partial<Case>) => setCases(cases.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const table = (title: string, rows: GroupRow[]) => rows.length > 0 && <div><h3 className="ps-h3">{title}</h3><table className="ps-table"><thead><tr><th scope="col">Group</th><th scope="col">Cases</th><th scope="col">A preferred</th><th scope="col">B preferred</th><th scope="col">No preference</th><th scope="col">Not picked</th></tr></thead><tbody>{rows.map((r) => <tr key={r.group}><th scope="row">{r.group}{r.n < 5 && <span className="ps-tag ps-tag--warn">small sample</span>}</th><td>{r.n}</td><td>{r.A}</td><td>{r.B}</td><td>{r.tie}</td><td>{r.unpicked}</td></tr>)}</tbody></table></div>;

  const panel = run ? (<div className="ps-stack" data-testid="blind-out">
    {run.simulated && <p className="ps-badge-sim">SIMULATED outputs (development provider). Preferences here prove nothing about a real model.</p>}
    {rev ? <>
      <div className="ps-stats"><div><b>{rev.totals.A}</b><span>A preferred</span></div><div><b>{rev.totals.B}</b><span>B preferred</span></div><div><b>{rev.totals.tie}</b><span>No preference</span></div><div><b>{rev.totals.unpicked}</b><span>Not picked</span></div></div>
      <p className="ps-hint">{rev.note}</p>
      {table("By category", rev.byCategory)}{table("By language", rev.byLanguage)}
      <ul className="ps-hint">{rev.rows.map((r) => <li key={r.caseId}>{r.caseId}: Answer 1 was {r.xIs}; you picked {r.pick ? PREF[r.pick] : "nothing"} → {r.winner}</li>)}</ul>
    </> : <p className="ps-hint">Pick the better answer for each pair, then reveal. Which prompt wrote which answer stays hidden until then.</p>}
  </div>) : <div className="ps-empty ps-empty--inline"><p>Run both prompts on your model to start a blind review.</p></div>;

  return (
    <ToolFrame id="blind" panel={panel} panelLabel="Result">
      {err && <p className="ps-err" role="alert">{err}</p>}
      {!run || rev ? <>
        <div className="ps-cols">
          <Field label="Prompt A" id="bl-a"><textarea id="bl-a" className="ps-ta" rows={6} value={a} onChange={(e) => setA(e.target.value)} /></Field>
          <Field label="Prompt B" id="bl-b"><textarea id="bl-b" className="ps-ta" rows={6} value={b} onChange={(e) => setB(e.target.value)} /></Field>
        </div>
        {active && <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={() => void fromSession("a")}>A = latest saved version</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => void fromSession("b")}>B = current draft</button></div>}
        <fieldset className="ps-fieldset"><legend>Test inputs ({cases.length}, up to 20)</legend>
          <ol className="ps-lv-reqs">{cases.map((c, i) => <li key={c.id} className="ps-lv-req">
            <label className="sr-only" htmlFor={`bl-in-${i}`}>Input {i + 1}</label><input id={`bl-in-${i}`} className="ps-inp" value={c.text} placeholder="A real user message" onChange={(e) => setCase(i, { text: e.target.value })} />
            <label className="sr-only" htmlFor={`bl-cat-${i}`}>Category</label><input id={`bl-cat-${i}`} className="ps-inp" value={c.category} placeholder="category" onChange={(e) => setCase(i, { category: e.target.value })} />
            <label className="sr-only" htmlFor={`bl-lang-${i}`}>Language</label><input id={`bl-lang-${i}`} className="ps-inp ps-inp--num" value={c.language} placeholder="lang" onChange={(e) => setCase(i, { language: e.target.value })} />
            <button type="button" className="ps-btn ps-btn--sm" aria-label={`Remove input ${i + 1}`} disabled={cases.length === 1} onClick={() => setCases(cases.filter((_, j) => j !== i))}>Remove</button></li>)}</ol>
          <button type="button" className="ps-btn ps-btn--sm" disabled={cases.length >= 20} onClick={() => setCases([...cases, { id: `c${cases.length + 1}_${Date.now().toString(36).slice(-3)}`, text: "", category: "", language: "" }])}>Add input</button>
        </fieldset>
        <ModelConnect idp="bl-mc" />
        <button type="button" className="ps-btn ps-btn--primary" disabled={busy || !a.trim() || !b.trim() || !cases.some((c) => c.text.trim())} onClick={() => void start()} data-testid="blind-run">{busy ? "Running on your model…" : "Run blind comparison"}</button>
      </> : <section aria-label="Blind pairs" className="ps-stack">
        <p className="ps-hint">{run.provider}/{run.model} · {run.view.length} pairs · answer order randomised per pair</p>
        {run.view.map((v, i) => <fieldset key={v.caseId} className="ps-fieldset ps-blind"><legend>Pair {i + 1}: {v.input.slice(0, 120)}</legend>
          <div className="ps-cols"><div className="ps-card ps-card--flat"><h3 className="ps-h3">Answer 1</h3><pre className="ps-pre ps-pre--sm">{v.x}</pre></div><div className="ps-card ps-card--flat"><h3 className="ps-h3">Answer 2</h3><pre className="ps-pre ps-pre--sm">{v.y}</pre></div></div>
          <div className="ps-seg" role="radiogroup" aria-label={`Your preference for pair ${i + 1}`}>{(["x", "y", "tie"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={picks[v.caseId] === k} onClick={() => setPicks({ ...picks, [v.caseId]: k })}>{PREF[k]}</button>)}</div>
        </fieldset>)}
        <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--primary" onClick={() => void reveal()} data-testid="blind-reveal">Reveal ({Object.keys(picks).length}/{run.view.length} picked)</button><button type="button" className="ps-btn" onClick={() => setRun(null)}>Discard</button></div>
      </section>}
    </ToolFrame>
  );
}
