// Brand & style guide: rules you write, checked by exact text matching. It does not judge tone or quality.
import type { PlainBlock } from "./studio.ts";
export interface BrandGuide { name: string; voice: string; required: string[]; banned: string[]; replace: { from: string; to: string }[]; maxSentenceWords: number | null }
export interface BrandFinding { rule: "required" | "banned" | "replace" | "sentence"; level: "bad" | "warn" | "ok"; message: string }
export const EMPTY_GUIDE: BrandGuide = { name: "", voice: "", required: [], banned: [], replace: [], maxSentenceWords: null };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (t: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(t.trim())}(?=$|[^\\p{L}\\p{N}])`, "giu");
export const countTerm = (text: string, term: string) => (term.trim() ? [...text.matchAll(wordRe(term))].length : 0);

export function lintBrand(text: string, g: BrandGuide): BrandFinding[] {
  const out: BrandFinding[] = [];
  for (const r of g.required.filter((x) => x.trim())) { const n = countTerm(text, r); out.push(n ? { rule: "required", level: "ok", message: `Uses “${r}” (${n}×).` } : { rule: "required", level: "bad", message: `Missing required term “${r}”.` }); }
  for (const b of g.banned.filter((x) => x.trim())) { const n = countTerm(text, b); if (n) out.push({ rule: "banned", level: "bad", message: `Banned term “${b}” appears ${n}×.` }); }
  for (const p of g.replace.filter((x) => x.from.trim())) { const n = countTerm(text, p.from); if (n) out.push({ rule: "replace", level: "warn", message: `Use “${p.to}” instead of “${p.from}” (${n}×).` }); }
  if (g.maxSentenceWords) {
    const long = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean).filter((s) => s.split(/\s+/).length > g.maxSentenceWords!);
    out.push(long.length ? { rule: "sentence", level: "warn", message: `${long.length} sentence${long.length > 1 ? "s" : ""} longer than ${g.maxSentenceWords} words.` } : { rule: "sentence", level: "ok", message: `Every sentence is ${g.maxSentenceWords} words or fewer.` });
  }
  return out;
}
export function applyReplacements(text: string, g: BrandGuide): string {
  let t = text; for (const p of g.replace.filter((x) => x.from.trim())) t = t.replace(wordRe(p.from), (_m, pre: string) => pre + p.to); return t;
}
/** Turns the guide into a Prompt Studio block, written exactly from the guide's fields. */
export function guideToBlock(g: BrandGuide): PlainBlock {
  const lines: string[] = [];
  if (g.voice.trim()) lines.push(`Voice: ${g.voice.trim()}`);
  if (g.required.some((x) => x.trim())) lines.push(`Always use these terms where relevant: ${g.required.filter((x) => x.trim()).join(", ")}.`);
  if (g.banned.some((x) => x.trim())) lines.push(`Never use these words: ${g.banned.filter((x) => x.trim()).join(", ")}.`);
  for (const p of g.replace.filter((x) => x.from.trim())) lines.push(`Write “${p.to}”, not “${p.from}”.`);
  if (g.maxSentenceWords) lines.push(`Keep sentences to ${g.maxSentenceWords} words or fewer.`);
  return { kind: "tone", title: g.name.trim() ? `Brand voice: ${g.name.trim()}` : "Brand voice", text: lines.join("\n") };
}
