import { useMemo, useRef, useState } from "react";
import { proApi, useProQuery } from "../api.ts";
import { usePro, useProAction, download, copyText } from "../context.ts";
import { ToolFrame, Checks } from "./Frame.tsx";
import { Icon } from "../icons.tsx";
import { type Block, type Kind, type PlainBlock, type Q, type Version, KINDS, LABEL, HINT, uid, plain, withIds, reqText, MAX_FILE, EXAMPLE, STARTER } from "../shared/constants.ts";
import type { Template } from "../core/templates.ts";
import { newSession, sessionTitle, plainBlocks as pb, type Session } from "../shared/workspace.ts";

interface Analysis { assembled: string; output: string; checks: Q[]; summary: string; vars: [string, number][]; tokens: number; words: number }
type DiffOp = { t: "eq" | "add" | "del"; s: string };
const varsIn = (t: string) => [...new Set([...t.matchAll(/\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g)].map((m) => m[1]))];

export default function PromptStudio() {
  const { active, updateSession, createSession, announce, log } = usePro();
  const [tab, setTab] = useState<"edit" | "ver" | "ab">("edit");
  const [tplOpen, setTplOpen] = useState(false);
  const [importErr, setImportErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const tplRef = useRef<HTMLDialogElement>(null);
  const openTpl = () => { setTplOpen(true); requestAnimationFrame(() => { tplRef.current?.showModal(); document.getElementById("ps-tpl-filter")?.focus(); }); };
  const s = active;
  const up = (fn: (x: Session) => Session) => { if (s) updateSession(s.id, fn); };
  const saveVersion = (note?: string) => {
    if (!s) return; const n = (note ?? window.prompt("Version note", `Snapshot ${s.versions.length + 1}`))?.trim(); if (n === undefined) return;
    up((x) => ({ ...x, versions: [...x.versions, { id: uid(), note: n || `Snapshot ${x.versions.length + 1}`, at: new Date().toISOString(), blocks: x.blocks.map(({ id: _i, ...b }) => plain(b)), variables: { ...x.vars } }] }));
    announce(`Saved version ${s.versions.length + 1}`); log("version.save", `${sessionTitle(s)} · v${s.versions.length + 1}`);
  };
  const exportSpe = async () => { if (!s) return; try { const { file } = await proApi<{ file: unknown }>("/studio/export", { name: sessionTitle(s), blocks: pb(s.blocks), versions: s.versions, vars: s.vars, mode: s.mode }); download(`${sessionTitle(s).replace(/\W+/g, "-").toLowerCase().slice(0, 40) || "prompt"}.spe`, JSON.stringify(file, null, 2)); announce("Exported .spe file"); } catch (e) { announce((e as Error).message); } };
  useProAction((id) => {
    if (id === "templates") openTpl();
    if (id === "import") fileRef.current?.click();
    if (id === "export") void exportSpe();
    if (id === "save-version") saveVersion(`Snapshot ${(s?.versions.length ?? 0) + 1}`);
  });
  const onImport = async (f: File) => {
    try {
      if (!/\.(spe|json)$/i.test(f.name)) throw new Error(`“${f.name}” is not a .spe file.`);
      if (f.size > MAX_FILE) throw new Error(`“${f.name}” is larger than 5 MB.`);
      if (f.size > 1.9 * 1024 * 1024) throw new Error(`“${f.name}” is larger than the 2 MB request limit.`);
      const d = await proApi<{ name: string; blocks: PlainBlock[]; versions: Version[]; vars: Record<string, string>; mode: "template" | "filled" }>("/studio/import", { raw: await f.text(), name: f.name });
      const ns = newSession(d.blocks, d.name); ns.vars = d.vars; ns.mode = d.mode; ns.versions = d.versions.map((v) => ({ ...v, id: uid() }));
      setImportErr(""); createSession(ns); announce(`Imported ${f.name} as a new session`);
    } catch (e) { const m = `Import failed: ${(e as Error).message} Nothing was changed.`; setImportErr(m); announce(m); }
  };
  const fileInput = <input ref={fileRef} type="file" accept=".spe,.json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />;

  if (!s) return (
    <ToolFrame id="studio" actions={<><button type="button" className="ps-btn" onClick={openTpl}>Templates</button><button type="button" className="ps-btn" onClick={() => fileRef.current?.click()}>Import .spe</button></>}>
      {fileInput}
      <div className="ps-empty ps-empty--inline" data-testid="studio-empty"><h2>No session open</h2><p>Start blank, load the example, or pick a template.</p>
        <div className="ps-row"><button type="button" className="ps-btn ps-btn--primary" onClick={() => createSession(newSession(STARTER))}>Starter blocks</button><button type="button" className="ps-btn" onClick={() => createSession(newSession(EXAMPLE, "Billing assistant example"))}>Load example</button><button type="button" className="ps-btn" onClick={openTpl}>Templates</button></div>
        {importErr && <p className="ps-err" role="alert">{importErr}</p>}</div>
      {tplOpen && <TemplateDialog dref={tplRef} onClose={() => { tplRef.current?.close(); setTplOpen(false); }} onUse={(bs, name) => { createSession(newSession(bs, name)); tplRef.current?.close(); setTplOpen(false); announce(`Started from template ${name}`); log("template.use", name); }} />}
    </ToolFrame>
  );

  return <StudioBody s={s} up={up} tab={tab} setTab={setTab} openTpl={openTpl} fileRef={fileRef} fileInput={fileInput} importErr={importErr} saveVersion={saveVersion} exportSpe={exportSpe}
    tpl={tplOpen && <TemplateDialog dref={tplRef} onClose={() => { tplRef.current?.close(); setTplOpen(false); }} onUse={(bs, name) => {
      if (s.blocks.some((b) => b.text.trim())) { if (!window.confirm(`Replace this session with “${name}”? The current draft is saved as a version first.`)) return; saveVersion(`Before template: ${name}`); }
      up((x) => ({ ...x, blocks: withIds(bs), vars: {} })); tplRef.current?.close(); setTplOpen(false); announce(`Loaded template ${name}`); log("template.use", name);
    }} />} />;
}

function StudioBody({ s, up, tab, setTab, openTpl, fileRef, fileInput, importErr, saveVersion, exportSpe, tpl }: { s: Session; up: (fn: (x: Session) => Session) => void; tab: "edit" | "ver" | "ab"; setTab: (t: "edit" | "ver" | "ab") => void; openTpl: () => void; fileRef: React.RefObject<HTMLInputElement>; fileInput: React.ReactNode; importErr: string; saveVersion: (n?: string) => void; exportSpe: () => Promise<void>; tpl: React.ReactNode }) {
  const { announce } = usePro();
  const setBlocks = (bs: Block[]) => up((x) => ({ ...x, blocks: bs }));
  const q = useProQuery<Analysis>("/studio/analyze", { blocks: pb(s.blocks), vars: s.vars, mode: s.mode }, { debounce: 250 });
  const a = q.data; const out = a?.output ?? ""; const vs = a?.vars ?? [];
  const panel = (
    <div className="ps-stack">
      <div className="ps-seg" role="group" aria-label="Preview mode">{(["template", "filled"] as const).map((m) => <button key={m} type="button" aria-pressed={s.mode === m} onClick={() => up((x) => ({ ...x, mode: m }))}>{m === "template" ? "Template" : "Filled"}</button>)}</div>
      <pre className="ps-pre ps-preview" data-testid="studio-preview" tabIndex={0} aria-label="Assembled prompt preview">{out || (q.loading && !a ? "Analysing on SPE Pro…" : "Your assembled prompt appears here as you type.")}</pre>
      {q.error && <p className="ps-err" role="alert">{q.error}</p>}
      <p className="ps-hint" aria-live="polite">{s.blocks.length} blocks · {a?.words ?? 0} words · ~{a?.tokens ?? 0} tokens{q.loading && a ? " · updating…" : ""}</p>
      <h3 className="ps-h3">Variables</h3>
      {vs.length ? <ul className="ps-vars">{vs.map(([n, c]) => <li key={n}><label htmlFor={`v-${n}`}><code>{`{{${n}}}`}</code> <small>{c}×</small></label><input id={`v-${n}`} className="ps-inp" value={s.vars[n] ?? ""} maxLength={20000} placeholder={`Value for ${n}`} onChange={(e) => up((x) => { const v = { ...x.vars }; if (e.target.value) v[n] = e.target.value; else delete v[n]; return { ...x, vars: v }; })} /></li>)}</ul> : <p className="ps-hint">Type {"{{name}}"} in any block to add a variable.</p>}
      <h3 className="ps-h3">Static checks <small>{a?.summary ?? ""}</small></h3>
      <Checks qs={a?.checks ?? []} />
    </div>
  );
  return (
    <ToolFrame id="studio" panel={panel} panelLabel="Preview & checks" actions={<>
      <button type="button" className="ps-btn" onClick={openTpl}>Templates</button>
      <button type="button" className="ps-btn" onClick={() => fileRef.current?.click()}>Import</button>
      <button type="button" className="ps-btn" onClick={() => void exportSpe()}>Export .spe</button>
      <button type="button" className="ps-btn" onClick={async () => announce((await copyText(out)) ? "Prompt copied" : "Copy was blocked; select the preview text instead")}>Copy</button>
      <button type="button" className="ps-btn ps-btn--primary" onClick={() => saveVersion()}>Save version</button></>}>
      {fileInput}
      {importErr && <p className="ps-err" role="alert">{importErr}</p>}
      <div className="ps-field ps-field--title"><label htmlFor="ps-s-title">Session title</label><input id="ps-s-title" className="ps-inp" value={s.title} placeholder={sessionTitle({ ...s, title: "" })} maxLength={120} onChange={(e) => up((x) => ({ ...x, title: e.target.value }))} /></div>
      <div role="tablist" aria-label="Prompt Studio views" className="ps-tabs">
        {([["edit", "Edit"], ["ver", `Versions (${s.versions.length})`], ["ab", "Compare"]] as const).map(([k, l], i, arr) => (
          <button key={k} id={`ps-tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls={`ps-tp-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}
            onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = arr[(i + (e.key === "ArrowRight" ? 1 : arr.length - 1)) % arr.length][0]; setTab(n); document.getElementById(`ps-tab-${n}`)?.focus(); } }}>{l}</button>))}
      </div>
      <div role="tabpanel" id={`ps-tp-${tab}`} aria-labelledby={`ps-tab-${tab}`}>
        {tab === "edit" && <Editor blocks={s.blocks} setBlocks={setBlocks} announce={announce} />}
        {tab === "ver" && <Versions s={s} up={up} announce={announce} />}
        {tab === "ab" && <Compare s={s} />}
      </div>
      {tpl}
    </ToolFrame>
  );
}

function Editor({ blocks, setBlocks, announce }: { blocks: Block[]; setBlocks: (b: Block[]) => void; announce: (m: string) => void }) {
  const [kind, setKind] = useState<Kind>("rules");
  const move = (i: number, j: number) => { if (j < 0 || j >= blocks.length) return; const b = [...blocks]; const [x] = b.splice(i, 1); b.splice(j, 0, x); setBlocks(b); announce(`${x.title} moved to position ${j + 1} of ${b.length}`); requestAnimationFrame(() => document.getElementById(`h-${x.id}`)?.focus()); };
  const patch = (id: string, p: Partial<Block>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const add = () => { const b: Block = kind === "requirements" ? { id: uid(), kind, title: LABEL[kind], text: "", must: [], mustNot: [] } : { id: uid(), kind, title: LABEL[kind], text: "" }; setBlocks([...blocks, b]); announce(`${b.title} block added`); requestAnimationFrame(() => document.getElementById(`x-${b.id}`)?.focus()); };
  return (
    <div className="ps-editor">
      {blocks.length === 0 && <p className="ps-hint">No blocks yet. Add one below.</p>}
      <ol className="ps-blocks" aria-label="Prompt blocks">
        {blocks.map((b, i) => (
          <li key={b.id} className="ps-blk" data-k={b.kind}>
            <div className="ps-blk-bar">
              <button type="button" id={`h-${b.id}`} className="ps-iconbtn ps-iconbtn--sm ps-handle" aria-label={`${b.title || LABEL[b.kind]}, position ${i + 1} of ${blocks.length}. Alt plus arrow keys to move.`} onKeyDown={(e) => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); move(i, e.key === "ArrowUp" ? i - 1 : i + 1); } }}>⠿</button>
              <span className="ps-blk-k">{LABEL[b.kind]}</span>
              <label className="sr-only" htmlFor={`t-${b.id}`}>Block title</label>
              <input id={`t-${b.id}`} className="ps-blk-title" value={b.title} maxLength={80} onChange={(e) => patch(b.id, { title: e.target.value })} />
              <button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Move ${b.title} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
              <button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Move ${b.title} down`} disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}>↓</button>
              <button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Remove ${b.title} block`} onClick={() => { setBlocks(blocks.filter((x) => x.id !== b.id)); announce(`${b.title} removed`); }}><Icon name="close" size={14} /></button>
            </div>
            {b.kind === "requirements" ? <ReqEditor b={b} patch={(p) => patch(b.id, p)} /> : <><label className="sr-only" htmlFor={`x-${b.id}`}>{b.title} content</label><textarea id={`x-${b.id}`} className="ps-ta" rows={Math.min(12, Math.max(3, b.text.split("\n").length + 1))} placeholder={HINT[b.kind]} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} /></>}
          </li>))}
      </ol>
      <div className="ps-row ps-addrow"><label htmlFor="ps-add-kind" className="sr-only">Block type</label><select id="ps-add-kind" className="ps-inp ps-inp--auto" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{KINDS.map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</select><button type="button" className="ps-btn" onClick={add}><Icon name="plus" size={14} /> Add block</button></div>
    </div>
  );
}
function ReqEditor({ b, patch }: { b: Block; patch: (p: Partial<Block>) => void }) {
  const [nw, setNw] = useState({ must: "", mustNot: "" });
  const set = (k: "must" | "mustNot", list: string[]) => { const n = { must: b.must ?? [], mustNot: b.mustNot ?? [], [k]: list }; patch({ ...n, text: reqText(n.must, n.mustNot) }); };
  return (<div className="ps-req">{(["must", "mustNot"] as const).map((k) => { const lab = k === "must" ? "Must follow" : "Must not"; const items = b[k] ?? []; return (
    <fieldset key={k} className="ps-req-list"><legend>{lab}</legend>
      <ul>{items.map((t, j) => <li key={j}><label className="sr-only" htmlFor={`rq-${b.id}-${k}-${j}`}>{lab} item {j + 1}</label><input id={`rq-${b.id}-${k}-${j}`} className="ps-inp" value={t} maxLength={2000} onChange={(e) => set(k, items.map((x, y) => (y === j ? e.target.value : x)))} /><button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Remove ${lab} item ${j + 1}`} onClick={() => set(k, items.filter((_, y) => y !== j))}><Icon name="close" size={13} /></button></li>)}</ul>
      <div className="ps-row"><label className="sr-only" htmlFor={`rq-${b.id}-${k}-new`}>Add {lab} item</label><input id={`rq-${b.id}-${k}-new`} className="ps-inp" value={nw[k]} maxLength={2000} placeholder={k === "must" ? "e.g. Work fully offline" : "e.g. collect analytics"} onChange={(e) => setNw({ ...nw, [k]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (nw[k].trim()) { set(k, [...items, nw[k]]); setNw({ ...nw, [k]: "" }); } } }} /><button type="button" className="ps-btn ps-btn--sm" onClick={() => { if (nw[k].trim()) { set(k, [...items, nw[k]]); setNw({ ...nw, [k]: "" }); } }}>Add</button></div>
    </fieldset>); })}</div>);
}
function Versions({ s, up, announce }: { s: Session; up: (fn: (x: Session) => Session) => void; announce: (m: string) => void }) {
  const src = useMemo(() => [{ id: "draft", label: "Current draft", blocks: s.blocks as PlainBlock[] }, ...s.versions.map((v, i) => ({ id: v.id, label: `v${i + 1} · ${v.note}`, blocks: v.blocks }))], [s]);
  const [from, setFrom] = useState(s.versions[s.versions.length - 1]?.id ?? "draft"); const [to, setTo] = useState("draft");
  const get = (id: string) => (src.find((x) => x.id === id) ?? src[0]).blocks;
  const dq = useProQuery<{ ops: DiffOp[]; add: number; del: number; intentLoss: string[] }>("/studio/diff", { a: get(from), b: get(to) });
  const sq = useProQuery<{ summaries: string[] }>("/studio/summaries", { versions: s.versions.map((v) => ({ blocks: v.blocks, variables: v.variables })) }, { enabled: s.versions.length > 0 });
  const ops = dq.data?.ops ?? []; const add = dq.data?.add ?? 0, del = dq.data?.del ?? 0; const loss = dq.data?.intentLoss ?? [];
  return (<div className="ps-stack">
    {s.versions.length === 0 ? <p className="ps-hint">No versions yet. Use “Save version” to start a history.</p> :
      <ul className="ps-list">{[...s.versions].map((v, i) => ({ v, i })).reverse().map(({ v, i }) => <li key={v.id} className="ps-li"><div><b>v{i + 1} · {v.note}</b><small>{new Date(v.at).toLocaleString()} · {v.blocks.length} blocks{sq.data?.summaries[i] ? ` · ${sq.data.summaries[i]}` : ""}</small></div>
        <div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={() => { up((x) => ({ ...x, blocks: withIds(v.blocks), vars: v.variables ? { ...v.variables } : x.vars })); announce(`Restored v${i + 1}`); }}>Restore</button><button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Delete v${i + 1}`} onClick={() => { up((x) => ({ ...x, versions: x.versions.filter((y) => y.id !== v.id) })); announce("Version deleted"); }}><Icon name="trash" size={14} /></button></div></li>)}</ul>}
    <h3 className="ps-h3">Line diff</h3>
    <div className="ps-row"><label className="ps-inline">From <select className="ps-inp ps-inp--auto" value={from} onChange={(e) => setFrom(e.target.value)}>{src.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label className="ps-inline">To <select className="ps-inp ps-inp--auto" value={to} onChange={(e) => setTo(e.target.value)}>{src.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label></div>
    <p className="ps-hint" data-testid="diff-sum" aria-live="polite">{!dq.data ? (dq.error || "Comparing on SPE Pro…") : add || del ? `+${add} lines added · −${del} lines removed` : "No differences."}</p>
    {loss.length > 0 && <div className="ps-verdict ps-verdict--bad" role="alert" data-testid="intent-loss"><b>Intent loss: the “To” version drops {loss.length} requirement{loss.length > 1 ? "s" : ""}</b><ul>{loss.map((x) => <li key={x}>{x}</li>)}</ul><p className="ps-hint">If this was not on purpose, restore the earlier version or add the requirement back.</p></div>}
    <pre className="ps-pre ps-diff">{ops.map((o, k) => o.t === "eq" ? <span key={k} className="eq">{o.s || " "}{"\n"}</span> : o.t === "add" ? <ins key={k}><span className="sr-only">Added: </span>{o.s || " "}{"\n"}</ins> : <del key={k}><span className="sr-only">Removed: </span>{o.s || " "}{"\n"}</del>)}</pre>
  </div>);
}
function Compare({ s }: { s: Session }) {
  const src = [{ id: "draft", label: "Current draft", blocks: s.blocks as PlainBlock[] }, ...s.versions.map((v, i) => ({ id: v.id, label: `v${i + 1} · ${v.note}`, blocks: v.blocks }))];
  const [a, setA] = useState(s.versions[s.versions.length - 1]?.id ?? "draft"); const [b, setB] = useState("draft");
  const get = (id: string) => (src.find((x) => x.id === id) ?? src[0]).blocks;
  const cq = useProQuery<{ a: { text: string; tokens: number; summary: string; checks: Q[] }; b: { text: string; tokens: number; summary: string; checks: Q[] } }>("/studio/compare", { a: get(a), b: get(b) });
  const ra = cq.data?.a, rb = cq.data?.b; const ta = ra?.tokens ?? 0, tb = rb?.tokens ?? 0;
  return (<div className="ps-stack"><p className="ps-hint">Static checks only. No outcome or model evaluation, so neither version is ranked.</p>
    {cq.error && <p className="ps-err" role="alert">{cq.error}</p>}
    <div className="ps-cols">{([["A", a, setA, ra], ["B", b, setB, rb]] as const).map(([n, v, set, r]) => <div key={n} className="ps-card ps-card--flat"><label className="ps-inline">Version {n} <select className="ps-inp ps-inp--auto" value={v} onChange={(e) => set(e.target.value)}>{src.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label><p className="ps-hint">{r ? `${r.summary} · ~${r.tokens} tokens` : "Loading…"}</p><pre className="ps-pre ps-pre--sm">{r?.text || "(empty)"}</pre><Checks qs={r?.checks ?? []} /></div>)}</div>
    <p className="ps-hint">Version B is {tb - ta >= 0 ? "+" : ""}{tb - ta} tokens vs version A.</p></div>);
}
function TemplateDialog({ dref, onClose, onUse }: { dref: React.RefObject<HTMLDialogElement>; onClose: () => void; onUse: (bs: PlainBlock[], name: string) => void }) {
  const [q, setQ] = useState("");
  const tq = useProQuery<{ templates: Template[] }>("/templates", undefined, { debounce: 0 });
  const TEMPLATES = tq.data?.templates ?? [];
  const list = TEMPLATES.filter((t) => !q.trim() || (t.name + " " + t.purpose).toLowerCase().includes(q.trim().toLowerCase()));
  return (<dialog ref={dref} className="ps-dialog ps-dialog--wide" aria-labelledby="ps-tpl-h" onClose={onClose} onCancel={onClose}>
    <div className="ps-dialog-in"><div className="ps-dialog-head"><h2 id="ps-tpl-h">Templates</h2><button type="button" className="ps-iconbtn" onClick={onClose} aria-label="Close templates"><Icon name="close" /></button></div>
      <label htmlFor="ps-tpl-filter" className="sr-only">Filter templates</label><input id="ps-tpl-filter" className="ps-inp" placeholder="Filter templates" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="ps-hint" role="status">{tq.data ? `${list.length} of ${TEMPLATES.length} templates` : tq.error || "Loading templates from SPE Pro…"}</p>
      <ul className="ps-tpl">{list.map((t) => <li key={t.id} className="ps-card ps-card--flat"><h3 className="ps-h3">{t.name}</h3><p className="ps-hint">{t.purpose}</p><p className="ps-hint">Variables: <code>{varsIn(t.blocks.map((b) => (b.kind === "requirements" ? reqText(b.must ?? [], b.mustNot ?? []) : b.text)).join("\n")).map((n) => `{{${n}}}`).join(", ") || "none"}</code></p><button type="button" className="ps-btn ps-btn--sm ps-btn--primary" onClick={() => onUse(t.blocks.map((b) => plain(b)), t.name)}>Use template</button></li>)}</ul>
    </div></dialog>);
}
