import { useState } from "react";
import { usePro, download, copyText } from "../context.ts";
import { ToolFrame, Field, NeedSession } from "./Frame.tsx";
import { buildReport } from "../core/report.ts";
import { sessionTitle } from "../core/workspace.ts";
export default function Report() {
  const { active, announce, log } = usePro();
  const [m, setM] = useState({ client: "", author: "", notes: "" });
  if (!active) return <ToolFrame id="report"><NeedSession what="Handoff Report" /></ToolFrame>;
  const md = buildReport({ title: sessionTitle(active), client: m.client, author: m.author, notes: m.notes, blocks: active.blocks, vars: active.vars, versions: active.versions });
  return (
    <ToolFrame id="report" panel={<div className="ps-stack"><pre className="ps-pre ps-code" tabIndex={0} aria-label="Report Markdown" data-testid="report-out">{md}</pre><div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(md)) ? "Report copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => { download(`${sessionTitle(active).replace(/\W+/g, "-").toLowerCase().slice(0, 40) || "prompt"}-handoff.md`, md, "text/markdown"); log("export.report", sessionTitle(active)); }}>Download .md</button></div></div>} panelLabel="Report">
      <p className="ps-hint">Built from the session as it is: prompt, variables, static checks, secret scan and version history. No scores and no model results, because none were run.</p>
      <div className="ps-cols"><Field label="Client" id="rep-client"><input id="rep-client" className="ps-inp" value={m.client} onChange={(e) => setM({ ...m, client: e.target.value })} /></Field><Field label="Prepared by" id="rep-author"><input id="rep-author" className="ps-inp" value={m.author} onChange={(e) => setM({ ...m, author: e.target.value })} /></Field></div>
      <Field label="Notes for the client" id="rep-notes"><textarea id="rep-notes" className="ps-ta" rows={4} value={m.notes} onChange={(e) => setM({ ...m, notes: e.target.value })} /></Field>
    </ToolFrame>
  );
}
