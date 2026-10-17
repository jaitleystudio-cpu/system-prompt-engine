import { LABEL, MAX_TEXT, plain, type Kind, type PlainBlock, type Version, type Mode } from "../shared/constants.ts";
export { KINDS, LABEL, HINT, uid, reqText, plain, withIds, QTYPE_LABEL, MAX_FILE, MAX_TEXT, EXAMPLE, STARTER } from "../shared/constants.ts";
export type { Kind, Block, PlainBlock, Version, Mode, SpeFile, QType, Level, Q } from "../shared/constants.ts";
import type { SpeFile, Q } from "../shared/constants.ts";
// Prompt Studio pure logic (ported from grok/pro-studio-r1 pro-studio/pro/studio/main.ts). No DOM, no network.

export const VAR_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;
export function findVars(text: string): [string, number][] { const m = new Map<string, number>(); for (const x of text.matchAll(VAR_RE)) m.set(x[1], (m.get(x[1]) || 0) + 1); return [...m]; }
export const filled = (text: string, v: Record<string, string>) => text.replace(VAR_RE, (all, n: string) => (v[n] ? v[n] : all));
export function malformed(text: string): string[] {
  const rest = text.replace(VAR_RE, " "); const out: string[] = [];
  for (const m of rest.matchAll(/\{\{[^{}\n]{0,24}|\{?[^{}\n]{0,24}\}\}|\{[a-zA-Z0-9_ ]{1,40}\}(?!\})/g)) out.push(m[0].trim());
  return out;
}
export function cleanVars(x: unknown): Record<string, string> {
  const o: Record<string, string> = {};
  if (x && typeof x === "object" && !Array.isArray(x)) for (const [k, v] of Object.entries(x).slice(0, 500)) if (/^[a-zA-Z0-9_]+$/.test(k) && typeof v === "string") o[k] = v.slice(0, 20000);
  return o;
}

export function assemble(bs: PlainBlock[]): string {
  return bs.filter((b) => b.text.trim()).map((b) => `## ${b.title.trim() || LABEL[b.kind]}\n${b.text.trim()}`).join("\n\n");
}
export const tokens = (s: string) => Math.ceil(s.length / 4);

const VAGUE = ["appropriate", "appropriately", "good", "nice", "properly", "relevant", "some", "various", "etc", "as needed", "if possible", "maybe", "try to", "stuff", "things", "best", "high quality", "engaging"];
export const MIN_T = 40, MAX_T = 3000;

/** Static Prompt Checks. None of these measure output quality. */
export function check(bs: PlainBlock[], vars: Record<string, string> = {}): Q[] {
  const out: Q[] = []; const text = assemble(bs); const lower = text.toLowerCase();
  const has = (k: Kind) => bs.some((b) => b.kind === k && b.text.trim());
  const t = tokens(text);
  out.push(has("role") ? { level: "ok", type: "deterministic", title: "Has Role block", detail: "Pass: a non-empty Role block exists." } : { level: "bad", type: "deterministic", title: "Has Role block", detail: "Fail: add a Role block saying who the assistant is." });
  out.push(has("output") ? { level: "ok", type: "deterministic", title: "Has Output format block", detail: "Pass: a non-empty Output format block exists." } : { level: "bad", type: "deterministic", title: "Has Output format block", detail: "Fail: add an Output format block describing the answer shape." });
  out.push(t >= MIN_T && t <= MAX_T ? { level: "ok", type: "deterministic", title: `Length within ${MIN_T}–${MAX_T} tokens (est.)`, detail: `Pass: ~${t} tokens.` } : { level: "bad", type: "deterministic", title: `Length within ${MIN_T}–${MAX_T} tokens (est.)`, detail: `Fail: ~${t} tokens.` });
  const norm1 = (x: string) => x.trim().replace(/\s+/g, " ").toLowerCase();
  const req = bs.filter((b) => b.kind === "requirements");
  const must = req.flatMap((b) => b.must || []).filter((x) => x.trim()), not = req.flatMap((b) => b.mustNot || []).filter((x) => x.trim());
  if (must.length || not.length) {
    const clash = must.flatMap((m) => not.filter((n) => norm1(n) === norm1(m)).map((n) => `Must: “${m.trim()}” vs Must not: “${n.trim()}”`));
    out.push(clash.length ? { level: "bad", type: "deterministic", title: `Requirement conflict (${clash.length})`, detail: `Same item in both lists. ${clash.join("; ")}` } : { level: "ok", type: "deterministic", title: "No requirement in both lists", detail: `Pass: ${must.length} must, ${not.length} must not, none identical.` });
  }
  const vs = findVars(text);
  if (vs.length) {
    const un = vs.filter(([n]) => !vars[n]).map(([n]) => `{{${n}}}`);
    out.push(un.length ? { level: "warn", type: "deterministic", title: `Unfilled variables (${un.length})`, detail: `No value yet: ${un.slice(0, 8).join(", ")}.` } : { level: "ok", type: "deterministic", title: "All variables have values", detail: `Pass: ${vs.length} variable${vs.length > 1 ? "s" : ""} filled.` });
  }
  const bad = malformed(text);
  if (bad.length) out.push({ level: "warn", type: "deterministic", title: `Malformed braces (${bad.length})`, detail: `Not a valid {{name}}: ${bad.slice(0, 5).map((x) => `“${x}”`).join(", ")}` });
  if (text) {
    if (!has("output") && /\b(json|markdown|bullet|table|format|sections?|words|sentences|lines)\b/i.test(text)) out.push({ level: "warn", type: "heuristic", title: "Format mentioned outside an Output block", detail: "A dedicated Output format block makes it explicit." });
    const lines = bs.flatMap((b) => b.text.split("\n")).map((l) => l.trim().toLowerCase()).filter(Boolean);
    const conflicts: string[] = [];
    const norm = (s: string) => s.replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const pos = new Map<string, string>(), neg = new Map<string, string>();
    for (const l of lines) {
      const m = l.match(/\b(always|must|do)\s+(.{4,40}?)(?:[.,;]|$)/); if (m) pos.set(norm(m[2]), l);
      const n = l.match(/\b(never|don't|do not|must not|avoid)\s+(.{4,40}?)(?:[.,;]|$)/); if (n) neg.set(norm(n[2]), l);
    }
    for (const [k, l] of pos) if (neg.has(k)) conflicts.push(`“${l}” vs “${neg.get(k)}”`);
    const pairs: [RegExp, RegExp, string][] = [
      [/\b(concise|brief|short)\b/, /\b(detailed|thorough|in-depth|comprehensive)\b/, "brief vs detailed"],
      [/\bformal\b/, /\b(casual|informal|slang)\b/, "formal vs casual"],
      [/\bno (emoji|emojis)\b/, /\buse (emoji|emojis)\b/, "emoji on vs off"],
      [/\b(json only|only json)\b/, /\bmarkdown\b/, "JSON-only vs Markdown"],
    ];
    for (const [a, b, name] of pairs) if (a.test(lower) && b.test(lower)) conflicts.push(name);
    out.push(conflicts.length ? { level: "warn", type: "heuristic", title: `Possible conflicting rules (${conflicts.length})`, detail: conflicts.slice(0, 3).join("; ") } : { level: "ok", type: "heuristic", title: "No conflicts found by pattern matching", detail: "Checked always/never pairs and common opposites only." });
    const found = VAGUE.filter((w) => new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`, "i").test(text));
    out.push(found.length ? { level: "warn", type: "heuristic", title: `Vague wording (${found.length})`, detail: `Consider something testable: ${found.slice(0, 6).map((w) => `“${w}”`).join(", ")}` } : { level: "ok", type: "heuristic", title: "No listed vague words found", detail: "Checked against a fixed list of common vague terms." });
  }
  out.push({ level: "na", type: "tokens", title: `~${t} tokens`, detail: "Approximate: characters ÷ 4. Real tokenizers differ." });
  out.push({ level: "na", type: "model", title: "Not run", detail: "No model evaluation exists in Pro Studio. Nothing is sent to a model." });
  return out;
}
export const detSummary = (bs: PlainBlock[], vars: Record<string, string> = {}) => { const d = check(bs, vars).filter((q) => q.type === "deterministic"); return `${d.filter((q) => q.level === "ok").length}/${d.length} deterministic checks pass`; };

export function blockCheck(b: PlainBlock): Q[] {
  const t = b.text.trim(); const q: Q[] = [];
  if (!t) return [{ level: "warn", type: "heuristic", title: "Empty", detail: "" }];
  const vague = VAGUE.filter((w) => new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`, "i").test(t));
  if (vague.length) q.push({ level: "warn", type: "heuristic", title: `Vague: ${vague.slice(0, 3).join(", ")}`, detail: "" });
  if (b.kind === "role" && !/\byou are\b|\byou're\b|\bact as\b/i.test(t)) q.push({ level: "warn", type: "heuristic", title: "No clear identity (“You are…”)", detail: "" });
  if (b.kind === "rules" && t.split("\n").filter((l) => l.trim()).length < 2) q.push({ level: "warn", type: "heuristic", title: "Only one rule", detail: "" });
  if (b.kind === "output" && !/\d|json|bullet|markdown|table|sections?|lines?|words/i.test(t)) q.push({ level: "warn", type: "heuristic", title: "No measurable format", detail: "" });
  if (b.kind === "examples" && !/(user|input|q)\s*:/i.test(t)) q.push({ level: "warn", type: "heuristic", title: "No input/output pair", detail: "" });
  const words = t.split(/\s+/).length; if (words > 400) q.push({ level: "warn", type: "heuristic", title: `Long block (${words} words)`, detail: "" });
  if (!q.length) q.push({ level: "ok", type: "heuristic", title: "Looks specific", detail: "" });
  return q;
}
export const blockCheckSummary = (b: PlainBlock) => blockCheck(b).map((q) => ({ level: q.level, title: q.title }));

export type Op = { t: "eq" | "add" | "del"; s: string };
export function lineDiff(a: string, b: string): Op[] {
  const A = a ? a.split("\n") : [], B = b ? b.split("\n") : []; const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Op[] = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { out.push({ t: "eq", s: A[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: "del", s: A[i++] }); else out.push({ t: "add", s: B[j++] }); }
  while (i < n) out.push({ t: "del", s: A[i++] });
  while (j < m) out.push({ t: "add", s: B[j++] });
  return out;
}

export function parseSpeJson(raw: string, name = "This file"): unknown {
  try { return JSON.parse(raw); } catch { throw new Error(`“${name}” is not valid JSON, so it can't be a .spe file.`); }
}
export function fromSpe(raw: string | object): PlainBlock[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = typeof raw === "string" ? parseSpeJson(raw) : raw;
  if (!d || typeof d !== "object") throw new Error("File content is not an SPE prompt object.");
  if (d.format !== "spe.prompt") throw new Error(`Unrecognised format ${d.format === undefined ? "(missing)" : `“${String(d.format).slice(0, 40)}”`}. Expected “spe.prompt”.`);
  if (d.version !== 1) throw new Error(`This file is .spe version ${String(d.version).slice(0, 10)}; Pro Studio reads version 1 only.`);
  if (!Array.isArray(d.blocks)) throw new Error("The file has no blocks list.");
  if (d.blocks.length > 200) throw new Error("Too many blocks (max 200).");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return d.blocks.map((b: any, i: number) => {
    if (!(b && typeof b.kind === "string" && b.kind in LABEL && typeof b.text === "string" && typeof b.title === "string")) throw new Error(`Block ${i + 1} is malformed (needs a known kind, a title and text).`);
    if (b.text.length > MAX_TEXT) throw new Error(`Block ${i + 1} is longer than ${MAX_TEXT.toLocaleString("en")} characters.`);
    if (b.kind === "requirements") {
      const lst = (x: unknown, nm: string): string[] => { if (x === undefined) return []; if (!Array.isArray(x) || x.length > 200 || x.some((y) => typeof y !== "string" || y.length > 2000)) throw new Error(`Block ${i + 1}: “${nm}” must be a list of up to 200 short text items.`); return x as string[]; };
      return plain({ kind: "requirements", title: b.title.slice(0, 80), text: "", must: lst(b.must, "must"), mustNot: lst(b.mustNot, "mustNot") });
    }
    return { kind: b.kind as Kind, title: b.title.slice(0, 80), text: b.text };
  });
}
export function toSpe(name: string, bs: PlainBlock[], versions: Version[], vars: Record<string, string>, mode: Mode, now = new Date()): SpeFile {
  const rendered = mode === "filled" ? filled(assemble(bs), vars) : assemble(bs);
  return { format: "spe.prompt", version: 1, name: name || "Untitled prompt", createdAt: now.toISOString(), blocks: bs.map(plain), versions, variables: { ...vars }, mode, rendered };
}

