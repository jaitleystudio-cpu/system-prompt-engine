// Prompt format converter: the same blocks rendered as Markdown, XML tags, JSON or plain text. Deterministic.
import { type PlainBlock, assemble, LABEL } from "./studio.ts";
export type Fmt = "markdown" | "xml" | "json" | "plain";
export const FORMATS: { id: Fmt; label: string; ext: string }[] = [
  { id: "markdown", label: "Markdown headings", ext: "md" }, { id: "xml", label: "XML tags", ext: "xml" },
  { id: "json", label: "JSON sections", ext: "json" }, { id: "plain", label: "Plain text", ext: "txt" },
];
export const tagName = (title: string) => (title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "_$1") || "section");
const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function convert(bs: PlainBlock[], f: Fmt): string {
  const live = bs.filter((b) => b.text.trim());
  if (f === "markdown") return assemble(live);
  if (f === "xml") return live.map((b) => { const t = tagName(b.title || LABEL[b.kind]); return `<${t}>\n${xmlEsc(b.text.trim())}\n</${t}>`; }).join("\n\n");
  if (f === "json") return JSON.stringify({ sections: live.map((b) => ({ kind: b.kind, title: b.title.trim() || LABEL[b.kind], text: b.text.trim() })) }, null, 2);
  return live.map((b) => `${(b.title.trim() || LABEL[b.kind]).toUpperCase()}\n${b.text.trim()}`).join("\n\n");
}
