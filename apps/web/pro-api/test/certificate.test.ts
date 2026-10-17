import { test } from "node:test";
import assert from "node:assert/strict";
import { newProject, runAttempt, type RunModel } from "../../src/pro-studio/core/living/loop.ts";
import { buildCertificate, verifyCertificate } from "../../src/pro-studio/core/living/certificate.ts";

const run: RunModel = async () => ({ text: "Refunds are accepted within 30 days.", usage: { total: 50 } });
async function verifiedProject() {
  const p = newProject({ name: "R", intent: "Refund answers", requirements: [{ id: "r1", text: "Mention 30 days", check: { kind: "contains", value: "30 days" } }], inputs: [{ id: "i1", text: "refund?" }], budget: { maxAttempts: 3, maxTokens: 10_000 } }, "2026-10-18T00:00:00.000Z");
  return runAttempt(p, run, { provider: "openai", model: "customer-model", simulated: false, now: () => "2026-10-18T00:00:01.000Z" });
}
async function signer() {
  const k = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return k;
}
test("certificate lists model, SPE version, every test, builder and verifier ids", async () => {
  const p = await verifiedProject();
  const c = await buildCertificate(p, { speVersion: "pro-r3", issuedAt: "2026-10-18T00:00:02.000Z" });
  assert.equal(c.verdict, "VERIFIED"); assert.equal(c.model, "customer-model"); assert.equal(c.speVersion, "pro-r3");
  assert.equal(c.tests.length, 1); assert.equal(c.tests[0].status, "VERIFIED");
  assert.notEqual(c.builder, c.verifier); assert.equal(c.signature, null); assert.equal(c.signed, "UNSIGNED");
  assert.equal((await verifyCertificate(c)).ok, true);
});
test("editing a status, an output or the verdict fails verification", async () => {
  const p = await verifiedProject();
  const c = await buildCertificate(p, { speVersion: "pro-r3", issuedAt: "2026-10-18T00:00:02.000Z" });
  const outEdit = structuredClone(c); outEdit.evidence[0].output = "We never give refunds."; 
  const r1 = await verifyCertificate(outEdit); assert.equal(r1.ok, false);
  const verdictEdit = structuredClone(c); verdictEdit.tests[0].status = "FAILED";
  assert.equal((await verifyCertificate(verdictEdit)).ok, false);
});
test("a forged certificate claiming VERIFIED for failing output is rejected (verifier re-runs checks)", async () => {
  const p = await verifiedProject();
  const c = await buildCertificate(p, { speVersion: "pro-r3", issuedAt: "2026-10-18T00:00:02.000Z" });
  const forged = structuredClone(c); forged.evidence[0].output = "no window"; forged.evidence[0].outputSha = await (await import("../../src/pro-studio/core/living/verify.ts")).sha256Hex("no window");
  const { recomputeCertSha } = await import("../../src/pro-studio/core/living/certificate.ts");
  forged.certSha256 = await recomputeCertSha(forged);
  const r = await verifyCertificate(forged); assert.equal(r.ok, false); assert.match(r.reasons.join(" "), /re-ran/i);
});
test("signed certificate: valid signature verifies, wrong key fails", async () => {
  const p = await verifiedProject(); const k = await signer(); const other = await signer();
  const c = await buildCertificate(p, { speVersion: "pro-r3", issuedAt: "2026-10-18T00:00:02.000Z", keys: k });
  assert.equal(c.signed, "ED25519"); assert.equal((await verifyCertificate(c)).ok, true);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", other.publicKey));
  const swapped = structuredClone(c); swapped.publicKey = Buffer.from(pub).toString("base64");
  assert.equal((await verifyCertificate(swapped)).ok, false);
});
