// Living .spe closed loop: compile -> firewall -> run on the customer's model -> verify -> diagnose ->
// decide (E0 repair / E1 change approach / verified / honest pause). One call = one attempt, so the caller
// can stop between attempts and every server request stays bounded. E2 (transition) is out of scope.
import type { Attempt, CheckResult, Decision, Deficit, ExecEvidence, LedgerEntry, LivingInput, LivingProject, PauseReason, Receipt, Repair, Requirement, Run, Strategy } from "./types.ts";
import { MAX_ATTEMPTS_CAP, MAX_INPUTS, MAX_REQUIREMENTS, OUTPUT_KEEP } from "./types.ts";
import { compilePrompt, repairClause, STRATEGIES, type CompileInput } from "./compile.ts";
import { verifyRuns, firewall, sha256Hex, isPass, extractCode, firstExecError } from "./verify.ts";
import { pinCallSite, driftCheck, scopedRepairText, driftRepairText, type ScopeReport } from "./scope.ts";
import { intentShield } from "./intentShield.ts";

export type RunModel = (system: string, user: string) => Promise<{ text: string; usage?: { total?: number } }>;
/** Sandbox harness that really executes generated code. Supplied by the host; never by the model. */
export type Execute = (code: string, opts?: { env?: "browser" | "ssr" }) => Promise<ExecEvidence>;
export interface StepOpts { provider: string; model: string; simulated: boolean; now?: () => string; compile?: (x: CompileInput) => string; execute?: Execute }
const nowIso = () => new Date().toISOString();
const rid = () => { const b = new Uint8Array(9); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); };
const clampInt = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const CHECK_KINDS = new Set(["contains", "not_contains", "regex", "not_regex", "json_valid", "json_keys", "max_words", "min_words", "max_chars", "starts_with", "ends_with", "line_count_max", "manual", "runs_clean"]);
export const needsExecution = (p: Pick<LivingProject, "requirements">) => p.requirements.some((q) => q.check.kind === "runs_clean");
function lineDiff(a: string, b: string) { const A = a.split("\n"), B = b.split("\n"); const sa = new Set(A), sb = new Set(B); return { added: B.filter((l) => l.trim() && !sa.has(l)), removed: A.filter((l) => l.trim() && !sb.has(l)) }; }

/** Validates and normalises a project definition. Throws a readable Error on bad input. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function newProject(d: any, at = nowIso()): LivingProject {
  if (!d || typeof d !== "object") throw new Error("Project definition is missing.");
  const intent = String(d.intent ?? "").trim().slice(0, 8000); if (!intent) throw new Error("Write the goal (intent) first.");
  const reqsIn = Array.isArray(d.requirements) ? d.requirements : [];
  if (reqsIn.length > MAX_REQUIREMENTS) throw new Error(`At most ${MAX_REQUIREMENTS} requirements.`);
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requirements: Requirement[] = reqsIn.map((q: any, i: number) => {
    const text = String(q?.text ?? "").trim().slice(0, 1000); if (!text) throw new Error(`Requirement ${i + 1} has no text.`);
    const kind = String(q?.check?.kind ?? "manual"); if (!CHECK_KINDS.has(kind)) throw new Error(`Requirement ${i + 1}: unknown check “${kind}”.`);
    let id = String(q?.id ?? `r${i + 1}`).replace(/[^\w-]/g, "").slice(0, 24) || `r${i + 1}`; if (seen.has(id)) id = `${id}_${i + 1}`; seen.add(id);
    const check = { kind: kind as Requirement["check"]["kind"], value: q.check?.value != null ? String(q.check.value).slice(0, 500) : undefined, n: q.check?.n != null ? Number(q.check.n) : undefined, keys: Array.isArray(q.check?.keys) ? q.check.keys.slice(0, 50).map((k: unknown) => String(k).slice(0, 80)) : undefined, caseSensitive: q.check?.caseSensitive === true, ...(kind === "runs_clean" && q.check?.env === "ssr" ? { env: "ssr" as const } : {}) };
    if (["contains", "not_contains", "regex", "not_regex", "starts_with", "ends_with"].includes(kind) && !check.value) throw new Error(`Requirement ${i + 1}: this check needs text.`);
    if (["max_words", "min_words", "max_chars", "line_count_max"].includes(kind) && !(Number(check.n) >= 0)) throw new Error(`Requirement ${i + 1}: this check needs a number.`);
    if (kind === "json_keys" && !check.keys?.length) throw new Error(`Requirement ${i + 1}: list the JSON keys.`);
    return { id, text, check };
  });
  const inputsIn = Array.isArray(d.inputs) ? d.inputs : [];
  if (inputsIn.length > MAX_INPUTS) throw new Error(`At most ${MAX_INPUTS} test inputs per project.`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs: LivingInput[] = inputsIn.map((x: any, i: number) => ({ id: String(x?.id ?? `i${i + 1}`).replace(/[^\w-]/g, "").slice(0, 24) || `i${i + 1}`, text: String(x?.text ?? "").slice(0, 8000), category: x?.category ? String(x.category).slice(0, 40) : undefined, language: x?.language ? String(x.language).slice(0, 20) : undefined })).filter((x: LivingInput) => x.text.trim());
  return {
    format: "spe.living", version: 1, id: typeof d.id === "string" && /^[\w-]{6,40}$/.test(d.id) ? d.id : rid(), name: String(d.name ?? "").trim().slice(0, 120) || "Untitled Living project", intent,
    requirements, inputs, budget: { maxAttempts: clampInt(d.budget?.maxAttempts, 1, MAX_ATTEMPTS_CAP, 5), maxTokens: clampInt(d.budget?.maxTokens, 100, 5_000_000, 50_000) },
    strategy: "direct", repairs: [], attempts: [], status: "draft", tokensUsed: 0, humanMarks: {}, receipt: null, createdAt: at, updatedAt: at,
  };
}

const est = (s: string) => Math.ceil(s.length / 4);
/** Latest result per requirement x input, with human marks applied to UNPROVEN manual checks only. */
export function ledgerOf(p: LivingProject): LedgerEntry[] {
  const last = p.attempts[p.attempts.length - 1];
  const out: LedgerEntry[] = [];
  for (const q of p.requirements) for (const inp of p.inputs) {
    const r = last?.results.find((x) => x.reqId === q.id && x.inputId === inp.id);
    const run = last?.runs.find((x) => x.inputId === inp.id);
    let status = r?.status ?? "NOT_RUN";
    if (status === "UNPROVEN" && p.humanMarks[q.id]) status = p.humanMarks[q.id] === "pass" ? "HUMAN_PASS" : "HUMAN_FAIL";
    out.push({ reqId: q.id, text: q.text, inputId: inp.id, status, attempt: last ? last.n : null, evidenceSha: run?.outputSha ?? "", evidence: r?.evidence ?? "Not run yet." });
  }
  return out;
}
function byReq(p: LivingProject, results: CheckResult[]) {
  const group = (pred: (s: CheckResult["status"]) => boolean) => p.requirements.filter((q) => results.filter((r) => r.reqId === q.id).some((r) => pred(r.status))).map((q) => q.id);
  const failed = group((s) => s === "FAILED" || s === "HUMAN_FAIL");
  const notRun = group((s) => s === "NOT_RUN").filter((id) => !failed.includes(id));
  const unproven = group((s) => s === "UNPROVEN").filter((id) => !failed.includes(id) && !notRun.includes(id));
  const verified = p.requirements.map((q) => q.id).filter((id) => { const rs = results.filter((r) => r.reqId === id); return rs.length > 0 && rs.every((r) => isPass(r.status)); });
  return { verified, failed, unproven, notRun };
}
function receiptOf(p: LivingProject, reason: Receipt["reason"], at: string): Receipt {
  const led = ledgerOf(p);
  const asResults = led.map((e) => ({ reqId: e.reqId, inputId: e.inputId, status: e.status, evidence: e.evidence }));
  const g = p.attempts.length ? byReq(p, asResults) : { verified: [], failed: [], unproven: [], notRun: p.requirements.map((q) => q.id) };
  let best: number | null = null; let bestScore = -1;
  for (const a of p.attempts) { const s = a.results.filter((r) => isPass(r.status)).length; if (s > bestScore) { bestScore = s; best = a.n; } }
  const srcs = new Set(p.attempts.map((a) => a.tokenSource));
  const MSG: Record<Receipt["reason"], string> = {
    VERIFIED: "Every requirement passed its check on every test input in the latest attempt.",
    USER_STOP: "You stopped the loop. Nothing below is claimed beyond what the checks recorded.",
    BUDGET_ATTEMPTS: "The attempt limit you set was reached before every requirement passed.",
    BUDGET_TOKENS: "The token budget you set was used up before every requirement passed.",
    PROVIDER_ERRORS: "Your model provider returned errors on two attempts in a row, so the loop paused instead of guessing.",
    INTENT_LOSS: "A compiled prompt lost a protected requirement, so it was blocked before reaching your model.",
    NEEDS_HUMAN_REVIEW: "All automatic checks pass, but some requirements have no automatic check and need your review.",
    NO_INPUTS: "Add at least one test input before running.",
    NO_REQUIREMENTS: "Add at least one requirement before running.",
    NO_SANDBOX: "A requirement needs the code to be executed, but this server has no execution sandbox. Nothing was executed, so nothing is claimed.",
  };
  const capturedErrors = p.attempts.flatMap((a) => a.runs.filter((r) => firstExecError(r.exec)).map((r) => ({ attempt: a.n, inputId: r.inputId, error: firstExecError(r.exec).slice(0, 300) })));
  const first = p.attempts[0], last = p.attempts[p.attempts.length - 1];
  const promptDiff = first && last && first !== last ? { from: first.n, to: last.n, ...lineDiff(first.prompt, last.prompt) } : null;
  const scopedRepairs = p.attempts.flatMap((a) => a.runs.filter((r) => r.scope).map((r) => { const s = r.scope!; return { attempt: a.n, inputId: r.inputId, verdict: s.verdict, pin: s.pin ? `line ${s.pin.line}: ${s.pin.expression}` : "not pinned", changed: s.drift.changed, outsidePin: s.drift.outsidePin, allowance: s.drift.allowance, touchedRegions: s.drift.touchedRegions.map((g) => `${g.start}${g.end !== g.start ? "–" + g.end : ""}${g.inPin ? " (pinned)" : ""}`).join(", "), importsChanged: [...s.drift.importsAdded.map((x) => "+" + x), ...s.drift.importsRemoved.map((x) => "−" + x)], stylingChanged: s.drift.stylingChanged.length, featuresRemoved: s.drift.featuresRemoved, regressions: s.regressions, preserved: s.preserved.map((x) => `${x.reqId}: ${x.before} → ${x.now}`), reasons: s.drift.reasons }; }));
  return { reason, message: MSG[reason], attemptsUsed: p.attempts.length, maxAttempts: p.budget.maxAttempts, tokensUsed: p.tokensUsed, maxTokens: p.budget.maxTokens, tokenSource: srcs.size === 0 ? "NONE" : srcs.size > 1 ? "MIXED" : ([...srcs][0] as "PROVIDER" | "ESTIMATED"), bestAttempt: best, ...g, at, capturedErrors, promptDiff, scopedRepairs };
}
const pause = (p: LivingProject, reason: PauseReason, at: string): LivingProject => ({ ...p, status: "paused", updatedAt: at, receipt: receiptOf(p, reason, at) });

/** Count of consecutive latest attempts in which requirement `id` failed after it already had a repair. */
function repairedFailStreak(p: LivingProject, id: string): number {
  let n = 0;
  for (let i = p.attempts.length - 1; i >= 0; i--) {
    const a = p.attempts[i]; const failed = a.results.some((r) => r.reqId === id && r.status === "FAILED");
    if (failed && a.repairs.some((r) => r.reqId === id) && a.strategy === p.strategy) n++; else break;
  }
  return n;
}
function diagnose(reqs: Requirement[], runs: Run[], results: CheckResult[]): Deficit[] {
  const out: Deficit[] = [];
  for (const r of runs) {
    if (r.error) { out.push({ inputId: r.inputId, kind: "PROVIDER_ERROR", detail: r.error }); continue; }
    if (!r.output.trim()) out.push({ inputId: r.inputId, kind: "EMPTY_OUTPUT", detail: "The model returned an empty answer." });
  }
  for (const res of results) {
    if (res.status !== "FAILED") continue;
    const q = reqs.find((x) => x.id === res.reqId)!; const k = q.check.kind;
    const drifted = k === "runs_clean" && runs.some((r) => r.inputId === res.inputId && r.scope?.verdict === "REJECTED_DRIFT");
    const kind = drifted ? "DRIFT" : k === "runs_clean" ? "RUNTIME_ERROR" : k === "contains" || k === "regex" || k === "starts_with" || k === "ends_with" ? "MISSING_CONTENT" : k === "not_contains" || k === "not_regex" ? "FORBIDDEN_CONTENT" : k === "json_valid" || k === "json_keys" ? "FORMAT" : "LENGTH";
    if (!out.some((d) => d.reqId === q.id && d.kind === kind)) out.push({ reqId: q.id, inputId: res.inputId, kind, detail: `${q.text}: ${res.evidence}` });
  }
  return out;
}

/** Most recent earlier run for this input that crashed, unless a later run for it was clean and accepted. */
function baselineFor(p: LivingProject, inputId: string): { attempt: number; run: Run; error: string; results: CheckResult[] } | null {
  for (let i = p.attempts.length - 1; i >= 0; i--) {
    const a = p.attempts[i]; const r = a.runs.find((x) => x.inputId === inputId);
    if (!r?.exec) continue;
    const err = firstExecError(r.exec);
    if (err) return { attempt: a.n, run: r, error: err, results: a.results };
    if (r.scope?.verdict === "REJECTED_DRIFT") continue;
    return null;
  }
  return null;
}
/** Scoped-repair verification: a run that now executes cleanly after a crash must stay inside the pinned
 *  region, keep imports/styling/features, and not regress any requirement that passed before. Otherwise the
 *  execution check for that input is FAILED as drift, even though it rendered with 0 errors. Mutates results. */
async function scopeVerify(p: LivingProject, runs: Run[], results: CheckResult[]) {
  const execReqs = p.requirements.filter((q) => q.check.kind === "runs_clean").map((q) => q.id);
  if (!execReqs.length) return;
  for (const r of runs) {
    if (!r.exec || !r.exec.ok) continue;
    const b = baselineFor(p, r.inputId); if (!b) continue;
    const before = extractCode(b.run.output), after = extractCode(r.output);
    const pin = pinCallSite(b.error, before, b.run.exec?.sites);
    const drift = driftCheck(before, after, pin);
    const preserved = p.requirements.filter((q) => q.check.kind !== "runs_clean").map((q) => ({ reqId: q.id, before: b.results.find((x) => x.reqId === q.id && x.inputId === r.inputId)?.status ?? "NOT_RUN", now: results.find((x) => x.reqId === q.id && x.inputId === r.inputId)?.status ?? "NOT_RUN" }));
    const regressions = preserved.filter((x) => isPass(x.before as CheckResult["status"]) && !isPass(x.now as CheckResult["status"])).map((x) => x.reqId);
    if (regressions.length) { drift.ok = false; drift.reasons.push(`Previously passing requirement${regressions.length > 1 ? "s" : ""} now fail: ${regressions.join(", ")}.`); }
    const scope: ScopeReport = { verdict: drift.ok ? "ACCEPTED" : "REJECTED_DRIFT", baseline: { attempt: b.attempt, codeSha: await sha256Hex(before), code: before, error: b.error }, pin, drift, preserved, regressions };
    r.scope = scope;
    if (scope.verdict === "REJECTED_DRIFT") for (const res of results) if (res.inputId === r.inputId && execReqs.includes(res.reqId) && res.status === "VERIFIED") { res.status = "FAILED"; res.evidence = `Ran with 0 errors, but the fix was rejected as drift: ${drift.reasons.join(" ")}`.slice(0, 600); }
  }
}

export async function runAttempt(p0: LivingProject, run: RunModel, o: StepOpts): Promise<LivingProject> {
  const at = (o.now ?? nowIso)();
  if (p0.status === "verified" || p0.status === "stopped") return p0;
  if (p0.status === "paused" && p0.receipt && ["BUDGET_ATTEMPTS", "BUDGET_TOKENS", "INTENT_LOSS"].includes(p0.receipt.reason)) {
    // Resume only if the user raised the cap that stopped it.
    const r = p0.receipt.reason;
    if ((r === "BUDGET_ATTEMPTS" && p0.attempts.length >= p0.budget.maxAttempts) || (r === "BUDGET_TOKENS" && p0.tokensUsed >= p0.budget.maxTokens) || r === "INTENT_LOSS") return p0;
  }
  const p: LivingProject = { ...p0, status: "running", receipt: null };
  if (!p.inputs.length) return pause(p, "NO_INPUTS", at);
  if (!p.requirements.length) return pause(p, "NO_REQUIREMENTS", at);
  if (p.attempts.length >= p.budget.maxAttempts) return pause(p, "BUDGET_ATTEMPTS", at);
  if (p.tokensUsed >= p.budget.maxTokens) return pause(p, "BUDGET_TOKENS", at);
  if (needsExecution(p) && !o.execute) return pause(p, "NO_SANDBOX", at);

  const n = p.attempts.length + 1;
  const prompt = (o.compile ?? compilePrompt)({ intent: p.intent, requirements: p.requirements, strategy: p.strategy, repairs: p.repairs });
  const promptSha = await sha256Hex(prompt);
  const fw = firewall(prompt, p.requirements);
  const shield = intentShield(p.requirements, prompt);
  const base = { n, strategy: p.strategy, prompt, promptSha, repairs: [...p.repairs], provider: o.provider, model: o.model, at, simulated: o.simulated, intentShield: shield };
  if (!fw.ok || shield.critical) {
    const deficits: Deficit[] = [...fw.missing.map((id): Deficit => ({ reqId: id, kind: "INTENT_LOSS", detail: `The compiled prompt dropped protected requirement ${id}.` })), ...(shield.critical ? shield.dropped.map((d): Deficit => ({ kind: "INTENT_LOSS", detail: `Intent Loss Detector (critical): ${d}` })) : [])];
    const a: Attempt = { ...base, runs: [], results: [], deficits, diagnosis: { deficits }, decision: { kind: "pause", reason: "INTENT_LOSS" }, tokens: 0, tokenSource: "ESTIMATED" };
    return pause({ ...p, attempts: [...p.attempts, a], updatedAt: at }, "INTENT_LOSS", at);
  }
  const runs: Run[] = []; let tokens = 0; let provided = true;
  for (const inp of p.inputs) {
    try {
      const r = await run(prompt, inp.text); const text = String(r.text ?? "");
      const t = Number(r.usage?.total); if (Number.isFinite(t) && t > 0) tokens += t; else { provided = false; tokens += est(prompt) + est(inp.text) + est(text); }
      const kept = text.slice(0, OUTPUT_KEEP);
      runs.push({ inputId: inp.id, output: kept, outputSha: await sha256Hex(kept), tokens: t > 0 ? t : undefined });
    } catch (e) {
      provided = false; tokens += est(prompt) + est(inp.text);
      runs.push({ inputId: inp.id, output: "", outputSha: "", error: String((e as Error).message || "Provider error").slice(0, 200) });
    }
  }
  if (o.execute && needsExecution(p)) {
    const env = p.requirements.find((q) => q.check.kind === "runs_clean")?.check.env ?? "browser";
    for (const r of runs) {
      if (r.error) continue;
      const code = extractCode(r.output);
      try { r.exec = await o.execute(code, { env }); }
      catch (e) { r.exec = { engine: "harness", codeSha: await sha256Hex(code), ok: false, errors: [`Harness error: ${String((e as Error).message || e).slice(0, 200)}`], consoleErrors: [], rendered: "", ms: 0 }; }
    }
  }
  const results = verifyRuns(p.requirements, runs);
  await scopeVerify(p, runs, results);
  const deficits = diagnose(p.requirements, runs, results);
  const next: LivingProject = { ...p, tokensUsed: p.tokensUsed + tokens, updatedAt: at };
  const allErr = runs.every((r) => r.error);
  const failed = [...new Set(results.filter((r) => r.status === "FAILED").map((r) => r.reqId))];
  const anyNotRun = results.some((r) => r.status === "NOT_RUN");
  const unproven = results.some((r) => r.status === "UNPROVEN" && !next.humanMarks[r.reqId]);
  let decision: Decision; let repairs: Repair[] = next.repairs; let strategy: Strategy = next.strategy;
  if (allErr) decision = { kind: "retry", why: "Every input hit a provider error." };
  else if (!failed.length && !anyNotRun) decision = unproven ? { kind: "pause", reason: "NEEDS_HUMAN_REVIEW" } : { kind: "verified" };
  else if (!failed.length) decision = { kind: "retry", why: "Some inputs hit provider errors; nothing failed a check." };
  else {
    const stuck = failed.filter((id) => repairedFailStreak({ ...next, attempts: [...next.attempts, { ...base, runs, results, deficits, diagnosis: { deficits }, decision: { kind: "retry", why: "" }, tokens, tokenSource: "ESTIMATED" }] }, id) >= 2);
    const idx = STRATEGIES.indexOf(strategy);
    if (stuck.length && idx < STRATEGIES.length - 1) { const to = STRATEGIES[idx + 1]; decision = { kind: "E1", from: strategy, to, reqIds: stuck }; strategy = to; }
    else decision = { kind: "E0", reqIds: failed };
    const add = failed.map((id): Repair => {
      const q = next.requirements.find((x) => x.id === id)!;
      if (q.check.kind !== "runs_clean") return { reqId: id, clause: repairClause(q), attempt: n };
      const drifted = runs.find((r) => r.scope?.verdict === "REJECTED_DRIFT");
      if (drifted) return { reqId: id, clause: driftRepairText(drifted.scope!), attempt: n, fromError: drifted.scope!.baseline.error.slice(0, 300) };
      const bad = runs.find((r) => firstExecError(r.exec)); const err = firstExecError(bad?.exec);
      if (!err || !bad) return { reqId: id, clause: repairClause(q), attempt: n };
      const pin = pinCallSite(err, extractCode(bad.output), bad.exec?.sites);
      return { reqId: id, clause: scopedRepairText(repairClause(q, err), err, pin), attempt: n, fromError: err.slice(0, 300) };
    }).filter((r) => !repairs.some((x) => x.clause === r.clause));
    repairs = [...repairs, ...add];
  }
  const a: Attempt = { ...base, runs, results, deficits, diagnosis: { deficits }, decision, tokens, tokenSource: provided ? "PROVIDER" : "ESTIMATED" };
  let out: LivingProject = { ...next, attempts: [...next.attempts, a], repairs, strategy };
  if (decision.kind === "verified") return { ...out, status: "verified", receipt: receiptOf(out, "VERIFIED", at) };
  if (decision.kind === "pause") return pause(out, decision.reason, at);
  if (allErr && p.attempts.length && p.attempts[p.attempts.length - 1].runs.every((r) => r.error)) return pause(out, "PROVIDER_ERRORS", at);
  if (out.attempts.length >= out.budget.maxAttempts) return pause(out, "BUDGET_ATTEMPTS", at);
  if (out.tokensUsed >= out.budget.maxTokens) return pause(out, "BUDGET_TOKENS", at);
  out = { ...out, status: "running" };
  return out;
}
export function stopProject(p: LivingProject, at = nowIso()): LivingProject {
  if (p.status === "verified" || p.status === "stopped") return p;
  return { ...p, status: "stopped", updatedAt: at, receipt: receiptOf(p, "USER_STOP", at) };
}
/** Human review of a manual (no automatic check) requirement. Labelled HUMAN_PASS / HUMAN_FAIL, never VERIFIED. */
export function markHuman(p: LivingProject, reqId: string, mark: "pass" | "fail", at = nowIso()): LivingProject {
  const q = p.requirements.find((x) => x.id === reqId); if (!q || q.check.kind !== "manual") throw new Error("Only requirements without an automatic check can be marked by a human.");
  const next: LivingProject = { ...p, humanMarks: { ...p.humanMarks, [reqId]: mark }, updatedAt: at };
  const last = next.attempts[next.attempts.length - 1]; if (!last) return next;
  const led = ledgerOf(next);
  if (led.every((e) => isPass(e.status))) return { ...next, status: "verified", receipt: receiptOf(next, "VERIFIED", at) };
  if (led.some((e) => e.status === "HUMAN_FAIL")) return { ...next, status: "paused", receipt: { ...receiptOf(next, "NEEDS_HUMAN_REVIEW", at), message: "A reviewer marked a requirement as not met." } };
  return next;
}
