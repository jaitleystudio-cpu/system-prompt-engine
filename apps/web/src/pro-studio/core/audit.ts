// Local audit log with a SHA-256 hash chain. It proves the log in this browser was not edited after the fact;
// it is not a server-side or tamper-proof record (anyone with this browser can clear it).
export interface AuditEntry { seq: number; at: string; action: string; detail: string; prev: string; hash: string }
export const GENESIS = "0".repeat(64);
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function sha256(s: string): Promise<string> { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
export const entryPayload = (e: Omit<AuditEntry, "hash">) => JSON.stringify([e.seq, e.at, e.action, e.detail, e.prev]);
export async function appendEntry(log: AuditEntry[], action: string, detail: string, at = new Date().toISOString()): Promise<AuditEntry[]> {
  const prev = log.length ? log[log.length - 1].hash : GENESIS; const base = { seq: log.length + 1, at, action, detail: detail.slice(0, 500), prev };
  return [...log, { ...base, hash: await sha256(entryPayload(base)) }];
}
export interface ChainResult { ok: boolean; brokenAt: number | null; reason: string }
export async function verifyChain(log: AuditEntry[]): Promise<ChainResult> {
  let prev = GENESIS;
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.seq !== i + 1) return { ok: false, brokenAt: i + 1, reason: `Entry ${i + 1} has sequence ${e.seq}.` };
    if (e.prev !== prev) return { ok: false, brokenAt: i + 1, reason: `Entry ${i + 1} does not point to the entry before it.` };
    if ((await sha256(entryPayload(e))) !== e.hash) return { ok: false, brokenAt: i + 1, reason: `Entry ${i + 1} was changed after it was written.` };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null, reason: `${log.length} entries, chain intact.` };
}
export function auditToCsv(log: AuditEntry[]): string {
  const c = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return ["seq,at,action,detail,prev,hash", ...log.map((e) => [e.seq, e.at, e.action, e.detail, e.prev, e.hash].map(c).join(","))].join("\n");
}
