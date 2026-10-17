import { useState } from "react";
import { usePro, download, copyText } from "../context.ts";
import { ToolFrame, NeedSession } from "./Frame.tsx";
import { FORMATS, convert, type Fmt } from "../core/formats.ts";
import { sessionTitle } from "../core/workspace.ts";
export default function Formats() {
  const { active, announce, log } = usePro();
  const [f, setF] = useState<Fmt>("xml");
  if (!active) return <ToolFrame id="formats"><NeedSession what="Format Converter" /></ToolFrame>;
  const out = convert(active.blocks, f); const meta = FORMATS.find((x) => x.id === f)!;
  return (
    <ToolFrame id="formats" panel={<div className="ps-stack"><pre className="ps-pre ps-code" tabIndex={0} aria-label={`${meta.label} output`} data-testid="fmt-out">{out || "(session is empty)"}</pre><div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(out)) ? "Copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => { download(`${sessionTitle(active).replace(/\W+/g, "-").toLowerCase().slice(0, 40) || "prompt"}.${meta.ext}`, out, "text/plain"); log("export.format", meta.label); }}>Download .{meta.ext}</button></div></div>} panelLabel="Converted">
      <p className="ps-hint">Same blocks, same words, different structure. Nothing is rewritten; XML special characters are escaped.</p>
      <div className="ps-seg ps-seg--wrap" role="group" aria-label="Output format">{FORMATS.map((x) => <button key={x.id} type="button" aria-pressed={f === x.id} onClick={() => setF(x.id)}>{x.label}</button>)}</div>
      <p className="ps-hint">Source: “{sessionTitle(active)}”, {active.blocks.filter((b) => b.text.trim()).length} non-empty blocks.</p>
    </ToolFrame>
  );
}
