import type { ReactNode } from "react";
import { usePro } from "../context.ts";
import { Icon } from "../icons.tsx";
import { toolById, type ToolId } from "../proRoutes.ts";
import { useEffect, useState } from "react";
import { QTYPE_LABEL, type Q } from "../shared/constants.ts";
import { proApi, type ProviderInfo } from "../api.ts";

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

/** Status badge. Only VERIFIED and HUMAN_PASS are passes; everything else is shown as not passed. */
const ST: Record<string, { cls: string; label: string }> = {
  VERIFIED: { cls: "ok", label: "Verified" }, HUMAN_PASS: { cls: "ok", label: "Human: pass" }, FAILED: { cls: "bad", label: "Failed" }, HUMAN_FAIL: { cls: "bad", label: "Human: fail" },
  UNPROVEN: { cls: "warn", label: "Unproven" }, NOT_RUN: { cls: "na", label: "Not run" }, SIMULATED: { cls: "warn", label: "Simulated" },
};
export function StatusBadge({ s }: { s: string }) { const m = ST[s] ?? { cls: "na", label: s }; return <span className={`ps-st ps-st--${m.cls}`} data-status={s}>{m.label}</span>; }

let providerCache: ProviderInfo[] | null = null;
export function useProviders(): ProviderInfo[] {
  const [list, setList] = useState<ProviderInfo[]>(providerCache ?? []);
  useEffect(() => { if (providerCache) return; proApi<{ providers: ProviderInfo[] }>("/providers").then((d) => { providerCache = d.providers; setList(d.providers); }).catch(() => {}); }, []);
  return list;
}
/** The customer's model connection (BYOK). The key is kept in page memory only and sent once per run. */
export function ModelConnect({ idp = "mc", compact }: { idp?: string; compact?: boolean }) {
  const { byok, setByok } = usePro(); const providers = useProviders();
  const p = providers.find((x) => x.id === byok.provider);
  return (
    <fieldset className={`ps-mc${compact ? " ps-mc--compact" : ""}`} data-testid="model-connect">
      <legend>Your model (BYOK)</legend>
      <div className="ps-cols ps-cols--3">
        <div className="ps-field"><label htmlFor={`${idp}-prov`}>Provider</label>
          <select id={`${idp}-prov`} className="ps-inp" value={byok.provider} onChange={(e) => setByok({ ...byok, provider: e.target.value })}>
            {(providers.length ? providers : [{ id: "openai", label: "OpenAI", note: "" }]).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select></div>
        <div className="ps-field"><label htmlFor={`${idp}-model`}>Model name</label>
          <input id={`${idp}-model`} className="ps-inp ps-mono" value={byok.model} placeholder="exact model ID from your provider" onChange={(e) => setByok({ ...byok, model: e.target.value })} autoComplete="off" spellCheck={false} /></div>
        {byok.provider !== "mock" && <div className="ps-field"><label htmlFor={`${idp}-key`}>Provider key</label>
          <input id={`${idp}-key`} className="ps-inp ps-mono" type="password" value={byok.key} placeholder="your own API key" onChange={(e) => setByok({ ...byok, key: e.target.value })} autoComplete="off" spellCheck={false} /></div>}
      </div>
      <p className="ps-hint">{p?.note ? `${p.note} ` : ""}SPE pays nothing for model calls and never stores this key: it stays in this page's memory and is sent only with each run, then discarded by the server.{byok.provider === "mock" ? " Simulated runs prove nothing about a real model and are labelled SIMULATED." : ""}</p>
    </fieldset>
  );
}
export interface GroupRow { group: string; n: number; pass: number; fail: number; unproven: number; notRun: number; passRate: number; smallSample: boolean }
/** Per-group results, worst first. No overall average is shown on its own. */
export function Breakdown({ title, rows }: { title: string; rows: GroupRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="ps-bd"><h3 className="ps-h3">{title}</h3>
      <table className="ps-table"><thead><tr><th scope="col">Group</th><th scope="col">Checks</th><th scope="col">Verified</th><th scope="col">Failed</th><th scope="col">Unproven</th><th scope="col">Not run</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.group}><th scope="row">{r.group}{r.smallSample && <span className="ps-tag ps-tag--warn">small sample</span>}</th><td>{r.n}</td><td>{r.pass}</td><td>{r.fail}</td><td>{r.unproven}</td><td>{r.notRun}</td></tr>)}</tbody></table>
      <p className="ps-hint">Worst group first. Groups under 5 checks are too small to generalise from.</p>
    </div>
  );
}
