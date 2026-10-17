// SPE Pro API: every Pro Studio tool runs here, behind a server-side Pro key check on EVERY request.
// Web-standard Request -> Response, so it runs on Cloudflare Workers (free plan), other edge runtimes, or the
// Vite dev/preview middleware used in tests. NOT DEPLOYED (hosting is on HOLD).
// Model calls are BYOK only: the customer's provider key arrives per request in X-Provider-Key, is used once,
// and is never stored, logged or echoed. SPE pays nothing for inference.
import { verifyProKey, keyEnvFrom, type KeyEnv, type KeyCheck } from "./keys.ts";
import { storeFromEnv, userKey, type ProStore } from "./store.ts";
import { hitRate, DEFAULT_RATE_PER_MIN, DEFAULT_BYOK_RATE_PER_MIN } from "./ratelimit.ts";
import { callModel, checkProvider, ProviderError, PROVIDERS, PROVIDER_IDS } from "./providers.ts";
import { check, assemble, detSummary, findVars, filled, tokens, lineDiff, fromSpe, toSpe, cleanVars, blockCheckSummary, type PlainBlock, type Version } from "../src/pro-studio/core/studio.ts";
import { TEMPLATES } from "../src/pro-studio/core/templates.ts";
import { validate, toOpenAI, toAnthropic, toMcpStyle, type Blueprint } from "../src/pro-studio/core/blueprint.ts";
import { runSuite, diffReports, evaluate, type TestCase } from "../src/pro-studio/core/regression.ts";
import { signRelease, verifyPack, fingerprint } from "../src/pro-studio/core/releases.ts";
import { exportCode, type CodeTarget, CODE_TARGETS } from "../src/pro-studio/core/codeExport.ts";
import { batchFill, batchToJsonl, toCsv } from "../src/pro-studio/core/csvBatch.ts";
import { lintBrand, guideToBlock, applyReplacements, type BrandGuide } from "../src/pro-studio/core/brandGuide.ts";
import { convert, type Fmt } from "../src/pro-studio/core/formats.ts";
import { estimateCost, type CostInput } from "../src/pro-studio/core/cost.ts";
import { scan, redact } from "../src/pro-studio/core/scanner.ts";
import { sha256, entryPayload, verifyChain, GENESIS, type AuditEntry } from "../src/pro-studio/core/audit.ts";
import { exportPack, importPack } from "../src/pro-studio/core/library.ts";
import { buildReport } from "../src/pro-studio/core/report.ts";
import { parseCommand, explain, suggest, HELP, type CwState } from "../src/pro-studio/core/coworkie.ts";
import { parseWorkspace } from "../src/pro-studio/core/workspace.ts";
import { newProject, runAttempt, stopProject, markHuman, ledgerOf, needsExecution, type Execute } from "../src/pro-studio/core/living/loop.ts";
import { compilePrompt, STRATEGY_LABEL } from "../src/pro-studio/core/living/compile.ts";
import { verifyRuns, sha256Hex, extractCode } from "../src/pro-studio/core/living/verify.ts";
import { buildCertificate, verifyCertificate, type Certificate } from "../src/pro-studio/core/living/certificate.ts";
import type { LivingProject } from "../src/pro-studio/core/living/types.ts";
import { breakdown, createBlind, revealBlind, cryptoRand, type BlindMap } from "../src/pro-studio/core/evalx.ts";

export interface ProEnv { [k: string]: unknown }
export interface ProDeps { keyEnv?: KeyEnv; store?: ProStore; fetch?: typeof fetch; now?: () => number; random?: () => number;
  /** Code-execution harness for "runs_clean" checks. Injected by the host (dev/test: Node harness). Absent on
   * the Worker build, where such checks pause honestly with NO_SANDBOX instead of pretending. */
  execute?: Execute }
export const MAX_BODY = 2 * 1024 * 1024;
export const DEFAULT_SPE_VERSION = "spe-pro-studio-r3";
const SEC = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
const J = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...SEC, ...extra } });
const bad = (msg: string, code = "BAD_REQUEST") => J(400, { error: code, message: msg });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;
const blocksOf = (x: unknown): PlainBlock[] => fromSpe({ format: "spe.prompt", version: 1, blocks: Array.isArray(x) ? x.map((b: Body) => ({ kind: b?.kind, title: b?.title, text: b?.text ?? "", must: b?.must, mustNot: b?.mustNot })) : x });
const str = (x: unknown, max = 200_000) => (typeof x === "string" ? x.slice(0, max) : "");
const envStr = (env: ProEnv, k: string) => (typeof env[k] === "string" ? (env[k] as string) : undefined);
const BYOK_ROUTES = new Set(["/living/step", "/regression/run", "/ab/create", "/portability/run"]);

async function releaseKeys(env: ProEnv): Promise<CryptoKeyPair | null> {
  const raw = envStr(env, "SPE_PRO_RELEASE_JWK"); if (!raw) return null;
  try { const jwk = JSON.parse(raw); const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]); const { d: _d, ...pub } = jwk; const publicKey = await crypto.subtle.importKey("jwk", { ...pub, key_ops: ["verify"] }, { name: "Ed25519" }, true, ["verify"]); return { privateKey, publicKey }; } catch { return null; }
}
async function readJson<T>(store: ProStore, k: string): Promise<T | null> { const v = await store.get(k); if (!v) return null; try { return JSON.parse(v) as T; } catch { return null; } }
async function appendAudit(store: ProStore, sub: string, action: string, detail: string, now: number) {
  const k = userKey(sub, "audit"); const log = (await readJson<AuditEntry[]>(store, k)) ?? [];
  const prev = log.length ? log[log.length - 1].hash : GENESIS;
  const base = { seq: log.length + 1, at: new Date(now).toISOString(), action: action.slice(0, 80), detail: detail.slice(0, 500), prev };
  const next = [...log, { ...base, hash: await sha256(entryPayload(base)) }];
  // Keep the newest 5,000 entries. Trimming is recorded by keeping seq numbers; verification covers the kept window.
  await store.put(k, JSON.stringify(next.length > 5000 ? next.slice(-5000) : next));
}
async function verifyWindow(log: AuditEntry[]) {
  if (!log.length || log[0].seq === 1) return verifyChain(log);
  // Trimmed window: verify links and hashes inside the window.
  for (let i = 0; i < log.length; i++) { const e = log[i]; if (i > 0 && (e.prev !== log[i - 1].hash || e.seq !== log[i - 1].seq + 1)) return { ok: false, brokenAt: e.seq, reason: `Entry ${e.seq} does not point to the entry before it.` }; if ((await sha256(entryPayload(e))) !== e.hash) return { ok: false, brokenAt: e.seq, reason: `Entry ${e.seq} was changed after it was written.` }; }
  return { ok: true, brokenAt: null, reason: `${log.length} newest entries (from ${log[0].seq}), chain intact.` };
}
const providerKeyOf = (req: Request, idx?: number) => (req.headers.get(idx === undefined ? "x-provider-key" : `x-provider-key-${idx}`) || "").trim();
/** Removes a provider key from any text before it leaves the server (defence in depth). */
const scrub = (s: string, ...keys: string[]) => keys.filter((k) => k && k.length >= 6).reduce((t, k) => t.split(k).join("[provider key removed]"), s);
const publicProject = (p: LivingProject) => ({ ...p, ledger: ledgerOf(p), strategyLabel: STRATEGY_LABEL[p.strategy] });

export async function handleProRequest(req: Request, env: ProEnv, deps: ProDeps = {}): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.startsWith("/api/pro")) return J(404, { error: "NOT_FOUND" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  const now = deps.now ?? Date.now; const rand = deps.random ?? cryptoRand; const f = deps.fetch ?? fetch;
  const kenv = deps.keyEnv ?? keyEnvFrom(Object.fromEntries(Object.entries(env).filter(([, v]) => typeof v === "string")) as Record<string, string>);
  const auth = req.headers.get("authorization") || "";
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const kc: KeyCheck = await verifyProKey(key, { ...kenv, now: kenv.now ?? now() });
  if (!kc.ok) return J(401, { error: "PRO_KEY_REQUIRED", reason: kc.reason, message: "A valid SPE Pro access key is required for this request." }, { "www-authenticate": 'Bearer realm="spe-pro"' });
  const sub = kc.payload.sub; const store = deps.store ?? storeFromEnv(env);
  const route = path.slice("/api/pro".length) || "/";
  const allowMock = envStr(env, "SPE_PRO_ALLOW_MOCK_PROVIDER") === "1" && kc.test;
  const speVersion = envStr(env, "SPE_VERSION") || DEFAULT_SPE_VERSION;
  const audit = (action: string, detail = "") => appendAudit(store, sub, action, detail, now());

  const rl = await hitRate(store, sub, "all", Number(envStr(env, "SPE_PRO_RATE_PER_MIN")) || DEFAULT_RATE_PER_MIN, now());
  if (!rl.ok) return J(429, { error: "RATE_LIMITED", message: "Too many requests. Wait a moment and try again." }, { "retry-after": String(rl.retryAfter) });
  if (BYOK_ROUTES.has(route)) { const b = await hitRate(store, sub, "byok", Number(envStr(env, "SPE_PRO_BYOK_RATE_PER_MIN")) || DEFAULT_BYOK_RATE_PER_MIN, now()); if (!b.ok) return J(429, { error: "RATE_LIMITED", message: "Too many model runs this minute. Wait a moment." }, { "retry-after": String(b.retryAfter) }); }

  if (req.method === "GET") {
    switch (route) {
      case "/session": return J(200, { ok: true, tier: kc.payload.tier, exp: kc.payload.exp, sub, test: kc.test, storage: store.kind, speVersion, simulatedProvider: allowMock, sandbox: deps.execute ? "node-harness" : "none" });
      case "/templates": return J(200, { templates: TEMPLATES });
      case "/providers": return J(200, { providers: [...PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label, note: PROVIDERS[id].note })), ...(allowMock ? [{ id: "mock", label: "Simulated (development only)", note: "Deterministic stand-in. Results are labelled SIMULATED and prove nothing about a real model." }] : [])] });
      case "/workspace": { const w = await store.get(userKey(sub, "ws")); return J(200, { workspace: parseWorkspace(w), storage: store.kind }); }
      case "/audit/list": { const log = (await readJson<AuditEntry[]>(store, userKey(sub, "audit"))) ?? []; return J(200, { entries: log, verify: await verifyWindow(log) }); }
      case "/living/list": {
        const keys = await store.list(userKey(sub, "living", ""));
        const items = (await Promise.all(keys.map((k) => readJson<LivingProject>(store, k)))).filter(Boolean).map((p) => ({ id: p!.id, name: p!.name, status: p!.status, attempts: p!.attempts.length, updatedAt: p!.updatedAt }));
        return J(200, { projects: items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)) });
      }
      default: return J(req.method === "GET" && route.startsWith("/") ? 404 : 405, { error: "NOT_FOUND", message: `No Pro API route ${route}.` });
    }
  }
  if (req.method !== "POST" && req.method !== "PUT") return J(405, { error: "METHOD_NOT_ALLOWED" });
  const len = Number(req.headers.get("content-length") || "0");
  if (len > MAX_BODY) return J(413, { error: "TOO_LARGE", message: "Request body is over 2 MB." });
  let b: Body; try { const t = await req.text(); if (t.length > MAX_BODY) return J(413, { error: "TOO_LARGE", message: "Request body is over 2 MB." }); b = t ? JSON.parse(t) : {}; } catch { return bad("Body must be JSON."); }
  if (!b || typeof b !== "object") b = {};
  const pk = providerKeyOf(req);

  const loadLiving = async (id: unknown) => (typeof id === "string" && /^[\w-]{1,40}$/.test(id) ? readJson<LivingProject>(store, userKey(sub, "living", id)) : null);
  const saveLiving = (p: LivingProject) => store.put(userKey(sub, "living", p.id), JSON.stringify(p));
  const modelCfg = (x: Body, apiKey: string) => { const provider = str(x?.provider, 30); const model = str(x?.model, 120).trim(); const err = checkProvider(provider, model, { allowMock }); return { err, cfg: { provider, model, apiKey, allowMock, maxTokens: Number(x?.maxTokens) || 600 } }; };

  try {
    if (req.method === "PUT") {
      if (route !== "/workspace") return J(405, { error: "METHOD_NOT_ALLOWED" });
      const ws = parseWorkspace(JSON.stringify(b.workspace ?? {})); const raw = JSON.stringify(ws);
      if (raw.length > 1_500_000) return J(413, { error: "TOO_LARGE", message: "Workspace is over 1.5 MB. Export older sessions as a Library pack." });
      await store.put(userKey(sub, "ws"), raw); return J(200, { ok: true, savedAt: new Date(now()).toISOString(), sessions: ws.sessions.length });
    }
    switch (route) {
      // ---------- Prompt Studio ----------
      case "/studio/analyze": {
        const bs = blocksOf(b.blocks); const vars = cleanVars(b.vars); const text = assemble(bs);
        return J(200, { assembled: text, output: b.mode === "filled" ? filled(text, vars) : text, checks: check(bs, vars), summary: detSummary(bs, vars), vars: findVars(text), tokens: tokens(text), words: text ? text.split(/\s+/).filter(Boolean).length : 0, blockChecks: bs.map((x) => blockCheckSummary(x)) });
      }
      case "/studio/diff": {
        const A = blocksOf(b.a), B = blocksOf(b.b); const ops = lineDiff(assemble(A), assemble(B));
        const items = (bs: PlainBlock[]) => new Set([...bs.flatMap((x) => (x.must ?? []).map((m) => `Must: ${m.trim()}`)), ...bs.flatMap((x) => (x.mustNot ?? []).map((m) => `Must not: ${m.trim()}`))].filter((x) => !/:\s*$/.test(x)));
        const ib = items(B); const intentLoss = [...items(A)].filter((x) => !ib.has(x));
        return J(200, { ops, add: ops.filter((o) => o.t === "add").length, del: ops.filter((o) => o.t === "del").length, intentLoss });
      }
      case "/studio/compare": { const one = (x: unknown) => { const bs = blocksOf(x); const t = assemble(bs); return { text: t, tokens: tokens(t), summary: detSummary(bs), checks: check(bs) }; }; return J(200, { a: one(b.a), b: one(b.b) }); }
      case "/studio/summaries": { const list = Array.isArray(b.versions) ? b.versions.slice(0, 200) : []; return J(200, { summaries: list.map((v: Body) => { try { return detSummary(blocksOf(v.blocks), cleanVars(v.variables)); } catch { return "unreadable"; } }) }); }
      case "/studio/import": {
        const raw = str(b.raw, 5 * 1024 * 1024); let d: Body; try { d = JSON.parse(raw); } catch { return bad(`“${str(b.name, 80) || "This file"}” is not valid JSON, so it can't be a .spe file.`); }
        const blocks = fromSpe(d);
        const versions: Version[] = Array.isArray(d.versions) ? d.versions.slice(0, 100).map((v: Body, i: number) => { try { return { id: `v${i + 1}`, note: String(v.note || "Imported").slice(0, 80), at: String(v.at || new Date(now()).toISOString()), blocks: fromSpe({ format: "spe.prompt", version: 1, blocks: v.blocks }), variables: cleanVars(v.variables) }; } catch (e) { throw new Error(`Version ${i + 1}: ${(e as Error).message}`); } }) : [];
        await audit("import.spe", str(b.name, 80));
        return J(200, { name: String(d.name ?? "").slice(0, 120), blocks, versions, vars: cleanVars(d.variables), mode: d.mode === "filled" ? "filled" : "template" });
      }
      case "/studio/export": await audit("export.spe", str(b.name, 80)); return J(200, { file: toSpe(str(b.name, 120), blocksOf(b.blocks), Array.isArray(b.versions) ? b.versions.slice(0, 200).map((v: Body) => ({ id: String(v.id), note: String(v.note).slice(0, 80), at: String(v.at), blocks: blocksOf(v.blocks), variables: cleanVars(v.variables) })) : [], cleanVars(b.vars), b.mode === "filled" ? "filled" : "template") });
      case "/blueprint": {
        const bp: Blueprint = b.bp; if (!bp || !Array.isArray(bp.agents) || !Array.isArray(bp.handoffs) || bp.agents.length > 100) return bad("Blueprint needs agents (max 100) and handoffs lists.");
        const ex = { mcp: toMcpStyle, openai: toOpenAI, anthropic: toAnthropic } as const; const fm = (b.fmt in ex ? b.fmt : "mcp") as keyof typeof ex;
        return J(200, { errors: validate(bp), export: ex[fm](bp) });
      }
      // ---------- Test & ship ----------
      case "/regression/run": {
        const cases: TestCase[] = Array.isArray(b.cases) ? b.cases.slice(0, 200) : [];
        if (!b.byok) { await audit("regression.simulated", `${cases.length} cases`); return J(200, { mode: "SIMULATED", report: diffReports(runSuite(str(b.a), cases), runSuite(str(b.b), cases)) }); }
        const { err, cfg } = modelCfg(b, pk); if (err) return bad(err);
        if (!pk && cfg.provider !== "mock") return bad("Real runs need your provider key (sent as X-Provider-Key). SPE does not supply a model.");
        if (cases.length > 20) return bad("Real runs are limited to 20 cases per request.");
        let simulated = false;
        const run = async (prompt: string) => { const out = []; for (const tc of cases) { const r = await callModel(cfg, prompt, tc.input, f); simulated ||= r.simulated; out.push(evaluate(r.text, tc)); } return out; };
        try { const ra = await run(str(b.a)); const rb = await run(str(b.b)); await audit("regression.byok", `${cfg.provider}/${cfg.model} · ${cases.length} cases`); return J(200, { mode: simulated ? "SIMULATED" : "BYOK_MODEL", provider: cfg.provider, model: cfg.model, report: diffReports(ra, rb) }); }
        catch (e) { return J(e instanceof ProviderError ? e.status : 502, { error: "PROVIDER_ERROR", message: scrub((e as Error).message, pk) }); }
      }
      case "/releases/sign": {
        const keys = await releaseKeys(env); if (!keys) return J(503, { error: "SIGNING_NOT_CONFIGURED", message: "The release signing key is not configured on this server. This is an open decision for the SPE owner." });
        const pack = await signRelease({ name: str(b.name, 120), version: str(b.version, 40).trim(), changelog: str(b.changelog, 4000), prompt: str(b.prompt), createdAt: new Date(now()).toISOString() }, keys);
        await audit("release.sign", `${pack.name} ${pack.version}`);
        return J(200, { pack, fingerprint: await fingerprint(pack.publicKey) });
      }
      case "/releases/verify": return J(200, await verifyPack(str(b.pack, 2_000_000), str(b.fingerprint, 64)));
      // ---------- Scale ----------
      case "/code": { const t = CODE_TARGETS.some((x) => x.id === b.target) ? (b.target as CodeTarget) : "python-openai"; await audit("export.code", t); return J(200, { code: exportCode(t, str(b.system), str(b.model, 120), str(b.message, 2000) || "Hello") }); }
      case "/batch": { const r = batchFill(str(b.template), str(b.csv, 5 * 1024 * 1024)); if (b.include) await audit("batch.export", `${r.rows.length} rows`); return J(200, { result: r, jsonl: b.include === "jsonl" ? batchToJsonl(r) : undefined, csv: b.include === "csv" ? toCsv([["row", "prompt", "missing"], ...r.rows.map((x) => [String(x.index), x.output, x.missing.join(" ")])]) : undefined }); }
      case "/brand": { const g: BrandGuide = { name: str(b.guide?.name, 80), voice: str(b.guide?.voice, 400), required: (b.guide?.required ?? []).slice(0, 100).map(String), banned: (b.guide?.banned ?? []).slice(0, 200).map(String), replace: (b.guide?.replace ?? []).slice(0, 200).map((r: Body) => ({ from: String(r.from), to: String(r.to) })), maxSentenceWords: Number(b.guide?.maxSentenceWords) > 0 ? Number(b.guide.maxSentenceWords) : null };
        return J(200, { findings: lintBrand(str(b.text), g), block: guideToBlock(g), replaced: Array.isArray(b.applyTo) ? b.applyTo.slice(0, 200).map((t: unknown) => applyReplacements(str(t), g)) : undefined }); }
      case "/formats": return J(200, { output: convert(blocksOf(b.blocks), (["markdown", "xml", "json", "plain"].includes(b.fmt) ? b.fmt : "markdown") as Fmt) });
      case "/cost": return J(200, estimateCost({ promptTokens: Number(b.promptTokens), inputTokensPerCall: Number(b.inputTokensPerCall), outputTokensPerCall: Number(b.outputTokensPerCall), pricePerMInput: Number(b.pricePerMInput), pricePerMOutput: Number(b.pricePerMOutput), callsPerDay: Number(b.callsPerDay), contextWindow: Number(b.contextWindow) > 0 ? Number(b.contextWindow) : null } as CostInput));
      case "/tokens": { const t = b.blocks ? assemble(blocksOf(b.blocks)) : str(b.text); return J(200, { tokens: tokens(t), chars: t.length }); }
      // ---------- Govern ----------
      case "/scan": { const t = str(b.text, MAX_BODY); const fs = scan(t); if (b.log) await audit("scan", `${fs.length} matches`); return J(200, { findings: fs, redacted: b.redact ? redact(t, fs) : undefined, redactedList: Array.isArray(b.redactList) ? b.redactList.slice(0, 500).map((x: unknown) => redact(str(x))) : undefined }); }
      case "/audit/append": { const action = str(b.action, 80).trim(); if (!/^[\w.-]{2,80}$/.test(action)) return bad("Action must be a short name like session.create."); await audit(action, str(b.detail, 500)); return J(200, { ok: true }); }
      case "/audit/verify": return J(200, await verifyChain(Array.isArray(b.log) ? b.log.slice(0, 10000) : []));
      case "/library/export": { await audit("library.export", `${(b.sessions ?? []).length} sessions`); return J(200, { pack: await exportPack(str(b.name, 120), (b.sessions ?? []).slice(0, 500).map((s: Body) => ({ ...s, blocks: blocksOf(s.blocks).map((x, i) => ({ ...x, id: String(i) })), vars: cleanVars(s.vars), title: str(s.title, 120) })), (b.projects ?? []).slice(0, 500)) }); }
      case "/library/import": return J(200, await importPack(str(b.raw, MAX_BODY)));
      case "/report": return J(200, { markdown: buildReport({ title: str(b.title, 120), client: str(b.client, 200), author: str(b.author, 200), notes: str(b.notes, 8000), blocks: blocksOf(b.blocks), vars: cleanVars(b.vars), versions: Array.isArray(b.versions) ? b.versions.slice(0, 200).map((v: Body) => ({ id: String(v.id), note: str(v.note, 80), at: str(v.at, 40), blocks: blocksOf(v.blocks) })) : [] }) });
      case "/coworkie": {
        const s: CwState = { tool: b.state?.tool ?? null, sessionTitle: b.state?.sessionTitle ? str(b.state.sessionTitle, 120) : null, projectName: b.state?.projectName ? str(b.state.projectName, 80) : null, blocks: b.state?.blocks ? blocksOf(b.state.blocks) : null, vars: cleanVars(b.state?.vars), versions: Array.isArray(b.state?.versions) ? b.state.versions.slice(0, 200) : [] };
        if (b.kind === "explain") return J(200, { lines: explain(s) });
        if (b.kind === "suggest") return J(200, { suggestions: suggest(s) });
        if (b.kind === "help") return J(200, { lines: HELP });
        if (b.kind === "context") return J(200, { suggestions: suggest(s), lines: [] });
        return J(200, { intent: parseCommand(str(b.input, 2000)) });
      }
      // ---------- Living .spe ----------
      case "/living/create": {
        const count = (await store.list(userKey(sub, "living", ""))).length; if (count >= 200) return bad("You have 200 Living projects. Delete some first.");
        const p = newProject({ ...(b.project ?? {}), id: undefined }, new Date(now()).toISOString());
        await saveLiving(p); await audit("living.create", p.name); return J(200, { project: publicProject(p) });
      }
      case "/living/get": { const p = await loadLiving(b.id); return p ? J(200, { project: publicProject(p) }) : J(404, { error: "NOT_FOUND", message: "No such Living project for this key." }); }
      case "/living/update": {
        const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND", message: "No such Living project for this key." });
        if (p.status === "running" && p.attempts.length) return J(409, { error: "RUNNING", message: "Stop the loop before editing the project." });
        const next = newProject({ ...p, ...(b.project ?? {}), id: p.id }, p.createdAt);
        const removed = p.requirements.filter((q) => !next.requirements.some((x) => x.id === q.id && x.text === q.text));
        if (removed.length && b.confirmRemove !== true) return J(409, { error: "INTENT_CHANGE", message: "This edit removes or changes protected requirements. Confirm to continue; it is recorded in the audit log.", removed: removed.map((q) => ({ id: q.id, text: q.text })) });
        const merged: LivingProject = { ...next, attempts: p.attempts, tokensUsed: p.tokensUsed, repairs: removed.length ? p.repairs.filter((r) => !removed.some((q) => q.id === r.reqId)) : p.repairs, strategy: p.strategy, status: p.attempts.length ? (p.status === "verified" ? "paused" : p.status) : "draft", humanMarks: p.humanMarks, receipt: p.receipt, updatedAt: new Date(now()).toISOString() };
        if (removed.length) await audit("living.requirements.removed", `${p.name}: ${removed.map((q) => q.text).join(" | ")}`.slice(0, 500));
        await saveLiving(merged); await audit("living.update", p.name); return J(200, { project: publicProject(merged) });
      }
      case "/living/delete": { const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND" }); await store.delete(userKey(sub, "living", p.id)); await audit("living.delete", p.name); return J(200, { ok: true }); }
      case "/living/preview": { const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND" }); return J(200, { prompt: compilePrompt({ intent: p.intent, requirements: p.requirements, strategy: p.strategy, repairs: p.repairs }), strategy: p.strategy }); }
      case "/living/step": {
        const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND", message: "No such Living project for this key." });
        const { err, cfg } = modelCfg(b, pk); if (err) return bad(err);
        if (!pk && cfg.provider !== "mock") return bad("Add your provider key. SPE never pays for model calls, so each run uses your own key (sent as X-Provider-Key, used once, not stored).");
        let simulated = cfg.provider === "mock";
        const next = await runAttempt(p, async (system, user) => { const r = await callModel(cfg, system, user, f); simulated ||= r.simulated; return r; }, { provider: cfg.provider, model: cfg.model, simulated, now: () => new Date(now()).toISOString(), execute: deps.execute });
        const clean: LivingProject = JSON.parse(scrub(JSON.stringify(next), pk));
        await saveLiving(clean);
        if (clean.attempts.length > p.attempts.length) { const a = clean.attempts[clean.attempts.length - 1]; await audit("living.step", `${p.name} · attempt ${a.n} · ${a.decision.kind}${"reason" in a.decision ? ` ${a.decision.reason}` : ""} · ${cfg.provider}/${cfg.model}${a.simulated ? " · SIMULATED" : ""}`); }
        return J(200, { project: publicProject(clean) });
      }
      case "/living/stop": { const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND" }); const n = stopProject(p, new Date(now()).toISOString()); await saveLiving(n); await audit("living.stop", p.name); return J(200, { project: publicProject(n) }); }
      case "/living/human": {
        const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND" });
        if (b.mark !== "pass" && b.mark !== "fail") return bad("Mark must be pass or fail.");
        const n = markHuman(p, str(b.reqId, 40), b.mark, new Date(now()).toISOString()); await saveLiving(n); await audit("living.human", `${p.name} · ${b.reqId} ${b.mark}`); return J(200, { project: publicProject(n) });
      }
      case "/living/certificate": {
        const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND" });
        const c = await buildCertificate(p, { speVersion, issuedAt: new Date(now()).toISOString(), keys: await releaseKeys(env), attempt: Number(b.attempt) || undefined });
        await audit("living.certificate", `${p.name} · attempt ${c.attempt} · ${c.verdict}`); return J(200, { certificate: c });
      }
      case "/living/export": { const p = await loadLiving(b.id); if (!p) return J(404, { error: "NOT_FOUND" }); return J(200, { file: { ...p, exportedAt: new Date(now()).toISOString(), speVersion } }); }
      case "/living/import": {
        let d: Body; try { d = typeof b.raw === "string" ? JSON.parse(str(b.raw, MAX_BODY)) : b.file; } catch { return bad("Not valid JSON."); }
        if (!d || d.format !== "spe.living") return bad("Not a Living .spe file (format spe.living).");
        // Imported definitions start fresh: history from another place is not re-trusted.
        const p = newProject({ name: d.name, intent: d.intent, requirements: d.requirements, inputs: d.inputs, budget: d.budget }, new Date(now()).toISOString());
        await saveLiving(p); await audit("living.import", p.name); return J(200, { project: publicProject(p) });
      }
      case "/certificate/verify": {
        const r = await verifyCertificate(b.certificate as Certificate, str(b.expectPublicKey, 200) || undefined);
        return J(200, r);
      }
      // ---------- Blind A/B ----------
      case "/ab/create": {
        const inputs: { id: string; text: string; category?: string; language?: string }[] = (Array.isArray(b.inputs) ? b.inputs : []).slice(0, 20).map((x: Body, i: number) => ({ id: String(x?.id ?? `c${i + 1}`).replace(/[^\w-]/g, "").slice(0, 24) || `c${i + 1}`, text: str(x?.text, 8000), category: x?.category ? str(x.category, 40) : undefined, language: x?.language ? str(x.language, 20) : undefined })).filter((x: { text: string }) => x.text.trim());
        if (!inputs.length) return bad("Add at least one test input.");
        if (!str(b.a).trim() || !str(b.b).trim()) return bad("Both prompts are needed.");
        const { err, cfg } = modelCfg(b, pk); if (err) return bad(err);
        if (!pk && cfg.provider !== "mock") return bad("Add your provider key: blind runs use your own model.");
        const outA: string[] = [], outB: string[] = []; let simulated = false;
        try { for (const inp of inputs) { const ra = await callModel(cfg, str(b.a), inp.text, f); const rb = await callModel(cfg, str(b.b), inp.text, f); simulated ||= ra.simulated || rb.simulated; outA.push(ra.text.slice(0, 4000)); outB.push(rb.text.slice(0, 4000)); } }
        catch (e) { return J(e instanceof ProviderError ? e.status : 502, { error: "PROVIDER_ERROR", message: scrub((e as Error).message, pk) }); }
        const bl = createBlind(inputs, outA, outB, rand); const id = (await sha256Hex(`${sub}:${now()}:${rand()}`)).slice(0, 20);
        await store.put(userKey(sub, "blind", id), JSON.stringify({ mapping: bl.mapping, inputs, provider: cfg.provider, model: cfg.model, simulated, createdAt: new Date(now()).toISOString() }), { ttlSeconds: 7 * 86400 });
        await audit("ab.create", `${inputs.length} cases · ${cfg.provider}/${cfg.model}${simulated ? " · SIMULATED" : ""}`);
        return J(200, { id, view: bl.view.map((v, i) => ({ ...v, input: inputs[i].text })), provider: cfg.provider, model: cfg.model, simulated });
      }
      case "/ab/reveal": {
        const id = str(b.id, 40); if (!/^[0-9a-f]{20}$/.test(id)) return bad("Unknown blind run.");
        const d = await readJson<{ mapping: BlindMap[]; inputs: { id: string; category?: string; language?: string }[]; simulated: boolean }>(store, userKey(sub, "blind", id)); if (!d) return J(404, { error: "NOT_FOUND", message: "This blind run expired or belongs to another key." });
        const picks: Record<string, string> = {}; for (const [k, v] of Object.entries(b.picks ?? {})) if (["x", "y", "tie"].includes(String(v))) picks[k] = String(v);
        const r = revealBlind(d.mapping, picks); await audit("ab.reveal", `A ${r.totals.A} · B ${r.totals.B} · tie ${r.totals.tie} · unpicked ${r.totals.unpicked}`);
        const byGroup = (by: "category" | "language") => { const groups = new Map<string, { group: string; A: number; B: number; tie: number; unpicked: number; n: number }>(); r.rows.forEach((row) => { const inp = d.inputs.find((x) => x.id === row.caseId); const k = (inp?.[by] ?? "").trim() || "(none)"; const g = groups.get(k) ?? { group: k, A: 0, B: 0, tie: 0, unpicked: 0, n: 0 }; g[row.winner]++; g.n++; groups.set(k, g); }); return [...groups.values()]; };
        return J(200, { ...r, simulated: d.simulated, byCategory: byGroup("category"), byLanguage: byGroup("language"), note: "These are human preferences on blind outputs, not automatic checks." });
      }
      // ---------- Cross-model portability ----------
      case "/portability/run": {
        const p = b.id ? await loadLiving(b.id) : newProject(b.project ?? {}, new Date(now()).toISOString());
        if (!p) return J(404, { error: "NOT_FOUND" });
        const models: Body[] = (Array.isArray(b.models) ? b.models : []).slice(0, 4); if (!models.length) return bad("Add at least one model.");
        const prompt = typeof b.prompt === "string" && b.prompt.trim() ? str(b.prompt) : compilePrompt({ intent: p.intent, requirements: p.requirements, strategy: p.strategy, repairs: p.repairs });
        const keys = models.map((_, i) => providerKeyOf(req, i)); const out = [];
        for (let i = 0; i < models.length; i++) {
          const { err, cfg } = modelCfg(models[i], keys[i]);
          if (err) { out.push({ provider: cfg.provider, model: cfg.model, status: "NOT_RUN", reason: err, pass: 0, fail: 0, notRun: 0, unproven: 0, results: [], byCategory: [], byLanguage: [], simulated: false }); continue; }
          if (!keys[i] && cfg.provider !== "mock") { out.push({ provider: cfg.provider, model: cfg.model, status: "NOT_RUN", reason: "No provider key for this model.", pass: 0, fail: 0, notRun: 0, unproven: 0, results: [], byCategory: [], byLanguage: [], simulated: false }); continue; }
          const runs = []; let simulated = false;
          for (const inp of p.inputs) { try { const r = await callModel(cfg, prompt, inp.text, f); simulated ||= r.simulated; const o = r.text.slice(0, 4000); runs.push({ inputId: inp.id, output: o, outputSha: await sha256Hex(o), ...(deps.execute && needsExecution(p) ? { exec: await deps.execute(extractCode(o)) } : {}) }); } catch (e) { runs.push({ inputId: inp.id, output: "", outputSha: "", error: scrub((e as Error).message, ...keys).slice(0, 200) }); } }
          const results = verifyRuns(p.requirements, runs);
          const rows = results.map((r) => { const inp = p.inputs.find((x) => x.id === r.inputId); return { category: inp?.category, language: inp?.language, status: r.status }; });
          out.push({ provider: cfg.provider, model: cfg.model, status: "RAN", simulated, pass: results.filter((r) => r.status === "VERIFIED").length, fail: results.filter((r) => r.status === "FAILED").length, notRun: results.filter((r) => r.status === "NOT_RUN").length, unproven: results.filter((r) => r.status === "UNPROVEN").length, results, runs: runs.map((r) => ({ inputId: r.inputId, output: r.output, error: (r as { error?: string }).error })), byCategory: breakdown(rows, "category"), byLanguage: breakdown(rows, "language") });
        }
        await audit("portability.run", `${p.name} · ${out.filter((m) => m.status === "RAN").length}/${out.length} models ran`);
        return J(200, { promptSha: await sha256Hex(prompt), checks: p.requirements.length * p.inputs.length, models: out, note: "Pass counts are deterministic checks on real outputs. NOT_RUN and UNPROVEN are not passes." });
      }
      default: return J(404, { error: "NOT_FOUND", message: `No Pro API route ${route}.` });
    }
  } catch (e) { return bad(scrub((e as Error).message || "Request failed.", pk)); }
}
