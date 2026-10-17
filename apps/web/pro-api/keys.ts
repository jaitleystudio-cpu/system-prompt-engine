// Pro access keys: no accounts, no passwords. A key is an Ed25519-signed claim that the SERVER verifies on
// every request. Format: spe_pro.v1.<payload base64url>.<signature base64url>
// Payload: { kid, sub, tier: "pro"|"team", iat, exp }  (times in ms since epoch)
// Issuance needs the issuer's private key, which never ships to browsers. No live issuance exists yet:
// that needs Antigravity's go-ahead. Test keys (kid "spe-pro-test-v1") are accepted ONLY when the server
// runs with SPE_PRO_ALLOW_TEST_KEYS=1, which is for local tests and must never be set in production.
export const KEY_PREFIX = "spe_pro.v1.";
export const TEST_KID = "spe-pro-test-v1";
export interface KeyPayload { kid: string; sub: string; tier: "pro" | "team"; iat: number; exp: number }
export type KeyCheck = { ok: true; payload: KeyPayload; test: boolean } | { ok: false; reason: KeyReason };
export type KeyReason = "MISSING_KEY" | "MALFORMED_KEY" | "UNKNOWN_ISSUER" | "TEST_KEYS_DISABLED" | "BAD_SIGNATURE" | "EXPIRED_KEY" | "NOT_YET_VALID" | "REVOKED_KEY" | "BAD_CLAIMS";
export interface KeyEnv { publicKeys: Record<string, string>; allowTestKeys: boolean; revoked: Set<string>; now?: number }

const enc = new TextEncoder(); const dec = new TextDecoder();
export const b64u = (b: Uint8Array) => { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export const fromB64u = (s: string) => { if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("bad b64u"); const p = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(p + "=".repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0)); };

/** Parses a Pro key from env values: SPE_PRO_PUBLIC_KEYS='{"kid":"<base64url raw 32-byte key>"}'. */
export function keyEnvFrom(e: Record<string, string | undefined>): KeyEnv {
  let publicKeys: Record<string, string> = {};
  try { const p = JSON.parse(e.SPE_PRO_PUBLIC_KEYS || "{}"); if (p && typeof p === "object") publicKeys = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === "string")) as Record<string, string>; } catch { publicKeys = {}; }
  return { publicKeys, allowTestKeys: e.SPE_PRO_ALLOW_TEST_KEYS === "1", revoked: new Set((e.SPE_PRO_REVOKED || "").split(",").map((x) => x.trim()).filter(Boolean)) };
}

export async function verifyProKey(raw: string | null | undefined, env: KeyEnv): Promise<KeyCheck> {
  const key = (raw ?? "").trim();
  if (!key) return { ok: false, reason: "MISSING_KEY" };
  if (!key.startsWith(KEY_PREFIX) || key.length > 4096) return { ok: false, reason: "MALFORMED_KEY" };
  const parts = key.slice(KEY_PREFIX.length).split(".");
  if (parts.length !== 2) return { ok: false, reason: "MALFORMED_KEY" };
  let payload: KeyPayload; let sig: Uint8Array; let body: Uint8Array;
  try { body = fromB64u(parts[0]); sig = fromB64u(parts[1]); payload = JSON.parse(dec.decode(body)); } catch { return { ok: false, reason: "MALFORMED_KEY" }; }
  if (!payload || typeof payload !== "object" || typeof payload.kid !== "string" || typeof payload.sub !== "string" || !payload.sub || (payload.tier !== "pro" && payload.tier !== "team") || typeof payload.iat !== "number" || typeof payload.exp !== "number") return { ok: false, reason: "BAD_CLAIMS" };
  const isTest = payload.kid === TEST_KID;
  if (isTest && !env.allowTestKeys) return { ok: false, reason: "TEST_KEYS_DISABLED" };
  const pub = env.publicKeys[payload.kid];
  if (!pub) return { ok: false, reason: "UNKNOWN_ISSUER" };
  if (sig.length !== 64) return { ok: false, reason: "BAD_SIGNATURE" };
  let valid = false;
  try { const k = await crypto.subtle.importKey("raw", fromB64u(pub), { name: "Ed25519" }, false, ["verify"]); valid = await crypto.subtle.verify({ name: "Ed25519" }, k, sig, body); } catch { valid = false; }
  if (!valid) return { ok: false, reason: "BAD_SIGNATURE" };
  const now = env.now ?? Date.now();
  if (payload.exp <= now) return { ok: false, reason: "EXPIRED_KEY" };
  if (payload.iat > now + 60_000) return { ok: false, reason: "NOT_YET_VALID" };
  if (env.revoked.has(payload.sub)) return { ok: false, reason: "REVOKED_KEY" };
  return { ok: true, payload, test: isTest };
}

/** Issuer-side helper (Node or tests only). Never import this into browser code. */
export async function signProKey(payload: KeyPayload, privateKey: CryptoKey): Promise<string> {
  const body = enc.encode(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privateKey, body));
  return `${KEY_PREFIX}${b64u(body)}.${b64u(sig)}`;
}
export async function newIssuerKeyPair(): Promise<{ keys: CryptoKeyPair; publicB64u: string }> {
  const keys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { keys, publicB64u: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey))) };
}
