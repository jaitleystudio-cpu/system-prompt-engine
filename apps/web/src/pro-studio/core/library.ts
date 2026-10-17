// Library packs: share many sessions as one file (no server, no accounts). The SHA-256 detects accidental or
// deliberate edits to the file; it does not prove who made it (use Signed Releases for that).
import type { Session, Project } from "./workspace.ts";
import { fromSpe, cleanVars, plain, type PlainBlock } from "./studio.ts";
import { sha256 } from "./audit.ts";
export const LIB_FORMAT = "spe.library";
export interface PackSession { title: string; project: string | null; blocks: PlainBlock[]; variables: Record<string, string> }
export interface LibraryPack { format: typeof LIB_FORMAT; version: 1; name: string; exportedAt: string; sessions: PackSession[]; sha256: string }
const body = (name: string, sessions: PackSession[]) => JSON.stringify({ name, sessions });
export async function exportPack(name: string, sessions: Session[], projects: Project[], now = new Date().toISOString()): Promise<LibraryPack> {
  const ps: PackSession[] = sessions.map((s) => ({ title: s.title, project: projects.find((p) => p.id === s.projectId)?.name ?? null, blocks: s.blocks.map(({ id: _id, ...b }) => plain(b)), variables: { ...s.vars } }));
  return { format: LIB_FORMAT, version: 1, name: name.trim() || "Prompt library", exportedAt: now, sessions: ps, sha256: await sha256(body(name.trim() || "Prompt library", ps)) };
}
export interface ImportResult { pack: LibraryPack; integrity: "match" | "mismatch" }
export async function importPack(raw: string): Promise<ImportResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let d: any; try { d = JSON.parse(raw); } catch { throw new Error("Not valid JSON."); }
  if (!d || d.format !== LIB_FORMAT) throw new Error(`Not a library pack (expected format “${LIB_FORMAT}”).`);
  if (d.version !== 1) throw new Error("Unsupported library pack version.");
  if (!Array.isArray(d.sessions) || d.sessions.length > 500) throw new Error("A pack needs a sessions list of at most 500.");
  const sessions: PackSession[] = d.sessions.map((s: PackSession, i: number) => {
    try { return { title: String(s.title ?? "").slice(0, 120), project: typeof s.project === "string" ? s.project.slice(0, 80) : null, blocks: fromSpe({ format: "spe.prompt", version: 1, blocks: s.blocks }), variables: cleanVars(s.variables) }; }
    catch (e) { throw new Error(`Session ${i + 1}: ${(e as Error).message}`); }
  });
  const name = String(d.name ?? "Prompt library");
  const integrity = typeof d.sha256 === "string" && d.sha256 === (await sha256(body(name, sessions))) ? "match" : "mismatch";
  return { pack: { format: LIB_FORMAT, version: 1, name, exportedAt: String(d.exportedAt ?? ""), sessions, sha256: String(d.sha256 ?? "") }, integrity };
}
