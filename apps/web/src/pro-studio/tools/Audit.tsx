import { useCallback, useEffect, useState } from "react";
import { download } from "../context.ts";
import { ToolFrame } from "./Frame.tsx";
import { proApi } from "../api.ts";
import type { AuditEntry, ChainResult } from "../core/audit.ts";
const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (log: AuditEntry[]) => [["seq", "at", "action", "detail", "prev", "hash"], ...log.map((e) => [String(e.seq), e.at, e.action, e.detail, e.prev, e.hash])].map((r) => r.map(cell).join(",")).join("\n");
export default function Audit() {
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [res, setRes] = useState<ChainResult | null>(null);
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const load = useCallback(async () => { setLoading(true); try { const d = await proApi<{ entries: AuditEntry[]; verify: ChainResult }>("/audit/list"); setLog(d.entries); setRes(d.verify); setErr(""); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const f = () => void load(); window.addEventListener("spe-pro-audit", f); return () => window.removeEventListener("spe-pro-audit", f); }, [load]);
  const shown = [...log].reverse().filter((e) => !q.trim() || `${e.action} ${e.detail}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <ToolFrame id="audit" panel={<div className="ps-stack" data-testid="audit-out">
      {res && <div className={`ps-verdict ps-verdict--${res.ok ? "ok" : "bad"}`} role="status"><b>{res.ok ? "Chain intact" : "Chain broken"}</b><p>{res.reason}</p></div>}
      {err && <p className="ps-err" role="alert">{err}</p>}
      <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={() => void load()}>Reload and verify</button><button type="button" className="ps-btn ps-btn--sm" disabled={!log.length} onClick={() => download("pro-studio-audit.json", JSON.stringify(log, null, 2))}>Export JSON</button><button type="button" className="ps-btn ps-btn--sm" disabled={!log.length} onClick={() => download("pro-studio-audit.csv", toCsv(log), "text/csv")}>Export CSV</button></div>
      <p className="ps-hint">The SPE Pro service writes this log for your access key. Each entry stores the SHA-256 of the one before it, so editing or removing an entry breaks the chain. The newest 2,000 entries are kept.</p>
    </div>} panelLabel="Integrity">
      <p className="ps-hint">What's logged: sessions and projects, imports and exports, scans, releases, Living runs and stops, human marks, requirement removals, blind and cross-model runs. Prompt text and provider keys are never written to the log.</p>
      <label htmlFor="audit-q" className="sr-only">Filter log</label><input id="audit-q" className="ps-inp" placeholder="Filter by action or detail" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && !log.length ? <p className="ps-hint" role="status">Loading the log from SPE Pro…</p> : log.length === 0 ? <div className="ps-empty ps-empty--inline"><p>No entries yet. Actions in Pro Studio will appear here.</p></div> :
        <div className="ps-scroll-x"><table className="ps-table"><caption className="sr-only">Audit entries, newest first</caption><thead><tr><th scope="col">#</th><th scope="col">Time</th><th scope="col">Action</th><th scope="col">Detail</th><th scope="col">Hash</th></tr></thead>
          <tbody>{shown.slice(0, 300).map((e) => <tr key={e.seq}><td>{e.seq}</td><td>{new Date(e.at).toLocaleString()}</td><td><code>{e.action}</code></td><td>{e.detail}</td><td><code title={e.hash}>{e.hash.slice(0, 10)}…</code></td></tr>)}</tbody></table></div>}
    </ToolFrame>
  );
}
