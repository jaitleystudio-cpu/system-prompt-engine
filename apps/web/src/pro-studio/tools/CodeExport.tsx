import { useState } from "react";
import { usePro, download, copyText } from "../context.ts";
import { ToolFrame, Field, NeedSession } from "./Frame.tsx";
import { CODE_TARGETS, exportCode, type CodeTarget } from "../core/codeExport.ts";
import { assemble, filled } from "../core/studio.ts";
export default function CodeExport() {
  const { active, announce, log } = usePro();
  const [target, setTarget] = useState<CodeTarget>("python-openai");
  const [model, setModel] = useState(""); const [msg, setMsg] = useState("Hello");
  if (!active) return <ToolFrame id="code"><NeedSession what="Export to Code" /></ToolFrame>;
  const sys = active.mode === "filled" ? filled(assemble(active.blocks), active.vars) : assemble(active.blocks);
  const code = exportCode(target, sys, model, msg); const t = CODE_TARGETS.find((x) => x.id === target)!;
  return (
    <ToolFrame id="code" panel={<div className="ps-stack"><pre className="ps-pre ps-code" tabIndex={0} aria-label={`${t.label} code`} data-testid="code-out">{code}</pre><div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(code)) ? "Code copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => { download(t.file, code, "text/plain"); log("export.code", t.label); }}>Download {t.file}</button></div></div>} panelLabel="Code">
      <p className="ps-hint">Cost model: BYOK. The code runs on your machine with your own provider key (read from an environment variable). Pro Studio never sees or stores the key and calls nothing.</p>
      <div className="ps-seg ps-seg--wrap" role="group" aria-label="Language and SDK">{CODE_TARGETS.map((x) => <button key={x.id} type="button" aria-pressed={target === x.id} onClick={() => setTarget(x.id)}>{x.label}</button>)}</div>
      <div className="ps-cols"><Field label="Model name" id="code-model" hint="Type the exact model ID from your provider. Pro Studio does not choose one."><input id="code-model" className="ps-inp ps-mono" value={model} placeholder="YOUR_MODEL_NAME" onChange={(e) => setModel(e.target.value)} aria-describedby="code-model-hint" /></Field>
        <Field label="Example user message" id="code-msg"><input id="code-msg" className="ps-inp" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field></div>
      <p className="ps-hint">System prompt source: current session ({active.mode === "filled" ? "Filled" : "Template"} mode), {sys.length} characters. Quotes, newlines and shell characters are escaped for each language.</p>
    </ToolFrame>
  );
}
