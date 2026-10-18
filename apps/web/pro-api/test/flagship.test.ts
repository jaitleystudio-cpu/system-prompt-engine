// Flagship acceptance demo (Prawin): goal -> model writes code that crashes -> SPE REALLY executes it in a
// sandbox harness and captures the real error -> Prompt V2 carries a targeted negative constraint derived from
// that exact error, plus every protected requirement -> re-execute -> 0 runtime/console errors, verified by the
// harness (never by the model's "Done"). What is real here: code execution, error capture, verification,
// prompt compilation, ledger/receipt/certificate. What is mocked: the model's text (deterministic script).
import { test } from "node:test";
import assert from "node:assert/strict";
import { newProject, runAttempt, type RunModel } from "../../src/pro-studio/core/living/loop.ts";
import { runtimeRepair } from "../../src/pro-studio/core/living/compile.ts";
import { firewall, runCheck } from "../../src/pro-studio/core/living/verify.ts";
import { buildCertificate, verifyCertificate, recomputeCertSha } from "../../src/pro-studio/core/living/certificate.ts";
import { executeInNodeHarness, NODE_HARNESS_ID } from "../sandbox-node.ts";
import { demoAnswer } from "../providers.ts";
import { handleProRequest } from "../handler.ts";
import { MemoryStore } from "../store.ts";
import { TEST_KID } from "../keys.ts";
import { issuer, req } from "./helpers.ts";

const GOAL = "Build a small todo list app that renders into #root";
const REQS = [
  { id: "r1", text: "The app must run with zero runtime or console errors", check: { kind: "runs_clean", value: "My todos" } },
  { id: "r2", text: "Render a heading that says My todos", check: { kind: "contains", value: "My todos" } },
  { id: "r3", text: "Do not use eval", check: { kind: "not_contains", value: "eval(" } },
];
const project = (marker: string, maxAttempts = 4) => newProject({ name: "Todo app", intent: GOAL, requirements: REQS, inputs: [{ id: "i1", text: `Write the app. ${marker}`, category: "codegen", language: "js" }], budget: { maxAttempts, maxTokens: 100_000 } }, "2026-10-18T00:00:00.000Z");
const mockModel = (): RunModel & { systems: string[] } => { const systems: string[] = []; const f = (async (system: string, user: string) => { systems.push(system); return { text: demoAnswer(system, user) ?? "" }; }) as RunModel & { systems: string[] }; f.systems = systems; return f; };
const opts = { provider: "mock", model: "scripted-demo", simulated: true, now: () => "2026-10-18T00:00:01.000Z", execute: (c: string) => executeInNodeHarness(c) };

test("harness really executes: crash is captured, fixed code renders with 0 errors", async () => {
  const crash = await executeInNodeHarness('document.getElementById("root").innerHTML = todos.join("");');
  assert.equal(crash.ok, false); assert.deepEqual(crash.errors, ["ReferenceError: todos is not defined"]); assert.equal(crash.engine, NODE_HARNESS_ID);
  const ok = await executeInNodeHarness('const todos=["a"]; document.getElementById("root").innerHTML = "<h1>My todos</h1>" + todos.join("");');
  assert.equal(ok.ok, true); assert.deepEqual(ok.errors, []); assert.deepEqual(ok.consoleErrors, []); assert.match(ok.rendered, /My todos a/);
  const ce = await executeInNodeHarness('console.error("boom")'); assert.equal(ce.ok, false); assert.deepEqual(ce.consoleErrors, ["boom"]);
  const loop = await executeInNodeHarness("for(;;){}"); assert.equal(loop.ok, false); assert.match(loop.errors[0], /Timed out/);
  const syn = await executeInNodeHarness("const = 1"); assert.match(syn.errors[0], /^SyntaxError/);
  const rej = await executeInNodeHarness("Promise.reject(new Error('late'))"); assert.match(rej.errors[0], /Unhandled rejection: Error: late/);
});

test("runtimeRepair derives a targeted negative constraint from the specific error", () => {
  assert.match(runtimeRepair("ReferenceError: todos is not defined"), /Do not reference `todos` unless you declare and initialise it first/);
  assert.match(runtimeRepair("TypeError: Cannot read properties of undefined (reading 'map')"), /Do not read `\.map` from a value that can be undefined/);
  assert.match(runtimeRepair("TypeError: render is not a function"), /Do not call `render` as a function/);
  assert.match(runtimeRepair("SyntaxError: Unexpected token ';'"), /did not parse/);
  assert.match(runtimeRepair("Timed out: the code ran longer than 1 s."), /infinite loops/);
  for (const e of ["ReferenceError: todos is not defined", "Weird: thing"]) assert.ok(runtimeRepair(e).includes(e), "the captured error is quoted verbatim");
});

test("ACCEPTANCE: goal -> V1 crashes -> real error captured -> V2 with targeted constraint -> renders with 0 errors (harness-verified)", async () => {
  const model = mockModel();
  let p = project("[demo:crash-then-fix]");
  p = await runAttempt(p, model, opts);
  const a1 = p.attempts[0];
  assert.equal(p.status, "running");
  assert.match(a1.runs[0].output, /Done — all requirements met/, "the model claims success on V1");
  assert.deepEqual(a1.runs[0].exec?.errors, ["ReferenceError: todos is not defined"], "real error captured from execution");
  const r1 = a1.results.find((r) => r.reqId === "r1")!;
  assert.equal(r1.status, "FAILED", "model's 'Done' is ignored: the harness says it crashed");
  assert.match(r1.evidence, /ReferenceError: todos is not defined/);
  assert.equal(a1.decision.kind, "E0");
  assert.ok(a1.deficits.some((d) => d.kind === "RUNTIME_ERROR" && /todos is not defined/.test(d.detail)));
  assert.equal(p.repairs.length, 1); assert.equal(p.repairs[0].fromError, "ReferenceError: todos is not defined");

  p = await runAttempt(p, model, opts);
  const a2 = p.attempts[1];
  const v2 = model.systems[1];
  assert.match(v2, /## Fixes from earlier attempts\n- The previous code crashed when it ran: "ReferenceError: todos is not defined"\. Do not reference `todos`/);
  assert.ok(firewall(v2, p.requirements).ok, "V2 keeps every protected requirement verbatim");
  for (const q of REQS) assert.ok(v2.includes(q.text));
  assert.notEqual(a1.promptSha, a2.promptSha);
  assert.deepEqual(a2.runs[0].exec?.errors, []); assert.deepEqual(a2.runs[0].exec?.consoleErrors, []);
  assert.match(a2.runs[0].exec!.rendered, /My todos Buy milk Ship the release/);
  assert.ok(a2.results.every((r) => r.status === "VERIFIED"), JSON.stringify(a2.results));
  assert.equal(p.status, "verified");
  const rc = p.receipt!;
  assert.equal(rc.reason, "VERIFIED");
  assert.deepEqual(rc.capturedErrors, [{ attempt: 1, inputId: "i1", error: "ReferenceError: todos is not defined" }]);
  assert.equal(rc.promptDiff?.from, 1); assert.equal(rc.promptDiff?.to, 2);
  assert.ok(rc.promptDiff!.added.some((l) => /Do not reference `todos`/.test(l))); assert.deepEqual(rc.promptDiff!.removed, []);

  const cert = await buildCertificate(p, { speVersion: "t" });
  assert.equal(cert.verdict, "VERIFIED"); assert.equal(cert.simulated, true, "mocked model is labelled SIMULATED");
  assert.equal(cert.evidence[0].exec?.engine, NODE_HARNESS_ID);
  assert.equal((await verifyCertificate(cert)).ok, true);
  const v1cert = await buildCertificate(p, { speVersion: "t", attempt: 1 });
  assert.equal(v1cert.verdict, "NOT_VERIFIED");
});

test("NEGATIVE: V2 still crashes -> retries within the cap -> pauses honestly with a receipt, never success", async () => {
  const model = mockModel();
  let p = project("[demo:always-crash]", 3);
  for (let i = 0; i < 6 && (p.status === "draft" || p.status === "running"); i++) p = await runAttempt(p, model, opts);
  assert.equal(p.attempts.length, 3, "stays within the attempt cap");
  assert.equal(p.status, "paused"); assert.notEqual(p.status, "verified");
  assert.equal(p.receipt?.reason, "BUDGET_ATTEMPTS");
  assert.ok(p.receipt!.failed.includes("r1")); assert.ok(!p.receipt!.verified.includes("r1"));
  assert.equal(p.receipt!.capturedErrors!.length, 3);
  assert.ok(p.attempts.every((a) => a.results.find((r) => r.reqId === "r1")!.status === "FAILED"));
  assert.ok(p.attempts.every((a) => /Done — fixed, all requirements met/.test(a.runs[0].output)), "model keeps claiming success; it is ignored");
  assert.deepEqual(p.attempts.map((a) => a.decision.kind), ["E0", "E0", "E1"], "same error twice after repair -> approach change");
  assert.ok(model.systems[1].includes("Do not reference `todos`"));
  const more = await runAttempt(p, model, opts); assert.equal(more.attempts.length, 3, "does not run past the cap");
  const cert = await buildCertificate(p, { speVersion: "t" }); assert.equal(cert.verdict, "NOT_VERIFIED");
});

test("NEGATIVE: no sandbox -> pauses NO_SANDBOX before calling the model; unexecuted output is never a pass", async () => {
  const model = mockModel();
  const p = await runAttempt(project("[demo:crash-then-fix]"), model, { ...opts, execute: undefined });
  assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "NO_SANDBOX"); assert.equal(model.systems.length, 0);
  assert.equal(runCheck({ kind: "runs_clean" }, "```js\nconst a = 1;\n```").status, "NOT_RUN");
  const lies = runCheck({ kind: "runs_clean" }, "Done! I ran it and it has 0 errors.");
  assert.equal(lies.status, "NOT_RUN", "text claiming it ran is not evidence");
});

test("NEGATIVE: tampering with recorded execution evidence is detected by certificate verification", async () => {
  let p = project("[demo:always-crash]", 1); p = await runAttempt(p, mockModel(), opts);
  const c = await buildCertificate(p, { speVersion: "t" });
  const forged = structuredClone(c); forged.evidence[0].exec!.errors = []; forged.tests = forged.tests.map((t) => ({ ...t, status: "VERIFIED" as const })); forged.verdict = "VERIFIED";
  const r = await verifyCertificate(forged); assert.equal(r.ok, false); assert.ok(r.reasons.some((x) => /hash does not match/.test(x)));
  const swapped = structuredClone(c); swapped.evidence[0].output = swapped.evidence[0].output.replace("todos.map", "[].map"); swapped.certSha256 = await recomputeCertSha(swapped);
  const r2 = await verifyCertificate(swapped); assert.equal(r2.ok, false); assert.ok(r2.reasons.some((x) => /different code|recorded hash/.test(x)));
});

async function apiSetup(withSandbox: boolean) {
  const i = await issuer(TEST_KID); const store = new MemoryStore();
  const keyEnv = i.env({ allowTestKeys: true });
  const call = (r: Request) => handleProRequest(r, { SPE_VERSION: "t", SPE_PRO_ALLOW_MOCK_PROVIDER: "1" }, { keyEnv, store, ...(withSandbox ? { execute: (c: string) => executeInNodeHarness(c) } : {}) });
  return { call, store, key: await i.sign() };
}
const J = async (r: Response) => { assert.equal(r.status, 200, await r.clone().text()); return r.json() as Promise<any>; };
test("ACCEPTANCE via the Pro API: /living/step x2 with the simulated provider and the injected harness", async () => {
  const s = await apiSetup(true);
  const sess = await J(await s.call(req("/session", { key: s.key }))); assert.equal(sess.sandbox, "node-harness");
  const c = await J(await s.call(req("/living/create", { key: s.key, json: { project: { name: "Todo app", intent: GOAL, requirements: REQS, inputs: [{ id: "i1", text: "Write the app. [demo:crash-then-fix]" }], budget: { maxAttempts: 4 } } } })));
  const step = () => s.call(req("/living/step", { key: s.key, json: { id: c.project.id, provider: "mock", model: "scripted-demo" } }));
  const d1 = await J(await step()); assert.equal(d1.project.attempts[0].results.find((r: any) => r.reqId === "r1").status, "FAILED");
  const d2 = await J(await step()); assert.equal(d2.project.status, "verified");
  assert.equal(d2.project.attempts[1].simulated, true);
  assert.deepEqual(d2.project.receipt.capturedErrors.map((e: any) => e.error), ["ReferenceError: todos is not defined"]);
  const led = d2.project.ledger.find((e: any) => e.reqId === "r1"); assert.equal(led.status, "VERIFIED"); assert.match(led.evidence, /0 runtime errors, 0 console errors/);
  const cert = await J(await s.call(req("/living/certificate", { key: s.key, json: { id: c.project.id } }))); assert.equal(cert.certificate.verdict, "VERIFIED");
  const audit = await J(await s.call(req("/audit/list", { key: s.key }))); assert.ok(audit.entries.some((e: any) => /attempt 1 · E0/.test(e.detail)));
});
test("Pro API without a sandbox (Worker build): runs_clean pauses NO_SANDBOX, nothing executed or claimed", async () => {
  const s = await apiSetup(false);
  const sess = await J(await s.call(req("/session", { key: s.key }))); assert.equal(sess.sandbox, "none");
  const c = await J(await s.call(req("/living/create", { key: s.key, json: { project: { name: "Todo", intent: GOAL, requirements: REQS, inputs: [{ id: "i1", text: "x [demo:crash-then-fix]" }] } } })));
  const d = await J(await s.call(req("/living/step", { key: s.key, json: { id: c.project.id, provider: "mock", model: "m" } })));
  assert.equal(d.project.status, "paused"); assert.equal(d.project.receipt.reason, "NO_SANDBOX"); assert.equal(d.project.attempts.length, 0);
});
