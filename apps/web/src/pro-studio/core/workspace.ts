// Sessions (Prompt Studio documents) and project folders. Stored only in this browser (localStorage).
import { type Block, type Version, type Mode, type PlainBlock, uid, withIds, LABEL, cleanVars, fromSpe } from "./studio.ts";
export interface Session { id: string; title: string; projectId: string | null; blocks: Block[]; versions: Version[]; vars: Record<string, string>; mode: Mode; createdAt: string; updatedAt: string }
export interface Project { id: string; name: string; createdAt: string }
export interface Workspace { sessions: Session[]; projects: Project[]; activeId: string | null }
export const WS_KEY = "spe.pro.studio.v2.workspace";

export function newSession(blocks: PlainBlock[] = [], title = "", projectId: string | null = null, now = new Date().toISOString()): Session {
  return { id: uid(), title, projectId, blocks: withIds(blocks), versions: [], vars: {}, mode: "template", createdAt: now, updatedAt: now };
}
/** Title shown in history: the user's title, else the first words of the Role block, else "Untitled session". */
export function sessionTitle(s: Pick<Session, "title" | "blocks">): string {
  if (s.title.trim()) return s.title.trim();
  const role = s.blocks.find((b) => b.kind === "role" && b.text.trim()) ?? s.blocks.find((b) => b.text.trim());
  if (!role) return "Untitled session";
  const t = role.text.trim().replace(/\s+/g, " ").replace(/^you are\s+/i, "");
  return t.length > 42 ? t.slice(0, 41) + "…" : t;
}
export function emptyWorkspace(): Workspace { return { sessions: [], projects: [], activeId: null }; }

/** Defensive load: anything malformed is dropped rather than crashing the shell. */
export function parseWorkspace(raw: string | null): Workspace {
  if (!raw) return emptyWorkspace();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = JSON.parse(raw); if (!d || typeof d !== "object") return emptyWorkspace();
    const projects: Project[] = Array.isArray(d.projects) ? d.projects.filter((p: Project) => p && typeof p.id === "string" && typeof p.name === "string").map((p: Project) => ({ id: p.id, name: p.name.slice(0, 80), createdAt: String(p.createdAt || "") })) : [];
    const pids = new Set(projects.map((p) => p.id));
    const sessions: Session[] = [];
    for (const s of Array.isArray(d.sessions) ? d.sessions.slice(0, 500) : []) {
      try {
        if (!s || typeof s.id !== "string") continue;
        const blocks = fromSpe({ format: "spe.prompt", version: 1, blocks: s.blocks ?? [] });
        const versions: Version[] = Array.isArray(s.versions) ? s.versions.slice(0, 200).flatMap((v: Version) => { try { return [{ id: String(v.id), note: String(v.note).slice(0, 80), at: String(v.at), blocks: fromSpe({ format: "spe.prompt", version: 1, blocks: v.blocks }), variables: cleanVars(v.variables) }]; } catch { return []; } }) : [];
        sessions.push({ id: s.id, title: String(s.title ?? "").slice(0, 120), projectId: typeof s.projectId === "string" && pids.has(s.projectId) ? s.projectId : null, blocks: blocks.map((b, i) => ({ ...b, id: typeof s.blocks[i]?.id === "string" ? s.blocks[i].id : uid() })), versions, vars: cleanVars(s.vars), mode: s.mode === "filled" ? "filled" : "template", createdAt: String(s.createdAt || ""), updatedAt: String(s.updatedAt || "") });
      } catch { /* skip malformed session */ }
    }
    const activeId = sessions.some((s) => s.id === d.activeId) ? d.activeId : sessions[0]?.id ?? null;
    return { sessions, projects, activeId };
  } catch { return emptyWorkspace(); }
}
export function sortByRecent(ss: Session[]): Session[] { return [...ss].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0)); }
export function groupByProject(ws: Workspace): { project: Project | null; sessions: Session[] }[] {
  const groups = ws.projects.map((p) => ({ project: p as Project | null, sessions: sortByRecent(ws.sessions.filter((s) => s.projectId === p.id)) }));
  return [...groups, { project: null, sessions: sortByRecent(ws.sessions.filter((s) => !s.projectId)) }];
}
export function deleteProject(ws: Workspace, id: string): Workspace {
  // Sessions are never deleted with a folder: they move back to "No project".
  return { ...ws, projects: ws.projects.filter((p) => p.id !== id), sessions: ws.sessions.map((s) => (s.projectId === id ? { ...s, projectId: null } : s)) };
}
export const kindLabel = (k: keyof typeof LABEL) => LABEL[k];
