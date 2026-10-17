import { useEffect, useMemo, useRef, useState } from "react";
import { usePro } from "./context.ts";
import { Icon } from "./icons.tsx";
import { toolById } from "./proRoutes.ts";
import { hasAccess } from "./proGate.ts";
import { sessionTitle } from "./core/workspace.ts";
import { parseCommand, explain, suggest, describeContext, HELP, type CwState, type Intent } from "./core/coworkie.ts";

interface Msg { id: number; from: "you" | "cw"; lines: string[] }
let mid = 0;
export default function CoWorkiePanel({ pinned, onPin, onClose, inDrawer }: { pinned: boolean; onPin: () => void; onClose: () => void; inDrawer?: boolean }) {
  const { route, active, ws, go, runAction, fillComposer, access, log } = usePro();
  const ok = hasAccess(access);
  const state: CwState = useMemo(() => ({
    tool: route.kind === "tool" ? route.tool : route.kind === "home" ? "home" : null,
    sessionTitle: active ? sessionTitle(active) : null,
    projectName: active?.projectId ? ws.projects.find((p) => p.id === active.projectId)?.name ?? null : null,
    blocks: active ? active.blocks : null, vars: active?.vars ?? {}, versions: active?.versions ?? [],
  }), [route, active, ws.projects]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const say = (lines: string[]) => setMsgs((m) => [...m, { id: ++mid, from: "cw", lines }]);

  const perform = (it: Intent, echo?: string) => {
    if (echo) setMsgs((m) => [...m, { id: ++mid, from: "you", lines: [echo] }]);
    if (!ok && it.type !== "help" && it.type !== "unknown") { say(["Pro Studio tools need a Pro or Team plan. Plans are on the Pricing page."]); return; }
    switch (it.type) {
      case "open": go({ kind: "tool", tool: it.tool }); say([`Opened ${toolById(it.tool)?.label}.`, toolById(it.tool)?.blurb ?? ""]); break;
      case "home": go({ kind: "home" }); say(["Opened Home. Type in the composer to start a session."]); break;
      case "action":
        if (["scan-session", "save-version"].includes(it.action) && !active) { say(["That works on a session, and none is open. Start one from Home first."]); break; }
        runAction(it.tool, it.action); say([`Done: ${it.label} (in ${toolById(it.tool)?.label}).`]); break;
      case "fill": fillComposer(it.text); say(["I put that text in the Home composer. Press Enter there to start the session."]); break;
      case "explain": say(explain(state)); break;
      case "suggest": { const s = suggest(state); say(s.length ? s.map((x) => `${x.label} — ${x.why}`) : ["Nothing to suggest right now."]); break; }
      case "help": say(HELP); break;
      case "unknown": say([`I don't know how to do “${it.text.slice(0, 80)}” yet.`, "No AI model is connected, so I only understand Pro Studio commands. Type “help” for the list."]); break;
    }
    log("coworkie", it.type === "unknown" ? "unknown command" : `${it.type}${"tool" in it ? ` ${it.tool}` : ""}`);
  };
  const submit = () => { const v = text.trim(); if (!v) return; setText(""); perform(parseCommand(v), v); };
  const sugg = ok ? suggest(state) : [];

  return (
    <div className="ps-cw-in" data-testid="coworkie">
      <div className="ps-cw-head">
        <span className="ps-cw-logo" aria-hidden="true"><Icon name="chat" size={16} /></span>
        <h2 className="ps-cw-h">CoWorkie</h2>
        {!inDrawer && <button type="button" className="ps-iconbtn" onClick={onPin} aria-pressed={pinned} aria-label={pinned ? "Unpin CoWorkie (auto-hide)" : "Pin CoWorkie open"} title={pinned ? "Unpin (auto-hide)" : "Pin open"} data-testid="cw-pin"><Icon name="panel" /></button>}
        <button type="button" className="ps-iconbtn" onClick={onClose} aria-label="Close CoWorkie"><Icon name="close" /></button>
      </div>
      <p className="ps-cw-ctx" data-testid="cw-context">{describeContext(state)}</p>
      <p className="ps-cw-honest">No AI model is connected in Pro Studio. CoWorkie follows commands and reads your Pro Studio state; it does not generate text.</p>
      <div className="ps-cw-log" aria-live="polite" aria-relevant="additions">
        {msgs.length === 0 && <div className="ps-cw-empty"><b>Meet CoWorkie.</b><span>Ask me to open a tool, run an action, explain the current session, or suggest what to do next.</span></div>}
        {msgs.map((m) => <div key={m.id} className={`ps-cw-msg ps-cw-msg--${m.from}`}><span className="sr-only">{m.from === "you" ? "You: " : "CoWorkie: "}</span>{m.lines.filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>)}
        <div ref={endRef} />
      </div>
      {sugg.length > 0 && <div className="ps-cw-sugg" aria-label="Suggested next steps">{sugg.map((s) => <button key={s.label} type="button" className="ps-chip ps-chip--sm" title={s.why} onClick={() => perform(s.intent, s.label)}>{s.label}</button>)}</div>}
      <div className="ps-cw-quick">
        <button type="button" className="ps-chip ps-chip--sm" onClick={() => perform({ type: "explain" }, "Explain")}>Explain</button>
        <button type="button" className="ps-chip ps-chip--sm" onClick={() => perform({ type: "suggest" }, "What next?")}>What next?</button>
        <button type="button" className="ps-chip ps-chip--sm" onClick={() => perform({ type: "help" }, "Help")}>Help</button>
      </div>
      <form className="ps-cw-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor="ps-cw-input" className="sr-only">Command for CoWorkie</label>
        <input id="ps-cw-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. open batch · scan for secrets · explain" autoComplete="off" />
        <button type="submit" className="ps-send ps-send--sm" aria-label="Send to CoWorkie" disabled={!text.trim()}><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}
