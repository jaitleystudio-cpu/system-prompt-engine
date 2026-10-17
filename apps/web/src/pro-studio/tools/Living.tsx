// Living .spe: the closed loop. All work happens on the SPE Pro service; this view only edits the definition,
// drives one attempt per request, and shows exactly what the verifier recorded.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePro, useProAction, download, slug } from "../context.ts";
import { ToolFrame, Field, ModelConnect, StatusBadge } from "./Frame.tsx";
import { proApi, byokReady, ApiError } from "../api.ts";
import { LivingTimeline } from "./LivingTimeline.tsx";
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

export default function Living() {
  const { announce, byok, setByok, info } = usePro();
  const [list, setList] = useState<ListItem[]>([]);
  const [p, setP] = useState<Pub | null>(null);
  const [d, setD] = useState<Draft>(blank);
  const [editing, setEditing] = useState(true);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState<"" | "save" | "run" | "stop">("");
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
      announce(cur.status === "verified" ? "Verified: every check passed on real outputs." : cur.receipt ? `Paused: ${cur.receipt.message}` : "Stopped after one attempt.");
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
  const setReq = (i: number, q: Partial<Requirement>) => setD({ ...d, requirements: d.requirements.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  const setInp = (i: number, q: Partial<LivingInput>) => setD({ ...d, inputs: d.inputs.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  const rc = p?.receipt;

  const panel = p ? (<div className="ps-stack" data-testid="living-panel">
    <div className="ps-row ps-wrap"><span className={`ps-lv-status ps-lv-status--${p.status}`} data-testid="living-status">{p.status.toUpperCase()}</span><span className="ps-hint">Attempt {p.attempts.length} of {p.budget.maxAttempts} · tokens {p.tokensUsed.toLocaleString()} / {p.budget.maxTokens.toLocaleString()} · approach: {p.strategyLabel}</span></div>
    <LivingTimeline p={p} />
    {p.attempts.some((a) => a.simulated) && <p className="ps-badge-sim">SIMULATED model output (development provider). Code execution and checks are real; the model text is scripted and proves nothing about a real model.</p>}
    {rc && <div className={`ps-verdict ps-verdict--${rc.reason === "VERIFIED" ? "ok" : "bad"}`} role="status" data-testid="living-receipt">
      <b>{rc.reason === "VERIFIED" ? "Verified" : rc.reason === "USER_STOP" ? "Stopped by you" : `Paused: ${rc.reason}`}</b><p>{rc.message}</p>
      <ul className="ps-hint"><li>Verified: {rc.verified.join(", ") || "none"}</li><li>Failed: {rc.failed.join(", ") || "none"}</li><li>Unproven: {rc.unproven.join(", ") || "none"}</li><li>Not run: {rc.notRun.join(", ") || "none"}</li><li>Attempts {rc.attemptsUsed}/{rc.maxAttempts} · tokens {rc.tokensUsed} ({rc.tokenSource.toLowerCase()}) · best attempt {rc.bestAttempt ?? "–"}</li></ul>
      {!!rc.capturedErrors?.length && <><h3 className="ps-h3">Errors captured by the sandbox</h3><ul className="ps-hint" data-testid="captured-errors">{rc.capturedErrors.map((e, i) => <li key={i}>Attempt {e.attempt} · {e.inputId}: <code>{e.error}</code></li>)}</ul></>}
      {rc.promptDiff && (rc.promptDiff.added.length > 0 || rc.promptDiff.removed.length > 0) && <><h3 className="ps-h3">Prompt V{rc.promptDiff.from} → V{rc.promptDiff.to}</h3><pre className="ps-pre ps-diff ps-pre--sm" data-testid="prompt-diff">{rc.promptDiff.removed.map((l, i) => <del key={`d${i}`}><span className="sr-only">Removed: </span>{l}{"\n"}</del>)}{rc.promptDiff.added.map((l, i) => <ins key={`a${i}`}><span className="sr-only">Added: </span>{l}{"\n"}</ins>)}</pre></>}
      {!!rc.scopedRepairs?.length && <><h3 className="ps-h3">Scoped repair checks</h3><div className="ps-table-wrap"><table className="ps-table" data-testid="scoped-repairs"><caption className="sr-only">Was each fix confined to the failing call-site?</caption><thead><tr><th scope="col">Attempt</th><th scope="col">Verdict</th><th scope="col">Pinned call-site</th><th scope="col">Lines changed</th><th scope="col">Outside pin</th><th scope="col">Regions</th><th scope="col">Kept checks</th><th scope="col">Why</th></tr></thead><tbody>{rc.scopedRepairs.map((x, k) => <tr key={k}><td>{x.attempt}</td><td><span className={`ps-badge ${x.verdict === "ACCEPTED" ? "ps-badge--ok" : "ps-badge--bad"}`}>{x.verdict === "ACCEPTED" ? "Accepted" : "Rejected: drift"}</span></td><td><code>{x.pin}</code></td><td>{x.changed}</td><td>{x.outsidePin} / {x.allowance}</td><td>{x.touchedRegions || "none"}</td><td>{x.preserved.join("; ") || "none"}{x.regressions.length ? ` · regressed: ${x.regressions.join(", ")}` : ""}</td><td>{x.reasons.join(" ") || "Inside the pinned region; imports, styling and features unchanged."}</td></tr>)}</tbody></table></div></>}
    </div>}
    <h3 className="ps-h3">Proof ledger</h3>
    {p.ledger.length === 0 ? <p className="ps-hint">Add requirements and test inputs.</p> : <div className="ps-scroll-x"><table className="ps-table" data-testid="living-ledger"><caption className="sr-only">Latest status of each requirement on each test input</caption><thead><tr><th scope="col">Requirement</th><th scope="col">Input</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead>
      <tbody>{p.ledger.map((e) => { const q = p.requirements.find((x) => x.id === e.reqId); return <tr key={`${e.reqId}-${e.inputId}`}><th scope="row">{e.reqId}. {e.text}</th><td>{e.inputId}</td><td><StatusBadge s={e.status} />{q?.check.kind === "manual" && e.status !== "NOT_RUN" && <span className="ps-row"><button type="button" className="ps-btn ps-btn--sm" onClick={() => void mark(e.reqId, "pass")}>Mark met</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => void mark(e.reqId, "fail")}>Mark not met</button></span>}</td><td className="ps-ev">{e.evidence}</td></tr>; })}</tbody></table></div>}
    <p className="ps-hint">Only deterministic checks and execution in the sandbox can produce Verified. A model saying “done” is never evidence. Human marks are labelled as human.</p>
    <h3 className="ps-h3">Proof certificate</h3>
    <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" disabled={!p.attempts.length} onClick={() => void getCert()} data-testid="living-cert">Create certificate</button>{cert && <button type="button" className="ps-btn ps-btn--sm" onClick={() => download(`${slug(p.name)}-attempt-${cert.attempt}.proof.json`, JSON.stringify(cert, null, 2))}>Download</button>}</div>
    {cert && <p className="ps-hint" data-testid="cert-summary">Verdict <b>{cert.verdict}</b> · attempt {cert.attempt} · {cert.signed === "ED25519" ? "Ed25519-signed by this server" : "UNSIGNED (no release key on this server)"} · sha256 <code>{cert.certSha256.slice(0, 16)}…</code>{cert.simulated ? " · SIMULATED model" : ""}</p>}
    {certCheck && <p className={certCheck.ok ? "ps-ok" : "ps-err"} role="status">{certCheck.ok ? "Independent re-check: the verifier re-ran every check on the stored outputs and agrees." : `Re-check failed: ${certCheck.reasons.join(" ")}`}</p>}
  </div>) : <div className="ps-empty ps-empty--inline"><p>Create or open a Living project to see its proof ledger.</p></div>;

  return (
    <ToolFrame id="living" panel={panel} panelLabel="Proof" actions={<>
      <button type="button" className="ps-btn" onClick={() => startNew()}>New project</button>
      <button type="button" className="ps-btn" onClick={() => { startNew(DEMO); if (demoReady) setByok({ provider: "mock", model: "scripted-demo", key: "" }); }} data-testid="living-demo">Load flagship demo</button>
      <button type="button" className="ps-btn" onClick={() => { startNew(DRIFT_DEMO); if (demoReady) setByok({ provider: "mock", model: "scripted-demo", key: "" }); }} data-testid="living-demo-drift">Load drift demo</button>
      <label className="ps-btn ps-file">Import<input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFile(f); }} /></label>
    </>}>
      {err && <p className="ps-err" role="alert" data-testid="living-err">{err}</p>}
      {list.length > 0 && <nav aria-label="Living projects" className="ps-lv-list"><ul className="ps-row ps-wrap">{list.map((x) => <li key={x.id}><button type="button" className="ps-chip" aria-pressed={p?.id === x.id} onClick={() => void open(x.id)}>{x.name} <small>· {x.status} · {x.attempts} attempts</small></button></li>)}</ul></nav>}
      {d.inputs.some((x) => x.text.includes("[demo:")) && !demoReady && <p className="ps-warn">The flagship demo uses the simulated provider and the code sandbox, which are only switched on for development servers. On this server it will pause honestly instead of pretending.</p>}

      {editing ? (<form className="ps-form" aria-label="Living project definition" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="ps-cols"><Field label="Project name" id="lv-name"><input id="lv-name" className="ps-inp" value={d.name} maxLength={120} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
          <div className="ps-cols"><Field label="Attempt cap (1–12)" id="lv-max"><input id="lv-max" className="ps-inp" type="number" min={1} max={12} value={d.budget.maxAttempts} onChange={(e) => setD({ ...d, budget: { ...d.budget, maxAttempts: Number(e.target.value) } })} /></Field>
            <Field label="Token budget" id="lv-tok"><input id="lv-tok" className="ps-inp" type="number" min={100} step={1000} value={d.budget.maxTokens} onChange={(e) => setD({ ...d, budget: { ...d.budget, maxTokens: Number(e.target.value) } })} /></Field></div></div>
        <Field label="Goal (what the prompt must achieve)" id="lv-goal"><textarea id="lv-goal" className="ps-ta" rows={3} value={d.intent} onChange={(e) => setD({ ...d, intent: e.target.value })} /></Field>
        <fieldset className="ps-fieldset"><legend>Protected requirements ({d.requirements.length}) — a version that loses one fails</legend>
          <ol className="ps-lv-reqs">{d.requirements.map((q, i) => <li key={i} className="ps-lv-req">
            <label className="sr-only" htmlFor={`lv-rq-${i}`}>Requirement {i + 1}</label><input id={`lv-rq-${i}`} className="ps-inp" value={q.text} placeholder="e.g. Mention the 30-day refund window" onChange={(e) => setReq(i, { text: e.target.value })} />
            <label className="sr-only" htmlFor={`lv-ck-${i}`}>Check for requirement {i + 1}</label><select id={`lv-ck-${i}`} className="ps-inp ps-inp--auto" value={q.check.kind} onChange={(e) => setReq(i, { check: { kind: e.target.value as CheckKind } })}>{(Object.keys(KIND_LABEL) as CheckKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
            {(NEEDS_VALUE.includes(q.check.kind) || q.check.kind === "runs_clean") && <><label className="sr-only" htmlFor={`lv-cv-${i}`}>{q.check.kind === "runs_clean" ? "Text the app must render (optional)" : "Check text"}</label><input id={`lv-cv-${i}`} className="ps-inp" value={q.check.value ?? ""} placeholder={q.check.kind === "runs_clean" ? "must render (optional)" : "text or pattern"} onChange={(e) => setReq(i, { check: { ...q.check, value: e.target.value } })} /></>}
            {q.check.kind === "runs_clean" && <><label className="sr-only" htmlFor={`lv-ce-${i}`}>Where the code runs</label><select id={`lv-ce-${i}`} className="ps-inp" value={q.check.env ?? "browser"} onChange={(e) => setReq(i, { check: { ...q.check, env: e.target.value === "ssr" ? "ssr" : undefined } })}><option value="browser">In a page (DOM)</option><option value="ssr">Server render (no window)</option></select></>}
            {NEEDS_N.includes(q.check.kind) && <><label className="sr-only" htmlFor={`lv-cn-${i}`}>Number</label><input id={`lv-cn-${i}`} className="ps-inp ps-inp--num" type="number" min={0} value={q.check.n ?? ""} onChange={(e) => setReq(i, { check: { ...q.check, n: Number(e.target.value) } })} /></>}
            {q.check.kind === "json_keys" && <><label className="sr-only" htmlFor={`lv-ckeys-${i}`}>Keys</label><input id={`lv-ckeys-${i}`} className="ps-inp" value={(q.check.keys ?? []).join(", ")} placeholder="answer, sources" onChange={(e) => setReq(i, { check: { ...q.check, keys: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} /></>}
            <button type="button" className="ps-btn ps-btn--sm" aria-label={`Remove requirement ${i + 1}`} onClick={() => setD({ ...d, requirements: d.requirements.filter((_, j) => j !== i) })}>Remove</button>
          </li>)}</ol>
          <button type="button" className="ps-btn ps-btn--sm" onClick={() => setD({ ...d, requirements: [...d.requirements, { id: `r${Date.now().toString(36).slice(-4)}`, text: "", check: { kind: "contains", value: "" } }] })}>Add requirement</button>
        </fieldset>
        <fieldset className="ps-fieldset"><legend>Test inputs ({d.inputs.length}) — each attempt runs every input</legend>
          <ol className="ps-lv-reqs">{d.inputs.map((x, i) => <li key={i} className="ps-lv-req">
            <label className="sr-only" htmlFor={`lv-in-${i}`}>Input {i + 1}</label><textarea id={`lv-in-${i}`} className="ps-ta" rows={2} value={x.text} placeholder="A real user message" onChange={(e) => setInp(i, { text: e.target.value })} />
            <label className="sr-only" htmlFor={`lv-cat-${i}`}>Category</label><input id={`lv-cat-${i}`} className="ps-inp" value={x.category ?? ""} placeholder="category" onChange={(e) => setInp(i, { category: e.target.value })} />
            <label className="sr-only" htmlFor={`lv-lang-${i}`}>Language</label><input id={`lv-lang-${i}`} className="ps-inp ps-inp--num" value={x.language ?? ""} placeholder="lang" onChange={(e) => setInp(i, { language: e.target.value })} />
            <button type="button" className="ps-btn ps-btn--sm" aria-label={`Remove input ${i + 1}`} onClick={() => setD({ ...d, inputs: d.inputs.filter((_, j) => j !== i) })}>Remove</button>
          </li>)}</ol>
          <button type="button" className="ps-btn ps-btn--sm" onClick={() => setD({ ...d, inputs: [...d.inputs, { id: `i${Date.now().toString(36).slice(-4)}`, text: "" }] })}>Add input</button>
        </fieldset>
        <div className="ps-row ps-wrap"><button type="submit" className="ps-btn ps-btn--primary" disabled={busy === "save"} data-testid="living-save">{p ? "Save changes" : "Create project"}</button>{p && <button type="button" className="ps-btn" onClick={() => { setD(toDraft(p)); setEditing(false); }}>Cancel</button>}</div>
      </form>) : p && (<div className="ps-card ps-card--flat" data-testid="living-def">
        <h2 className="ps-h3">{p.name}</h2><p>{p.intent}</p>
        <ol className="ps-hint">{p.requirements.map((q) => <li key={q.id}><b>{q.id}</b> {q.text} <small>· {KIND_LABEL[q.check.kind]}{q.check.value ? `: “${q.check.value}”` : ""}{q.check.n != null ? `: ${q.check.n}` : ""}</small></li>)}</ol>
        <p className="ps-hint">{p.inputs.length} test input{p.inputs.length === 1 ? "" : "s"} · cap {p.budget.maxAttempts} attempts · {p.budget.maxTokens.toLocaleString()} tokens</p>
        <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" disabled={running} onClick={() => setEditing(true)}>Edit</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => void exportFile()}>Export</button><button type="button" className="ps-btn ps-btn--sm ps-btn--danger" disabled={running} onClick={() => void del()}>Delete</button></div>
      </div>)}

      <ModelConnect idp="lv-mc" />
      <div className="ps-row ps-wrap ps-lv-run">
        <button type="button" className="ps-btn ps-btn--primary" disabled={running || busy === "save"} onClick={() => void runLoop()} data-testid="living-run">{running ? "Running…" : p?.attempts.length ? "Continue loop" : "Run loop"}</button>
        <button type="button" className="ps-btn" disabled={running} onClick={() => void runLoop(true)}>Run one attempt</button>
        <button type="button" className="ps-btn ps-btn--danger" disabled={!p || (!running && p.status !== "running")} onClick={() => void stop()} data-testid="living-stop">Stop</button>
      </div>
      <p className="ps-hint">Each attempt sends the compiled prompt and every test input to your model, using your key once. The loop stops by itself when everything is verified, when your cap or budget is reached, or when it cannot make honest progress.</p>

      {p && p.attempts.length > 0 && <section aria-label="Attempts" className="ps-stack" data-testid="living-attempts"><h2 className="ps-h3">Attempts</h2>
        <ol className="ps-lv-attempts">{[...p.attempts].reverse().map((a) => { const prev = p.attempts.find((x) => x.n === a.n - 1); const df = prev ? lineDiff(prev.prompt, a.prompt) : null; return <li key={a.n} className="ps-card ps-card--flat">
          <p><b>Attempt {a.n}</b> · {a.strategy} · {a.provider}/{a.model}{a.simulated ? " · SIMULATED" : ""} · {a.tokens} tokens ({a.tokenSource.toLowerCase()})</p>
          <p className="ps-hint">{DECISION(a)}</p>
          <p className="ps-hint">{a.results.filter((r) => r.status === "VERIFIED").length} verified · {a.results.filter((r) => r.status === "FAILED").length} failed · {a.results.filter((r) => r.status === "UNPROVEN").length} unproven · {a.results.filter((r) => r.status === "NOT_RUN").length} not run</p>
          {a.runs.filter((r) => r.exec).map((r) => <p key={r.inputId} className={r.exec!.ok ? "ps-ok" : "ps-err"}>Sandbox ({r.exec!.engine}) on {r.inputId}: {r.exec!.ok ? `0 runtime errors, 0 console errors · rendered “${r.exec!.rendered.slice(0, 80)}”` : `${[...r.exec!.errors, ...r.exec!.consoleErrors.map((c) => `console.error: ${c}`)].join(" · ")}`}</p>)}
          {df && (df.added.length > 0 || df.removed.length > 0) && <details><summary>Prompt changes from attempt {a.n - 1}</summary><pre className="ps-pre ps-diff ps-pre--sm">{df.removed.map((l, i) => <del key={`d${i}`}><span className="sr-only">Removed: </span>{l}{"\n"}</del>)}{df.added.map((l, i) => <ins key={`a${i}`}><span className="sr-only">Added: </span>{l}{"\n"}</ins>)}</pre></details>}
          <details><summary>Prompt V{a.n} (sha256 {a.promptSha.slice(0, 12)}…)</summary><pre className="ps-pre ps-pre--sm">{a.prompt}</pre></details>
          {a.runs.map((r) => <details key={r.inputId}><summary>Model output for {r.inputId}{r.error ? " (provider error)" : ""}</summary><pre className="ps-pre ps-pre--sm">{r.error ?? r.output}</pre></details>)}
        </li>; })}</ol></section>}
    </ToolFrame>
  );
}
