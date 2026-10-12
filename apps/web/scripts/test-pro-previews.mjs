// Unit tests for the Pro previews: regression diff logic, release crypto, blueprint export. Run: node --experimental-strip-types
import assert from "node:assert/strict";
import { test } from "node:test";
import * as R from "../redesign-site/pro/lib/regression.ts";
import * as S from "../redesign-site/pro/lib/releases.ts";
import * as B from "../redesign-site/pro/lib/blueprint.ts";

const tc = (o) => ({ id: "c", name: "c", input: "x", mustInclude: [], mustNotInclude: [], format: "any", maxWords: null, ...o });

test("evaluate: include / not-include are case-insensitive", () => {
  const r = R.evaluate("Hello World", tc({ mustInclude: ["hello"], mustNotInclude: ["WORLD"] }));
  assert.equal(r.checks[0].pass, true); assert.equal(r.checks[1].pass, false); assert.equal(r.pass, false);
});
test("evaluate: json, bullets, max words", () => {
  assert.equal(R.evaluate('{"a":1}', tc({ format: "json" })).pass, true);
  assert.equal(R.evaluate("{a:1}", tc({ format: "json" })).pass, false);
  assert.equal(R.evaluate("- a\n- b", tc({ format: "bullets" })).pass, true);
  assert.equal(R.evaluate("- a\nb", tc({ format: "bullets" })).pass, false);
  assert.equal(R.evaluate("", tc({ format: "bullets" })).pass, false);
  assert.equal(R.evaluate("one two three", tc({ maxWords: 3 })).pass, true);
  assert.equal(R.evaluate("one two three four", tc({ maxWords: 3 })).pass, false);
});
test("no checks = pass (vacuous) and is reported as zero checks", () => {
  const r = R.evaluate("anything", tc({})); assert.equal(r.pass, true); assert.equal(r.checks.length, 0);
});
test("simulated runner is deterministic and obeys directives", () => {
  const p = "Never say: refund\nAlways include: Visit the help centre\nFormat: bullets";
  const a = R.simulateResponse(p, "I want a refund"), b = R.simulateResponse(p, "I want a refund");
  assert.equal(a, b); assert.ok(!/refund/i.test(a)); assert.ok(a.includes("Visit the help centre")); assert.ok(a.split("\n").every((l) => l.startsWith("- ")));
  assert.ok(/refund you in full/.test(R.simulateResponse("", "refund please")));
  assert.doesNotThrow(() => JSON.parse(R.simulateResponse("Format: json", "hi")));
  assert.ok(R.countWords(R.simulateResponse("Max words: 4", "a long question here")) <= 4);
});
test("diffReports classifies fixed / regressed / still / new / removed", () => {
  const mk = (id, pass) => ({ id, name: id, output: "", pass, checks: [] });
  const d = R.diffReports([mk("f", false), mk("r", true), mk("sp", true), mk("sf", false), mk("gone", true)],
                          [mk("f", true), mk("r", false), mk("sp", true), mk("sf", false), mk("n", true)]);
  const by = Object.fromEntries(d.rows.map((x) => [x.id, x.change]));
  assert.deepEqual(by, { f: "fixed", r: "regressed", sp: "still-pass", sf: "still-fail", gone: "removed", n: "new" });
  assert.equal(d.counts.fixed, 1); assert.equal(d.counts.regressed, 1); assert.equal(d.total, 6); assert.equal(d.passA, 3); assert.equal(d.passB, 3);
});
test("end to end: adding a rule fixes the refund case and the report says so", () => {
  const cases = [tc({ id: "1", name: "refund", input: "Can I get a refund?", mustNotInclude: ["refund you"] })];
  const d = R.diffReports(R.runSuite("Be helpful.", cases), R.runSuite("Be helpful.\nNever say: refund", cases));
  assert.equal(d.rows[0].change, "fixed");
});

const input = { name: "Support bot", version: "1.2.0", changelog: "Add refund rule", prompt: "Never say: refund", createdAt: "2026-10-12T00:00:00.000Z" };
test("SHA-256 matches a known vector", async () => {
  assert.equal(await S.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("Ed25519 is supported in this runtime", async () => { assert.equal(await S.ed25519Supported(), true); });
test("sign then verify succeeds; fingerprint pinning works", async () => {
  const k = await S.generateKeyPair(); const p = await S.signRelease(input, k); const t = JSON.stringify(p);
  assert.equal(p.sha256, await S.sha256Hex(S.canonical(input)));
  assert.equal(S.fromB64(p.signature).length, 64);
  const v = await S.verifyPack(t); assert.equal(v.ok, true, v.reasons.join()); assert.equal(v.fingerprint, await S.fingerprint(p.publicKey));
  assert.equal((await S.verifyPack(t, v.fingerprint)).ok, true);
  const w = await S.verifyPack(t, "0000000000000000"); assert.equal(w.ok, false); assert.match(w.reasons.join(), /not the expected key/);
});
test("tampering with any signed field is detected", async () => {
  const k = await S.generateKeyPair(); const p = await S.signRelease(input, k);
  for (const f of ["name", "version", "changelog", "prompt", "createdAt"]) {
    const v = await S.verifyPack(JSON.stringify({ ...p, [f]: p[f] + "x" })); assert.equal(v.ok, false, f);
  }
  // attacker recomputes the hash but cannot re-sign
  const forged = { ...p, prompt: "Promise refunds" }; forged.sha256 = await S.sha256Hex(S.canonical(forged));
  const v = await S.verifyPack(JSON.stringify(forged)); assert.equal(v.ok, false); assert.match(v.reasons.join(), /Signature does not match/);
});
test("a different key's signature is rejected (key substitution keeps integrity, pinning catches identity)", async () => {
  const k1 = await S.generateKeyPair(), k2 = await S.generateKeyPair(); const p1 = await S.signRelease(input, k1), p2 = await S.signRelease(input, k2);
  assert.equal((await S.verifyPack(JSON.stringify({ ...p1, signature: p2.signature }))).ok, false);
  const fp1 = await S.fingerprint(p1.publicKey); assert.equal((await S.verifyPack(JSON.stringify(p2), fp1)).ok, false);
});
test("malformed input is rejected, never throws", async () => {
  for (const t of ["", "nope", "null", "{}", '{"format":1}', JSON.stringify({ ...input, format: S.FORMAT, sha256: "", publicKey: "!!", signature: "!!" })])
    assert.equal((await S.verifyPack(t)).ok, false, t);
});
test("signRelease validates name and semver", async () => {
  const k = await S.generateKeyPair();
  await assert.rejects(S.signRelease({ ...input, version: "v1" }, k)); await assert.rejects(S.signRelease({ ...input, name: " " }, k));
});
test("private key is not extractable", async () => {
  const k = await S.generateKeyPair(); await assert.rejects(crypto.subtle.exportKey("pkcs8", k.privateKey));
});

const bp = () => ({ name: "Shop", agents: [
  { id: "a", name: "Triage", role: "r", instructions: "i", tools: ["web_search"], maxSteps: 5, needsApproval: false, x: 0, y: 0 },
  { id: "b", name: "Refunds", role: "r", instructions: "", tools: ["send_email"], maxSteps: 8, needsApproval: true, x: 0, y: 0 }],
  handoffs: [{ from: "a", to: "b", when: "billing" }] });
test("blueprint validation", () => {
  assert.deepEqual(B.validate(bp()), []);
  const x = bp(); x.agents[1].needsApproval = false; assert.match(B.validate(x).join(), /require human approval/);
  const y = bp(); y.handoffs.push({ from: "a", to: "a", when: "" }, { from: "a", to: "zz", when: "" }); assert.equal(B.validate(y).length, 2);
  const z = bp(); z.agents[1].name = "triage"; assert.match(B.validate(z).join(), /Two agents/);
});
test("exports carry the draft note, tools and handoffs", () => {
  for (const f of [B.toOpenAI, B.toAnthropic, B.toMcpStyle]) { const o = f(bp()); assert.match(o._note, /verify before use/); assert.doesNotThrow(() => JSON.stringify(o)); }
  assert.equal(B.toOpenAI(bp()).agents[0].handoffs[0].agent, "refunds");
  assert.equal(B.toAnthropic(bp()).agents[1].tools[0].name, "send_email");
  assert.equal(B.toMcpStyle(bp()).tools.send_email.annotations.destructiveHint, true);
  const y = bp(); y.handoffs.push({ from: "a", to: "zz", when: "" }); assert.equal(B.toMcpStyle(y).handoffs.length, 1);
});
