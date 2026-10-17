// Test helpers: a run-time generated test issuer keypair (no private key is ever committed).
import { newIssuerKeyPair, signProKey, TEST_KID, type KeyEnv, type KeyPayload } from "../keys.ts";
export const DAY = 86_400_000;
export async function issuer(kid = TEST_KID) {
  const { keys, publicB64u } = await newIssuerKeyPair();
  const env = (o: Partial<KeyEnv> = {}): KeyEnv => ({ publicKeys: { [kid]: publicB64u }, allowTestKeys: true, revoked: new Set(), ...o });
  const sign = (p: Partial<KeyPayload> = {}, now = Date.now()) => signProKey({ kid, sub: "cust_1", tier: "pro", iat: now - 1000, exp: now + 30 * DAY, ...p }, keys.privateKey);
  return { keys, publicB64u, env, sign, kid };
}
export const req = (path: string, init: RequestInit & { key?: string; json?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.key !== undefined) headers.set("authorization", `Bearer ${init.key}`);
  let body = init.body;
  if (init.json !== undefined) { headers.set("content-type", "application/json"); body = JSON.stringify(init.json); }
  return new Request(`http://pro.test/api/pro${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
};
