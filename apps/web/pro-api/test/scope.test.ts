// Scoped repair guard (Prawin): V2 pins the failing call-site from the real error, adds error-class negative
// constraints and a hard scope rule, keeps protected requirements frozen; after V2 runs, the CODE DIFF is
// verified. A "fix" that renders with 0 errors but rewrites 200 lines, drops a feature, changes styling or
// swaps a library is REJECTED as drift. Real: harness execution, diff, checks. Mocked: the model's text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newProject, runAttempt, type RunModel, type Execute } from "../../src/pro-studio/core/living/loop.ts";
import { pinCallSite, errorClassConstraints, driftCheck, importsOf, featuresOf, SCOPE_RULE, FREEZE_RULE } from "../../src/pro-studio/core/living/scope.ts";
import { intentShield } from "../../src/pro-studio/core/living/intentShield.ts";
import { buildCertificate, verifyCertificate, recomputeCertSha } from "../../src/pro-studio/core/living/certificate.ts";
import { executeInNodeHarness } from "../sandbox-node.ts";
import { demoAnswer } from "../providers.ts";

const REQS = [
  { id: "r1", text: "The app must run with zero runtime or console errors", check: { kind: "runs_clean", value: "My todos" } },
  { id: "r2", text: "Render a heading that says My todos", check: { kind: "contains", value: "My todos" } },
  { id: "r3", text: "Do not use eval", check: { kind: "not_contains", value: "eval(" } },
];
const mk = (marker: string, maxAttempts = 3, reqs: unknown[] = REQS, intent = "Build a small todo list app that renders into #root") =>
  newProject({ name: "Scope", intent, requirements: reqs, inputs: [{ id: "i1", text: `Write the app. ${marker}` }], budget: { maxAttempts, maxTokens: 500_000 } }, "2026-10-18T00:00:00.000Z");
const model: RunModel = async (system, user) => ({ text: demoAnswer(system, user) ?? "" });
const real: Execute = (c, o) => executeInNodeHarness(c, { env: o?.env });
const opts = { provider: "mock", model: "scripted-demo", simulated: true, now: () => "2026-10-18T00:00:01.000Z", execute: real };
async function loop(p: ReturnType<typeof mk>, m: RunModel = model, o = opts) { for (let i = 0; i < 12 && (p.status === "draft" || p.status === "running"); i++) p = await runAttempt(p, m, o); return p; }

test("harness pins the real call-site (stack line) and runs SSR without window/document", async () => {
  const e = await executeInNodeHarness('const a = 1;\nconst b = 2;\nroot.innerHTML = todos.length;');
  assert.deepEqual(e.sites?.[0]?.line, 3);
  const ssr = await executeInNodeHarness('const w = window.innerWidth;\nfunction render(){ return "<h1>x</h1>"; }', { env: "ssr" });
  assert.deepEqual(ssr.errors, ["ReferenceError: window is not defined"]); assert.equal(ssr.env, "ssr");
  const ok = await executeInNodeHarness('function render(){ return "<h1>3D Hero</h1>"; }', { env: "ssr" });
  assert.equal(ok.ok, true); assert.equal(ok.rendered, "3D Hero");
  const none = await executeInNodeHarness("const x = 1;", { env: "ssr" }); assert.match(none.errors[0], /no render\(\)/);
});

test("error-class constraints: undefined reference, SSR window, default vs named import, conditional hooks", () => {
  assert.match(errorClassConstraints("ReferenceError: todos is not defined").join(" "), /MUST NOT reference `todos` before it is declared/);
  assert.match(errorClassConstraints("ReferenceError: window is not defined").join(" "), /MUST NOT use `window` during server-side rendering/);
  assert.match(errorClassConstraints("SyntaxError: The requested module 'x' does not provide an export named 'default'").join(" "), /default and named imports/);
  assert.match(errorClassConstraints("Error: Rendered more hooks than during the previous render.").join(" "), /hooks conditionally/);
  assert.match(errorClassConstraints("TypeError: Cannot read properties of undefined (reading 'map')").join(" "), /MUST NOT read `\.map`/);
  const pin = pinCallSite("ReferenceError: todos is not defined", "const a = 1;\nx(todos);\n", undefined);
  assert.deepEqual(pin, { line: 2, expression: "x(todos);", source: "search" });
  assert.equal(pinCallSite("Weird: nothing", "a\nb", undefined), null);
});

test("ACCEPTED: scoped fix (one expression) passes, V2 prompt pins line + error class + scope rule + freeze rule", async () => {
  const p = await loop(mk("[demo:scoped-fix]"));
  assert.equal(p.status, "verified");
  const v2 = p.attempts[1].prompt;
  assert.match(v2, /The failing call-site is line 7(, column \d+)?: `root\.innerHTML = title/);
  assert.ok(v2.includes(SCOPE_RULE) && v2.includes(FREEZE_RULE));
  for (const q of REQS) assert.ok(v2.includes(q.text), `protected requirement kept: ${q.id}`);
  const s = p.attempts[1].runs[0].scope!;
  assert.equal(s.verdict, "ACCEPTED"); assert.equal(s.drift.changed, 2); assert.equal(s.drift.outsidePin, 0);
  assert.deepEqual(s.drift.touchedRegions, [{ start: 7, end: 7, inPin: true }]);
  const sr = p.receipt!.scopedRepairs!; assert.equal(sr.length, 1); assert.equal(sr[0].verdict, "ACCEPTED"); assert.equal(sr[0].changed, 2);
  assert.deepEqual(sr[0].preserved, ["r2: VERIFIED → VERIFIED", "r3: VERIFIED → VERIFIED"]);
  const c = await buildCertificate(p, { speVersion: "t" }); assert.equal(c.verdict, "VERIFIED"); assert.equal((await verifyCertificate(c)).ok, true);
});

for (const [marker, why] of [["[demo:drift-rewrite]", /changed lines fall outside the pinned region/], ["[demo:drift-drop]", /Features removed: footer/], ["[demo:drift-style]", /Styling changed outside the pinned region/]] as const) {
  test(`REJECTED as drift even though it renders with 0 errors: ${marker}`, async () => {
    const p = await loop(mk(marker, 3));
    assert.notEqual(p.status, "verified"); assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "BUDGET_ATTEMPTS");
    const a2 = p.attempts[1]; const run = a2.runs[0];
    assert.equal(run.exec?.ok, true, "the drifted code really executes with 0 errors");
    assert.equal(run.scope?.verdict, "REJECTED_DRIFT"); assert.match(run.scope!.drift.reasons.join(" "), why);
    const r1 = a2.results.find((r) => r.reqId === "r1")!; assert.equal(r1.status, "FAILED"); assert.match(r1.evidence, /rejected as drift/);
    assert.ok(a2.deficits.some((d) => d.kind === "DRIFT"));
    assert.match(p.attempts[2].prompt, /rejected as drift/, "V3 tells the model to go back and change only the pinned expression");
    assert.equal(p.attempts[2].runs[0].scope?.baseline.attempt, 1, "drift is always measured against the last crashing code");
    assert.ok(p.receipt!.scopedRepairs!.every((x) => x.verdict === "REJECTED_DRIFT"));
    const c = await buildCertificate(p, { speVersion: "t", attempt: 2 }); assert.equal(c.verdict, "NOT_VERIFIED");
    assert.equal((await verifyCertificate(c)).ok, true, "the drift verdict is re-derived by the verifier from the recorded code");
  });
}
test("REJECTED: 200-line rewrite reports diff size and touched regions", async () => {
  const p = await loop(mk("[demo:drift-rewrite]", 2));
  const s = p.attempts[1].runs[0].scope!; assert.ok(s.drift.outsidePin >= 190, String(s.drift.outsidePin)); assert.ok(s.drift.changed >= 200); assert.ok(s.drift.touchedRegions.length >= 1);
  assert.match(p.receipt!.scopedRepairs![0].touchedRegions, /\d/);
});

test("REJECTED: library swap (and import changes) — stubbed execution, code diff is real", async () => {
  const v1 = "```js\nimport { html } from \"lit-html\";\nconst root = document.getElementById(\"root\");\nroot.innerHTML = html`<h1>My todos</h1>` + todos.length;\n```";
  const v2 = "```js\nimport { html } from \"htm/preact\";\nconst todos = [];\nconst root = document.getElementById(\"root\");\nroot.innerHTML = html`<h1>My todos</h1>` + todos.length;\n```";
  const m: RunModel = async (system) => ({ text: /Do not reference `todos`/.test(system) ? v2 : v1 });
  // The dev harness cannot load npm modules, so execution is stubbed here: V1 "crashes", V2 "runs clean".
  const stub: Execute = async (code) => ({ engine: "stub", codeSha: "", ok: !/lit-html/.test(code), errors: /lit-html/.test(code) ? ["ReferenceError: todos is not defined"] : [], consoleErrors: [], rendered: "My todos 0", ms: 1, sites: /lit-html/.test(code) ? [{ line: 3 }] : undefined });
  const p = await loop(mk("x", 2), m, { ...opts, execute: stub });
  const s = p.attempts[1].runs[0].scope!; assert.equal(s.verdict, "REJECTED_DRIFT");
  assert.deepEqual(s.drift.importsAdded, ["htm/preact"]); assert.deepEqual(s.drift.importsRemoved, ["lit-html"]);
  assert.notEqual(p.status, "verified");
});

test("REJECTED: a previously passing requirement now fails (regression), even with a clean run", async () => {
  const v1 = "```js\nconst root = document.getElementById(\"root\");\nroot.innerHTML = \"<h1>My todos</h1>\" + todos.length;\n```";
  const v2 = "```js\nconst todos = [];\nconst root = document.getElementById(\"root\");\nroot.innerHTML = \"<h1>My todos</h1>\" + todos.length; eval(\"1\");\n```";
  const m: RunModel = async (system) => ({ text: /Do not reference `todos`/.test(system) ? v2 : v1 });
  const stubOk: Execute = async (code) => (/const todos/.test(code) ? { engine: "stub", codeSha: "", ok: true, errors: [], consoleErrors: [], rendered: "My todos 0", ms: 1 } : { engine: "stub", codeSha: "", ok: false, errors: ["ReferenceError: todos is not defined"], consoleErrors: [], rendered: "", ms: 1 });
  const p = await loop(mk("x", 2), m, { ...opts, execute: stubOk });
  const s = p.attempts[1].runs[0].scope!; assert.deepEqual(s.regressions, ["r3"]); assert.equal(s.verdict, "REJECTED_DRIFT");
});

test("SSR fixture (Prawin's diagram): 3D Hero crashes with window is not defined -> V2 'MUST NOT use window during SSR' -> renders, layout kept", async () => {
  const reqs = [
    { id: "r1", text: "The page must render on the server with zero runtime or console errors", check: { kind: "runs_clean", value: "3D Hero", env: "ssr" } },
    { id: "r2", text: "Keep the hero layout section", check: { kind: "contains", value: "class=\\\"hero\\\"" } },
  ];
  const p = await loop(mk("[demo:ssr-window]", 4, reqs, "Build 3D Hero App"));
  assert.equal(p.status, "verified");
  assert.deepEqual(p.attempts[0].runs[0].exec?.errors, ["ReferenceError: window is not defined"]);
  assert.match(p.attempts[1].prompt, /MUST NOT use `window` during server-side rendering/);
  assert.match(p.attempts[1].prompt, /line 1(, column \d+)?: `const width = window\.innerWidth;`/);
  assert.equal(p.attempts[1].runs[0].scope?.verdict, "ACCEPTED");
  assert.equal(p.attempts[1].runs[0].exec?.env, "ssr");
});

test("tampering with the drift verdict in a certificate is detected", async () => {
  const p = await loop(mk("[demo:drift-drop]", 2));
  const c = await buildCertificate(p, { speVersion: "t" });
  c.evidence[0].scope!.verdict = "ACCEPTED"; c.tests = c.tests.map((t) => ({ ...t, status: "VERIFIED" })); c.verdict = "VERIFIED"; c.counts = { ...c.counts, VERIFIED: c.tests.length, FAILED: 0 };
  c.certSha256 = await recomputeCertSha(c);
  const v = await verifyCertificate(c); assert.equal(v.ok, false); assert.match(v.reasons.join(" "), /Scope verdict|re-ran r1/);
});

test("Intent Loss Detector is wired in: CRITICAL loss blocks the attempt before the model is called", async () => {
  const ok = intentShield(REQS as never, "Do not use eval. Render a heading that says My todos. The app must run with zero runtime or console errors.");
  assert.equal(ok.critical, false);
  const bad = intentShield(REQS as never, "Render a heading that says My todos. Use eval to build the list.");
  assert.equal(bad.critical, true);
  let calls = 0; const m: RunModel = async () => { calls++; return { text: "" }; };
  const p = await runAttempt(mk("x"), m, { ...opts, compile: () => "Build a todo app. The app must run with zero runtime or console errors. Render a heading that says My todos. Do not use eval. Use eval( to speed up rendering." });
  assert.equal(calls, 0); assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "INTENT_LOSS");
  assert.match(p.attempts[0].deficits.map((d) => d.detail).join(" "), /Intent Loss Detector \(critical\)/);
});

test("static helpers: imports and features", () => {
  assert.deepEqual(importsOf('import React from "react";\nconst x = require("lodash");\n<script src="https://cdn/x.js"></script>'), ["https://cdn/x.js", "lodash", "react"]);
  assert.deepEqual(featuresOf('function a(){}\nconst b = 1;\nel.id = "main";'), ["#main", "a", "b"]);
  const d = driftCheck("a\nb\nc", "a\nb\nc", { line: 2, expression: "b", source: "search" }); assert.equal(d.ok, true); assert.equal(d.changed, 0);
  const u = driftCheck("a", "b", null); assert.equal(u.ok, false, "an unpinned change is never accepted as scoped");
});
