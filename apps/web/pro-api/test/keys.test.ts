import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyProKey, TEST_KID, keyEnvFrom } from "../keys.ts";
import { issuer, DAY } from "./helpers.ts";

test("valid key verifies and returns claims", async () => {
  const i = await issuer("spe-pro-2026");
  const r = await verifyProKey(await i.sign(), i.env());
  assert.equal(r.ok, true); if (r.ok) { assert.equal(r.payload.sub, "cust_1"); assert.equal(r.test, false); }
});
test("every rejection reason is reachable", async () => {
  const i = await issuer("spe-pro-2026"); const t = await issuer(TEST_KID); const now = Date.now();
  const k = await i.sign();
  const cases: [string, Promise<unknown>][] = [
    ["MISSING_KEY", verifyProKey("", i.env())],
    ["MALFORMED_KEY", verifyProKey("sk-abc", i.env())],
    ["MALFORMED_KEY", verifyProKey("spe_pro.v1.only-one-part", i.env())],
    ["MALFORMED_KEY", verifyProKey("spe_pro.v1.!!!.@@@", i.env())],
    ["UNKNOWN_ISSUER", verifyProKey(k, { ...i.env(), publicKeys: {} })],
    ["TEST_KEYS_DISABLED", verifyProKey(await t.sign(), t.env({ allowTestKeys: false }))],
    ["BAD_SIGNATURE", verifyProKey(k.slice(0, -3) + (k.endsWith("AAA") ? "BBB" : "AAA"), i.env())],
    ["EXPIRED_KEY", verifyProKey(await i.sign({ iat: now - 10 * DAY, exp: now - DAY }), i.env())],
    ["NOT_YET_VALID", verifyProKey(await i.sign({ iat: now + 10 * 60_000 }), i.env())],
    ["REVOKED_KEY", verifyProKey(k, i.env({ revoked: new Set(["cust_1"]) }))],
    ["BAD_CLAIMS", verifyProKey(await i.sign({ tier: "free" as never }), i.env())],
  ];
  for (const [want, p] of cases) { const r = (await p) as { ok: boolean; reason?: string }; assert.equal(r.ok, false, want); assert.equal(r.reason, want); }
});
test("payload tamper (sub changed) breaks the signature", async () => {
  const i = await issuer("spe-pro-2026"); const k = await i.sign();
  const [, , body, sig] = k.split(".");
  const p = JSON.parse(Buffer.from(body, "base64url").toString()); p.sub = "someone_else";
  const forged = `spe_pro.v1.${Buffer.from(JSON.stringify(p)).toString("base64url")}.${sig}`;
  const r = await verifyProKey(forged, i.env()); assert.equal(r.ok, false); assert.equal((r as { reason: string }).reason, "BAD_SIGNATURE");
});
test("a key signed by another issuer with the same kid is rejected", async () => {
  const a = await issuer("spe-pro-2026"); const b = await issuer("spe-pro-2026");
  const r = await verifyProKey(await b.sign(), a.env()); assert.equal(r.ok, false);
});
test("keyEnvFrom: test keys need the exact flag; revocation list parsed; bad JSON tolerated", () => {
  assert.equal(keyEnvFrom({ SPE_PRO_ALLOW_TEST_KEYS: "true" }).allowTestKeys, false);
  assert.equal(keyEnvFrom({ SPE_PRO_ALLOW_TEST_KEYS: "1" }).allowTestKeys, true);
  assert.deepEqual([...keyEnvFrom({ SPE_PRO_REVOKED: " a, b ,," }).revoked], ["a", "b"]);
  assert.deepEqual(keyEnvFrom({ SPE_PRO_PUBLIC_KEYS: "{not json" }).publicKeys, {});
});
