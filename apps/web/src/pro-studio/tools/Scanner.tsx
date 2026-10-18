import { useState } from "react";
import { usePro, useProAction, copyText } from "../context.ts";
import { ToolFrame, Field, About } from "./Frame.tsx";
import { proApi, useProQuery } from "../api.ts";
import { sessionTitle, plainBlocks } from "../shared/workspace.ts";
import type { ScanFinding } from "../core/scanner.ts";
export default function Scanner() {
  const { active, updateSession, announce } = usePro();
  const [text, setText] = useState("");
  const [src, setSrc] = useState<"paste" | "session">(active ? "session" : "paste");
  const an = useProQuery<{ assembled: string }>("/studio/analyze", active ? { blocks: plainBlocks(active.blocks), vars: {} } : null, { enabled: !!active && src === "session" });
  const body = src === "session" && active ? an.data?.assembled ?? "" : text;
  const q = useProQuery<{ findings: ScanFinding[]; redacted: string }>("/scan", { text: body, redact: true }, { enabled: !!body });
  const fs = body ? q.data?.findings ?? [] : [];
  useProAction((id) => { if (id === "scan-session" && active) { setSrc("session"); void proApi<{ findings: ScanFinding[] }>("/scan", { text: active.blocks.map((b) => b.text).join("\n"), log: true }).then((d) => announce(d.findings.length ? `Scanner found ${d.findings.length} match${d.findings.length > 1 ? "es" : ""}` : "No matches in the current session")); } });
  const secrets = fs.filter((f) => f.severity === "secret").length;
  const redactSession = async () => {
    if (!active || !window.confirm("Replace matches in the session with [REDACTED:…] markers?")) return;
    const items = active.blocks.flatMap((b) => [b.text, ...(b.must ?? []), ...(b.mustNot ?? [])]);
    try {
      const d = await proApi<{ redactedList: string[] }>("/scan", { text: "", redactList: items, log: true }); let i = 0; const next = () => d.redactedList[i++];
      updateSession(active.id, (s) => ({ ...s, blocks: s.blocks.map((b) => { const text = next(); const must = (b.must ?? []).map(() => next()); const mustNot = (b.mustNot ?? []).map(() => next()); return b.kind === "requirements" ? { ...b, text, must, mustNot } : { ...b, text }; }) }));
      announce(`Session “${sessionTitle(active)}” redacted`);
    } catch (e) { announce((e as Error).message); }
  };
  const panel = (<div className="ps-stack" data-testid="scan-out">
    <p className={fs.length ? "ps-warn" : "ps-ok"} role="status">{!body ? "Nothing to scan yet." : q.loading && !q.data ? "Scanning on SPE Pro…" : fs.length ? `${fs.length} match${fs.length > 1 ? "es" : ""}: ${secrets} secret${secrets === 1 ? "" : "s"}, ${fs.length - secrets} personal data` : "No matches."}</p>
    <ul className="ps-list">{fs.map((f, i) => <li key={i} className="ps-li"><div><b>{f.label}</b><small>{f.severity} · character {f.index} · <code>{f.preview}</code></small></div></li>)}</ul>
    {fs.length > 0 && <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(q.data?.redacted ?? "")) ? "Redacted copy copied" : "Copy was blocked")}>Copy redacted text</button>
      {src === "session" && active && <button type="button" className="ps-btn ps-btn--sm ps-btn--danger" onClick={() => void redactSession()}>Redact in session</button>}</div>}
    {q.error && <p className="ps-err" role="alert">{q.error}</p>}
    <About label="Limits">Pattern matching only. It can miss secrets and can flag look-alikes. The text is scanned on the SPE Pro service and not stored.</About>
  </div>);
  return (
    <ToolFrame id="scanner" panel={panel} panelLabel="Findings">
      <div className="ps-seg" role="group" aria-label="What to scan"><button type="button" aria-pressed={src === "session"} disabled={!active} onClick={() => setSrc("session")}>Current session</button><button type="button" aria-pressed={src === "paste"} onClick={() => setSrc("paste")}>Pasted text</button></div>
      {src === "paste" ? <Field label="Text to scan" id="scan-text"><textarea id="scan-text" className="ps-ta ps-mono" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a prompt, config or log" /></Field> : <pre className="ps-pre ps-pre--sm" tabIndex={0} aria-label="Session text being scanned">{body || "(empty session)"}</pre>}
      <About label="What it detects">Detects: private key blocks, AWS, OpenAI-style, Anthropic, GitHub, Slack and Google keys, JWTs, Luhn-valid card numbers, emails, phone numbers, IPv4, Indian PAN and IBAN.</About>
    </ToolFrame>
  );
}
