// Client handoff report (Markdown). Assembled from the session as it is: no scores, no model results.
import { type PlainBlock, type Version, type Q, assemble, check, findVars, tokens, QTYPE_LABEL } from "./studio.ts";
import { type ScanFinding, scan } from "./scanner.ts";
export interface ReportInput { title: string; client: string; author: string; blocks: PlainBlock[]; vars: Record<string, string>; versions: Version[]; notes: string; now?: Date }
const mark: Record<Q["level"], string> = { ok: "PASS", warn: "WARN", bad: "FAIL", na: "INFO" };
export function buildReport(i: ReportInput): string {
  const text = assemble(i.blocks); const qs = check(i.blocks, i.vars); const fs: ScanFinding[] = scan(text); const vs = findVars(text);
  const L: string[] = [`# ${i.title.trim() || "Prompt handoff"}`, ""];
  if (i.client.trim()) L.push(`Client: ${i.client.trim()}  `);
  if (i.author.trim()) L.push(`Prepared by: ${i.author.trim()}  `);
  L.push(`Date: ${(i.now ?? new Date()).toISOString().slice(0, 10)}  `, `Size: ${i.blocks.length} blocks · ~${tokens(text)} tokens (approximate)`, "");
  if (i.notes.trim()) L.push("## Notes", i.notes.trim(), "");
  L.push("## Prompt", "", "```text", text || "(empty)", "```", "");
  L.push("## Variables", vs.length ? vs.map(([n, c]) => `- \`{{${n}}}\` used ${c}× — ${i.vars[n] ? "value set" : "no value yet"}`).join("\n") : "None.", "");
  L.push("## Static checks", "These checks read the prompt text only. They do not measure answer quality and no model was run.", "", "| Result | Type | Check | Detail |", "|---|---|---|---|");
  for (const q of qs) L.push(`| ${mark[q.level]} | ${QTYPE_LABEL[q.type]} | ${q.title.replace(/\|/g, "\\|")} | ${q.detail.replace(/\|/g, "\\|")} |`);
  L.push("", "## Secrets and personal data scan", fs.length ? fs.map((f) => `- ${f.label} (${f.severity}) at character ${f.index}: ${f.preview}`).join("\n") : "Nothing matched the scanner's patterns. Pattern matching can miss things.", "");
  L.push("## Version history", i.versions.length ? i.versions.map((v, k) => `- v${k + 1} · ${v.note} · ${v.at.slice(0, 16).replace("T", " ")} · ${v.blocks.length} blocks`).join("\n") : "No saved versions.", "");
  return L.join("\n");
}
