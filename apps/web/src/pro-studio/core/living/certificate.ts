// Proof certificate for one attempt of a Living project. It is self-contained: it carries the checks and
// the evidence outputs, so the VERIFIER can re-run every check instead of trusting the recorded statuses.
import type { Check, ExecEvidence, LivingProject, Status } from "./types.ts";
import { runCheck, sha256Hex, VERIFIER_ID, isPass, extractCode } from "./verify.ts";
import { BUILDER_ID } from "./compile.ts";
import { ledgerOf } from "./loop.ts";
export const CERT_FORMAT = "spe.proof-certificate/1";
export interface Certificate {
  format: typeof CERT_FORMAT; projectId: string; projectName: string; intent: string; attempt: number;
  provider: string; model: string; simulated: boolean; speVersion: string; promptSha256: string;
  requirements: { id: string; text: string; check: Check }[];
  evidence: { inputId: string; output: string; outputSha: string; error?: string; exec?: ExecEvidence }[];
  tests: { reqId: string; inputId: string; status: Status }[];
  verdict: "VERIFIED" | "NOT_VERIFIED"; counts: Record<Status, number>;
  builder: string; verifier: string; issuedAt: string; certSha256: string;
  signed: "UNSIGNED" | "ED25519"; signature: string | null; publicKey: string | null;
}
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => { const bin = atob(s); const o = new Uint8Array(new ArrayBuffer(bin.length)); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const body = (c: Certificate) => { const { certSha256: _a, signature: _b, publicKey: _c, signed: _d, ...rest } = c; return JSON.stringify(rest); };
export const recomputeCertSha = (c: Certificate) => sha256Hex(body(c));
const zero = (): Record<Status, number> => ({ VERIFIED: 0, FAILED: 0, UNPROVEN: 0, NOT_RUN: 0, HUMAN_PASS: 0, HUMAN_FAIL: 0 });

export async function buildCertificate(p: LivingProject, o: { speVersion: string; issuedAt?: string; keys?: CryptoKeyPair | null; attempt?: number }): Promise<Certificate> {
  const a = o.attempt ? p.attempts.find((x) => x.n === o.attempt) : p.attempts[p.attempts.length - 1];
  if (!a) throw new Error("No attempt has run yet, so there is nothing to certify.");
  const led = a.n === p.attempts[p.attempts.length - 1].n ? ledgerOf(p) : null;
  const tests = a.results.map((r) => ({ reqId: r.reqId, inputId: r.inputId, status: (led?.find((e) => e.reqId === r.reqId && e.inputId === r.inputId)?.status ?? r.status) as Status }));
  const counts = zero(); for (const t of tests) counts[t.status]++;
  const verdict = tests.length > 0 && tests.every((t) => isPass(t.status)) ? "VERIFIED" : "NOT_VERIFIED";
  const c: Certificate = {
    format: CERT_FORMAT, projectId: p.id, projectName: p.name, intent: p.intent, attempt: a.n, provider: a.provider, model: a.model, simulated: a.simulated,
    speVersion: o.speVersion, promptSha256: a.promptSha, requirements: p.requirements.map((q) => ({ id: q.id, text: q.text, check: q.check })),
    evidence: a.runs.map((r) => ({ inputId: r.inputId, output: r.output, outputSha: r.outputSha, ...(r.error ? { error: r.error } : {}), ...(r.exec ? { exec: r.exec } : {}) })),
    tests, verdict, counts, builder: BUILDER_ID, verifier: VERIFIER_ID, issuedAt: o.issuedAt ?? new Date().toISOString(),
    certSha256: "", signed: "UNSIGNED", signature: null, publicKey: null,
  };
  c.certSha256 = await recomputeCertSha(c);
  if (o.keys) {
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, o.keys.privateKey, new TextEncoder().encode(c.certSha256)));
    c.signed = "ED25519"; c.signature = b64(sig); c.publicKey = b64(new Uint8Array(await crypto.subtle.exportKey("raw", o.keys.publicKey)));
  }
  return c;
}

export async function verifyCertificate(c: Certificate, expectPublicKey?: string): Promise<{ ok: boolean; reasons: string[]; recheck: { reqId: string; inputId: string; claimed: Status; rerun: Status }[] }> {
  const reasons: string[] = []; const recheck: { reqId: string; inputId: string; claimed: Status; rerun: Status }[] = [];
  if (!c || c.format !== CERT_FORMAT) return { ok: false, reasons: ["Not an SPE proof certificate."], recheck };
  if (c.builder === c.verifier) reasons.push("Builder and verifier must be different.");
  for (const e of c.evidence ?? []) if (!e.error && (await sha256Hex(e.output ?? "")) !== e.outputSha) reasons.push(`Output for input ${e.inputId} does not match its recorded hash.`);
  for (const e of c.evidence ?? []) if (e.exec && (await sha256Hex(extractCode(e.output ?? ""))) !== e.exec.codeSha) reasons.push(`Execution record for input ${e.inputId} is for different code than the recorded output.`);
  for (const t of c.tests ?? []) {
    const q = c.requirements.find((x) => x.id === t.reqId); const e = c.evidence.find((x) => x.inputId === t.inputId);
    if (!q || !e) { reasons.push(`Test ${t.reqId}/${t.inputId} has no matching requirement or evidence.`); continue; }
    let rerun: Status = e.error ? "NOT_RUN" : runCheck(q.check, e.output, e.exec).status;
    if (rerun === "UNPROVEN" && (t.status === "HUMAN_PASS" || t.status === "HUMAN_FAIL")) rerun = t.status; // human marks only on manual checks
    recheck.push({ reqId: t.reqId, inputId: t.inputId, claimed: t.status, rerun });
    if (rerun !== t.status) reasons.push(`Verifier re-ran ${t.reqId} on input ${t.inputId}: got ${rerun}, certificate says ${t.status}.`);
  }
  const want = (c.tests ?? []).length > 0 && c.tests.every((t) => isPass(t.status)) ? "VERIFIED" : "NOT_VERIFIED";
  if (c.verdict !== want) reasons.push(`Verdict ${c.verdict} does not follow from the tests (${want}).`);
  if ((await recomputeCertSha(c)) !== c.certSha256) reasons.push("Certificate hash does not match its content.");
  if (c.signed === "ED25519") {
    try {
      if (!c.publicKey || !c.signature) throw new Error();
      if (expectPublicKey && expectPublicKey !== c.publicKey) reasons.push("Signed by a different key than expected.");
      const k = await crypto.subtle.importKey("raw", unb64(c.publicKey), { name: "Ed25519" }, false, ["verify"]);
      if (!(await crypto.subtle.verify({ name: "Ed25519" }, k, unb64(c.signature), new TextEncoder().encode(c.certSha256)))) reasons.push("Signature does not match.");
    } catch { reasons.push("Signature or public key is malformed."); }
  } else if (c.signature) reasons.push("Certificate says UNSIGNED but carries a signature.");
  return { ok: reasons.length === 0, reasons, recheck };
}
