import { createContext, useContext, useEffect, useRef } from "react";
import type { Workspace, Session } from "./shared/workspace.ts";
import type { ToolId, ProRoute } from "./proRoutes.ts";
import type { Access } from "./proGate.ts";
import type { Byok, SessionInfo } from "./api.ts";

export type SyncState = "loading" | "idle" | "saving" | "saved" | "error";
export interface ProCtxValue {
  ws: Workspace;
  setWs: (fn: (w: Workspace) => Workspace) => void;
  active: Session | null;
  updateSession: (id: string, fn: (s: Session) => Session) => void;
  createSession: (s: Session, open?: boolean) => void;
  go: (r: { kind: "home" } | { kind: "tool"; tool: ToolId }) => void;
  announce: (msg: string) => void;
  /** Records an action in the server-side, hash-chained audit log (fire and forget). */
  log: (action: string, detail?: string) => void;
  access: Access;
  info: SessionInfo | null;
  sync: SyncState;
  byok: Byok;
  setByok: (b: Byok) => void;
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
export const ProCtx = createContext<ProCtxValue | null>(null);
export function usePro(): ProCtxValue { const v = useContext(ProCtx); if (!v) throw new Error("usePro outside ProCtx"); return v; }
export function useProAction(handler: (id: string) => void) {
  const { actionBus } = usePro(); const ref = useRef(handler); ref.current = handler;
  useEffect(() => { const f = (e: Event) => ref.current((e as CustomEvent<string>).detail); actionBus.addEventListener("action", f); return () => actionBus.removeEventListener("action", f); }, [actionBus]);
}
export function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function copyText(text: string): Promise<boolean> { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
export const slug = (s: string) => s.replace(/\W+/g, "-").toLowerCase().replace(/^-+|-+$/g, "").slice(0, 40) || "prompt";
