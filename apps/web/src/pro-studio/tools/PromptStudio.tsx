import { useMemo, useRef, useState } from "react";
import { usePro, useProAction, download, copyText } from "../context.ts";
import { ToolFrame, Checks } from "./Frame.tsx";
import { Icon } from "../icons.tsx";
import { type Block, type Kind, type PlainBlock, KINDS, LABEL, HINT, uid, plain, withIds, reqText, assemble, check, detSummary, findVars, filled, tokens, lineDiff, fromSpe, parseSpeJson, toSpe, cleanVars, MAX_FILE, EXAMPLE, STARTER } from "../core/studio.ts";
import { TEMPLATES } from "../core/templates.ts";
import { newSession, sessionTitle, type Session } from "../core/workspace.ts";

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
  const setBlocks = (bs: Block[]) => up((x) => ({ ...x, blocks: bs }));
  const saveVersion = (note?: string) => {
    if (!s) return; const n = (note ?? window.prompt("Version note", `Snapshot ${s.versions.length + 1}`))?.trim(); if (n === undefined) return;
    up((x) => ({ ...x, versions: [...x.versions, { id: uid(), note: n || `Snapshot ${x.versions.length + 1}`, at: new Date().toISOString(), blocks: x.blocks.map(({ id: _i, ...b }) => plain(b)), variables: { ...x.vars } }] }));
    announce(`Saved version ${s.versions.length + 1}`); log("version.save", `${sessionTitle(s)} · v${s.versions.length + 1}`);
  };
  const exportSpe = () => { if (!s) return; const f = toSpe(sessionTitle(s), s.blocks.map(({ id: _i, ...b }) => b), s.versions, s.vars, s.mode); download(`${sessionTitle(s).replace(/\W+/g, "-").toLowerCase().slice(0, 40) || "prompt"}.spe`, JSON.stringify(f, null, 2)); announce("Exported .spe file"); log("export.spe", sessionTitle(s)); };
  useProAction((id) => {
    if (id === "templates") openTpl();
    if (id === "import") fileRef.current?.click();
    if (id === "export") exportSpe();
    if (id === "save-version") saveVersion(`Snapshot ${(s?.versions.length ?? 0) + 1}`);
  });
  const onImport = async (f: File) => {
    try {
      if (!/\.(spe|json)$/i.test(f.name)) throw new Error(`“${f.name}” is not a .spe file.`);
      if (f.size > MAX_FILE) throw new Error(`“${f.name}” is larger than 5 MB.`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = parseSpeJson(await f.text(), f.name); const bs = fromSpe(d);
      const ns = newSession(bs, String(d.name ?? "").slice(0, 120));
      ns.vars = cleanVars(d.variables); ns.mode = d.mode === "filled" ? "filled" : "template";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ns.versions = Array.isArray(d.versions) ? d.versions.slice(0, 100).map((v: any, i: number) => { try { return { id: uid(), note: String(v.note || "Imported").slice(0, 80), at: String(v.at || new Date().toISOString()), blocks: fromSpe({ format: "spe.prompt", version: 1, blocks: v.blocks }), variables: cleanVars(v.variables) }; } catch (e) { throw new Error(`Version ${i + 1}: ${(e as Error).message}`); } }) : [];
      setImportErr(""); createSession(ns); announce(`Imported ${f.name} as a new session`); log("import.spe", f.name);
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

  const plainBlocks: PlainBlock[] = s.blocks;
  const text = assemble(plainBlocks); const out = s.mode === "filled" ? filled(text, s.vars) : text;
  const qs = check(plainBlocks, s.vars); const vs = findVars(text);
  const panel = (
    <div className="ps-stack">
      <div className="ps-seg" role="group" aria-label="Preview mode">{(["template", "filled"] as const).map((m) => <button key={m} type="button" aria-pressed={s.mode === m} onClick={() => up((x) => ({ ...x, mode: m }))}>{m === "template" ? "Template" : "Filled"}</button>)}</div>
      <pre className="ps-pre ps-preview" data-testid="studio-preview" tabIndex={0} aria-label="Assembled prompt preview">{out || "Your assembled prompt appears here as you type."}</pre>
      <p className="ps-hint">{s.blocks.length} blocks · {text ? text.split(/\s+/).filter(Boolean).length : 0} words · ~{tokens(text)} tokens</p>
      <h3 className="ps-h3">Variables</h3>
      {vs.length ? <ul className="ps-vars">{vs.map(([n, c]) => <li key={n}><label htmlFor={`v-${n}`}><code>{`{{${n}}}`}</code> <small>{c}×</small></label><input id={`v-${n}`} className="ps-inp" value={s.vars[n] ?? ""} maxLength={20000} placeholder={`Value for ${n}`} onChange={(e) => up((x) => { const v = { ...x.vars }; if (e.target.value) v[n] = e.target.value; else delete v[n]; return { ...x, vars: v }; })} /></li>)}</ul> : <p className="ps-hint">Type {"{{name}}"} in any block to add a variable.</p>}
      <h3 className="ps-h3">Static checks <small>{detSummary(plainBlocks, s.vars)}</small></h3>
      <Checks qs={qs} />
    </div>
  );
  return (
    <ToolFrame id="studio" panel={panel} panelLabel="Preview & checks" actions={<>
      <button type="button" className="ps-btn" onClick={openTpl}>Templates</button>
      <button type="button" className="ps-btn" onClick={() => fileRef.current?.click()}>Import</button>
      <button type="button" className="ps-btn" onClick={exportSpe}>Export .spe</button>
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
      {tplOpen && <TemplateDialog dref={tplRef} onClose={() => { tplRef.current?.close(); setTplOpen(false); }} onUse={(bs, name) => {
        if (s.blocks.some((b) => b.text.trim())) { if (!window.confirm(`Replace this session with “${name}”? The current draft is saved as a version first.`)) return; saveVersion(`Before template: ${name}`); }
        up((x) => ({ ...x, blocks: withIds(bs), vars: {} })); tplRef.current?.close(); setTplOpen(false); announce(`Loaded template ${name}`); log("template.use", name);
      }} />}
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
  const ops = lineDiff(assemble(get(from)), assemble(get(to))); const add = ops.filter((o) => o.t === "add").length, del = ops.filter((o) => o.t === "del").length;
  return (<div className="ps-stack">
    {s.versions.length === 0 ? <p className="ps-hint">No versions yet. Use “Save version” to start a history.</p> :
      <ul className="ps-list">{[...s.versions].map((v, i) => ({ v, i })).reverse().map(({ v, i }) => <li key={v.id} className="ps-li"><div><b>v{i + 1} · {v.note}</b><small>{new Date(v.at).toLocaleString()} · {v.blocks.length} blocks · {detSummary(v.blocks, v.variables)}</small></div>
        <div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={() => { up((x) => ({ ...x, blocks: withIds(v.blocks), vars: v.variables ? { ...v.variables } : x.vars })); announce(`Restored v${i + 1}`); }}>Restore</button><button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Delete v${i + 1}`} onClick={() => { up((x) => ({ ...x, versions: x.versions.filter((y) => y.id !== v.id) })); announce("Version deleted"); }}><Icon name="trash" size={14} /></button></div></li>)}</ul>}
    <h3 className="ps-h3">Line diff</h3>
    <div className="ps-row"><label className="ps-inline">From <select className="ps-inp ps-inp--auto" value={from} onChange={(e) => setFrom(e.target.value)}>{src.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label className="ps-inline">To <select className="ps-inp ps-inp--auto" value={to} onChange={(e) => setTo(e.target.value)}>{src.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label></div>
    <p className="ps-hint" data-testid="diff-sum">{add || del ? `+${add} lines added · −${del} lines removed` : "No differences."}</p>
    <pre className="ps-pre ps-diff">{ops.map((o, k) => o.t === "eq" ? <span key={k} className="eq">{o.s || " "}{"\n"}</span> : o.t === "add" ? <ins key={k}><span className="sr-only">Added: </span>{o.s || " "}{"\n"}</ins> : <del key={k}><span className="sr-only">Removed: </span>{o.s || " "}{"\n"}</del>)}</pre>
  </div>);
}
function Compare({ s }: { s: Session }) {
  const src = [{ id: "draft", label: "Current draft", blocks: s.blocks as PlainBlock[] }, ...s.versions.map((v, i) => ({ id: v.id, label: `v${i + 1} · ${v.note}`, blocks: v.blocks }))];
  const [a, setA] = useState(s.versions[s.versions.length - 1]?.id ?? "draft"); const [b, setB] = useState("draft");
  const get = (id: string) => (src.find((x) => x.id === id) ?? src[0]).blocks;
  const ta = tokens(assemble(get(a))), tb = tokens(assemble(get(b)));
  return (<div className="ps-stack"><p className="ps-hint">Static checks only. No outcome or model evaluation, so neither version is ranked.</p>
    <div className="ps-cols">{([["A", a, setA, ta], ["B", b, setB, tb]] as const).map(([n, v, set, t]) => <div key={n} className="ps-card ps-card--flat"><label className="ps-inline">Version {n} <select className="ps-inp ps-inp--auto" value={v} onChange={(e) => set(e.target.value)}>{src.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label><p className="ps-hint">{detSummary(get(v))} · ~{t} tokens</p><pre className="ps-pre ps-pre--sm">{assemble(get(v)) || "(empty)"}</pre><Checks qs={check(get(v))} /></div>)}</div>
    <p className="ps-hint">Version B is {tb - ta >= 0 ? "+" : ""}{tb - ta} tokens vs version A.</p></div>);
}
function TemplateDialog({ dref, onClose, onUse }: { dref: React.RefObject<HTMLDialogElement>; onClose: () => void; onUse: (bs: PlainBlock[], name: string) => void }) {
  const [q, setQ] = useState("");
  const list = TEMPLATES.filter((t) => !q.trim() || (t.name + " " + t.purpose).toLowerCase().includes(q.trim().toLowerCase()));
  return (<dialog ref={dref} className="ps-dialog ps-dialog--wide" aria-labelledby="ps-tpl-h" onClose={onClose} onCancel={onClose}>
    <div className="ps-dialog-in"><div className="ps-dialog-head"><h2 id="ps-tpl-h">Templates</h2><button type="button" className="ps-iconbtn" onClick={onClose} aria-label="Close templates"><Icon name="close" /></button></div>
      <label htmlFor="ps-tpl-filter" className="sr-only">Filter templates</label><input id="ps-tpl-filter" className="ps-inp" placeholder="Filter templates" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="ps-hint" role="status">{list.length} of {TEMPLATES.length} templates</p>
      <ul className="ps-tpl">{list.map((t) => <li key={t.id} className="ps-card ps-card--flat"><h3 className="ps-h3">{t.name}</h3><p className="ps-hint">{t.purpose}</p><p className="ps-hint">Variables: <code>{findVars(t.blocks.map((b) => (b.kind === "requirements" ? reqText(b.must, b.mustNot) : b.text)).join("\n")).map(([n]) => `{{${n}}}`).join(", ") || "none"}</code></p><button type="button" className="ps-btn ps-btn--sm ps-btn--primary" onClick={() => onUse(t.blocks.map((b) => plain(b)), t.name)}>Use template</button></li>)}</ul>
    </div></dialog>);
}
