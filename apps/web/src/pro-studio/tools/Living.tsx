// Living .spe: the closed loop. All work happens on the SPE Pro service; this view only edits the definition,
// drives one attempt per request, and shows exactly what the verifier recorded.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePro, useProAction, download, slug } from "../context.ts";
import { ToolFrame, ModelConnect, StatusBadge, Empty, Stepper } from "./Frame.tsx";
import { proApi, byokReady, ApiError } from "../api.ts";
import { LivingTimeline } from "./LivingTimeline.tsx";
import { Icon } from "../icons.tsx";
import type { LivingProject, LedgerEntry, Requirement, LivingInput, CheckKind, Attempt } from "../core/living/types.ts";
import type { Certificate } from "../core/living/certificate.ts";

type Pub = LivingProject & { ledger: LedgerEntry[]; strategyLabel: string };
interface ListItem { id: string; name: string; status: string; attempts: number; updatedAt: string }
const KIND_LABEL: Record<CheckKind, string> = {
  runs_clean: "Code runs with 0 errors (sandbox)", contains: "Must contain text", not_contains: "Must not contain text", regex: "Must match pattern", not_regex: "Must not match pattern",
  json_valid: "Valid JSON only", json_keys: "JSON object with keys", max_words: "At most N words", min_words: "At least N words", max_chars: "At most N characters",
  starts_with: "Starts with", ends_with: "Ends with", line_count_max: "At most N lines", manual: "Human review (no automatic check)",
};
const NEEDS_VALUE: CheckKind[] = ["contains", "not_contains", "regex", "not_regex", "starts_with", "ends_with"];
const NEEDS_N: CheckKind[] = ["max_words", "min_words", "max_chars", "line_count_max"];
const DECISION = (a: Attempt) => { const d = a.decision; switch (d.kind) { case "verified": return "All checks passed"; case "E0": return `E0 repair: added fixes for ${d.reqIds.join(", ")}`; case "E1": return `E1 approach change: ${d.from} → ${d.to} (stuck: ${d.reqIds.join(", ")})`; case "retry": return `Retry: ${d.why}`; case "pause": return `Paused: ${d.reason}`; } };
const lineDiff = (a: string, b: string) => { const A = a.split("\n"), B = b.split("\n"); const sa = new Set(A), sb = new Set(B); return { added: B.filter((l) => l.trim() && !sa.has(l)), removed: A.filter((l) => l.trim() && !sb.has(l)) }; };
interface Draft { name: string; intent: string; requirements: Requirement[]; inputs: LivingInput[]; budget: { maxAttempts: number; maxTokens: number } }
const blank = (): Draft => ({ name: "", intent: "", requirements: [{ id: "r1", text: "", check: { kind: "contains", value: "" } }], inputs: [{ id: "i1", text: "" }], budget: { maxAttempts: 5, maxTokens: 50_000 } });
const DEMO: Draft = {
  name: "Flagship demo: 3D Hero (SSR crash → captured error → scoped fix)",
  intent: "Build 3D Hero App",
  requirements: [
    { id: "r1", text: "The page must render on the server with zero runtime or console errors", check: { kind: "runs_clean", value: "3D Hero", env: "ssr" } },
    { id: "r2", text: "Keep the hero layout section", check: { kind: "contains", value: 'class=\\"hero\\"' } },
    { id: "r3", text: "Do not use eval", check: { kind: "not_contains", value: "eval(" } },
  ],
  inputs: [{ id: "i1", text: "Write the server-rendered hero as one JavaScript code block with a render() function. [demo:ssr-window]", category: "codegen", language: "js" }],
  budget: { maxAttempts: 4, maxTokens: 50_000 },
};
const DRIFT_DEMO: Draft = {
  name: "Drift demo: a fix that also drops a feature",
  intent: "Build a small todo list app that renders into #root.",
  requirements: [
    { id: "r1", text: "The app must run with zero runtime or console errors", check: { kind: "runs_clean", value: "My todos" } },
    { id: "r2", text: "Render a heading that says My todos", check: { kind: "contains", value: "My todos" } },
  ],
  inputs: [{ id: "i1", text: "Write the app as one JavaScript code block. [demo:drift-drop]", category: "codegen", language: "js" }],
  budget: { maxAttempts: 3, maxTokens: 50_000 },
};
const toDraft = (p: LivingProject): Draft => ({ name: p.name, intent: p.intent, requirements: p.requirements, inputs: p.inputs, budget: p.budget });

const TAB_LABEL = { result: "Result", ledger: "Proof ledger", repairs: "Repair checks", cert: "Certificate" } as const;
export default function Living() {
  const { announce, byok, setByok, info } = usePro();
  const [list, setList] = useState<ListItem[]>([]);
  const [p, setP] = useState<Pub | null>(null);
  const [d, setD] = useState<Draft>(blank);
  const [editing, setEditing] = useState(true);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState<"" | "save" | "run" | "stop">("");
  const [tab, setTab] = useState<"result" | "ledger" | "repairs" | "cert">("result"); const [allProj, setAllProj] = useState(false);
  const [cert, setCert] = useState<Certificate | null>(null); const [certCheck, setCertCheck] = useState<{ ok: boolean; reasons: string[] } | null>(null);
  const stopRef = useRef(false);
  const demoReady = !!info?.simulatedProvider && info?.sandbox === "node-harness";
  const loadList = useCallback(async () => { try { setList((await proApi<{ projects: ListItem[] }>("/living/list")).projects ?? []); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { void loadList(); }, [loadList]);
  const open = async (id: string) => { try { const r = await proApi<{ project: Pub }>("/living/get", { id }); setP(r.project); setD(toDraft(r.project)); setEditing(false); setCert(null); setCertCheck(null); setErr(""); } catch (e) { setErr((e as Error).message); } };
  const startNew = (from: Draft = blank()) => { setP(null); setD(structuredClone(from)); setEditing(true); setCert(null); setCertCheck(null); setErr(""); requestAnimationFrame(() => document.getElementById("lv-name")?.focus()); };
  useProAction((id) => { if (id === "new") startNew(); });

  const save = async (confirmRemove = false): Promise<Pub | null> => {
    setBusy("save"); setErr("");
    try {
      const r = p ? await proApi<{ project: Pub }>("/living/update", { id: p.id, project: d, confirmRemove }) : await proApi<{ project: Pub }>("/living/create", { project: d });
      setP(r.project); setD(toDraft(r.project)); setEditing(false); void loadList(); announce(p ? "Project saved" : "Living project created"); return r.project;
    } catch (e) {
      if (e instanceof ApiError && e.code === "INTENT_CHANGE") { if (window.confirm(`${e.message}\n\nContinue and remove or change those protected requirements?`)) return save(true); setErr("Not saved: protected requirements were kept."); return null; }
      setErr((e as Error).message); return null;
    } finally { setBusy(""); }
  };
  const runLoop = async (once = false) => {
    let first: Pub | null = p; if (!first || editing) first = await save(); if (!first) return;
    let cur: Pub = first;
    if (!byokReady(byok)) { setErr("Connect your model first: provider, model name and key."); document.getElementById("lv-mc-model")?.focus(); return; }
    setBusy("run"); setErr(""); stopRef.current = false; setCert(null); setCertCheck(null);
    try {
      for (let i = 0; i < 12; i++) {
        const r: { project: Pub } = await proApi<{ project: Pub }>("/living/step", { id: cur.id, provider: byok.provider, model: byok.model }, { providerKey: byok.provider === "mock" ? undefined : byok.key });
        cur = r.project; setP(cur);
        const a = cur.attempts[cur.attempts.length - 1]; if (a) announce(`Attempt ${a.n}: ${DECISION(a)}`);
        if (cur.status !== "running" || once || stopRef.current) break;
      }
      if (stopRef.current && cur.status === "running") { const r: { project: Pub } = await proApi<{ project: Pub }>("/living/stop", { id: cur.id }); cur = r.project; setP(cur); }
      announce(cur.status === "verified" ? "Verified: every check passed on the recorded outputs." : cur.receipt ? `Paused: ${cur.receipt.message}` : "Stopped after one attempt.");
      void loadList();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  };
  const stop = async () => { stopRef.current = true; if (!p || busy === "run") return; setBusy("stop"); try { const r = await proApi<{ project: Pub }>("/living/stop", { id: p.id }); setP(r.project); announce("Loop stopped"); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } };
  const mark = async (reqId: string, m: "pass" | "fail") => { if (!p) return; try { const r = await proApi<{ project: Pub }>("/living/human", { id: p.id, reqId, mark: m }); setP(r.project); announce(`Marked ${reqId} as human ${m}`); } catch (e) { setErr((e as Error).message); } };
  const getCert = async () => { if (!p) return; try { const r = await proApi<{ certificate: Certificate }>("/living/certificate", { id: p.id }); setCert(r.certificate); setCertCheck(await proApi<{ ok: boolean; reasons: string[] }>("/certificate/verify", { certificate: r.certificate })); } catch (e) { setErr((e as Error).message); } };
  const del = async () => { if (!p || !window.confirm(`Delete “${p.name}” and its history?`)) return; try { await proApi("/living/delete", { id: p.id }); setP(null); startNew(); void loadList(); announce("Project deleted"); } catch (e) { setErr((e as Error).message); } };
  const exportFile = async () => { if (!p) return; try { const r = await proApi<{ file: unknown }>("/living/export", { id: p.id }); download(`${slug(p.name)}.living.json`, JSON.stringify(r.file, null, 2)); } catch (e) { setErr((e as Error).message); } };
  const importFile = async (f: File) => { try { const r = await proApi<{ project: Pub }>("/living/import", { raw: await f.text() }); setP(r.project); setD(toDraft(r.project)); setEditing(false); void loadList(); announce("Imported. History is not imported; the loop starts fresh."); } catch (e) { setErr((e as Error).message); } };

  const running = busy === "run";
  const setReq = (i: number, q: Partial<Requirement>) => setD((dd) => ({ ...dd, requirements: dd.requirements.map((x, j) => (j === i ? { ...x, ...q } : x)) }));
  const setInp = (i: number, q: Partial<LivingInput>) => setD((dd) => ({ ...dd, inputs: dd.inputs.map((x, j) => (j === i ? { ...x, ...q } : x)) }));
  const rc = p?.receipt;

  const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, b ? (a / b) * 100 : 0))}%`;
  const diffPre = (removed: string[], added: string[], testid?: string) => <pre className="ps-pre ps-diff ps-pre--sm" data-testid={testid}>{removed.map((l, i) => <del key={`d${i}`}><span className="sr-only">Removed: </span>{l}{"\n"}</del>)}{added.map((l, i) => <ins key={`a${i}`}><span className="sr-only">Added: </span>{l}{"\n"}</ins>)}</pre>;
  const rcTone = rc ? (rc.reason === "VERIFIED" ? "ok" : rc.reason === "USER_STOP" ? "warn" : "warn") : "warn";

  const tabIds: ("result" | "ledger" | "repairs" | "cert")[] = rc?.scopedRepairs?.length ? ["result", "repairs", "ledger", "cert"] : ["result", "ledger", "cert"];
  const curTab = tabIds.includes(tab) ? tab : "result";
  const run = p ? (<section className="ps-run" aria-labelledby="lv-run-h" data-testid="living-panel">
    <div className="ps-run-head">
      <h2 id="lv-run-h">Run</h2>
      {p.attempts.some((a) => a.simulated) && <span className="ps-sim" title="Model output comes from the development provider">Simulated model</span>}
      <span className={`ps-lv-status ps-lv-status--${p.status}`} data-testid="living-status">{p.status.toUpperCase()}</span>
    </div>
    <div className="ps-run-meta">
      <div className="ps-kv"><span>Attempts</span><b>{p.attempts.length} <span className="ps-muted">of {p.budget.maxAttempts}</span></b><div className="ps-meter" aria-hidden="true"><i style={{ width: pct(p.attempts.length, p.budget.maxAttempts) }} /></div></div>
      <div className="ps-kv"><span>Tokens</span><b>{p.tokensUsed.toLocaleString()} <span className="ps-muted">/ {p.budget.maxTokens.toLocaleString()}</span></b><div className="ps-meter" aria-hidden="true"><i style={{ width: pct(p.tokensUsed, p.budget.maxTokens) }} /></div></div>
      <div className="ps-kv"><span>Approach</span><b title={p.strategyLabel}>{p.strategyLabel}</b></div>
    </div>
    <LivingTimeline p={p} />
    {p.attempts.some((a) => a.simulated) && <p className="ps-badge-sim"><span className="ps-sim">SIMULATED</span><span>Model text is scripted by the development provider. Sandbox execution and checks are real.</span></p>}
    <div className="ps-tabs" role="tablist" aria-label="Run evidence" onKeyDown={(e) => { const ids = tabIds; const k = ids.indexOf(curTab); const n = e.key === "ArrowRight" ? ids[(k + 1) % ids.length] : e.key === "ArrowLeft" ? ids[(k - 1 + ids.length) % ids.length] : null; if (n) { e.preventDefault(); setTab(n); document.getElementById(`lv-tab-${n}`)?.focus(); } }}>
      {tabIds.map((t) => <button key={t} type="button" role="tab" id={`lv-tab-${t}`} aria-controls={`lv-tp-${t}`} aria-selected={curTab === t} tabIndex={curTab === t ? 0 : -1} data-testid={`lv-tab-${t}`} onClick={() => setTab(t)}>{TAB_LABEL[t]}{t === "ledger" && p.ledger.length > 0 && <span className="ps-tab-n">{p.ledger.length}</span>}{t === "repairs" && <span className={`ps-tab-n${rc?.scopedRepairs?.some((x) => x.verdict !== "ACCEPTED") ? " ps-tab-n--bad" : ""}`}>{rc?.scopedRepairs?.length ?? 0}</span>}{t === "result" && rc && <span className={`ps-dot ps-dot--${p.status}`} aria-hidden="true" />}</button>)}
    </div>
    <div className="ps-tabp" role="tabpanel" id="lv-tp-result" aria-labelledby="lv-tab-result" hidden={curTab !== "result"}>{rc ?     <div className={`ps-verdict ps-verdict--${rcTone}`} role="status" data-testid="living-receipt">
      <div className="ps-verdict-h"><Icon name={rc.reason === "VERIFIED" ? "check" : "alert"} size={16} />{rc.reason === "VERIFIED" ? "Verified" : rc.reason === "USER_STOP" ? "Stopped by you" : `Paused: ${rc.reason}`}</div>
      <p>{rc.message}</p>
      <ul className="ps-rc-grid" aria-label="Requirements by status">
        <li><span>Verified</span><b>{rc.verified.join(", ") || "none"}</b></li><li><span>Failed</span><b>{rc.failed.join(", ") || "none"}</b></li>
        <li><span>Unproven</span><b>{rc.unproven.join(", ") || "none"}</b></li><li><span>Not run</span><b>{rc.notRun.join(", ") || "none"}</b></li>
      </ul>
      <p className="ps-meta"><span>Attempts {rc.attemptsUsed}/{rc.maxAttempts}</span><span>Tokens {rc.tokensUsed} ({rc.tokenSource.toLowerCase()})</span><span>Best attempt {rc.bestAttempt ?? "–"}</span></p>
      {!!rc.capturedErrors?.length && <div className="ps-stack" style={{ gap: 6 }}><h3 className="ps-eyebrow">Errors captured by the sandbox</h3><ul className="ps-cap-list" data-testid="captured-errors">{rc.capturedErrors.map((e, i) => <li key={i}><span className="ps-muted">Attempt {e.attempt} · {e.inputId}</span><code>{e.error}</code></li>)}</ul></div>}
      {rc.promptDiff && (rc.promptDiff.added.length > 0 || rc.promptDiff.removed.length > 0) && <details className="ps-details" data-testid="prompt-diff-details"><summary>Prompt V{rc.promptDiff.from} → V{rc.promptDiff.to} changes ({rc.promptDiff.added.length} added, {rc.promptDiff.removed.length} removed)</summary>{diffPre(rc.promptDiff.removed, rc.promptDiff.added, "prompt-diff")}</details>}
    </div> : <Empty icon="play">{running ? "Running… the receipt appears when the loop stops." : "Run the loop to get a receipt."}</Empty>}</div>
    {tabIds.includes("repairs") && <div className="ps-tabp" role="tabpanel" id="lv-tp-repairs" aria-labelledby="lv-tab-repairs" hidden={curTab !== "repairs"}>    <div className="ps-stack" style={{ gap: 10 }}><p className="ps-hint">Was each fix confined to the failing call-site?</p>
      <ul className="ps-scoped" data-testid="scoped-repairs">{(rc?.scopedRepairs ?? []).map((x, k) => <li key={k}>
        <div className="ps-scoped-h"><span className={`ps-badge ${x.verdict === "ACCEPTED" ? "ps-badge--ok" : "ps-badge--bad"}`}>{x.verdict === "ACCEPTED" ? "Accepted" : "Rejected: drift"}</span><b>Attempt {x.attempt}</b><code>{x.pin}</code></div>
        <p className="ps-meta"><span>{x.changed} line{x.changed === 1 ? "" : "s"} changed</span><span>{x.outsidePin} / {x.allowance} outside the pin</span><span>Regions: {x.touchedRegions || "none"}</span></p>
        <p className="ps-scoped-why">{x.reasons.join(" ") || "Inside the pinned region; imports, styling and features unchanged."}</p>
        <p className="ps-meta"><span>Kept checks: {x.preserved.join("; ") || "none"}</span>{x.regressions.length > 0 && <span className="ps-err">Regressed: {x.regressions.join(", ")}</span>}</p>
      </li>)}</ul></div></div>}
    <div className="ps-tabp" role="tabpanel" id="lv-tp-ledger" aria-labelledby="lv-tab-ledger" hidden={curTab !== "ledger"}>    <div className="ps-stack" style={{ gap: 10 }}><p className="ps-hint">Latest status of each requirement on each input.</p>
      {p.ledger.length === 0 ? <p className="ps-hint">Add requirements and test inputs.</p> : <ul className="ps-ledger" data-testid="living-ledger">{p.ledger.map((e) => { const q = p.requirements.find((x) => x.id === e.reqId); return <li key={`${e.reqId}-${e.inputId}`}>
        <span className="ps-ledger-t"><span className="ps-rid">{e.reqId}</span><span>{e.text}</span></span>
        <span className="ps-ledger-side"><span className="ps-tag">{e.inputId}</span><StatusBadge s={e.status} />{q?.check.kind === "manual" && e.status !== "NOT_RUN" && <><button type="button" className="ps-btn ps-btn--sm" onClick={() => void mark(e.reqId, "pass")}>Mark met</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => void mark(e.reqId, "fail")}>Mark not met</button></>}</span>
        <span className="ps-ledger-ev">{e.evidence}</span></li>; })}</ul>}
      <details className="ps-details"><summary>How verification works</summary><p>Only deterministic checks and execution in the sandbox can produce Verified. A model saying “done” is never evidence. Unproven, skipped, simulated and not-run results never count as a pass. Human marks are labelled as human.</p></details>
    </div></div>
    <div className="ps-tabp" role="tabpanel" id="lv-tp-cert" aria-labelledby="lv-tab-cert" hidden={curTab !== "cert"}><div className="ps-cert">
      <span className="ps-cert-i" aria-hidden="true"><Icon name="cert" size={18} /></span>
      <div className="ps-cert-t"><b>Proof certificate</b>
        {cert ? <p className="ps-hint" data-testid="cert-summary">Verdict <b>{cert.verdict}</b> · attempt {cert.attempt} · {cert.signed === "ED25519" ? "Ed25519-signed by this server" : "UNSIGNED (no release key on this server)"} · sha256 <code>{cert.certSha256.slice(0, 16)}…</code>{cert.simulated ? " · SIMULATED model" : ""}</p> : <p className="ps-hint">A portable record of this run that anyone can re-check.</p>}
        {certCheck && <p className={certCheck.ok ? "ps-ok" : "ps-err"} role="status" style={{ fontSize: 12.5 }}>{certCheck.ok ? "Independent re-check: the verifier re-ran every check on the stored outputs and agrees." : `Re-check failed: ${certCheck.reasons.join(" ")}`}</p>}
      </div>
      <div className="ps-row"><button type="button" className="ps-btn ps-btn--sm" disabled={!p.attempts.length} onClick={() => void getCert()} data-testid="living-cert">{cert ? "Recreate" : "Create certificate"}</button>{cert && <button type="button" className="ps-btn ps-btn--sm" onClick={() => download(`${slug(p.name)}-attempt-${cert.attempt}.proof.json`, JSON.stringify(cert, null, 2))}><Icon name="download" size={14} />Download</button>}</div>
    </div></div>
  </section>) : null;

  return (
    <ToolFrame id="living" layout="flow" actions={<>
      <button type="button" className="ps-btn ps-btn--ghost" disabled={running} onClick={() => { startNew(DEMO); if (demoReady) setByok({ provider: "mock", model: "scripted-demo", key: "" }); }} data-testid="living-demo"><Icon name="play" size={14} />Load flagship demo</button>
      <button type="button" className="ps-btn ps-btn--ghost" disabled={running} onClick={() => { startNew(DRIFT_DEMO); if (demoReady) setByok({ provider: "mock", model: "scripted-demo", key: "" }); }} data-testid="living-demo-drift">Load drift demo</button>
      <label className="ps-btn ps-file"><Icon name="upload" size={14} />Import<input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFile(f); }} /></label>
      <button type="button" className="ps-btn ps-btn--primary" onClick={() => startNew()}><Icon name="plus" size={14} />New project</button>
    </>}>
      {err && <p className="ps-err" role="alert" data-testid="living-err">{err}</p>}
      {list.length > 0 && <nav aria-label="Living projects" className="ps-lv-list"><ul>{(allProj ? list : list.slice(0, 6)).map((x) => <li key={x.id}><button type="button" className="ps-lv-proj" aria-pressed={p?.id === x.id} onClick={() => void open(x.id)}><b>{x.name}</b><small><span className={`ps-dot ps-dot--${x.status}`} aria-hidden="true" />{x.status} · {x.attempts} attempt{x.attempts === 1 ? "" : "s"}</small></button></li>)}</ul>{list.length > 6 && <button type="button" className="ps-btn ps-btn--sm ps-btn--ghost" onClick={() => setAllProj((v) => !v)}>{allProj ? "Show fewer" : `Show all ${list.length}`}</button>}</nav>}
      {d.inputs.some((x) => x.text.includes("[demo:")) && !demoReady && <p className="ps-warn">The flagship demo uses the simulated provider and the code sandbox, which are only switched on for development servers. On this server it will pause honestly instead of pretending.</p>}

      {editing ? (<form className="ps-form" aria-label="Living project definition" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="ps-lv-top">
          <label htmlFor="lv-name" className="sr-only">Project name</label>
          <input id="lv-name" className="ps-lv-name" value={d.name} maxLength={120} placeholder="Untitled project" onChange={(e) => { const v = e.target.value; setD((dd) => ({ ...dd, name: v })); }} />
          <div className="ps-goalbox">
            <label htmlFor="lv-goal" className="ps-eyebrow">Goal</label>
            <textarea id="lv-goal" rows={3} value={d.intent} placeholder="What must the prompt achieve? e.g. Answer billing questions in under 120 words" onChange={(e) => { const v = e.target.value; setD((dd) => ({ ...dd, intent: v })); }} />
            <div className="ps-goal-bar">
              <div className="ps-goal-set"><label htmlFor="lv-max">Attempt cap</label><Stepper id="lv-max" label="attempt cap" value={d.budget.maxAttempts} min={1} max={12} onChange={(n) => setD((dd) => ({ ...dd, budget: { ...dd.budget, maxAttempts: n } }))} /></div>
              <div className="ps-goal-set"><label htmlFor="lv-tok">Token budget</label><Stepper id="lv-tok" label="token budget" value={d.budget.maxTokens} min={100} step={1000} onChange={(n) => setD((dd) => ({ ...dd, budget: { ...dd.budget, maxTokens: n } }))} /></div>
            </div>
          </div>
        </div>
        <fieldset className="ps-fieldset"><legend>Protected requirements <small>· {d.requirements.length} · a version that loses one fails</small></legend>
          <ol className="ps-lv-reqs">{d.requirements.map((q, i) => <li key={i} className="ps-lv-req ps-reqrow"><span className="ps-rid" aria-hidden="true">{q.id || i + 1}</span>
            <label className="sr-only" htmlFor={`lv-rq-${i}`}>Requirement {i + 1}</label><input id={`lv-rq-${i}`} className="ps-inp" value={q.text} placeholder="e.g. Mention the 30-day refund window" onChange={(e) => setReq(i, { text: e.target.value })} />
            <label className="sr-only" htmlFor={`lv-ck-${i}`}>Check for requirement {i + 1}</label><select id={`lv-ck-${i}`} className="ps-inp ps-inp--auto" value={q.check.kind} onChange={(e) => setReq(i, { check: { kind: e.target.value as CheckKind } })}>{(Object.keys(KIND_LABEL) as CheckKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
            {(NEEDS_VALUE.includes(q.check.kind) || q.check.kind === "runs_clean") && <><label className="sr-only" htmlFor={`lv-cv-${i}`}>{q.check.kind === "runs_clean" ? "Text the app must render (optional)" : "Check text"}</label><input id={`lv-cv-${i}`} className="ps-inp" value={q.check.value ?? ""} placeholder={q.check.kind === "runs_clean" ? "must render (optional)" : "text or pattern"} onChange={(e) => setReq(i, { check: { ...q.check, value: e.target.value } })} /></>}
            {q.check.kind === "runs_clean" && <><label className="sr-only" htmlFor={`lv-ce-${i}`}>Where the code runs</label><select id={`lv-ce-${i}`} className="ps-inp" value={q.check.env ?? "browser"} onChange={(e) => setReq(i, { check: { ...q.check, env: e.target.value === "ssr" ? "ssr" : undefined } })}><option value="browser">In a page (DOM)</option><option value="ssr">Server render (no window)</option></select></>}
            {NEEDS_N.includes(q.check.kind) && <><label className="sr-only" htmlFor={`lv-cn-${i}`}>Number</label><input id={`lv-cn-${i}`} className="ps-inp ps-inp--num" type="number" min={0} value={q.check.n ?? ""} onChange={(e) => setReq(i, { check: { ...q.check, n: Number(e.target.value) } })} /></>}
            {q.check.kind === "json_keys" && <><label className="sr-only" htmlFor={`lv-ckeys-${i}`}>Keys</label><input id={`lv-ckeys-${i}`} className="ps-inp" value={(q.check.keys ?? []).join(", ")} placeholder="answer, sources" onChange={(e) => setReq(i, { check: { ...q.check, keys: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} /></>}
            <button type="button" className="ps-iconbtn" aria-label={`Remove requirement ${i + 1}`} title="Remove" onClick={() => setD((dd) => ({ ...dd, requirements: dd.requirements.filter((_, j) => j !== i) }))}><Icon name="trash" size={15} /></button>
          </li>)}</ol>
          <div><button type="button" className="ps-btn ps-btn--sm ps-btn--ghost" onClick={() => setD((dd) => ({ ...dd, requirements: [...dd.requirements, { id: `r${Date.now().toString(36).slice(-4)}`, text: "", check: { kind: "contains", value: "" } }] }))}><Icon name="plus" size={14} />Add requirement</button></div>
        </fieldset>
        <fieldset className="ps-fieldset"><legend>Test inputs <small>· {d.inputs.length} · each attempt runs every input</small></legend>
          <ol className="ps-lv-reqs">{d.inputs.map((x, i) => <li key={i} className="ps-lv-req ps-reqrow ps-reqrow--in"><span className="ps-rid" aria-hidden="true">{x.id || i + 1}</span>
            <label className="sr-only" htmlFor={`lv-in-${i}`}>Input {i + 1}</label><textarea id={`lv-in-${i}`} className="ps-ta" rows={2} value={x.text} placeholder="A real user message" onChange={(e) => setInp(i, { text: e.target.value })} />
            <label className="sr-only" htmlFor={`lv-cat-${i}`}>Category</label><input id={`lv-cat-${i}`} className="ps-inp" value={x.category ?? ""} placeholder="category" onChange={(e) => setInp(i, { category: e.target.value })} />
            <label className="sr-only" htmlFor={`lv-lang-${i}`}>Language</label><input id={`lv-lang-${i}`} className="ps-inp ps-inp--num" value={x.language ?? ""} placeholder="lang" onChange={(e) => setInp(i, { language: e.target.value })} />
            <button type="button" className="ps-iconbtn" aria-label={`Remove input ${i + 1}`} title="Remove" onClick={() => setD((dd) => ({ ...dd, inputs: dd.inputs.filter((_, j) => j !== i) }))}><Icon name="trash" size={15} /></button>
          </li>)}</ol>
          <div><button type="button" className="ps-btn ps-btn--sm ps-btn--ghost" onClick={() => setD((dd) => ({ ...dd, inputs: [...dd.inputs, { id: `i${Date.now().toString(36).slice(-4)}`, text: "" }] }))}><Icon name="plus" size={14} />Add input</button></div>
        </fieldset>
        <div className="ps-row ps-wrap"><button type="submit" className="ps-btn ps-btn--primary" disabled={busy === "save"} data-testid="living-save">{p ? "Save changes" : "Create project"}</button>{p && <button type="button" className="ps-btn ps-btn--ghost" onClick={() => { setD(toDraft(p)); setEditing(false); }}>Cancel</button>}</div>
      </form>) : p && (<div className="ps-card ps-def" data-testid="living-def">
        <div className="ps-def-top"><div style={{ minWidth: 0 }}><h2>{p.name}</h2><p className="ps-def-goal"><Icon name="target" size={14} />{p.intent}</p></div>
          <div className="ps-row"><button type="button" className="ps-btn ps-btn--sm ps-btn--ghost" disabled={running} onClick={() => setEditing(true)}><Icon name="edit" size={14} />Edit</button><button type="button" className="ps-btn ps-btn--sm ps-btn--ghost" onClick={() => void exportFile()}><Icon name="download" size={14} />Export</button><button type="button" className="ps-btn ps-btn--sm ps-btn--ghost ps-btn--danger" disabled={running} onClick={() => void del()}><Icon name="trash" size={14} />Delete</button></div></div>
        <ol className="ps-reqlist" aria-label="Protected requirements">{p.requirements.map((q) => <li key={q.id}><span className="ps-rid">{q.id}</span><span>{q.text}</span><small>{KIND_LABEL[q.check.kind]}{q.check.value ? `: “${q.check.value}”` : ""}{q.check.n != null ? `: ${q.check.n}` : ""}{q.check.env === "ssr" ? " · server render" : ""}</small></li>)}</ol>
        <p className="ps-meta"><span>{p.inputs.length} test input{p.inputs.length === 1 ? "" : "s"}</span><span>Cap {p.budget.maxAttempts} attempts</span><span>{p.budget.maxTokens.toLocaleString()} tokens</span></p>
      </div>)}

      <section className="ps-runbar" aria-label="Model and run controls">
        <ModelConnect idp="lv-mc" compact />
        <div className="ps-runbar-actions">
          <button type="button" className="ps-btn ps-btn--primary" disabled={running || busy === "save"} onClick={() => void runLoop()} data-testid="living-run">{running ? <><span className="ps-spinner" aria-hidden="true" />Running…</> : <><Icon name="play" size={14} />{p?.attempts.length ? "Continue loop" : "Run loop"}</>}</button>
          <button type="button" className="ps-btn" disabled={running} onClick={() => void runLoop(true)}>Run one attempt</button>
          <button type="button" className="ps-btn ps-btn--ghost ps-btn--danger" disabled={!p || (!running && p.status !== "running")} onClick={() => void stop()} data-testid="living-stop"><Icon name="stop" size={14} />Stop</button>
          <details className="ps-details"><summary>How the loop works</summary><p>Each attempt sends the compiled prompt and every test input to your model, using your key once. The loop stops by itself when everything is verified, when your cap or budget is reached, or when it cannot make honest progress.</p></details>
        </div>
      </section>

      {run ?? <div className="ps-empty ps-empty--inline"><span className="ps-card-i" aria-hidden="true"><Icon name="living" /></span><p><b>No run yet.</b> Create a project, or load the flagship demo to watch a crash get captured, repaired and verified.</p></div>}

      {p && p.attempts.length > 0 && <section aria-labelledby="lv-att-h" className="ps-sect" data-testid="living-attempts"><div className="ps-sect-h"><h2 id="lv-att-h">Attempts</h2><span className="ps-hint">Newest first</span></div>
        <ol className="ps-lv-attempts">{[...p.attempts].reverse().map((a) => { const prev = p.attempts.find((x) => x.n === a.n - 1); const df = prev ? lineDiff(prev.prompt, a.prompt) : null; const cnt = (st: string) => a.results.filter((r) => r.status === st).length; return <li key={a.n} className="ps-attempt">
          <div className="ps-attempt-h"><b>Attempt {a.n}</b><span className="ps-tag">{a.strategy}</span>{a.simulated && <span className="ps-sim">Simulated</span>}<span className="ps-muted">{a.provider}/{a.model} · {a.tokens} tokens ({a.tokenSource.toLowerCase()})</span></div>
          <p className="ps-hint">{DECISION(a)}</p>
          <p className="ps-meta"><span className="ps-st ps-st--ok">{cnt("VERIFIED")} verified</span><span className="ps-st ps-st--bad">{cnt("FAILED")} failed</span><span className="ps-st ps-st--warn">{cnt("UNPROVEN")} unproven</span><span className="ps-st ps-st--na">{cnt("NOT_RUN")} not run</span></p>
          {a.runs.filter((r) => r.exec).map((r) => <p key={r.inputId} className={r.exec!.ok ? "ps-ok" : "ps-err"} style={{ fontSize: 12.5 }}>Sandbox ({r.exec!.engine}) on {r.inputId}: {r.exec!.ok ? `0 runtime errors, 0 console errors · rendered “${r.exec!.rendered.slice(0, 80)}”` : `${[...r.exec!.errors, ...r.exec!.consoleErrors.map((c) => `console.error: ${c}`)].join(" · ")}`}</p>)}
          <div className="ps-attempt-x">
            {df && (df.added.length > 0 || df.removed.length > 0) && <details className="ps-details"><summary>Prompt changes from attempt {a.n - 1}</summary>{diffPre(df.removed, df.added)}</details>}
            <details className="ps-details"><summary>Prompt V{a.n} <span className="ps-muted ps-mono">sha256 {a.promptSha.slice(0, 12)}…</span></summary><pre className="ps-pre ps-pre--sm">{a.prompt}</pre></details>
            {a.runs.map((r) => <details key={r.inputId} className="ps-details"><summary>Model output for {r.inputId}{r.error ? " (provider error)" : ""}</summary><pre className="ps-pre ps-pre--sm">{r.error ?? r.output}</pre></details>)}
          </div>
        </li>; })}</ol></section>}
    </ToolFrame>
  );
}
