import { useMemo, useState } from "react";
import { usePro, download } from "../context.ts";
import { ToolFrame, Field, NeedSession } from "./Frame.tsx";
import { batchFill, batchToJsonl, toCsv, type BatchResult } from "../core/csvBatch.ts";
import { assemble, findVars } from "../core/studio.ts";
export default function Batch() {
  const { active, announce, log } = usePro();
  const tpl = active ? assemble(active.blocks) : "";
  const vars = findVars(tpl).map(([n]) => n);
  const [csv, setCsv] = useState("");
  const res = useMemo<{ r: BatchResult | null; err: string }>(() => { if (!csv.trim()) return { r: null, err: "" }; try { return { r: batchFill(tpl, csv), err: "" }; } catch (e) { return { r: null, err: (e as Error).message }; } }, [csv, tpl]);
  if (!active) return <ToolFrame id="batch"><NeedSession what="Batch from CSV" /></ToolFrame>;
  const r = res.r;
  const panel = r ? (<div className="ps-stack" data-testid="batch-out">
    <p className="ps-hint" role="status">{r.rows.length} rows · {r.complete} complete · {r.rows.length - r.complete} with missing values{r.unusedColumns.length ? ` · unused columns: ${r.unusedColumns.join(", ")}` : ""}</p>
    <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={() => { download("batch-prompts.jsonl", batchToJsonl(r), "application/x-ndjson"); log("batch.export", `${r.rows.length} rows jsonl`); }}>Download JSONL</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => { download("batch-prompts.csv", toCsv([["row", "prompt", "missing"], ...r.rows.map((x) => [String(x.index), x.output, x.missing.join(" ")])]), "text/csv"); log("batch.export", `${r.rows.length} rows csv`); }}>Download CSV</button></div>
    <ol className="ps-batch">{r.rows.slice(0, 50).map((x) => <li key={x.index}><b>Row {x.index}</b>{x.missing.length > 0 && <span className="ps-tag ps-tag--warn">missing {x.missing.join(", ")}</span>}<pre className="ps-pre ps-pre--sm">{x.output}</pre></li>)}</ol>
    {r.rows.length > 50 && <p className="ps-hint">Showing the first 50 rows; downloads include all {r.rows.length}.</p>}
  </div>) : <div className="ps-empty ps-empty--inline"><p>Paste or upload a CSV to preview rendered prompts.</p></div>;
  return (
    <ToolFrame id="batch" panel={panel} panelLabel="Rendered prompts">
      <p className="ps-hint">Fills the current session's {"{{variables}}"} once per row. This renders prompts only; no model is run. Up to 5,000 rows, processed in this browser.</p>
      <p className="ps-hint">Variables in this session: {vars.length ? vars.map((v) => <code key={v}>{`{{${v}}}`} </code>) : "none — add {{name}} placeholders in Prompt Studio first."}</p>
      {vars.length > 0 && <button type="button" className="ps-btn ps-btn--sm" onClick={() => setCsv(vars.join(",") + "\n" + vars.map((v) => `example_${v}`).join(","))}>Insert a header row for these variables</button>}
      <Field label="CSV (first row = variable names)" id="batch-csv"><textarea id="batch-csv" className="ps-ta ps-mono" rows={10} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"product_name,support_hours\nAcme,9am–5pm IST"} /></Field>
      <label className="ps-btn ps-btn--sm ps-file">Upload .csv<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 5 * 1024 * 1024) { announce("CSV is larger than 5 MB"); return; } setCsv(await f.text()); announce(`Loaded ${f.name}`); e.target.value = ""; }} /></label>
      {res.err && <p className="ps-err" role="alert">CSV problem: {res.err}</p>}
    </ToolFrame>
  );
}
