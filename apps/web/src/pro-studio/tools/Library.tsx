import { useState } from "react";
import { usePro, download } from "../context.ts";
import { ToolFrame, Field } from "./Frame.tsx";
import { proApi } from "../api.ts";
import { uid } from "../shared/constants.ts";
import { sessionTitle, newSession, plainBlocks } from "../shared/workspace.ts";
import type { ImportResult, LibraryPack } from "../core/library.ts";
export default function Library() {
  const { ws, setWs, announce, log } = usePro();
  const [sel, setSel] = useState<Set<string>>(() => new Set(ws.sessions.map((s) => s.id)));
  const [name, setName] = useState("Team prompt library");
  const [imp, setImp] = useState<ImportResult | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const doImport = () => { if (!imp) return; const projMap = new Map(ws.projects.map((p) => [p.name, p.id])); const newProjects = [...new Set(imp.pack.sessions.map((s) => s.project).filter((p): p is string => !!p && !projMap.has(p)))].map((n) => ({ id: uid(), name: n, createdAt: new Date().toISOString() }));
    newProjects.forEach((p) => projMap.set(p.name, p.id));
    const ss = imp.pack.sessions.map((p) => { const s = newSession(p.blocks, p.title, p.project ? projMap.get(p.project) ?? null : null); s.vars = { ...p.variables }; return s; });
    setWs((w) => ({ ...w, projects: [...w.projects, ...newProjects], sessions: [...ss, ...w.sessions], activeId: ss[0]?.id ?? w.activeId })); announce(`Imported ${ss.length} sessions`); log("library.import", `${imp.pack.name} · ${ss.length} sessions · integrity ${imp.integrity}`); setImp(null); };
  const doExport = async () => {
    setBusy(true);
    try { const chosen = ws.sessions.filter((s) => sel.has(s.id)).map((s) => ({ ...s, blocks: plainBlocks(s.blocks) }));
      const { pack } = await proApi<{ pack: LibraryPack }>("/library/export", { name, sessions: chosen, projects: ws.projects });
      download(`${name.replace(/\W+/g, "-").toLowerCase() || "library"}.spelib.json`, JSON.stringify(pack, null, 2)); announce(`Exported ${pack.sessions.length} sessions`);
    } catch (e) { announce((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <ToolFrame id="library" panel={<div className="ps-stack">
      <h3 className="ps-h3">Import a pack</h3>
      <label className="ps-btn ps-btn--sm ps-file">Choose .spelib.json<input type="file" accept=".json,application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 1.9 * 1024 * 1024) { setErr("File is larger than the 2 MB request limit."); return; } try { setImp(await proApi<ImportResult>("/library/import", { raw: await f.text() })); setErr(""); } catch (x) { setImp(null); setErr((x as Error).message); } }} /></label>
      {err && <p className="ps-err" role="alert">Import failed: {err}</p>}
      {imp && <div className={`ps-verdict ps-verdict--${imp.integrity === "match" ? "ok" : "bad"}`} data-testid="lib-import"><b>{imp.pack.name}: {imp.pack.sessions.length} sessions</b><p>{imp.integrity === "match" ? "SHA-256 matches: the file is unchanged since export." : "SHA-256 does not match: the file was edited after export. Review before importing."}</p><ul>{imp.pack.sessions.slice(0, 8).map((s, i) => <li key={i}>{s.title || "Untitled"}{s.project ? ` · ${s.project}` : ""}</li>)}</ul><button type="button" className="ps-btn ps-btn--sm ps-btn--primary" onClick={doImport}>Import as new sessions</button></div>}
      <p className="ps-hint">The hash detects edits; it does not prove who made the file. For authorship use Signed Releases.</p>
    </div>} panelLabel="Import">
      <p className="ps-hint">Share many sessions as one file with your team. Packs are built and checked by the SPE Pro service; sessions keep their project folder names.</p>
      <Field label="Pack name" id="lib-name"><input id="lib-name" className="ps-inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {ws.sessions.length === 0 ? <p className="ps-hint">No sessions to export yet.</p> : <fieldset className="ps-fieldset"><legend>Sessions to include ({sel.size} of {ws.sessions.length})</legend>
        <div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={() => setSel(new Set(ws.sessions.map((s) => s.id)))}>All</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => setSel(new Set())}>None</button></div>
        {ws.sessions.map((s) => <label key={s.id} className="ps-opt"><input type="checkbox" checked={sel.has(s.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(s.id); else n.delete(s.id); setSel(n); }} /><span>{sessionTitle(s)}<small>{ws.projects.find((p) => p.id === s.projectId)?.name ?? "No project"} · {s.blocks.length} blocks</small></span></label>)}</fieldset>}
      <button type="button" className="ps-btn ps-btn--primary" disabled={!sel.size || busy} data-testid="lib-export" onClick={() => void doExport()}>{busy ? "Exporting…" : "Export pack"}</button>
    </ToolFrame>
  );
}
