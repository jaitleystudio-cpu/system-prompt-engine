// Flagship flow timeline (Prawin's diagram): goal -> Prompt V1 with protected bounds -> model writes code ->
// executed: crashed? -> error log + call-site captured -> Intent Loss Shield, protected intent frozen ->
// Prompt V2 with targeted negative constraints -> re-executed -> "Verified 0 errors, fix recorded".
// Every step is derived from what the server recorded; nothing here is inferred from model text.
import type { LivingProject } from "../core/living/types.ts";

type State = "done" | "fail" | "todo" | "warn";
const ICON: Record<State, string> = { done: "✓", fail: "✕", todo: "○", warn: "!" };
const LABEL: Record<State, string> = { done: "done", fail: "failed", todo: "not reached", warn: "attention" };

export function LivingTimeline({ p }: { p: LivingProject }) {
  const a1 = p.attempts[0]; const last = p.attempts[p.attempts.length - 1];
  const crashed = p.attempts.find((a) => a.runs.some((r) => r.exec && !r.exec.ok));
  const crashRun = crashed?.runs.find((r) => r.exec && !r.exec.ok);
  const err = crashRun?.exec ? (crashRun.exec.errors[0] ?? (crashRun.exec.consoleErrors[0] ? `console.error: ${crashRun.exec.consoleErrors[0]}` : "")) : "";
  const fix = crashed ? p.attempts.find((a) => a.n > crashed.n) : undefined;
  const pinned = fix?.repairs.find((r) => r.fromError)?.clause.match(/The failing call-site is (line \d+(?:, column \d+)?): `([^`]*)`/);
  const mustNot = (fix?.repairs.find((r) => r.fromError)?.clause.match(/MUST NOT [^.]+\./g) ?? []).slice(0, 4);
  const lastRun = last?.runs.find((r) => r.exec);
  const drift = last?.runs.find((r) => r.scope?.verdict === "REJECTED_DRIFT")?.scope;
  const verified = p.status === "verified";
  const sim = p.attempts.some((a) => a.simulated);
  const steps: { s: State; t: string; d?: string }[] = [
    { s: "done", t: `Goal: ${p.intent.slice(0, 80)}` },
    { s: a1 ? (a1.decision.kind === "pause" && a1.decision.reason === "INTENT_LOSS" ? "fail" : "done") : "todo", t: `Prompt V1 compiled with ${p.requirements.length} protected requirement${p.requirements.length === 1 ? "" : "s"}` },
    { s: a1?.runs.length ? "done" : "todo", t: `Model wrote code${sim ? " (SIMULATED model)" : ""}` },
    { s: !a1?.runs.some((r) => r.exec) ? "todo" : crashed ? "warn" : "done", t: !a1?.runs.some((r) => r.exec) ? "Executed in the sandbox: crashed?" : crashed ? `Crashed when executed (attempt ${crashed.n})` : "Executed: no crash, 0 errors", d: err || undefined },
    { s: !crashed ? "todo" : pinned ? "done" : "warn", t: "Error log and call-site captured", d: pinned ? `${pinned[1]}: ${pinned[2]}` : crashed ? "Error captured; call-site not pinned." : undefined },
    { s: !fix ? "todo" : fix.intentShield?.critical ? "fail" : "done", t: "Intent Loss Shield: protected intent frozen", d: fix?.intentShield ? `Intent fidelity ${fix.intentShield.fidelity.toFixed(2)} · ${fix.intentShield.critical ? "critical loss: blocked" : "no critical loss"}` : undefined },
    { s: fix ? "done" : "todo", t: `Prompt V${fix?.n ?? 2} with targeted negative constraints`, d: mustNot.join(" ") || undefined },
    { s: !fix ? "todo" : drift ? "fail" : lastRun?.exec?.ok ? "done" : "fail", t: drift ? "Re-executed: 0 errors, but rejected as drift" : lastRun?.exec?.ok ? "Re-executed: renders with 0 errors" : "Re-executed: still failing", d: drift ? drift.drift.reasons.join(" ") : undefined },
    { s: verified ? "done" : p.status === "paused" || p.status === "stopped" ? "fail" : "todo", t: verified ? "Verified 0 errors, fix recorded in this Living project" : p.status === "paused" ? `Paused with a receipt: ${p.receipt?.reason ?? ""}` : "Verified 0 errors, fix recorded" },
  ];
  return (
    <section aria-labelledby="lv-tl-h" className="ps-tl-wrap">
      <h3 className="ps-h3" id="lv-tl-h">Flow</h3>
      <ol className="ps-tl" data-testid="living-timeline">
        {steps.map((x, i) => (
          <li key={i} className={`ps-tl-step ps-tl-step--${x.s}`}>
            <span className="ps-tl-dot" aria-hidden="true">{ICON[x.s]}</span>
            <span><b>{x.t}</b><span className="sr-only"> ({LABEL[x.s]})</span>{x.d && <span className="ps-tl-d">{x.d}</span>}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
