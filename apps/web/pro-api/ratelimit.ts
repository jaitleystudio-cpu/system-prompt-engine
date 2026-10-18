// Fixed-window rate limit per key subject. Numbers are a proposal; Prawin decides the real limits.
import type { ProStore } from "./store.ts";
export const DEFAULT_RATE_PER_MIN = 120;
export const DEFAULT_BYOK_RATE_PER_MIN = 20;
export async function hitRate(store: ProStore, sub: string, bucket: string, limit: number, now = Date.now()): Promise<{ ok: boolean; retryAfter: number; remaining: number }> {
  const win = Math.floor(now / 60_000); const k = `rl:${encodeURIComponent(sub)}:${bucket}:${win}`;
  const n = Number((await store.get(k)) ?? "0") || 0;
  const retryAfter = Math.max(1, Math.ceil(((win + 1) * 60_000 - now) / 1000));
  if (n >= limit) return { ok: false, retryAfter, remaining: 0 };
  await store.put(k, String(n + 1), { ttlSeconds: 120 });
  return { ok: true, retryAfter: 0, remaining: limit - n - 1 };
}
