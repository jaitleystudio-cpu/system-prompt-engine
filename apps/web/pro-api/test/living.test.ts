import { test } from "node:test";
import assert from "node:assert/strict";
import { runCheck, verifyRuns, firewall } from "../../src/pro-studio/core/living/verify.ts";
import { compilePrompt, STRATEGIES } from "../../src/pro-studio/core/living/compile.ts";
import { newProject, runAttempt, stopProject, ledgerOf, markHuman, type RunModel } from "../../src/pro-studio/core/living/loop.ts";
import type { Requirement } from "../../src/pro-studio/core/living/types.ts";

const R = (id: string, text: string, check: Requirement["check"]): Requirement => ({ id, text, check });
const reqs = [R("r1", "Mention the refund window of 30 days", { kind: "contains", value: "30 days" }), R("r2", "Never promise a callback", { kind: "not_contains", value: "call you back" })];
const proj = (o = {}) => newProject({ name: "Refunds", intent: "Answer refund questions for Acme", requirements: reqs, inputs: [{ id: "i1", text: "Can I get a refund?", category: "billing", language: "en" }], budget: { maxAttempts: 5, maxTokens: 50_000 }, ...o }, "2026-10-18T00:00:00.000Z");
const opts = { provider: "openai", model: "customer-model", simulated: false, now: () => "2026-10-18T00:00:01.000Z" };
const scripted = (outs: (string | Error)[]): RunModel & { calls: { system: string; user: string }[] } => {
  const calls: { system: string; user: string }[] = []; let i = 0;
  const f = (async (system: string, user: string) => { calls.push({ system, user }); const o = outs[Math.min(i++, outs.length - 1)]; if (o instanceof Error) throw o; return { text: o, usage: { total: 100 } }; }) as RunModel & { calls: typeof calls };
  f.calls = calls; return f;
};

test("deterministic checks: each kind passes and fails correctly", () => {
  const cases: [Requirement["check"], string, string][] = [
    [{ kind: "contains", value: "30 days" }, "within 30 days", "within thirty days"],
    [{ kind: "not_contains", value: "guarantee" }, "no promises", "we guarantee it"],
    [{ kind: "regex", value: "^Order #\\d+" }, "Order #12 shipped", "Your order shipped"],
    [{ kind: "not_regex", value: "\\b\\d{16}\\b" }, "card ending 1234", "card 4111111111111111"],
    [{ kind: "json_valid" }, '{"a":1}', "Sure! {\"a\":1}"],
    [{ kind: "json_keys", keys: ["answer", "sources"] }, '{"answer":"x","sources":[]}', '{"answer":"x"}'],
    [{ kind: "max_words", n: 5 }, "one two three", "one two three four five six"],
    [{ kind: "min_words", n: 3 }, "one two three", "one"],
    [{ kind: "max_chars", n: 10 }, "short", "this is far too long"],
    [{ kind: "starts_with", value: "Hello" }, "Hello there", "Hi there"],
    [{ kind: "ends_with", value: "Thanks." }, "Bye. Thanks.", "Thanks. Bye."],
    [{ kind: "line_count_max", n: 2 }, "a\nb", "a\nb\nc"],
  ];
  for (const [c, good, bad] of cases) {
    assert.equal(runCheck(c, good).status, "VERIFIED", `${c.kind} good`);
    assert.equal(runCheck(c, bad).status, "FAILED", `${c.kind} bad`);
  }
});
test("manual checks are UNPROVEN, never VERIFIED; bad regex is FAILED with a reason, not a crash", () => {
  assert.equal(runCheck({ kind: "manual" }, "anything").status, "UNPROVEN");
  const r = runCheck({ kind: "regex", value: "(" }, "x"); assert.equal(r.status, "FAILED"); assert.match(r.evidence, /invalid/i);
});
test("the model saying it is done is not evidence", () => {
  const rs = verifyRuns(reqs, [{ inputId: "i1", output: "DONE. All requirements are satisfied and verified ✅", outputSha: "x" }]);
  assert.equal(rs.find((r) => r.reqId === "r1")!.status, "FAILED");
});
test("a provider error on an input makes its checks NOT_RUN, never VERIFIED", () => {
  const rs = verifyRuns(reqs, [{ inputId: "i1", output: "", outputSha: "", error: "Provider returned HTTP 500" }]);
  assert.ok(rs.every((r) => r.status === "NOT_RUN"));
});
test("firewall: a compiled prompt must carry every protected requirement verbatim", () => {
  for (const s of STRATEGIES) { const p = compilePrompt({ intent: "Goal", requirements: reqs, strategy: s, repairs: [] }); assert.equal(firewall(p, reqs).ok, true, s); }
  const dropped = compilePrompt({ intent: "Goal", requirements: reqs, strategy: "direct", repairs: [] }).replace(reqs[1].text, "");
  const fw = firewall(dropped, reqs); assert.equal(fw.ok, false); assert.deepEqual(fw.missing, ["r2"]);
});
test("loop: failing attempt -> E0 repair -> verified, with certificate-ready ledger", async () => {
  const m = scripted(["Sure, we will call you back about refunds.", "Refunds are accepted within 30 days of purchase."]);
  let p = await runAttempt(proj(), m, opts);
  assert.equal(p.status, "running"); assert.equal(p.attempts[0].decision.kind, "E0");
  assert.deepEqual([...p.attempts[0].diagnosis.deficits.map((d) => d.kind)].sort(), ["FORBIDDEN_CONTENT", "MISSING_CONTENT"]);
  p = await runAttempt(p, m, opts);
  assert.equal(p.status, "verified"); assert.equal(p.attempts.length, 2);
  assert.match(m.calls[1].system, /30 days/); // repair clause reached the model
  const l = ledgerOf(p); assert.ok(l.every((e) => e.status === "VERIFIED"));
});
test("loop: E1 changes strategy when the same requirement keeps failing after repairs", async () => {
  const m = scripted(["no window mentioned"]);
  let p = proj({ budget: { maxAttempts: 6, maxTokens: 1e9 } });
  for (let i = 0; i < 4; i++) { if (p.status !== "draft" && p.status !== "running") break; p = await runAttempt(p, m, opts); }
  const kinds = p.attempts.map((a) => a.decision.kind);
  assert.ok(kinds.includes("E1"), kinds.join(","));
  assert.notEqual(p.strategy, "direct");
});
test("loop: attempt cap -> honest pause with receipt (no fake success)", async () => {
  const m = scripted(["never right"]);
  let p = proj({ budget: { maxAttempts: 2, maxTokens: 1e9 } });
  p = await runAttempt(p, m, opts); p = await runAttempt(p, m, opts);
  assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "BUDGET_ATTEMPTS");
  assert.equal(p.receipt?.attemptsUsed, 2); assert.ok(p.receipt!.failed.includes("r1"));
  const again = await runAttempt(p, m, opts); assert.equal(again.attempts.length, 2, "no attempt runs past the cap");
});
test("loop: token budget is enforced", async () => {
  const m = scripted(["never right"]);
  let p = proj({ budget: { maxAttempts: 10, maxTokens: 150 } });
  p = await runAttempt(p, m, opts); p = await runAttempt(p, m, opts);
  assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "BUDGET_TOKENS");
});
test("loop: two attempts of provider errors -> pause PROVIDER_ERRORS, nothing VERIFIED", async () => {
  const m = scripted([new Error("Provider returned HTTP 401")]);
  let p = await runAttempt(proj(), m, opts); assert.equal(p.status, "running");
  p = await runAttempt(p, m, opts);
  assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "PROVIDER_ERRORS");
  assert.ok(ledgerOf(p).every((e) => e.status === "NOT_RUN"));
});
test("loop: a compiler that drops a requirement is caught; the model is never called", async () => {
  const m = scripted(["Refunds within 30 days."]);
  const bad = (x: Parameters<typeof compilePrompt>[0]) => compilePrompt(x).replace(reqs[0].text, "");
  const p = await runAttempt(proj(), m, { ...opts, compile: bad });
  assert.equal(m.calls.length, 0); assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "INTENT_LOSS");
});
test("stop: user stop gives a receipt and blocks further attempts", async () => {
  const m = scripted(["never right"]);
  let p = await runAttempt(proj(), m, opts); p = stopProject(p, "2026-10-18T00:01:00.000Z");
  assert.equal(p.status, "stopped"); assert.equal(p.receipt?.reason, "USER_STOP");
  const q = await runAttempt(p, m, opts); assert.equal(q.attempts.length, 1);
});
test("manual requirement: automated pass is not enough; status needs human review; HUMAN marks are labelled", async () => {
  const withManual = [...reqs, R("r3", "Tone is warm", { kind: "manual" })];
  const m = scripted(["Refunds are accepted within 30 days."]);
  let p = await runAttempt(proj({ requirements: withManual }), m, opts);
  assert.equal(p.status, "paused"); assert.equal(p.receipt?.reason, "NEEDS_HUMAN_REVIEW"); assert.ok(p.receipt!.unproven.includes("r3"));
  p = markHuman(p, "r3", "pass", "2026-10-18T00:02:00.000Z");
  assert.equal(p.status, "verified"); assert.equal(ledgerOf(p).find((e) => e.reqId === "r3")!.status, "HUMAN_PASS");
});
