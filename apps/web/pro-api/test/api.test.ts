import { test } from "node:test";
import assert from "node:assert/strict";
import { handleProRequest } from "../handler.ts";
import { MemoryStore } from "../store.ts";
import { issuer, req } from "./helpers.ts";
import { TEST_KID } from "../keys.ts";

const PK = "sk-customer-SECRET-123456";
function openaiFetch(answers: (string | number)[]) {
  const calls: { url: string; auth: string | null; body: any }[] = []; let i = 0;
  const f = async (url: string | URL | Request, init?: RequestInit) => {
    const h = new Headers(init?.headers); calls.push({ url: String(url), auth: h.get("authorization") ?? h.get("x-api-key"), body: JSON.parse(String(init?.body ?? "{}")) });
    const a = answers[Math.min(i++, answers.length - 1)];
    if (typeof a === "number") return new Response(JSON.stringify({ error: { message: `bad key ${PK}` } }), { status: a });
    return new Response(JSON.stringify({ choices: [{ message: { content: a } }], usage: { total_tokens: 42 } }), { status: 200 });
  };
  return { f: f as typeof fetch, calls };
}
async function setup(o: { fetchAnswers?: (string | number)[]; env?: Record<string, string>; allowTest?: boolean } = {}) {
  const i = await issuer("spe-pro-2026"); const store = new MemoryStore(); const of = openaiFetch(o.fetchAnswers ?? ["ok"]);
  const keyEnv = i.env({ allowTestKeys: o.allowTest ?? false });
  const call = (r: Request) => handleProRequest(r, { SPE_VERSION: "pro-r3-test", ...(o.env ?? {}) }, { keyEnv, store, fetch: of.f });
  return { i, store, call, calls: of.calls, key: await i.sign(), keyB: await i.sign({ sub: "cust_2" }) };
}
const body = async (r: Response) => r.json() as Promise<any>;

const ROUTES: [string, string][] = [["GET", "/session"], ["GET", "/workspace"], ["PUT", "/workspace"], ["POST", "/scan"], ["POST", "/studio/analyze"], ["POST", "/code"], ["POST", "/batch"], ["POST", "/living/create"], ["POST", "/living/step"], ["GET", "/living/list"], ["POST", "/ab/create"], ["POST", "/portability/run"], ["POST", "/certificate/verify"], ["GET", "/audit/list"], ["POST", "/coworkie"]];
test("every Pro route rejects a missing key and a tampered key with 401", async () => {
  const s = await setup(); const tampered = s.key.slice(0, -4) + "AAAA";
  for (const [m, p] of ROUTES) {
    const a = await s.call(req(p, { method: m, json: m === "GET" ? undefined : {} }));
    assert.equal(a.status, 401, `${m} ${p}`); assert.equal((await body(a)).reason, "MISSING_KEY");
    const b = await s.call(req(p, { method: m, key: tampered, json: m === "GET" ? undefined : {} }));
    assert.equal(b.status, 401, `${m} ${p} tampered`);
  }
});
test("test keys are refused unless the server enables them", async () => {
  const t = await issuer(TEST_KID); const store = new MemoryStore();
  const r = await handleProRequest(req("/session", { key: await t.sign() }), {}, { keyEnv: t.env({ allowTestKeys: false }), store });
  assert.equal(r.status, 401); assert.equal((await body(r)).reason, "TEST_KEYS_DISABLED");
});
test("session reports tier and the storage mode honestly", async () => {
  const s = await setup(); const r = await s.call(req("/session", { key: s.key })); const d = await body(r);
  assert.equal(r.status, 200); assert.equal(d.tier, "pro"); assert.equal(d.storage, "memory");
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("workspace is stored per key subject and isolated between customers", async () => {
  const s = await setup();
  const ws = { sessions: [{ id: "s1", title: "Mine", projectId: null, blocks: [{ kind: "role", title: "Role", text: "You are X" }], versions: [], vars: {}, mode: "template", createdAt: "", updatedAt: "" }], projects: [], activeId: "s1" };
  assert.equal((await s.call(req("/workspace", { method: "PUT", key: s.key, json: { workspace: ws } }))).status, 200);
  const mine = await body(await s.call(req("/workspace", { key: s.key }))); assert.equal(mine.workspace.sessions[0].title, "Mine");
  const theirs = await body(await s.call(req("/workspace", { key: s.keyB }))); assert.equal(theirs.workspace.sessions.length, 0);
});
test("body over 2 MB is rejected with 413", async () => {
  const s = await setup(); const big = "x".repeat(2 * 1024 * 1024 + 10);
  const r = await s.call(req("/scan", { key: s.key, json: { text: big } })); assert.equal(r.status, 413);
});
test("tools run on the server: scan, analyze, code, batch", async () => {
  const s = await setup();
  const sc = await body(await s.call(req("/scan", { key: s.key, json: { text: "key AKIAABCDEFGHIJKLMNOP here", redact: true } })));
  assert.ok(sc.findings.length >= 1); assert.ok(!sc.redacted.includes("AKIAABCDEFGHIJKLMNOP"));
  const an = await body(await s.call(req("/studio/analyze", { key: s.key, json: { blocks: [{ kind: "role", title: "Role", text: "You are {{name}}" }], vars: {} } })));
  assert.deepEqual(an.vars, [["name", 1]]);
  const code = await body(await s.call(req("/code", { key: s.key, json: { target: "python-openai", system: 'Say "hi"\nnow', model: "m" } })));
  assert.match(code.code, /Say/);
  const b = await body(await s.call(req("/batch", { key: s.key, json: { template: "Hi {{n}}", csv: "n\nA\nB" } })));
  assert.equal(b.result.rows.length, 2);
});
test("studio diff flags protected must-haves that a version drops", async () => {
  const s = await setup();
  const a = [{ kind: "requirements", title: "Req", text: "", must: ["Cite sources", "Answer in English"], mustNot: ["Invent prices"] }];
  const b = [{ kind: "requirements", title: "Req", text: "", must: ["Answer in English"], mustNot: [] }];
  const d = await body(await s.call(req("/studio/diff", { key: s.key, json: { a, b } })));
  assert.deepEqual(d.intentLoss, ["Must: Cite sources", "Must not: Invent prices"]);
});

const project = { name: "Refunds", intent: "Answer refund questions", requirements: [{ id: "r1", text: "Mention 30 days", check: { kind: "contains", value: "30 days" } }], inputs: [{ id: "i1", text: "Can I get a refund?", category: "billing", language: "en" }], budget: { maxAttempts: 4, maxTokens: 10000 } };
const model = { provider: "openai", model: "customer-model" };
test("living: create -> step (repair) -> verified; provider key forwarded but never echoed or stored", async () => {
  const s = await setup({ fetchAnswers: ["We can help.", "Refunds within 30 days."] });
  const c = await body(await s.call(req("/living/create", { key: s.key, json: { project } })));
  const id = c.project.id; assert.equal(c.project.status, "draft");
  const step = (k = PK) => s.call(req("/living/step", { key: s.key, json: { id, ...model }, headers: { "x-provider-key": k } }));
  const r1 = await step(); const t1 = await r1.text(); assert.equal(r1.status, 200); assert.ok(!t1.includes(PK));
  assert.equal(JSON.parse(t1).project.attempts[0].decision.kind, "E0");
  const d2 = await body(await step()); assert.equal(d2.project.status, "verified");
  assert.equal(s.calls[0].url, "https://api.openai.com/v1/chat/completions"); assert.equal(s.calls[0].auth, `Bearer ${PK}`);
  for (const k of await s.store.list("")) assert.ok(!(await s.store.get(k))!.includes(PK), `key leaked into store ${k}`);
  const cert = await body(await s.call(req("/living/certificate", { key: s.key, json: { id } })));
  assert.equal(cert.certificate.verdict, "VERIFIED");
  const v = await body(await s.call(req("/certificate/verify", { key: s.key, json: { certificate: cert.certificate } }))); assert.equal(v.ok, true);
  const other = await s.call(req("/living/get", { key: s.keyB, json: { id } })); assert.equal(other.status, 404, "another customer cannot read the project");
});
test("living: missing provider key -> 400; provider error -> recorded, error text has no key", async () => {
  const s = await setup({ fetchAnswers: [500] });
  const id = (await body(await s.call(req("/living/create", { key: s.key, json: { project } })))).project.id;
  const r0 = await s.call(req("/living/step", { key: s.key, json: { id, ...model } })); assert.equal(r0.status, 400);
  const r = await s.call(req("/living/step", { key: s.key, json: { id, ...model }, headers: { "x-provider-key": PK } }));
  const t = await r.text(); assert.equal(r.status, 200); assert.ok(!t.includes(PK)); assert.match(t, /HTTP 500/);
});
test("living: stop returns a receipt", async () => {
  const s = await setup({ fetchAnswers: ["nope"] });
  const id = (await body(await s.call(req("/living/create", { key: s.key, json: { project } })))).project.id;
  await s.call(req("/living/step", { key: s.key, json: { id, ...model }, headers: { "x-provider-key": PK } }));
  const st = await body(await s.call(req("/living/stop", { key: s.key, json: { id } })));
  assert.equal(st.project.status, "stopped"); assert.equal(st.project.receipt.reason, "USER_STOP");
});
test("providers: unknown provider or custom URL is rejected (SSRF guard); allowlisted free-tier host works", async () => {
  const s = await setup({ fetchAnswers: ["Refunds within 30 days."] });
  const id = (await body(await s.call(req("/living/create", { key: s.key, json: { project } })))).project.id;
  const bad = await s.call(req("/living/step", { key: s.key, json: { id, provider: "custom", model: "x", baseUrl: "http://169.254.169.254/" }, headers: { "x-provider-key": PK } }));
  assert.equal(bad.status, 400);
  const ok = await s.call(req("/living/step", { key: s.key, json: { id, provider: "groq", model: "customer-model" }, headers: { "x-provider-key": PK } }));
  assert.equal(ok.status, 200); assert.equal(s.calls.at(-1)!.url, "https://api.groq.com/openai/v1/chat/completions");
});
test("mock provider needs BOTH the server flag and a test key; results are labelled SIMULATED", async () => {
  const s = await setup({ env: { SPE_PRO_ALLOW_MOCK_PROVIDER: "1" } });
  const id = (await body(await s.call(req("/living/create", { key: s.key, json: { project } })))).project.id;
  const real = await s.call(req("/living/step", { key: s.key, json: { id, provider: "mock", model: "mock" } })); assert.equal(real.status, 400, "real key cannot use mock");
  const t = await issuer(TEST_KID); const store = new MemoryStore(); const tk = await t.sign();
  const call = (r: Request, env: Record<string, string>) => handleProRequest(r, env, { keyEnv: t.env(), store });
  const id2 = (await body(await call(req("/living/create", { key: tk, json: { project } }), {}))).project.id;
  assert.equal((await call(req("/living/step", { key: tk, json: { id: id2, provider: "mock", model: "mock" } }), {})).status, 400, "flag off");
  const d = await body(await call(req("/living/step", { key: tk, json: { id: id2, provider: "mock", model: "mock" } }), { SPE_PRO_ALLOW_MOCK_PROVIDER: "1" }));
  assert.equal(d.project.attempts[0].simulated, true);
});
test("rate limit returns 429 with retry-after", async () => {
  const s = await setup({ env: { SPE_PRO_RATE_PER_MIN: "3" } });
  for (let n = 0; n < 3; n++) assert.equal((await s.call(req("/session", { key: s.key }))).status, 200);
  const r = await s.call(req("/session", { key: s.key })); assert.equal(r.status, 429); assert.ok(Number(r.headers.get("retry-after")) > 0);
  assert.equal((await s.call(req("/session", { key: s.keyB }))).status, 200, "limits are per customer");
});
test("audit log is server-side, per customer, hash-chained", async () => {
  const s = await setup();
  await s.call(req("/audit/append", { key: s.key, json: { action: "session.create", detail: "A" } }));
  await s.call(req("/living/create", { key: s.key, json: { project } }));
  const a = await body(await s.call(req("/audit/list", { key: s.key })));
  assert.ok(a.entries.length >= 2); assert.equal(a.verify.ok, true);
  assert.ok(a.entries.some((e: any) => e.action === "living.create"));
  const b = await body(await s.call(req("/audit/list", { key: s.keyB }))); assert.equal(b.entries.length, 0);
});
test("blind A/B: create hides which prompt wrote which output; reveal after picks", async () => {
  const s = await setup({ fetchAnswers: ["out-A1", "out-B1"] });
  const c = await s.call(req("/ab/create", { key: s.key, json: { a: "Prompt A", b: "Prompt B", inputs: [{ id: "c1", text: "hello" }], ...model }, headers: { "x-provider-key": PK } }));
  const t = await c.text(); assert.equal(c.status, 200); assert.ok(!/xIs|"A"|"B"/.test(t.replace(/"Prompt [AB]"/g, ""))); const d = JSON.parse(t);
  assert.equal(d.view.length, 1);
  const r = await body(await s.call(req("/ab/reveal", { key: s.key, json: { id: d.id, picks: { c1: "x" } } })));
  assert.equal(r.totals.A + r.totals.B, 1);
});
test("portability: per-model rows; a model without a key is NOT_RUN", async () => {
  const s = await setup({ fetchAnswers: ["Refunds within 30 days."] });
  const r = await body(await s.call(req("/portability/run", { key: s.key, json: { project, models: [{ provider: "openai", model: "m1" }, { provider: "anthropic", model: "m2" }] }, headers: { "x-provider-key-0": PK } })));
  assert.equal(r.models[0].status, "RAN"); assert.equal(r.models[0].pass, 1);
  assert.equal(r.models[1].status, "NOT_RUN");
});
