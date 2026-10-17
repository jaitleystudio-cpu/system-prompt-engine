// Signed Prompt Releases — real SHA-256 + Ed25519 via WebCrypto. Keys are generated locally and never leave the tab.
export const FORMAT = "spe-release-pack/0.1";
export interface ReleaseInput { name: string; version: string; changelog: string; prompt: string; createdAt: string; }
export interface ReleasePack extends ReleaseInput { format: string; sha256: string; publicKey: string; signature: string; }
export interface VerifyResult { ok: boolean; reasons: string[]; fingerprint: string | null; }

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
export const toHex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b as ArrayBuffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
export const toB64 = (b: ArrayBuffer | Uint8Array) => { let s = ""; for (const x of new Uint8Array(b as ArrayBuffer)) s += String.fromCharCode(x); return btoa(s); };
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;

/** Canonical bytes: fixed key order, so the same release always hashes the same way. */
export function canonical(r: ReleaseInput & { format?: string }): string {
  return JSON.stringify({ format: FORMAT, name: r.name, version: r.version, createdAt: r.createdAt, changelog: r.changelog, prompt: r.prompt });
}
export async function sha256Hex(s: string): Promise<string> { return toHex(await subtle().digest("SHA-256", enc.encode(s))); }
export async function ed25519Supported(): Promise<boolean> {
  try { await subtle().generateKey({ name: "Ed25519" }, false, ["sign", "verify"]); return true; } catch { return false; }
}
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return (await subtle().generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair; // private key non-extractable
}
export async function exportPublic(k: CryptoKey): Promise<string> { return toB64(await subtle().exportKey("raw", k)); }
export async function fingerprint(publicKeyB64: string): Promise<string> { return (await sha256Hex(publicKeyB64)).slice(0, 16); }

export async function signRelease(input: ReleaseInput, keys: CryptoKeyPair): Promise<ReleasePack> {
  if (!input.name.trim()) throw new Error("Name is required.");
  if (!SEMVER.test(input.version)) throw new Error("Version must look like 1.2.3.");
  const c = canonical(input);
  const sig = await subtle().sign({ name: "Ed25519" }, keys.privateKey, enc.encode(c));
  return { format: FORMAT, ...input, sha256: await sha256Hex(c), publicKey: await exportPublic(keys.publicKey), signature: toB64(sig) };
}

export async function verifyPack(text: string, expectedFingerprint = ""): Promise<VerifyResult> {
  const reasons: string[] = []; let p: ReleasePack;
  try { p = JSON.parse(text); } catch { return { ok: false, reasons: ["Not valid JSON."], fingerprint: null }; }
  if (!p || typeof p !== "object") return { ok: false, reasons: ["Not a release pack."], fingerprint: null };
  for (const k of ["format", "name", "version", "createdAt", "changelog", "prompt", "sha256", "publicKey", "signature"] as const)
    if (typeof (p as any)[k] !== "string") reasons.push(`Missing field: ${k}.`);
  if (reasons.length) return { ok: false, reasons, fingerprint: null };
  if (p.format !== FORMAT) reasons.push(`Unknown format: ${p.format}.`);
  const c = canonical(p);
  if ((await sha256Hex(c)) !== p.sha256) reasons.push("Hash does not match the content. The pack was changed after signing.");
  let fp: string | null = null;
  try {
    const raw = fromB64(p.publicKey); if (raw.length !== 32) throw new Error();
    fp = await fingerprint(p.publicKey);
    const key = await subtle().importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
    const sig = fromB64(p.signature);
    if (!(await subtle().verify({ name: "Ed25519" }, key, sig, enc.encode(c)))) reasons.push("Signature does not match this content and key.");
  } catch { reasons.push("Public key or signature is malformed."); }
  const want = expectedFingerprint.trim().toLowerCase();
  if (want && fp && want !== fp) reasons.push(`Signed by key ${fp}, not the expected key ${want}.`);
  return { ok: reasons.length === 0, reasons, fingerprint: fp };
}
