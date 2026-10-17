// Development / test execution harness for the Living "runs_clean" check. NODE ONLY: never imported by
// the Cloudflare Worker entry or by client code.
//
// What it really does: runs the generated JavaScript in a separate worker thread (own heap, memory cap,
// empty env, hard wall-clock kill) inside a fresh vm context that has a minimal fake DOM
// (document.getElementById / createElement / body / querySelector), console capture, setTimeout and
// queueMicrotask, and nothing else: no require, no process, no fetch. It records uncaught exceptions,
// syntax errors, unhandled promise rejections, console.error calls, timeouts and the rendered text.
//
// What it is NOT: node:vm is not a security boundary. This harness is for development and tests with
// mocked or trusted output. Production needs real isolation (a sandboxed iframe in the user's browser or
// an isolated container); that is an open decision.
import { Worker } from "node:worker_threads";
import type { ExecEvidence } from "../src/pro-studio/core/living/types.ts";
import { sha256Hex } from "../src/pro-studio/core/living/verify.ts";

export const NODE_HARNESS_ID = "node-vm-worker/1 (dev/test harness)";

const WORKER_SRC = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
const vm = require("node:vm");
const errors = [], consoleErrors = [], logs = [], sites = [];
const SSR = workerData.env === "ssr";
const site = (e) => { const m = /generated\.js:(\d+)(?::(\d+))?/.exec(String((e && e.stack) || "")); if (m && !sites.length) sites.push(m[2] ? { line: +m[1], col: +m[2] } : { line: +m[1] }); };
const fmt = (e) => { site(e); return e && e.name && e.message ? e.name + ": " + e.message : String(e); };
process.on("uncaughtException", (e) => errors.push(fmt(e)));
process.on("unhandledRejection", (e) => errors.push("Unhandled rejection: " + fmt(e)));
const strip = (h) => String(h).replace(/<[^>]*>/g, " ");
function el(tag) {
  const node = { tagName: String(tag).toUpperCase(), children: [], attributes: {}, style: {}, dataset: {}, _html: "", _text: null,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k] ?? null; },
    appendChild(c) { this.children.push(c); return c; }, append(...cs) { for (const c of cs) this.children.push(typeof c === "string" ? { text: () => c } : c); },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = String(v); this._text = null; this.children = []; },
    get textContent() { return this.text(); }, set textContent(v) { this._text = String(v); this._html = ""; this.children = []; },
    text() { return (this._text ?? strip(this._html)) + " " + this.children.map((c) => (c && c.text ? c.text() : "")).join(" "); },
  };
  return node;
}
const root = el("div"); root.attributes.id = "root"; const app = el("div"); app.attributes.id = "app";
const body = el("body"); body.children.push(root, app);
const byId = { root, app };
const document = { body, documentElement: body, title: "",
  getElementById: (id) => byId[id] ?? null, createElement: (t) => el(t), createTextNode: (t) => ({ text: () => String(t) }),
  querySelector: (s) => (s === "#root" ? root : s === "#app" ? app : s === "body" ? body : null), querySelectorAll: () => [], addEventListener() {} };
const out = (arr) => (...a) => arr.push(a.map((x) => (typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })())).join(" ").slice(0, 500));
const sandboxConsole = { log: out(logs), info: out(logs), warn: out(logs), debug: out(logs), error: out(consoleErrors) };
const timers = [];
const ctx = vm.createContext({ ...(SSR ? {} : { document }), console: sandboxConsole, setTimeout: (f, ms) => { timers.push(f); return timers.length; }, clearTimeout() {}, queueMicrotask: (f) => Promise.resolve().then(f) }, { codeGeneration: { strings: false, wasm: false } });
if (!SSR) ctx.window = ctx;
let ssrHtml = "";
const t0 = Date.now();
try { new vm.Script(workerData.code, { filename: "generated.js" }).runInContext(ctx, { timeout: 1000 }); }
catch (e) { errors.push(/Script execution timed out/.test(String(e && e.message)) ? "Timed out: the code ran longer than 1 s." : fmt(e)); }
(async () => {
  for (let i = 0; i < 20 && timers.length; i++) { const f = timers.shift(); try { vm.runInContext("void 0", ctx); f(); } catch (e) { errors.push(fmt(e)); } }
  if (SSR && !errors.length) { try { const f = vm.runInContext("typeof render === 'function' ? render : null", ctx); if (f) ssrHtml = strip(String(f())); else errors.push("SSR: the code defines no render() function to call."); } catch (e) { errors.push(fmt(e)); } }
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setTimeout(r, 20));
  parentPort.postMessage({ sites, consoleErrors: consoleErrors.slice(0, 20), errors: errors.slice(0, 20), rendered: SSR ? ssrHtml.replace(/\s+/g, " ").trim().slice(0, 2000) : root.text().concat(" ", app.text(), " ", body.children.slice(2).map((c) => (c && c.text ? c.text() : "")).join(" ")).replace(/\s+/g, " ").trim().slice(0, 2000), ms: Date.now() - t0 });
})();
`;

export async function executeInNodeHarness(code: string, opts: { wallMs?: number; env?: "browser" | "ssr" } = {}): Promise<ExecEvidence> {
  const env = opts.env === "ssr" ? "ssr" : "browser";
  const codeSha = await sha256Hex(code);
  const started = Date.now();
  if (!code.trim()) return { engine: NODE_HARNESS_ID, codeSha, ok: false, errors: ["No code to execute: the output had no code block and was empty."], consoleErrors: [], rendered: "", ms: 0 };
  if (code.length > 100_000) return { engine: NODE_HARNESS_ID, codeSha, ok: false, errors: ["Code is over 100,000 characters; not executed."], consoleErrors: [], rendered: "", ms: 0 };
  return await new Promise<ExecEvidence>((resolve) => {
    const w = new Worker(WORKER_SRC, { eval: true, workerData: { code, env }, env: {}, resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, codeRangeSizeMb: 16 }, stdout: true, stderr: true });
    let done = false;
    const finish = (x: Omit<ExecEvidence, "engine" | "codeSha" | "ok" | "env">) => { if (done) return; done = true; clearTimeout(kill); void w.terminate(); resolve({ engine: NODE_HARNESS_ID, codeSha, ok: x.errors.length === 0 && x.consoleErrors.length === 0, ...x, env, ...(x.sites?.length ? {} : { sites: undefined }) }); };
    const kill = setTimeout(() => finish({ errors: [`Timed out: no result after ${opts.wallMs ?? 3000} ms.`], consoleErrors: [], rendered: "", ms: Date.now() - started }), opts.wallMs ?? 3000);
    w.once("message", (m: { errors: string[]; consoleErrors: string[]; rendered: string; ms: number; sites?: { line: number; col?: number }[] }) => finish(m));
    w.once("error", (e: Error) => finish({ errors: [`Harness worker crashed: ${String(e?.message ?? e).slice(0, 200)}`], consoleErrors: [], rendered: "", ms: Date.now() - started }));
    w.once("exit", (c) => { if (!done) finish({ errors: [`Harness worker exited (code ${c}) before reporting.`], consoleErrors: [], rendered: "", ms: Date.now() - started }); });
  });
}
