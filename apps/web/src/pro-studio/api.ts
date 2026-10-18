// Client for the gated SPE Pro API. Every Pro tool result comes from the server; the browser only renders it.
import { useEffect, useRef, useState } from "react";
export const KEY_STORE = "spe.pro.key";
export function getKey(): string { try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; } }
export function setKey(k: string) { try { if (k) localStorage.setItem(KEY_STORE, k.trim()); else localStorage.removeItem(KEY_STORE); } catch { /* storage blocked: key lives for this page only */ } }
export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public reason?: string) { super(message); } }
let onUnauthorized: ((reason: string) => void) | null = null;
export const setUnauthorizedHandler = (f: (reason: string) => void) => { onUnauthorized = f; };

export async function proApi<T>(path: string, body?: unknown, opts: { method?: "GET" | "POST" | "PUT"; providerKey?: string; key?: string; signal?: AbortSignal; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { authorization: `Bearer ${opts.key ?? getKey()}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (opts.providerKey) headers["x-provider-key"] = opts.providerKey;
  if (opts.headers) Object.assign(headers, opts.headers);
  let r: Response;
  try { r = await fetch(`/api/pro${path}`, { method: opts.method ?? (body === undefined ? "GET" : "POST"), headers, body: body === undefined ? undefined : JSON.stringify(body), signal: opts.signal, credentials: "omit", cache: "no-store" }); }
  catch (e) { if ((e as Error).name === "AbortError") throw e; throw new ApiError(0, "NETWORK", "Can't reach the SPE Pro service. Pro Studio needs a connection."); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d: any = null; try { d = await r.json(); } catch { d = null; }
  if (!r.ok) {
    if (r.status === 401 && onUnauthorized) onUnauthorized(d?.reason ?? "MISSING_KEY");
    throw new ApiError(r.status, d?.error ?? "HTTP_" + r.status, d?.message ?? `Request failed (HTTP ${r.status}).`, d?.reason);
  }
  return d as T;
}

/** Debounced server query. Re-runs when `key` (a stable JSON string of the inputs) changes. */
export function useProQuery<T>(path: string, body: unknown, opts: { enabled?: boolean; debounce?: number } = {}) {
  const { enabled = true, debounce = 220 } = opts;
  const sig = JSON.stringify(body ?? null);
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: "", loading: enabled });
  const seq = useRef(0);
  useEffect(() => {
    if (!enabled) { setState((s) => ({ ...s, loading: false })); return; }
    const my = ++seq.current; const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      proApi<T>(path, body === undefined ? undefined : JSON.parse(sig), { signal: ctl.signal })
        .then((data) => { if (my === seq.current) setState({ data, error: "", loading: false }); })
        .catch((e) => { if ((e as Error).name !== "AbortError" && my === seq.current) setState((s) => ({ data: s.data, error: (e as Error).message, loading: false })); });
    }, debounce);
    return () => { clearTimeout(t); ctl.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, sig, enabled, debounce]);
  return state;
}

/** The customer's own model connection. Held in page memory only: never written to storage, never sent
 * anywhere except the X-Provider-Key header of a run request to the SPE Pro service, which uses it once. */
export interface Byok { provider: string; model: string; key: string }
export const EMPTY_BYOK: Byok = { provider: "openai", model: "", key: "" };
export const byokReady = (b: Byok) => !!b.model.trim() && (b.provider === "mock" || !!b.key.trim());
export interface ProviderInfo { id: string; label: string; note: string }
export interface SessionInfo { ok: true; tier: "pro" | "team"; exp: number; sub: string; test: boolean; storage: "memory" | "kv"; speVersion: string; simulatedProvider: boolean; sandbox?: "node-harness" | "none" }
