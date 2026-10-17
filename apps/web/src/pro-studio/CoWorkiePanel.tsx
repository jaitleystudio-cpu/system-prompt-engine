import { useEffect, useMemo, useRef, useState } from "react";
import { usePro } from "./context.ts";
import { Icon } from "./icons.tsx";
import { toolById } from "./proRoutes.ts";
import { hasAccess } from "./proGate.ts";
import { sessionTitle, plainBlocks } from "./shared/workspace.ts";
import type { CwState, Intent } from "./core/coworkie.ts";
import { proApi, useProQuery } from "./api.ts";
interface Suggestion { label: string; why: string; intent: Intent }

interface Msg { id: number; from: "you" | "cw"; lines: string[] }
let mid = 0;
export default function CoWorkiePanel({ pinned, onPin, onClose, inDrawer }: { pinned: boolean; onPin: () => void; onClose: () => void; inDrawer?: boolean }) {
  const { route, active, ws, go, runAction, fillComposer, access, log } = usePro();
  const ok = hasAccess(access);
  const state: CwState = useMemo(() => ({
    tool: route.kind === "tool" ? route.tool : route.kind === "home" ? "home" : null,
    sessionTitle: active ? sessionTitle(active) : null,
    projectName: active?.projectId ? ws.projects.find((p) => p.id === active.projectId)?.name ?? null : null,
    blocks: active ? plainBlocks(active.blocks) : null, vars: active?.vars ?? {}, versions: active?.versions ?? [],
  }), [route, active, ws.projects]);
  const ctxQ = useProQuery<{ suggestions: Suggestion[] }>("/coworkie", { kind: "suggest", state }, { enabled: ok, debounce: 600 });
  const where = route.kind === "tool" ? toolById(route.tool)?.label ?? "a tool" : "Home";
  const context = `You are in ${where}${state.sessionTitle ? ` · session “${state.sessionTitle}”` : " · no session open"}${state.projectName ? ` · project ${state.projectName}` : ""}.`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const say = (lines: string[]) => setMsgs((m) => [...m, { id: ++mid, from: "cw", lines }]);

  const ask = async (kind: "explain" | "suggest" | "help"): Promise<string[]> => {
    try { const d = await proApi<{ lines?: string[]; suggestions?: Suggestion[] }>("/coworkie", { kind, state }); return kind === "suggest" ? ((d.suggestions ?? []).length ? d.suggestions!.map((x) => `${x.label} — ${x.why}`) : ["Nothing to suggest right now."]) : d.lines ?? []; }
    catch (e) { return [(e as Error).message]; }
  };
  const perform = (it: Intent, echo?: string) => {
    if (echo) setMsgs((m) => [...m, { id: ++mid, from: "you", lines: [echo] }]);
    if (!ok) { say(["Pro Studio needs a valid Pro access key. Paste yours on the unlock screen."]); return; }
    switch (it.type) {
      case "open": go({ kind: "tool", tool: it.tool }); say([`Opened ${toolById(it.tool)?.label}.`, toolById(it.tool)?.blurb ?? ""]); break;
      case "home": go({ kind: "home" }); say(["Opened Home. Type in the composer to start a session."]); break;
      case "action":
        if (["scan-session", "save-version"].includes(it.action) && !active) { say(["That works on a session, and none is open. Start one from Home first."]); break; }
        runAction(it.tool, it.action); say([`Done: ${it.label} (in ${toolById(it.tool)?.label}).`]); break;
      case "fill": fillComposer(it.text); say(["I put that text in the Home composer. Press Enter there to start the session."]); break;
      case "explain": case "suggest": case "help": void ask(it.type).then(say); break;
      case "unknown": say([`I don't know how to do “${it.text.slice(0, 80)}” yet.`, "CoWorkie understands Pro Studio commands; it does not generate text. Type “help” for the list."]); break;
    }
    log("coworkie", it.type === "unknown" ? "unknown command" : `${it.type}${"tool" in it ? ` ${it.tool}` : ""}`);
  };
  const submit = async () => { const v = text.trim(); if (!v) return; setText(""); if (!ok) { perform({ type: "help" }, v); return; }
    try { const d = await proApi<{ intent: Intent }>("/coworkie", { kind: "parse", input: v }); perform(d.intent, v); } catch (e) { setMsgs((m) => [...m, { id: ++mid, from: "you", lines: [v] }]); say([(e as Error).message]); } };
  const sugg = ok ? ctxQ.data?.suggestions ?? [] : [];

  const quick: { label: string; text: string; icon: string; it: Intent }[] = [
    { label: "Explain", text: "What this screen and session contain", icon: "info", it: { type: "explain" } },
    { label: "What next?", text: "Suggestions based on your state", icon: "target", it: { type: "suggest" } },
    { label: "Open a tool", text: "Try “open living”", icon: "right", it: { type: "open", tool: "living" } },
    { label: "Help", text: "Commands I understand", icon: "keyboard", it: { type: "help" } },
  ];
  return (
    <div className="ps-cw-in" data-testid="coworkie">
      <div className="ps-cw-head">
        <span className="ps-cw-logo" aria-hidden="true"><Icon name="sparkles" size={15} /></span>
        <div className="ps-cw-title"><h2 className="ps-cw-h">CoWorkie</h2><small>Workspace assistant</small></div>
        {!inDrawer && <button type="button" className="ps-iconbtn" onClick={onPin} aria-pressed={pinned} aria-label={pinned ? "Unpin CoWorkie (auto-hide)" : "Pin CoWorkie open"} title={pinned ? "Unpin (auto-hide)" : "Pin open"} data-testid="cw-pin"><Icon name="panel" /></button>}
        <button type="button" className="ps-iconbtn" onClick={onClose} aria-label="Close CoWorkie"><Icon name="close" /></button>
      </div>
      <p className="ps-cw-ctx" data-testid="cw-context" title={context}>{context}</p>
      <div className="ps-cw-log" aria-live="polite" aria-relevant="additions">
        {msgs.length === 0 && <div className="ps-cw-empty">
          <span className="ps-cw-logo ps-cw-logo--lg" aria-hidden="true"><Icon name="sparkles" size={22} /></span>
          <b>How can I help?</b>
          <span>I open tools, run actions and explain your current session.</span>
          <div className="ps-cw-cards">{quick.map((q) => <button key={q.label} type="button" className="ps-cw-card" onClick={() => perform(q.it, q.label)}><Icon name={q.icon} size={16} /><b>{q.label}</b><small>{q.text}</small></button>)}</div>
        </div>}
        {msgs.map((m) => <div key={m.id} className={`ps-cw-msg ps-cw-msg--${m.from}`}><span className="sr-only">{m.from === "you" ? "You: " : "CoWorkie: "}</span>{m.lines.filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}</div>)}
        <div ref={endRef} />
      </div>
      {sugg.length > 0 && <div className="ps-cw-sugg" aria-label="Suggested next steps"><p className="ps-eyebrow">Suggested</p>{sugg.slice(0, 3).map((s) => <button key={s.label} type="button" className="ps-chip ps-chip--sm" title={s.why} onClick={() => perform(s.intent, s.label)}><Icon name="sparkles" size={13} />{s.label}</button>)}</div>}
      {msgs.length > 0 && <div className="ps-cw-quick">
        <button type="button" className="ps-chip ps-chip--sm" onClick={() => perform({ type: "explain" }, "Explain")}>Explain</button>
        <button type="button" className="ps-chip ps-chip--sm" onClick={() => perform({ type: "suggest" }, "What next?")}>What next?</button>
        <button type="button" className="ps-chip ps-chip--sm" onClick={() => perform({ type: "help" }, "Help")}>Help</button>
      </div>}
      <form className="ps-cw-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label htmlFor="ps-cw-input" className="sr-only">Command for CoWorkie</label>
        <input id="ps-cw-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask CoWorkie… e.g. open batch" autoComplete="off" />
        <button type="submit" className="ps-send ps-send--sm" aria-label="Send to CoWorkie" disabled={!text.trim()}><Icon name="send" size={15} /></button>
      </form>
      <div className="ps-cw-foot"><p className="ps-cw-honest" title="CoWorkie follows commands and reads your Pro Studio state on the SPE Pro service. It does not call an AI model and does not generate text.">Commands only · no AI model · does not generate text</p></div>
    </div>
  );
}
