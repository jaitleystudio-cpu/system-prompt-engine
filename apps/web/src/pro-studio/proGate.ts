// Pro gate. The ONLY source of truth is the server: GET /api/pro/session verifies the Pro access key
// (Ed25519, server-side) on every request, and every tool request is verified again. The browser stores the
// pasted key and renders the result. No accounts, no passwords, no payments are taken here; live key issuance
// needs Antigravity's go-ahead.
export type AccessState = "checking" | "pro" | "locked" | "offline";
export interface Access { state: AccessState; tier: "pro" | "team" | null; label: string; detail: string; test: boolean; reason: string | null }
export interface SessionOk { ok: true; tier: "pro" | "team"; exp: number; sub: string; test: boolean }
export const REASON_TEXT: Record<string, string> = {
  MISSING_KEY: "Paste your Pro access key to unlock Pro Studio.",
  MALFORMED_KEY: "That doesn't look like an SPE Pro access key. Keys start with spe_pro.v1.",
  UNKNOWN_ISSUER: "This key wasn't issued by SPE.",
  TEST_KEYS_DISABLED: "Test keys only work on development servers.",
  BAD_SIGNATURE: "This key's signature is invalid. It may have been changed.",
  EXPIRED_KEY: "This key has expired.",
  NOT_YET_VALID: "This key isn't valid yet. Check your device clock.",
  REVOKED_KEY: "This key has been revoked.",
  BAD_CLAIMS: "This key is missing required details.",
  RATE_LIMITED: "Too many requests. Wait a minute and try again.",
};
export const CHECKING: Access = { state: "checking", tier: null, label: "Checking key…", detail: "Verifying your Pro access key with the SPE Pro service.", test: false, reason: null };
export function accessFromSession(res: SessionOk | { reason?: string } | null, opts: { network?: boolean; now?: number } = {}): Access {
  if (opts.network) return { state: "offline", tier: null, label: "Can't reach SPE Pro", detail: "Pro Studio is an online service. Check your connection and try again.", test: false, reason: "NETWORK" };
  if (res && "ok" in res && res.ok === true && (res.tier === "pro" || res.tier === "team") && res.exp > (opts.now ?? Date.now())) {
    const plan = res.tier === "team" ? "Team" : "Pro"; const days = Math.max(0, Math.ceil((res.exp - (opts.now ?? Date.now())) / 86_400_000));
    return { state: "pro", tier: res.tier, label: res.test ? `${plan} · TEST KEY` : `${plan} plan`, detail: res.test ? "Development test key. Accepted only on servers with test keys enabled." : `Key verified by the SPE Pro service. Valid for ${days} more day${days === 1 ? "" : "s"}.`, test: res.test, reason: null };
  }
  const reason = (res && "reason" in res && res.reason) || "MISSING_KEY";
  return { state: "locked", tier: null, label: "No Pro key", detail: REASON_TEXT[reason] ?? "This key was rejected.", test: false, reason };
}
export const hasAccess = (a: Access) => a.state === "pro";
