import { useState } from "react";
import { usePro, download, copyText, slug } from "../context.ts";
import { ToolFrame, NeedSession } from "./Frame.tsx";
import { FORMATS, type Fmt } from "../shared/constants.ts";
import { useProQuery } from "../api.ts";
import { sessionTitle, plainBlocks } from "../shared/workspace.ts";
export default function Formats() {
  const { active, announce } = usePro();
  const [f, setF] = useState<Fmt>("xml");
  const q = useProQuery<{ output: string }>("/formats", active ? { blocks: plainBlocks(active.blocks), fmt: f } : null, { enabled: !!active });
  if (!active) return <ToolFrame id="formats"><NeedSession what="Format Converter" /></ToolFrame>;
  const out = q.data?.output ?? ""; const meta = FORMATS.find((x) => x.id === f)!;
  return (
    <ToolFrame id="formats" panel={<div className="ps-stack"><pre className="ps-pre ps-code" tabIndex={0} aria-label={`${meta.label} output`} data-testid="fmt-out">{out || (q.loading ? "Converting on SPE Pro…" : "(session is empty)")}</pre><div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" disabled={!out} onClick={async () => announce((await copyText(out)) ? "Copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" disabled={!out} onClick={() => download(`${slug(sessionTitle(active))}.${meta.ext}`, out, "text/plain")}>Download .{meta.ext}</button></div>{q.error && <p className="ps-err" role="alert">{q.error}</p>}</div>} panelLabel="Converted">
      <p className="ps-hint">Same blocks, same words, different structure. Nothing is rewritten; XML special characters are escaped.</p>
      <div className="ps-seg ps-seg--wrap" role="group" aria-label="Output format">{FORMATS.map((x) => <button key={x.id} type="button" aria-pressed={f === x.id} onClick={() => setF(x.id)}>{x.label}</button>)}</div>
      <p className="ps-hint">Source: “{sessionTitle(active)}”, {active.blocks.filter((b) => b.text.trim()).length} non-empty blocks.</p>
    </ToolFrame>
  );
}
