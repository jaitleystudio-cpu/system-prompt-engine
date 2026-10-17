// Server-side workspace validation. The client-safe model lives in shared/workspace.ts.
import { uid, cleanVars, fromSpe, LABEL, type Version } from "./studio.ts";
import { emptyWorkspace, type Session, type Project, type Workspace } from "../shared/workspace.ts";
export { newSession, sessionTitle, emptyWorkspace, sortByRecent, groupByProject, deleteProject, type Session, type Project, type Workspace } from "../shared/workspace.ts";
export const WS_KEY = "spe.pro.studio.v2.workspace";
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
export const kindLabel = (k: keyof typeof LABEL) => LABEL[k];
