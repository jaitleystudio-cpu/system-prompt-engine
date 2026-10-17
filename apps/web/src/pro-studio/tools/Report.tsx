import { useState } from "react";
import { usePro, download, copyText, slug } from "../context.ts";
import { ToolFrame, Field, NeedSession } from "./Frame.tsx";
import { useProQuery } from "../api.ts";
import { sessionTitle, plainBlocks } from "../shared/workspace.ts";
export default function Report() {
  const { active, announce, log } = usePro();
  const [m, setM] = useState({ client: "", author: "", notes: "" });
  const q = useProQuery<{ markdown: string }>("/report", active ? { title: sessionTitle(active), ...m, blocks: plainBlocks(active.blocks), vars: active.vars, versions: active.versions } : null, { enabled: !!active, debounce: 400 });
  if (!active) return <ToolFrame id="report"><NeedSession what="Handoff Report" /></ToolFrame>;
  const md = q.data?.markdown ?? "";
  return (
    <ToolFrame id="report" panel={<div className="ps-stack"><pre className="ps-pre ps-code" tabIndex={0} aria-label="Report Markdown" data-testid="report-out">{md || (q.loading ? "Building on SPE Pro…" : "")}</pre><div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" disabled={!md} onClick={async () => announce((await copyText(md)) ? "Report copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" disabled={!md} onClick={() => { download(`${slug(sessionTitle(active))}-handoff.md`, md, "text/markdown"); log("export.report", sessionTitle(active)); }}>Download .md</button></div>{q.error && <p className="ps-err" role="alert">{q.error}</p>}</div>} panelLabel="Report">
      <p className="ps-hint">Built from the session as it is: prompt, variables, static checks, secret scan and version history. No scores and no model results, because none were run.</p>
      <div className="ps-cols"><Field label="Client" id="rep-client"><input id="rep-client" className="ps-inp" value={m.client} onChange={(e) => setM({ ...m, client: e.target.value })} /></Field><Field label="Prepared by" id="rep-author"><input id="rep-author" className="ps-inp" value={m.author} onChange={(e) => setM({ ...m, author: e.target.value })} /></Field></div>
      <Field label="Notes for the client" id="rep-notes"><textarea id="rep-notes" className="ps-ta" rows={4} value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} /></Field>
    </ToolFrame>
  );
}
