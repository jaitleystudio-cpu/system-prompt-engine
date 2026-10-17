import { useCallback, useEffect, useState } from "react";
import { usePro, download, AUDIT_KEY } from "../context.ts";
import { ToolFrame } from "./Frame.tsx";
import { verifyChain, auditToCsv, type AuditEntry, type ChainResult } from "../core/audit.ts";
const read = (): AuditEntry[] => { try { const v = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
export default function Audit() {
  const { announce } = usePro();
  const [log, setLog] = useState<AuditEntry[]>(read);
  const [res, setRes] = useState<ChainResult | null>(null);
  const [q, setQ] = useState("");
  const check = useCallback(async (l: AuditEntry[]) => setRes(await verifyChain(l)), []);
  useEffect(() => { const f = () => { const l = read(); setLog(l); void check(l); }; f(); window.addEventListener("spe-pro-audit", f); return () => window.removeEventListener("spe-pro-audit", f); }, [check]);
  const shown = [...log].reverse().filter((e) => !q.trim() || `${e.action} ${e.detail}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <ToolFrame id="audit" panel={<div className="ps-stack" data-testid="audit-out">
      {res && <div className={`ps-verdict ps-verdict--${res.ok ? "ok" : "bad"}`} role="status"><b>{res.ok ? "Chain intact" : "Chain broken"}</b><p>{res.reason}</p></div>}
      <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={() => void check(read())}>Verify again</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => download("pro-studio-audit.json", JSON.stringify(log, null, 2))}>Export JSON</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => download("pro-studio-audit.csv", auditToCsv(log), "text/csv")}>Export CSV</button></div>
      <p className="ps-hint">Each entry stores the SHA-256 of the one before it, so editing or removing an entry breaks the chain. This is a local log in this browser, not a server record; clearing site data deletes it.</p>
      <button type="button" className="ps-btn ps-btn--sm ps-btn--danger" onClick={() => { if (!window.confirm("Delete the whole audit log on this device?")) return; try { localStorage.removeItem(AUDIT_KEY); } catch { /* ignore */ } setLog([]); setRes(null); announce("Audit log cleared"); }}>Clear log</button>
    </div>} panelLabel="Integrity">
      <p className="ps-hint">What's logged: sessions created, renamed, moved or deleted; versions saved; imports and exports; releases signed; scans; CoWorkie commands. Prompt text itself is not copied into the log.</p>
      <label htmlFor="audit-q" className="sr-only">Filter log</label><input id="audit-q" className="ps-inp" placeholder="Filter by action or detail" value={q} onChange={(e) => setQ(e.target.value)} />
      {log.length === 0 ? <div className="ps-empty ps-empty--inline"><p>No entries yet. Actions in Pro Studio will appear here.</p></div> :
        <table className="ps-table"><caption className="sr-only">Audit entries, newest first</caption><thead><tr><th scope="col">#</th><th scope="col">Time</th><th scope="col">Action</th><th scope="col">Detail</th><th scope="col">Hash</th></tr></thead>
          <tbody>{shown.slice(0, 300).map((e) => <tr key={e.seq}><td>{e.seq}</td><td>{new Date(e.at).toLocaleString()}</td><td><code>{e.action}</code></td><td>{e.detail}</td><td><code title={e.hash}>{e.hash.slice(0, 10)}…</code></td></tr>)}</tbody></table>}
    </ToolFrame>
  );
}
