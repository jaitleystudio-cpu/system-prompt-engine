import { useState } from "react";
import { usePro, useProAction, copyText } from "../context.ts";
import { ToolFrame, Field } from "./Frame.tsx";
import { scan, redact, type ScanFinding } from "../core/scanner.ts";
import { assemble } from "../core/studio.ts";
import { sessionTitle } from "../core/workspace.ts";
export default function Scanner() {
  const { active, updateSession, announce, log } = usePro();
  const [text, setText] = useState("");
  const [src, setSrc] = useState<"paste" | "session">(active ? "session" : "paste");
  const body = src === "session" && active ? assemble(active.blocks) : text;
  const fs: ScanFinding[] = scan(body);
  useProAction((id) => { if (id === "scan-session" && active) { setSrc("session"); const n = scan(assemble(active.blocks)).length; announce(n ? `Scanner found ${n} match${n > 1 ? "es" : ""}` : "No matches in the current session"); log("scan.session", `${sessionTitle(active)} · ${n} matches`); } });
  const secrets = fs.filter((f) => f.severity === "secret").length;
  const panel = (<div className="ps-stack" data-testid="scan-out">
    <p className={fs.length ? "ps-warn" : "ps-ok"} role="status">{fs.length ? `${fs.length} match${fs.length > 1 ? "es" : ""}: ${secrets} secret${secrets === 1 ? "" : "s"}, ${fs.length - secrets} personal data` : "No matches."}</p>
    <ul className="ps-list">{fs.map((f, i) => <li key={i} className="ps-li"><div><b>{f.label}</b><small>{f.severity} · character {f.index} · <code>{f.preview}</code></small></div></li>)}</ul>
    {fs.length > 0 && <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(redact(body, fs))) ? "Redacted copy copied" : "Copy was blocked")}>Copy redacted text</button>
      {src === "session" && active && <button type="button" className="ps-btn ps-btn--sm ps-btn--danger" onClick={() => { if (!window.confirm("Replace matches in the session with [REDACTED:…] markers?")) return; updateSession(active.id, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.kind === "requirements" ? { ...b, must: (b.must ?? []).map((x) => redact(x)), mustNot: (b.mustNot ?? []).map((x) => redact(x)), text: redact(b.text) } : { ...b, text: redact(b.text) })) })); announce("Session redacted"); log("scan.redact", sessionTitle(active)); }}>Redact in session</button>}</div>}
    <p className="ps-hint">Pattern matching only. It can miss secrets and can flag look-alikes. Nothing leaves this browser.</p>
  </div>);
  return (
    <ToolFrame id="scanner" panel={panel} panelLabel="Findings">
      <div className="ps-seg" role="group" aria-label="What to scan"><button type="button" aria-pressed={src === "session"} disabled={!active} onClick={() => setSrc("session")}>Current session</button><button type="button" aria-pressed={src === "paste"} onClick={() => setSrc("paste")}>Pasted text</button></div>
      {src === "paste" ? <Field label="Text to scan" id="scan-text"><textarea id="scan-text" className="ps-ta ps-mono" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a prompt, config or log" /></Field> : <pre className="ps-pre ps-pre--sm" tabIndex={0} aria-label="Session text being scanned">{body || "(empty session)"}</pre>}
      <p className="ps-hint">Detects: private key blocks, AWS, OpenAI-style, Anthropic, GitHub, Slack and Google keys, JWTs, Luhn-valid card numbers, emails, phone numbers, IPv4, Indian PAN and IBAN.</p>
    </ToolFrame>
  );
}
