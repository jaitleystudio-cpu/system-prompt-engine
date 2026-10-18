// Server storage for Pro Studio, keyed by the Pro key subject (`sub`). No store has been provisioned:
// choosing one (e.g. Cloudflare KV free tier, no card) is Prawin's decision. Until then the dev/test server
// uses MemoryStore, which is NOT persistent and is reported as "memory" by GET /api/pro/session.
export interface ProStore { readonly kind: "memory" | "kv"; get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { ttlSeconds?: number }): Promise<void>; delete(key: string): Promise<void>; list(prefix: string): Promise<string[]> }
export class MemoryStore implements ProStore {
  readonly kind = "memory" as const;
  private m = new Map<string, { v: string; exp: number | null }>();
  constructor(private now: () => number = Date.now) {}
  async get(k: string) { const e = this.m.get(k); if (!e) return null; if (e.exp !== null && e.exp <= this.now()) { this.m.delete(k); return null; } return e.v; }
  async put(k: string, v: string, o?: { ttlSeconds?: number }) { this.m.set(k, { v, exp: o?.ttlSeconds ? this.now() + o.ttlSeconds * 1000 : null }); }
  async delete(k: string) { this.m.delete(k); }
  async list(prefix: string) { const out: string[] = []; for (const k of this.m.keys()) if (k.startsWith(prefix) && (await this.get(k)) !== null) out.push(k); return out.sort(); }
}
/** Minimal shape of a Cloudflare Workers KV namespace binding. */
export interface KvNamespaceLike { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void>; delete(k: string): Promise<void>; list(o: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> }
export class KvStore implements ProStore {
  readonly kind = "kv" as const;
  constructor(private kv: KvNamespaceLike) {}
  get(k: string) { return this.kv.get(k); }
  put(k: string, v: string, o?: { ttlSeconds?: number }) { return this.kv.put(k, v, o?.ttlSeconds ? { expirationTtl: Math.max(60, o.ttlSeconds) } : undefined); }
  delete(k: string) { return this.kv.delete(k); }
  async list(prefix: string) { const out: string[] = []; let cursor: string | undefined; do { const r = await this.kv.list({ prefix, cursor }); out.push(...r.keys.map((x) => x.name)); cursor = r.list_complete ? undefined : r.cursor; } while (cursor); return out; }
}
let devStore: MemoryStore | null = null;
/** KV binding `PRO_KV` if present (Workers), else one process-wide MemoryStore (dev/tests only). */
export function storeFromEnv(env: Record<string, unknown>): ProStore {
  const kv = env.PRO_KV as KvNamespaceLike | undefined;
  if (kv && typeof kv.get === "function" && typeof kv.list === "function") return new KvStore(kv);
  return (devStore ??= new MemoryStore());
}
export const userKey = (sub: string, ...parts: string[]) => `u:${encodeURIComponent(sub)}:${parts.join(":")}`;
