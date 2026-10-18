// Client-safe workspace model (sessions and project folders). The workspace is stored on the SPE Pro server,
// keyed by the Pro key; the browser holds it only while the page is open. parseWorkspace (validation) is server-side.
import { withIds, type Block, type Version, type Mode, type PlainBlock } from "./constants.ts";
export interface Session { id: string; title: string; projectId: string | null; blocks: Block[]; versions: Version[]; vars: Record<string, string>; mode: Mode; createdAt: string; updatedAt: string }
export interface Project { id: string; name: string; createdAt: string }
export interface Workspace { sessions: Session[]; projects: Project[]; activeId: string | null }
const newId = () => { const b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); };
export function newSession(blocks: PlainBlock[] = [], title = "", projectId: string | null = null, now = new Date().toISOString()): Session {
  return { id: newId(), title, projectId, blocks: withIds(blocks), versions: [], vars: {}, mode: "template", createdAt: now, updatedAt: now };
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
export function sortByRecent(ss: Session[]): Session[] { return [...ss].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : b.updatedAt < a.updatedAt ? -1 : 0)); }
export function groupByProject(ws: Workspace): { project: Project | null; sessions: Session[] }[] {
  const groups = ws.projects.map((p) => ({ project: p as Project | null, sessions: sortByRecent(ws.sessions.filter((s) => s.projectId === p.id)) }));
  return [...groups, { project: null, sessions: sortByRecent(ws.sessions.filter((s) => !s.projectId)) }];
}
export function deleteProject(ws: Workspace, id: string): Workspace {
  // Sessions are never deleted with a folder: they move back to "No project".
  return { ...ws, projects: ws.projects.filter((p) => p.id !== id), sessions: ws.sessions.map((s) => (s.projectId === id ? { ...s, projectId: null } : s)) };
}
/** Strip ids for sending blocks to the API. */
export const plainBlocks = (bs: Block[]): PlainBlock[] => bs.map(({ id: _id, ...b }) => b);
