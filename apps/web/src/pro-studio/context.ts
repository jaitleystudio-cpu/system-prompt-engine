import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Workspace, Session } from "./core/workspace.ts";
import type { ToolId, ProRoute } from "./proRoutes.ts";
import type { Access } from "./proGate.ts";

export interface ProCtxValue {
  ws: Workspace;
  setWs: (fn: (w: Workspace) => Workspace) => void;
  active: Session | null;
  updateSession: (id: string, fn: (s: Session) => Session) => void;
  createSession: (s: Session, open?: boolean) => void;
  go: (r: { kind: "home" } | { kind: "tool"; tool: ToolId }) => void;
  announce: (msg: string) => void;
  log: (action: string, detail?: string) => void;
  access: Access;
  panelOpen: boolean;
  togglePanel: () => void;
  /** Tool-specific palette actions are delivered here; tools subscribe with useProAction. */
  actionBus: EventTarget;
  route: ProRoute;
  runAction: (tool: ToolId, action: string) => void;
  composer: string;
  setComposer: (t: string) => void;
  fillComposer: (t: string) => void;
}
export const AUDIT_KEY = "spe.pro.studio.v2.audit";
export const ProCtx = createContext<ProCtxValue | null>(null);
export function usePro(): ProCtxValue { const v = useContext(ProCtx); if (!v) throw new Error("usePro outside ProCtx"); return v; }

export function usePersisted<T>(key: string, init: () => T, validate?: (v: unknown) => v is T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); if (raw) { const p = JSON.parse(raw); if (!validate || validate(p)) return p as T; } } catch { /* blocked storage or bad JSON: start fresh */ }
    return init();
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked: keep working in memory */ } }, [key, v]);
  return [v, setV];
}
export function useProAction(handler: (id: string) => void) {
  const { actionBus } = usePro(); const ref = useRef(handler); ref.current = handler;
  useEffect(() => { const f = (e: Event) => ref.current((e as CustomEvent<string>).detail); actionBus.addEventListener("action", f); return () => actionBus.removeEventListener("action", f); }, [actionBus]);
}
export function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copyText(text: string): Promise<boolean> { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
