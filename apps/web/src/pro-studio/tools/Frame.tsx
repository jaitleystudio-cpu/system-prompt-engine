import type { ReactNode } from "react";
import { usePro } from "../context.ts";
import { Icon } from "../icons.tsx";
import { toolById, type ToolId } from "../proRoutes.ts";
import type { Q } from "../core/studio.ts";
import { QTYPE_LABEL } from "../core/studio.ts";

export function ToolFrame({ id, actions, panel, panelLabel = "Output", children }: { id: ToolId; actions?: ReactNode; panel?: ReactNode; panelLabel?: string; children: ReactNode }) {
  const { panelOpen } = usePro(); const t = toolById(id)!;
  return (
    <section className="ps-tool" aria-labelledby={`ps-h-${id}`} data-tool={id}>
      <header className="ps-tool-head">
        <div className="ps-tool-ttl"><span className="ps-tool-i" aria-hidden="true"><Icon name={id} /></span><div><h1 id={`ps-h-${id}`}>{t.label}{t.isNew && <span className="ps-new">New</span>}</h1><p>{t.blurb}</p></div></div>
        {actions && <div className="ps-tool-act">{actions}</div>}
      </header>
      <div className="ps-tool-body" data-has-panel={panel && panelOpen ? "1" : "0"}>
        <div className="ps-work">{children}</div>
        {panel && panelOpen && <aside className="ps-panel" aria-label={`${t.label} ${panelLabel.toLowerCase()}`}><h2 className="ps-panel-h">{panelLabel}</h2>{panel}</aside>}
      </div>
    </section>
  );
}
export function NeedSession({ what }: { what: string }) {
  const { go } = usePro();
  return (<div className="ps-empty ps-empty--inline"><p>{what} works on a Prompt Studio session. Open or start one first.</p><button type="button" className="ps-btn ps-btn--primary" onClick={() => go({ kind: "home" })}>Start a session</button></div>);
}
const SYM = { ok: "✓", warn: "!", bad: "×", na: "–" } as const;
const SR = { ok: "Pass: ", warn: "Warning: ", bad: "Fail: ", na: "" } as const;
export function Checks({ qs }: { qs: Q[] }) {
  return (<ul className="ps-checks">{qs.map((q, i) => <li key={i} className={`ps-q ps-q--${q.level}`} data-qtype={q.type}><i aria-hidden="true">{SYM[q.level]}</i><div><span className="ps-qtype">{QTYPE_LABEL[q.type]}</span><b><span className="sr-only">{SR[q.level]}</span>{q.title}</b>{q.detail && <span>{q.detail}</span>}</div></li>)}</ul>);
}
export function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (<div className="ps-field"><label htmlFor={id}>{label}</label>{children}{hint && <small id={`${id}-hint`} className="ps-hint">{hint}</small>}</div>);
}
export const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
export const commaList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
