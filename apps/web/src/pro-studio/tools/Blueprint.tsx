import { useState } from "react";
import { usePro, useProAction, download, copyText } from "../context.ts";
import { ToolFrame } from "./Frame.tsx";
import { type Blueprint as BP, type Agent, AGENT_TOOLS, RISKY, DRAFT_NOTE, uid } from "../shared/constants.ts";
import { useProQuery } from "../api.ts";
export const exampleBlueprint = (): BP => ({ name: "Bike shop help desk", agents: [
  { id: "triage", name: "Triage", role: "Reads each message and decides who should answer.", instructions: "Ask one clarifying question if the request is unclear.", tools: [], maxSteps: 4, needsApproval: false, x: 16, y: 168 },
  { id: "repairs", name: "Repair advisor", role: "Suggests the right repair and a price range.", instructions: "Use the shop's price list. Never promise refunds.", tools: ["read_file", "web_search"], maxSteps: 8, needsApproval: false, x: 232, y: 40 },
  { id: "billing", name: "Billing", role: "Drafts replies about invoices.", instructions: "Hand anything about refunds to a person.", tools: ["read_file", "send_email"], maxSteps: 6, needsApproval: true, x: 232, y: 296 },
  { id: "human", name: "Staff member", role: "A person who approves refunds.", instructions: "", tools: [], maxSteps: 1, needsApproval: false, x: 448, y: 296 }],
  handoffs: [{ from: "triage", to: "repairs", when: "the question is about a repair" }, { from: "triage", to: "billing", when: "the question is about billing" }, { from: "billing", to: "human", when: "a refund is requested" }] });
const EXP = { mcp: "MCP-style", openai: "OpenAI-style", anthropic: "Anthropic-style" } as const;
// Kept for the page's lifetime. Download the draft config to keep it.
let lastBp: BP | null = null;
const W = 168, H = 64;
export default function Blueprint() {
  const { announce, log } = usePro();
  const [bp, setBp0] = useState<BP>(() => lastBp ?? exampleBlueprint());
  const setBp = (fn: BP | ((b: BP) => BP)) => setBp0((b) => { const n = typeof fn === "function" ? fn(b) : fn; lastBp = n; return n; });
  const [sel, setSel] = useState(bp.agents[0]?.id ?? "");
  const [fmt, setFmt] = useState<keyof typeof EXP>("mcp");
  const [hf, setHf] = useState(""); const [ht, setHt] = useState(""); const [hw, setHw] = useState("");
  const a = bp.agents.find((x) => x.id === sel);
  const q = useProQuery<{ errors: string[]; export: unknown }>("/blueprint", { bp, fmt });
  const errs = q.data?.errors ?? []; const exp = q.data ? JSON.stringify(q.data.export, null, 2) : "";
  const patch = (p: Partial<Agent>) => setBp((b) => ({ ...b, agents: b.agents.map((x) => (x.id === sel ? { ...x, ...p } : x)) }));
  const addAgent = () => { const id = uid(); const n = bp.agents.length; setBp((b) => ({ ...b, agents: [...b.agents, { id, name: `Agent ${n + 1}`, role: "", instructions: "", tools: [], maxSteps: 5, needsApproval: false, x: 16 + (n % 3) * 216, y: 24 + (Math.floor(n / 3) * 120) % 360 }] })); setSel(id); announce(`Added Agent ${n + 1}`); requestAnimationFrame(() => document.getElementById("bp-name")?.focus()); };
  useProAction((id) => { if (id === "add-agent") addAgent(); });
  const nm = (id: string) => bp.agents.find((x) => x.id === id)?.name ?? "missing agent";
  const pos = new Map(bp.agents.map((x) => [x.id, x]));
  const panel = (<div className="ps-stack">
    <h3 className="ps-h3">Checks</h3>
    <ul className="ps-checks" data-testid="bp-checks">{!q.data ? <li className="ps-hint" role="status">{q.error || "Checking on SPE Pro…"}</li> : errs.length ? errs.map((e, i) => <li key={i} className="ps-q ps-q--bad"><i aria-hidden="true">×</i><div><b><span className="sr-only">Problem: </span>{e}</b></div></li>) : <li className="ps-q ps-q--ok"><i aria-hidden="true">✓</i><div><b>No problems found.</b></div></li>}</ul>
    <h3 className="ps-h3">Export draft config</h3>
    <div className="ps-seg" role="group" aria-label="Export format">{(Object.keys(EXP) as (keyof typeof EXP)[]).map((k) => <button key={k} type="button" aria-pressed={fmt === k} onClick={() => setFmt(k)}>{EXP[k]}</button>)}</div>
    <p className="ps-hint">{DRAFT_NOTE}</p>
    <pre className="ps-pre ps-pre--sm" tabIndex={0} aria-label="Exported config">{exp}</pre>
    <div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" disabled={!exp} onClick={async () => announce((await copyText(exp)) ? "Draft config copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" disabled={!exp} onClick={() => { download(`blueprint-${fmt}-draft.json`, exp); log("export.blueprint", fmt); }}>Download</button></div>
  </div>);
  return (
    <ToolFrame id="blueprint" panel={panel} panelLabel="Checks & export" actions={<><button type="button" className="ps-btn" onClick={() => { setBp(exampleBlueprint()); setSel("triage"); announce("Example restored"); }}>Reset example</button><button type="button" className="ps-btn ps-btn--primary" onClick={addAgent}>Add agent</button></>}>
      <div className="ps-field"><label htmlFor="bp-title">Blueprint name</label><input id="bp-title" className="ps-inp" value={bp.name} onChange={(e) => setBp((b) => ({ ...b, name: e.target.value }))} /></div>
      <div className="ps-canvas" role="group" aria-label="Agent map. Select an agent to edit it.">
        <svg className="ps-edges" viewBox="0 0 640 400" preserveAspectRatio="xMinYMin meet" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
          {bp.handoffs.map((h, i) => { const f = pos.get(h.from), t = pos.get(h.to); if (!f || !t || f === t) return null; const x1 = f.x + W, y1 = f.y + H / 2, x2 = t.x, y2 = t.y + H / 2, mx = (x1 + x2) / 2; return <path key={i} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2 - 4} ${y2}`} fill="none" stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arr)" />; })}
          {bp.agents.map((x) => <foreignObject key={x.id} x={x.x} y={x.y} width={W} height={H}><button type="button" className="ps-node" aria-pressed={x.id === sel} onClick={() => setSel(x.id)}><b>{x.name}</b><small>{x.tools.length} tools · {x.maxSteps} steps{x.needsApproval ? " · approval" : ""}</small></button></foreignObject>)}
        </svg>
      </div>
      <ul className="ps-agentlist" aria-label="Agents">{bp.agents.map((x) => <li key={x.id}><button type="button" className="ps-chip" aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>{x.name}</button></li>)}</ul>
      {a ? (<form className="ps-form" onSubmit={(e) => e.preventDefault()} aria-label={`Edit ${a.name}`}>
        <div className="ps-cols"><div className="ps-field"><label htmlFor="bp-name">Name</label><input id="bp-name" className="ps-inp" value={a.name} onChange={(e) => patch({ name: e.target.value })} /></div>
          <div className="ps-field"><label htmlFor="bp-steps">Step limit (1–100)</label><input id="bp-steps" className="ps-inp" type="number" min={1} max={100} value={a.maxSteps} onChange={(e) => patch({ maxSteps: parseInt(e.target.value, 10) || 0 })} /></div></div>
        <div className="ps-field"><label htmlFor="bp-role">Role</label><input id="bp-role" className="ps-inp" value={a.role} onChange={(e) => patch({ role: e.target.value })} /></div>
        <div className="ps-field"><label htmlFor="bp-ins">Instructions</label><textarea id="bp-ins" className="ps-ta" rows={3} value={a.instructions} onChange={(e) => patch({ instructions: e.target.value })} /></div>
        <fieldset className="ps-fieldset"><legend>Tools it may use</legend>{Object.entries(AGENT_TOOLS).map(([k, d]) => <label key={k} className="ps-opt"><input type="checkbox" checked={a.tools.includes(k)} onChange={(e) => patch({ tools: e.target.checked ? [...a.tools, k] : a.tools.filter((t) => t !== k) })} /><span><code>{k}</code>{RISKY.has(k) && <em className="ps-tag">changes things</em>}<small>{d}</small></span></label>)}</fieldset>
        <label className="ps-opt"><input type="checkbox" checked={a.needsApproval} onChange={(e) => patch({ needsApproval: e.target.checked })} /><span>Ask a human before acting</span></label>
        <button type="button" className="ps-btn ps-btn--danger" onClick={() => { setBp((b) => ({ ...b, agents: b.agents.filter((x) => x.id !== a.id), handoffs: b.handoffs.filter((h) => h.from !== a.id && h.to !== a.id) })); setSel(bp.agents.find((x) => x.id !== a.id)?.id ?? ""); announce(`Removed ${a.name} and its handoffs`); }}>Remove agent</button>
      </form>) : <p className="ps-hint">No agent selected.</p>}
      <h2 className="ps-h3">Handoffs</h2>
      <form className="ps-row ps-wrap" onSubmit={(e) => { e.preventDefault(); const from = hf || bp.agents[0]?.id, to = ht || bp.agents[1]?.id; if (!from || !to || from === to) { announce("Pick two different agents."); return; } setBp((b) => ({ ...b, handoffs: [...b.handoffs, { from, to, when: hw.trim() || "needed" }] })); setHw(""); announce("Handoff added"); }}>
        <label className="ps-inline">From <select className="ps-inp ps-inp--auto" value={hf || bp.agents[0]?.id} onChange={(e) => setHf(e.target.value)}>{bp.agents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="ps-inline">To <select className="ps-inp ps-inp--auto" value={ht || bp.agents[1]?.id} onChange={(e) => setHt(e.target.value)}>{bp.agents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="ps-inline">When <input className="ps-inp" value={hw} onChange={(e) => setHw(e.target.value)} placeholder="e.g. a refund is requested" /></label>
        <button type="submit" className="ps-btn">Add handoff</button>
      </form>
      <ul className="ps-list">{bp.handoffs.length ? bp.handoffs.map((h, i) => <li key={i} className="ps-li"><div><b>{nm(h.from)} → {nm(h.to)}</b><small>When {h.when}</small></div><button type="button" className="ps-btn ps-btn--sm" aria-label={`Remove handoff from ${nm(h.from)} to ${nm(h.to)}`} onClick={() => setBp((b) => ({ ...b, handoffs: b.handoffs.filter((_, j) => j !== i) }))}>Remove</button></li>) : <li className="ps-hint">No handoffs yet.</li>}</ul>
    </ToolFrame>
  );
}
