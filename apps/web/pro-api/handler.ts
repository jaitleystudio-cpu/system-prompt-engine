// SPE Pro API: every Pro Studio tool runs here, behind a server-side Pro key check.
// Web-standard Request -> Response, so it runs on Cloudflare Workers (free plan), other edge runtimes,
// or the Vite dev/preview middleware used in tests. No database, no paid API. AI calls are BYOK: the
// customer's provider key is forwarded once per request, never stored or logged, and billed to them.
import { verifyProKey, keyEnvFrom, type KeyEnv, type KeyCheck } from "./keys.ts";
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
import { sha256, entryPayload, verifyChain, type AuditEntry } from "../src/pro-studio/core/audit.ts";
import { exportPack, importPack } from "../src/pro-studio/core/library.ts";
import { buildReport } from "../src/pro-studio/core/report.ts";
import { parseCommand, explain, suggest, HELP, type CwState } from "../src/pro-studio/core/coworkie.ts";

export interface ProEnv { [k: string]: string | undefined }
export const MAX_BODY = 2 * 1024 * 1024;
const J = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", ...extra } });
const bad = (msg: string) => J(400, { error: "BAD_REQUEST", message: msg });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = any;
const blocksOf = (x: unknown): PlainBlock[] => fromSpe({ format: "spe.prompt", version: 1, blocks: Array.isArray(x) ? x.map((b: Body) => ({ kind: b?.kind, title: b?.title, text: b?.text ?? "", must: b?.must, mustNot: b?.mustNot })) : x });
const str = (x: unknown, max = 200_000) => (typeof x === "string" ? x.slice(0, max) : "");

async function releaseKeys(env: ProEnv): Promise<CryptoKeyPair | null> {
  if (!env.SPE_PRO_RELEASE_JWK) return null;
  try { const jwk = JSON.parse(env.SPE_PRO_RELEASE_JWK); const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]); const { d: _d, ...pub } = jwk; const publicKey = await crypto.subtle.importKey("jwk", { ...pub, key_ops: ["verify"] }, { name: "Ed25519" }, true, ["verify"]); return { privateKey, publicKey }; } catch { return null; }
}

async function byokComplete(provider: string, apiKey: string, model: string, system: string, user: string): Promise<string> {
  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 400 }) });
    if (!r.ok) throw new Error(`Provider returned HTTP ${r.status}`); const d: Body = await r.json(); return String(d?.choices?.[0]?.message?.content ?? "");
  }
  if (provider === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model, max_tokens: 400, system, messages: [{ role: "user", content: user }] }) });
    if (!r.ok) throw new Error(`Provider returned HTTP ${r.status}`); const d: Body = await r.json(); return String(d?.content?.[0]?.text ?? "");
  }
  throw new Error("Unknown provider. Use openai or anthropic.");
}

export async function handleProRequest(req: Request, env: ProEnv, keyEnvOverride?: KeyEnv): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.startsWith("/api/pro")) return J(404, { error: "NOT_FOUND" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const kenv = keyEnvOverride ?? keyEnvFrom(env);
  const auth = req.headers.get("authorization") || "";
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const kc: KeyCheck = await verifyProKey(key, kenv);
  if (!kc.ok) return J(401, { error: "PRO_KEY_REQUIRED", reason: kc.reason, message: "A valid SPE Pro access key is required for this request." }, { "www-authenticate": 'Bearer realm="spe-pro"' });
  const route = path.slice("/api/pro".length) || "/";

  if (req.method === "GET" && route === "/session") return J(200, { ok: true, tier: kc.payload.tier, exp: kc.payload.exp, sub: kc.payload.sub, test: kc.test });
  if (req.method === "GET" && route === "/templates") return J(200, { templates: TEMPLATES });
  if (req.method !== "POST") return J(405, { error: "METHOD_NOT_ALLOWED" });
  const len = Number(req.headers.get("content-length") || "0");
  if (len > MAX_BODY) return J(413, { error: "TOO_LARGE", message: "Request body is over 2 MB." });
  let b: Body; try { const t = await req.text(); if (t.length > MAX_BODY) return J(413, { error: "TOO_LARGE" }); b = t ? JSON.parse(t) : {}; } catch { return bad("Body must be JSON."); }

  try {
    switch (route) {
      case "/studio/analyze": {
        const bs = blocksOf(b.blocks); const vars = cleanVars(b.vars); const text = assemble(bs);
        return J(200, { assembled: text, output: b.mode === "filled" ? filled(text, vars) : text, checks: check(bs, vars), summary: detSummary(bs, vars), vars: findVars(text), tokens: tokens(text), words: text ? text.split(/\s+/).filter(Boolean).length : 0, blockChecks: bs.map((x) => blockCheckSummary(x)) });
      }
      case "/studio/diff": { const ops = lineDiff(assemble(blocksOf(b.a)), assemble(blocksOf(b.b))); return J(200, { ops, add: ops.filter((o) => o.t === "add").length, del: ops.filter((o) => o.t === "del").length }); }
      case "/studio/compare": { const one = (x: unknown) => { const bs = blocksOf(x); const t = assemble(bs); return { text: t, tokens: tokens(t), summary: detSummary(bs), checks: check(bs) }; }; return J(200, { a: one(b.a), b: one(b.b) }); }
      case "/studio/summaries": { const list = Array.isArray(b.versions) ? b.versions.slice(0, 200) : []; return J(200, { summaries: list.map((v: Body) => { try { return detSummary(blocksOf(v.blocks), cleanVars(v.variables)); } catch { return "unreadable"; } }) }); }
      case "/studio/import": {
        const raw = str(b.raw, 5 * 1024 * 1024); let d: Body; try { d = JSON.parse(raw); } catch { return bad(`“${str(b.name, 80) || "This file"}” is not valid JSON, so it can't be a .spe file.`); }
        const blocks = fromSpe(d);
        const versions: Version[] = Array.isArray(d.versions) ? d.versions.slice(0, 100).map((v: Body, i: number) => { try { return { id: `v${i + 1}`, note: String(v.note || "Imported").slice(0, 80), at: String(v.at || new Date().toISOString()), blocks: fromSpe({ format: "spe.prompt", version: 1, blocks: v.blocks }), variables: cleanVars(v.variables) }; } catch (e) { throw new Error(`Version ${i + 1}: ${(e as Error).message}`); } }) : [];
        return J(200, { name: String(d.name ?? "").slice(0, 120), blocks, versions, vars: cleanVars(d.variables), mode: d.mode === "filled" ? "filled" : "template" });
      }
      case "/studio/export": return J(200, { file: toSpe(str(b.name, 120), blocksOf(b.blocks), Array.isArray(b.versions) ? b.versions.slice(0, 200).map((v: Body) => ({ id: String(v.id), note: String(v.note).slice(0, 80), at: String(v.at), blocks: blocksOf(v.blocks), variables: cleanVars(v.variables) })) : [], cleanVars(b.vars), b.mode === "filled" ? "filled" : "template") });
      case "/blueprint": {
        const bp: Blueprint = b.bp; if (!bp || !Array.isArray(bp.agents) || !Array.isArray(bp.handoffs) || bp.agents.length > 100) return bad("Blueprint needs agents (max 100) and handoffs lists.");
        const ex = { mcp: toMcpStyle, openai: toOpenAI, anthropic: toAnthropic } as const; const f = (b.fmt in ex ? b.fmt : "mcp") as keyof typeof ex;
        return J(200, { errors: validate(bp), export: ex[f](bp) });
      }
      case "/regression/run": {
        const cases: TestCase[] = Array.isArray(b.cases) ? b.cases.slice(0, 200) : [];
        if (!b.byok) return J(200, { mode: "SIMULATED", report: diffReports(runSuite(str(b.a), cases), runSuite(str(b.b), cases)) });
        const pk = req.headers.get("x-provider-key") || ""; const provider = str(b.provider, 20); const model = str(b.model, 120);
        if (!pk || !model) return bad("Real runs need your provider key (sent as X-Provider-Key) and a model name. SPE does not supply a model.");
        if (cases.length > 20) return bad("Real runs are limited to 20 cases per request.");
        const run = async (prompt: string) => Promise.all(cases.map(async (tc) => evaluate(await byokComplete(provider, pk, model, prompt, tc.input), tc)));
        try { const [ra, rb] = await Promise.all([run(str(b.a)), run(str(b.b))]); return J(200, { mode: "BYOK_MODEL", provider, model, report: diffReports(ra, rb) }); }
        catch (e) { return J(502, { error: "PROVIDER_ERROR", message: (e as Error).message }); }
      }
      case "/releases/sign": {
        const keys = await releaseKeys(env); if (!keys) return J(503, { error: "SIGNING_NOT_CONFIGURED", message: "The release signing key is not configured on this server." });
        const pack = await signRelease({ name: str(b.name, 120), version: str(b.version, 40).trim(), changelog: str(b.changelog, 4000), prompt: str(b.prompt), createdAt: new Date().toISOString() }, keys);
        return J(200, { pack, fingerprint: await fingerprint(pack.publicKey) });
      }
      case "/releases/verify": return J(200, await verifyPack(str(b.pack, 2_000_000), str(b.fingerprint, 64)));
      case "/code": { const t = CODE_TARGETS.some((x) => x.id === b.target) ? (b.target as CodeTarget) : "python-openai"; return J(200, { code: exportCode(t, str(b.system), str(b.model, 120), str(b.message, 2000) || "Hello") }); }
      case "/batch": { const r = batchFill(str(b.template), str(b.csv, 5 * 1024 * 1024)); return J(200, { result: r, jsonl: b.include === "jsonl" ? batchToJsonl(r) : undefined, csv: b.include === "csv" ? toCsv([["row", "prompt", "missing"], ...r.rows.map((x) => [String(x.index), x.output, x.missing.join(" ")])]) : undefined }); }
      case "/brand": { const g: BrandGuide = { name: str(b.guide?.name, 80), voice: str(b.guide?.voice, 400), required: (b.guide?.required ?? []).slice(0, 100).map(String), banned: (b.guide?.banned ?? []).slice(0, 200).map(String), replace: (b.guide?.replace ?? []).slice(0, 200).map((r: Body) => ({ from: String(r.from), to: String(r.to) })), maxSentenceWords: Number(b.guide?.maxSentenceWords) > 0 ? Number(b.guide.maxSentenceWords) : null };
        return J(200, { findings: lintBrand(str(b.text), g), block: guideToBlock(g), replaced: Array.isArray(b.applyTo) ? b.applyTo.slice(0, 200).map((t: unknown) => applyReplacements(str(t), g)) : undefined }); }
      case "/formats": return J(200, { output: convert(blocksOf(b.blocks), (["markdown", "xml", "json", "plain"].includes(b.fmt) ? b.fmt : "markdown") as Fmt) });
      case "/cost": return J(200, estimateCost({ promptTokens: Number(b.promptTokens), inputTokensPerCall: Number(b.inputTokensPerCall), outputTokensPerCall: Number(b.outputTokensPerCall), pricePerMInput: Number(b.pricePerMInput), pricePerMOutput: Number(b.pricePerMOutput), callsPerDay: Number(b.callsPerDay), contextWindow: Number(b.contextWindow) > 0 ? Number(b.contextWindow) : null } as CostInput));
      case "/scan": { const t = str(b.text); const fs = scan(t); return J(200, { findings: fs, redacted: b.redact ? redact(t, fs) : undefined, redactedList: Array.isArray(b.redactList) ? b.redactList.slice(0, 500).map((x: unknown) => redact(str(x))) : undefined }); }
      case "/audit/append": {
        const seq = Number(b.seq); const prev = str(b.prev, 64); if (!(seq >= 1) || !/^[0-9a-f]{64}$/.test(prev)) return bad("Need seq >= 1 and a 64-hex prev hash.");
        const base = { seq, at: new Date().toISOString(), action: str(b.action, 80), detail: str(b.detail, 500), prev }; return J(200, { entry: { ...base, hash: await sha256(entryPayload(base)) } as AuditEntry });
      }
      case "/audit/verify": return J(200, await verifyChain(Array.isArray(b.log) ? b.log.slice(0, 10000) : []));
      case "/library/export": return J(200, { pack: await exportPack(str(b.name, 120), (b.sessions ?? []).slice(0, 500).map((s: Body) => ({ ...s, blocks: blocksOf(s.blocks).map((x, i) => ({ ...x, id: String(i) })), vars: cleanVars(s.vars), title: str(s.title, 120) })), (b.projects ?? []).slice(0, 500)) });
      case "/library/import": return J(200, await importPack(str(b.raw, 10 * 1024 * 1024)));
      case "/report": return J(200, { markdown: buildReport({ title: str(b.title, 120), client: str(b.client, 200), author: str(b.author, 200), notes: str(b.notes, 8000), blocks: blocksOf(b.blocks), vars: cleanVars(b.vars), versions: Array.isArray(b.versions) ? b.versions.slice(0, 200).map((v: Body) => ({ id: String(v.id), note: str(v.note, 80), at: str(v.at, 40), blocks: blocksOf(v.blocks) })) : [] }) });
      case "/coworkie": {
        const s: CwState = { tool: b.state?.tool ?? null, sessionTitle: b.state?.sessionTitle ? str(b.state.sessionTitle, 120) : null, projectName: b.state?.projectName ? str(b.state.projectName, 80) : null, blocks: b.state?.blocks ? blocksOf(b.state.blocks) : null, vars: cleanVars(b.state?.vars), versions: Array.isArray(b.state?.versions) ? b.state.versions.slice(0, 200) : [] };
        if (b.kind === "explain") return J(200, { lines: explain(s) });
        if (b.kind === "suggest") return J(200, { suggestions: suggest(s) });
        if (b.kind === "help") return J(200, { lines: HELP });
        return J(200, { intent: parseCommand(str(b.input, 2000)) });
      }
      default: return J(404, { error: "NOT_FOUND", message: `No Pro API route ${route}.` });
    }
  } catch (e) { return bad((e as Error).message || "Request failed."); }
}
