// Flagship flow timeline (Prawin's diagram): goal -> Prompt V1 with protected bounds -> model writes code ->
// executed: crashed? -> error log + call-site captured -> Intent Loss Shield, protected intent frozen ->
// Prompt V2 with targeted negative constraints -> re-executed -> "Verified 0 errors, fix recorded".
// Every step is derived from what the server recorded; nothing here is inferred from model text.
import type { ReactNode } from "react";
import { Icon } from "../icons.tsx";
import type { LivingProject } from "../core/living/types.ts";

type State = "done" | "fail" | "todo" | "warn";
const LABEL: Record<State, string> = { done: "done", fail: "failed", todo: "not reached", warn: "attention" };

export function LivingTimeline({ p }: { p: LivingProject }) {
  const a1 = p.attempts[0]; const last = p.attempts[p.attempts.length - 1];
  const crashed = p.attempts.find((a) => a.runs.some((r) => r.exec && !r.exec.ok));
  const crashRun = crashed?.runs.find((r) => r.exec && !r.exec.ok);
  const err = crashRun?.exec ? (crashRun.exec.errors[0] ?? (crashRun.exec.consoleErrors[0] ? `console.error: ${crashRun.exec.consoleErrors[0]}` : "")) : "";
  const fix = crashed ? p.attempts.find((a) => a.n > crashed.n) : undefined;
  const fromErr = fix?.repairs.find((r) => r.fromError)?.clause ?? "";
  const pinned = fromErr.match(/The failing call-site is (line \d+(?:, column \d+)?): `([^`]*)`/);
  const mustNot = (fromErr.match(/MUST NOT [^.]+\./g) ?? []).slice(0, 5);
  const lastRun = last?.runs.find((r) => r.exec);
  const drift = last?.runs.find((r) => r.scope?.verdict === "REJECTED_DRIFT")?.scope;
  const verified = p.status === "verified";
  const sim = p.attempts.some((a) => a.simulated);
  const executed = !!a1?.runs.some((r) => r.exec);
  const steps: { s: State; icon: string; t: string; tag?: ReactNode; d?: string; card?: ReactNode }[] = [
    { s: "done", icon: "target", t: "Goal", d: p.intent.slice(0, 160) },
    { s: a1 ? (a1.decision.kind === "pause" && a1.decision.reason === "INTENT_LOSS" ? "fail" : "done") : "todo", icon: "filecode", t: `Prompt V1 compiled with ${p.requirements.length} protected requirement${p.requirements.length === 1 ? "" : "s"}` },
    { s: a1?.runs.length ? "done" : "todo", icon: "bot", t: "Model wrote code", tag: sim ? <span className="ps-sim">Simulated</span> : undefined },
    {
      s: !executed ? "todo" : crashed ? "fail" : "done", icon: "terminal",
      t: !executed ? "Executed in the sandbox: crashed?" : crashed ? `Crashed when executed (attempt ${crashed.n})` : "Executed: no crash, 0 errors",
      card: crashed && err ? <div className="ps-tl-card ps-tl-card--bad"><span className="ps-tl-err">{err}</span></div> : undefined,
    },
    {
      s: !crashed ? "todo" : pinned ? "done" : "warn", icon: "search", t: "Error log and call-site captured",
      d: !pinned && crashed ? "Error captured; call-site not pinned." : undefined,
      card: pinned ? <div className="ps-tl-code" aria-label={`Pinned call-site, ${pinned[1]}`}><span>{pinned[1]}</span><span>{pinned[2]}</span></div> : undefined,
    },
    {
      s: !fix ? "todo" : fix.intentShield?.critical ? "fail" : "done", icon: "shield", t: "Intent Loss Shield: protected intent frozen",
      d: fix?.intentShield ? `Intent fidelity ${fix.intentShield.fidelity.toFixed(2)} · ${fix.intentShield.critical ? "critical loss: blocked" : "no critical loss"}` : undefined,
    },
    {
      s: fix ? "done" : "todo", icon: "filecode", t: `Prompt V${fix?.n ?? 2} with targeted negative constraints`,
      card: mustNot.length ? <ul className="ps-cchips" aria-label="Constraints added from the captured error">{mustNot.map((m, i) => <li key={i} className="ps-cchip" title={m}><b>MUST NOT</b><span>{m.replace(/^MUST NOT\s+/, "")}</span></li>)}<li className="ps-cchip ps-cchip--freeze"><b>FROZEN</b><span>Protected requirements unchanged</span></li></ul> : undefined,
    },
    {
      s: !fix ? "todo" : drift ? "fail" : lastRun?.exec?.ok ? "done" : "fail", icon: "terminal",
      t: drift ? "Re-executed: 0 errors, but rejected as drift" : !fix ? "Re-executed" : lastRun?.exec?.ok ? "Re-executed: renders with 0 errors" : "Re-executed: still failing",
      card: drift ? <div className="ps-tl-card ps-tl-card--bad"><span className="ps-tl-d">{drift.drift.reasons.join(" ")}</span></div>
        : fix && lastRun?.exec?.ok ? <div className="ps-tl-card ps-tl-card--ok"><span className="ps-tl-okline"><Icon name="check" size={14} />0 runtime errors · 0 console errors{lastRun.exec.rendered ? ` · rendered “${lastRun.exec.rendered.slice(0, 60)}”` : ""}</span></div> : undefined,
    },
    {
      s: verified ? "done" : p.status === "paused" || p.status === "stopped" ? "fail" : "todo", icon: verified ? "cert" : "cert",
      t: verified ? "Verified 0 errors, fix recorded in this Living project" : p.status === "paused" ? `Paused with a receipt: ${p.receipt?.reason ?? ""}` : "Verified 0 errors, fix recorded",
    },
  ];
  return (
    <section aria-labelledby="lv-tl-h" className="ps-tl-wrap">
      <h3 className="ps-eyebrow" id="lv-tl-h">Flow</h3>
      <ol className="ps-tl" data-testid="living-timeline">
        {steps.map((x, i) => (
          <li key={i} className={`ps-tl-step ps-tl-step--${x.s}`} style={{ animationDelay: `${i * 30}ms` }}>
            <span className="ps-tl-dot" aria-hidden="true"><Icon name={x.s === "fail" ? "xcircle" : x.s === "warn" ? "alert" : x.icon} size={14} /></span>
            <div className="ps-tl-body">
              <span className="ps-tl-t">{x.t}{x.tag}<span className="sr-only"> ({LABEL[x.s]})</span></span>
              {x.d && <span className="ps-tl-d">{x.d}</span>}
              {x.card}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
