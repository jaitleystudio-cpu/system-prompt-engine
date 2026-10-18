import { useState } from "react";
import { usePro, download } from "../context.ts";
import { Icon } from "../icons.tsx";
import { ToolFrame, Field, NeedSession, Empty, About } from "./Frame.tsx";
import { proApi, useProQuery } from "../api.ts";
import { plainBlocks } from "../shared/workspace.ts";
import type { BatchResult } from "../core/csvBatch.ts";
interface Analyze { assembled: string; vars: [string, number][] }
export default function Batch() {
  const { active, announce } = usePro();
  const [csv, setCsv] = useState("");
  const an = useProQuery<Analyze>("/studio/analyze", active ? { blocks: plainBlocks(active.blocks), vars: {} } : null, { enabled: !!active });
  const tpl = an.data?.assembled ?? ""; const vars = (an.data?.vars ?? []).map(([n]) => n);
  const res = useProQuery<{ result: BatchResult }>("/batch", { template: tpl, csv }, { enabled: !!active && !!csv.trim() && !!an.data });
  if (!active) return <ToolFrame id="batch"><NeedSession what="Batch from CSV" /></ToolFrame>;
  const r = csv.trim() ? res.data?.result ?? null : null;
  const dl = async (include: "jsonl" | "csv") => { try { const d = await proApi<{ jsonl?: string; csv?: string }>("/batch", { template: tpl, csv, include }); if (include === "jsonl") download("batch-prompts.jsonl", d.jsonl ?? "", "application/x-ndjson"); else download("batch-prompts.csv", d.csv ?? "", "text/csv"); } catch (e) { announce((e as Error).message); } };
  const panel = r ? (<div className="ps-stack" data-testid="batch-out">
    <p className="ps-hint" role="status">{r.rows.length} rows · {r.complete} complete · {r.rows.length - r.complete} with missing values{r.unusedColumns.length ? ` · unused columns: ${r.unusedColumns.join(", ")}` : ""}</p>
    <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={() => void dl("jsonl")}>Download JSONL</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => void dl("csv")}>Download CSV</button></div>
    <ol className="ps-batch">{r.rows.slice(0, 50).map((x) => <li key={x.index}><b>Row {x.index}</b>{x.missing.length > 0 && <span className="ps-tag ps-tag--warn">missing {x.missing.join(", ")}</span>}<pre className="ps-pre ps-pre--sm">{x.output}</pre></li>)}</ol>
    {r.rows.length > 50 && <p className="ps-hint">Showing the first 50 rows; downloads include all {r.rows.length}.</p>}
  </div>) : <Empty>{res.loading && csv.trim() ? "Rendering on SPE Pro…" : "Paste or upload a CSV to preview rendered prompts."}</Empty>;
  return (
    <ToolFrame id="batch" panel={panel} panelLabel="Rendered prompts">
      <About>Fills the current session's {"{{variables}}"} once per row on the SPE Pro service. This renders prompts only; no model is run. Up to 5,000 rows.</About>
      <p className="ps-ctxline">Variables in this session: {vars.length ? vars.map((v) => <code key={v}>{`{{${v}}}`} </code>) : "none — add {{name}} placeholders in Prompt Studio first."}</p>
      {vars.length > 0 && <button type="button" className="ps-btn ps-btn--sm" onClick={() => setCsv(vars.join(",") + "\n" + vars.map((v) => `example_${v}`).join(","))}>Insert a header row for these variables</button>}
      <Field label="CSV (first row = variable names)" id="batch-csv"><textarea id="batch-csv" className="ps-ta ps-mono" rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"product_name,support_hours\nAcme,9am–5pm IST"} /></Field>
      <label className="ps-btn ps-btn--sm ps-file"><Icon name="upload" size={14} />Upload .csv<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 1.9 * 1024 * 1024) { announce("CSV is larger than the 2 MB request limit"); return; } setCsv(await f.text()); announce(`Loaded ${f.name}`); e.target.value = ""; }} /></label>
      {(res.error || an.error) && <p className="ps-err" role="alert">{res.error || an.error}</p>}
    </ToolFrame>
  );
}
