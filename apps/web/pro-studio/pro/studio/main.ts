import { TEMPLATES } from "./templates";
import "../shared/shell";
// SPE Pro Prompt Studio r1 — runs fully client-side. No network calls (CSP connect-src 'none').
type Kind = "role" | "rules" | "tone" | "output" | "examples" | "requirements" | "custom";
interface Block { id: string; kind: Kind; title: string; text: string; must?: string[]; mustNot?: string[] }
// Requirements are typed by the user. Rendering is a fixed template: no NLP, no extraction, nothing added.
export function reqText(must: string[] = [], mustNot: string[] = []): string {
  const m = must.map(x => x.trim()).filter(Boolean), n = mustNot.map(x => x.trim()).filter(Boolean);
  return [m.length ? "Must:\n" + m.map(x => `- ${x}`).join("\n") : "", n.length ? "Must not:\n" + n.map(x => `- Do not: ${x}`).join("\n") : ""].filter(Boolean).join("\n");
}
const plain = (b: Omit<Block, "id">): Omit<Block, "id"> => b.kind === "requirements" ? { kind: b.kind, title: b.title, text: reqText(b.must, b.mustNot), must: [...(b.must || [])], mustNot: [...(b.mustNot || [])] } : { kind: b.kind, title: b.title, text: b.text };
interface SpeFile { format: "spe.prompt"; version: 1; name: string; createdAt: string; blocks: Omit<Block, "id">[]; versions?: Version[]; variables?: Record<string, string>; mode?: Mode; rendered?: string }

const LABEL: Record<Kind, string> = { role: "Role", rules: "Rules", tone: "Tone", output: "Output format", examples: "Examples", requirements: "Requirements", custom: "Custom" };
const HINT: Record<Kind, string> = {
  role: "Who the assistant is and who it serves, e.g. You are a support agent for…",
  rules: "One rule per line. Prefer concrete, testable rules.",
  tone: "Voice and register, e.g. Warm, concise, plain English.",
  output: "Exact shape of the answer: sections, JSON keys, length limits.",
  examples: "Input → ideal output pairs.",
  requirements: "Your requirements: what the prompt must follow and must not do.",
  custom: "Anything else the model needs.",
};
const STORE = "spe.pro.studio.r1.draft";
const VSTORE = "spe.pro.studio.r1.versions";
interface Version { id: string; note: string; at: string; blocks: Omit<Block, "id">[]; variables?: Record<string, string> }
type Mode = "template" | "filled";
const XSTORE = "spe.pro.studio.r1.vars";
let vars: Record<string, string> = {}; let mode: Mode = "template";
// {{name}} placeholders, [a-zA-Z0-9_] only. Detection and filling are a single regex pass: values are never re-scanned.
const VAR_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;
export function findVars(text: string): [string, number][] { const m = new Map<string, number>(); for (const x of text.matchAll(VAR_RE)) m.set(x[1], (m.get(x[1]) || 0) + 1); return [...m]; }
export const filled = (text: string, v: Record<string, string>) => text.replace(VAR_RE, (all, n) => v[n] ? v[n] : all);
export function malformed(text: string): string[] {
  const rest = text.replace(VAR_RE, " "); const out: string[] = [];
  for (const m of rest.matchAll(/\{\{[^{}\n]{0,24}|\{?[^{}\n]{0,24}\}\}|\{[a-zA-Z0-9_ ]{1,40}\}(?!\})/g)) out.push(m[0].trim());
  return out;
}
export function cleanVars(x: any): Record<string, string> { const o: Record<string, string> = {}; if (x && typeof x === "object" && !Array.isArray(x)) for (const [k, v] of Object.entries(x).slice(0, 500)) if (/^[a-zA-Z0-9_]+$/.test(k) && typeof v === "string") o[k] = v.slice(0, 20000); return o; }
const output = () => mode === "filled" ? filled(assemble(blocks), vars) : assemble(blocks);
let versions: Version[] = [];
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const uid = () => Math.random().toString(36).slice(2, 10);
let blocks: Block[] = [];

const EXAMPLE: Omit<Block, "id">[] = [
  { kind: "role", title: "Role", text: "You are Ledger, a billing support assistant for Northwind Cloud. You help small-business customers understand invoices, refunds and plan changes." },
  { kind: "rules", title: "Rules", text: "Only answer questions about Northwind billing; politely redirect anything else.\nNever ask for full card numbers or passwords.\nIf a refund is over $500, hand off to a human agent.\nCite the invoice ID whenever you reference a charge." },
  { kind: "tone", title: "Tone", text: "Calm, friendly and concise. Plain English, no jargon. Acknowledge frustration in one sentence, then solve." },
  { kind: "output", title: "Output format", text: "Reply in at most 120 words.\nStart with a one-line answer, then up to 3 bullet steps.\nEnd with: \"Anything else on your bill?\"" },
  { kind: "examples", title: "Examples", text: "User: Why was I charged twice in May?\nAssistant: You were billed once for May (INV-2041) and once for a prorated upgrade (INV-2042).\n- Open Billing → Invoices to see both.\n- The upgrade charge covers May 14–31.\nAnything else on your bill?" },
];

function load() { try { const r = localStorage.getItem(STORE); if (r) blocks = JSON.parse(r); const v = localStorage.getItem(VSTORE); if (v) versions = JSON.parse(v); const x = JSON.parse(localStorage.getItem(XSTORE) || "{}"); vars = cleanVars(x.vars); mode = x.mode === "filled" ? "filled" : "template"; } catch { blocks = []; versions = []; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(blocks)); localStorage.setItem(VSTORE, JSON.stringify(versions)); localStorage.setItem(XSTORE, JSON.stringify({ vars, mode })); } catch { /* storage disabled: editor still works */ } }
const announce = (m: string) => { $("#live").textContent = m; };

export function assemble(bs: Block[]): string {
  return bs.filter(b => b.text.trim()).map(b => `## ${b.title.trim() || LABEL[b.kind]}\n${b.text.trim()}`).join("\n\n");
}
export const tokens = (s: string) => Math.ceil(s.length / 4);

export type QType = "deterministic" | "heuristic" | "tokens" | "model";
type Q = { level: "ok" | "warn" | "bad" | "na"; type: QType; title: string; detail: string };
export const QTYPE_LABEL: Record<QType, string> = { deterministic: "Deterministic check", heuristic: "Heuristic warning", tokens: "Token estimate (approximate)", model: "Model evaluation" };
const VAGUE = ["appropriate", "appropriately", "good", "nice", "properly", "relevant", "some", "various", "etc", "as needed", "if possible", "maybe", "try to", "stuff", "things", "best", "high quality", "engaging"];
const MIN_T = 40, MAX_T = 3000;
// Static Prompt Checks: deterministic pass/fail, heuristic warnings, an approximate token estimate,
// and an explicit "Not run" model evaluation. None of these measure output quality.
export function check(bs: Block[]): Q[] {
  const out: Q[] = []; const text = assemble(bs); const lower = text.toLowerCase();
  const has = (k: Kind) => bs.some(b => b.kind === k && b.text.trim());
  const t = tokens(text);
  out.push(has("role") ? { level: "ok", type: "deterministic", title: "Has Role block", detail: "Pass: a non-empty Role block exists." } : { level: "bad", type: "deterministic", title: "Has Role block", detail: "Fail: add a Role block saying who the assistant is." });
  out.push(has("output") ? { level: "ok", type: "deterministic", title: "Has Output format block", detail: "Pass: a non-empty Output format block exists." } : { level: "bad", type: "deterministic", title: "Has Output format block", detail: "Fail: add an Output format block describing the answer shape." });
  out.push(t >= MIN_T && t <= MAX_T ? { level: "ok", type: "deterministic", title: `Length within ${MIN_T}–${MAX_T} tokens (est.)`, detail: `Pass: ~${t} tokens.` } : { level: "bad", type: "deterministic", title: `Length within ${MIN_T}–${MAX_T} tokens (est.)`, detail: `Fail: ~${t} tokens.` });
  const norm = (x: string) => x.trim().replace(/\s+/g, " ").toLowerCase();
  const req = bs.filter(b => b.kind === "requirements");
  const must = req.flatMap(b => b.must || []).filter(x => x.trim()), not = req.flatMap(b => b.mustNot || []).filter(x => x.trim());
  if (must.length || not.length) {
    const clash = must.flatMap(m => not.filter(n => norm(n) === norm(m)).map(n => `Must: “${m.trim()}” vs Must not: “${n.trim()}”`));
    out.push(clash.length ? { level: "bad", type: "deterministic", title: `Requirement conflict (${clash.length})`, detail: `Same item in both lists; both are kept in the prompt. ${clash.join("; ")}` } : { level: "ok", type: "deterministic", title: "No requirement in both lists", detail: `Pass: ${must.length} must, ${not.length} must not, none identical.` });
  }
  const vs = findVars(text);
  if (vs.length) { const un = vs.filter(([n]) => !vars[n]).map(([n]) => `{{${n}}}`);
    out.push(un.length ? { level: "warn", type: "deterministic", title: `Unfilled variables (${un.length})`, detail: `No value yet: ${un.slice(0, 8).join(", ")}. They stay as {{name}} in Filled mode.` } : { level: "ok", type: "deterministic", title: "All variables have values", detail: `Pass: ${vs.length} variable${vs.length > 1 ? "s" : ""} filled.` }); }
  const bad = malformed(text);
  if (bad.length) out.push({ level: "warn", type: "deterministic", title: `Malformed braces (${bad.length})`, detail: `Not a valid {{name}}: ${bad.slice(0, 5).map(x => `“${x}”`).join(", ")}` });
  if (text) {
    if (!has("output") && /\b(json|markdown|bullet|table|format|sections?|words|sentences|lines)\b/i.test(text)) out.push({ level: "warn", type: "heuristic", title: "Format mentioned outside an Output block", detail: "A dedicated Output format block makes it explicit." });
    const lines = bs.flatMap(b => b.text.split("\n")).map(l => l.trim().toLowerCase()).filter(Boolean);
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
    const wl = [...lower.matchAll(/\b(?:at most|under|max(?:imum)?(?: of)?|no more than)\s+(\d+)\s+words/g)].map(m => +m[1]);
    const wm = [...lower.matchAll(/\b(?:at least|minimum(?: of)?|no fewer than)\s+(\d+)\s+words/g)].map(m => +m[1]);
    if (wl.length && wm.length && Math.max(...wm) > Math.min(...wl)) conflicts.push(`at least ${Math.max(...wm)} words vs at most ${Math.min(...wl)} words`);
    out.push(conflicts.length ? { level: "warn", type: "heuristic", title: `Possible conflicting rules (${conflicts.length})`, detail: conflicts.slice(0, 3).join("; ") } : { level: "ok", type: "heuristic", title: "No conflicts found by pattern matching", detail: "Checked always/never pairs and common opposites only." });
    const found = VAGUE.filter(w => new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`, "i").test(text));
    out.push(found.length ? { level: "warn", type: "heuristic", title: `Vague wording (${found.length})`, detail: `Consider something testable: ${found.slice(0, 6).map(w => `“${w}”`).join(", ")}` } : { level: "ok", type: "heuristic", title: "No listed vague words found", detail: "Checked against a fixed list of common vague terms." });
  }
  out.push({ level: "na", type: "tokens", title: `~${t} tokens`, detail: "Approximate: characters ÷ 4. Real tokenizers differ." });
  out.push({ level: "na", type: "model", title: "Not run", detail: "No model evaluation exists in Prompt Studio. Nothing is sent to a model." });
  return out;
}
export const detSummary = (bs: Block[]) => { const d = check(bs).filter(q => q.type === "deterministic"); return `${d.filter(q => q.level === "ok").length}/${d.length} deterministic checks pass`; };

export function blockCheck(b: Block): Q[] {
  const t = b.text.trim(); const q: Q[] = [];
  if (!t) return [{ level: "warn", type: "heuristic", title: "Empty", detail: "" }];
  const vague = VAGUE.filter(w => new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`, "i").test(t));
  if (vague.length) q.push({ level: "warn", type: "heuristic", title: `Vague: ${vague.slice(0, 3).join(", ")}`, detail: "" });
  const words = t.split(/\s+/).length;
  if (b.kind === "role" && !/\byou are\b|\byou're\b|\bact as\b/i.test(t)) q.push({ level: "warn", type: "heuristic", title: "No clear identity (\"You are…\")", detail: "" });
  if (b.kind === "rules" && t.split("\n").filter(l => l.trim()).length < 2) q.push({ level: "warn", type: "heuristic", title: "Only one rule", detail: "" });
  if (b.kind === "output" && !/\d|json|bullet|markdown|table|sections?|lines?|words/i.test(t)) q.push({ level: "warn", type: "heuristic", title: "No measurable format", detail: "" });
  if (b.kind === "examples" && !/(user|input|q)\s*:/i.test(t)) q.push({ level: "warn", type: "heuristic", title: "No input/output pair", detail: "" });
  if (words > 400) q.push({ level: "warn", type: "heuristic", title: `Long block (${words} words)`, detail: "" });
  if (!q.length) q.push({ level: "ok", type: "heuristic", title: "Looks specific", detail: "" });
  return q;
}
type Op = { t: "eq" | "add" | "del"; s: string };
export function lineDiff(a: string, b: string): Op[] {
  const A = a ? a.split("\n") : [], B = b ? b.split("\n") : []; const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Op[] = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { out.push({ t: "eq", s: A[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: "del", s: A[i++] }); else out.push({ t: "add", s: B[j++] }); }
  while (i < n) out.push({ t: "del", s: A[i++] }); while (j < m) out.push({ t: "add", s: B[j++] });
  return out;
}
const esc = (s: string) => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const chips = (b: Block) => blockCheck(b).map(q => `<span class="chip chip--${q.level}">${q.level === "ok" ? "✓" : "!"} ${esc(q.title)}</span>`).join("");
const SYM = { ok: "✓", warn: "!", bad: "×", na: "–" } as const;
const SR = { ok: "Pass: ", warn: "Warning: ", bad: "Fail: ", na: "" } as const;
const qHtml = (qs: Q[]) => qs.map(q => `<li class="q q--${q.level}" data-qtype="${q.type}"><i aria-hidden="true">${SYM[q.level]}</i><div><span class="qtype">${QTYPE_LABEL[q.type]}</span><b><span class="sr-only">${SR[q.level]}</span>${esc(q.title)}</b><span>${esc(q.detail)}</span></div></li>`).join("");
const withIds = (bs: Omit<Block, "id">[]): Block[] => bs.map(b => ({ ...b, id: "" }));
function sources(): { id: string; label: string; blocks: Block[] }[] { return [{ id: "draft", label: "Current draft", blocks }, ...versions.map((v, i) => ({ id: v.id, label: `v${i + 1} · ${v.note}`, blocks: withIds(v.blocks) }))]; }
function fillSel(sel: HTMLSelectElement, def: string) { const cur = sel.value || def; sel.innerHTML = sources().map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join(""); sel.value = sources().some(s => s.id === cur) ? cur : def; }
const src = (id: string) => (sources().find(s => s.id === id) || sources()[0]).blocks;
function renderVersions() {
  $("#vlist").innerHTML = versions.length ? versions.map((v, i) => `<li class="vrow"><div><b>v${i + 1} · ${esc(v.note)}</b><span>${new Date(v.at).toLocaleString()} · ${v.blocks.length} blocks · ${detSummary(withIds(v.blocks))}</span></div><div class="vrow__act"><button type="button" class="btn btn--ghost btn--sm" data-restore="${v.id}" aria-label="Restore v${i + 1} into the editor">Restore</button><button type="button" class="icon-btn" data-delv="${v.id}" aria-label="Delete v${i + 1}">✕</button></div></li>`).reverse().join("") : '<li class="small">No versions yet. Save one to start a history.</li>';
  const last = versions.length ? versions[versions.length - 1].id : "draft";
  fillSel($("#d-from"), last); fillSel($("#d-to"), "draft"); fillSel($("#ab-a"), last); fillSel($("#ab-b"), "draft");
  renderDiff(); renderAB();
}
function renderDiff() {
  const ops = lineDiff(assemble(src(($("#d-from") as HTMLSelectElement).value)), assemble(src(($("#d-to") as HTMLSelectElement).value)));
  const add = ops.filter(o => o.t === "add").length, del = ops.filter(o => o.t === "del").length;
  $("#d-sum").textContent = add || del ? `+${add} lines added · −${del} lines removed` : "No differences.";
  $("#diff").innerHTML = ops.map(o => o.t === "eq" ? `<span class="eq">${esc(o.s) || " "}</span>` : o.t === "add" ? `<ins><span class="sr-only">Added: </span>${esc(o.s) || " "}</ins>` : `<del><span class="sr-only">Removed: </span>${esc(o.s) || " "}</del>`).join("");
}
function renderAB() {
  const a = src(($("#ab-a") as HTMLSelectElement).value), b = src(($("#ab-b") as HTMLSelectElement).value);
  const ta = tokens(assemble(a)), tb = tokens(assemble(b));
  $("#ab-pa").textContent = assemble(a) || "(empty)"; $("#ab-pb").textContent = assemble(b) || "(empty)";
  $("#ab-sa").textContent = `${detSummary(a)} · ~${ta} tokens`; $("#ab-sb").textContent = `${detSummary(b)} · ~${tb} tokens`;
  $("#ab-qa").innerHTML = qHtml(check(a)); $("#ab-qb").innerHTML = qHtml(check(b));
  $("#ab-sum").textContent = `Version 2 is ${tb - ta >= 0 ? "+" : ""}${tb - ta} tokens vs version 1. Static checks only; no outcome or model evaluation, so neither version is ranked.`;
}
function renderSide() {
  const text = assemble(blocks);
  const parts: string[] = []; let last = 0;
  for (const m of text.matchAll(VAR_RE)) { parts.push(esc(text.slice(last, m.index))); const v = vars[m[1]];
    parts.push(mode === "filled" && v ? esc(v) : `<mark class="${mode === "filled" ? "var-unfilled" : "var"}">${esc(m[0])}</mark>`); last = m.index! + m[0].length; }
  parts.push(esc(text.slice(last)));
  $("#preview").innerHTML = text ? parts.join("") : '<span class="ph">Your assembled prompt appears here as you type.</span>';
  (["template", "filled"] as Mode[]).forEach(k => $(`#pv-${k}`).setAttribute("aria-pressed", String(mode === k)));
  renderVars(findVars(text));
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  $("#stats").textContent = `${blocks.length} blocks · ${words} words · ${text.length} chars · ~${tokens(text)} tokens`;
  const qs = check(blocks); $("#quality").innerHTML = qHtml(qs);
  $("#q-sum").textContent = `${detSummary(blocks)} · ${qs.filter(q => q.level === "warn").length} heuristic warnings`;
  save();
}

let varSig = "";
function renderVars(vs: [string, number][]) {
  const sig = JSON.stringify(vs); if (sig === varSig) return; varSig = sig;
  const ul = $("#vars"); ul.innerHTML = vs.length ? vs.map(([n, c]) => `<li class="var-row" data-var="${n}"><label for="var-${n}"><code>{{${n}}}</code> <span class="var-count">${c} use${c > 1 ? "s" : ""}</span></label><input id="var-${n}" class="inp" maxlength="20000" placeholder="Value for ${n}" /></li>`).join("") : '<li class="small">No variables yet. Type {{name}} in any block to add one.</li>';
  ul.querySelectorAll<HTMLInputElement>("input").forEach(inp => { const n = inp.id.slice(4); inp.value = vars[n] || ""; inp.addEventListener("input", () => { vars[n] = inp.value; if (!inp.value) delete vars[n]; renderSide(); }); });
}
function render(focusId?: string, enterId?: string) {
  const ol = $("#blocks"); ol.innerHTML = "";
  ($("#empty") as HTMLElement).hidden = blocks.length > 0;
  blocks.forEach((b, i) => {
    const li = document.createElement("li");
    li.className = "blk" + (b.id === enterId ? " enter" : ""); li.dataset.k = b.kind; li.dataset.id = b.id;
    const tid = `t-${b.id}`, xid = `x-${b.id}`;
    li.innerHTML = `<div class="blk__bar">
      <button type="button" class="handle" aria-label="Reorder ${esc(b.title || LABEL[b.kind])}, position ${i + 1} of ${blocks.length}. Alt plus arrow keys to move.">⠿</button>
      <span class="blk__label">${LABEL[b.kind]}</span>
      <label class="sr-only" for="${tid}">Block title</label><input id="${tid}" class="blk__title" value="${esc(b.title).replace(/"/g, "&quot;")}" />
      <button type="button" class="icon-btn up" aria-label="Move ${esc(b.title)} up" ${i === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="icon-btn down" aria-label="Move ${esc(b.title)} down" ${i === blocks.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="icon-btn del" aria-label="Remove ${esc(b.title)} block">✕</button></div>
      <label class="sr-only" for="${xid}">${esc(b.title)} content</label><textarea id="${xid}" class="blk__ta" placeholder="${esc(HINT[b.kind])}" aria-describedby="bq-${b.id}"></textarea><div class="blk__q" id="bq-${b.id}" aria-label="Block checks">${chips(b)}</div>`;
    if (b.kind === "requirements") { renderReq(li, b); } else {
    (li.querySelector("textarea") as HTMLTextAreaElement).value = b.text;
    li.querySelector("textarea")!.addEventListener("input", e => { b.text = (e.target as HTMLTextAreaElement).value; li.querySelector(".blk__q")!.innerHTML = chips(b); renderSide(); }); }
    li.querySelector(".blk__title")!.addEventListener("input", e => { b.title = (e.target as HTMLInputElement).value; renderSide(); });
    li.querySelector(".up")!.addEventListener("click", () => move(i, i - 1, "up"));
    li.querySelector(".down")!.addEventListener("click", () => move(i, i + 1, "down"));
    li.querySelector(".del")!.addEventListener("click", () => { blocks.splice(i, 1); announce(`${b.title} removed`); render(blocks[Math.min(i, blocks.length - 1)]?.id); });
    const h = li.querySelector(".handle") as HTMLButtonElement;
    h.addEventListener("keydown", e => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); move(i, e.key === "ArrowUp" ? i - 1 : i + 1, "handle"); } });
    h.addEventListener("pointerdown", e => startDrag(e, i, li, h));
    ol.appendChild(li);
  });
  if (focusId) (ol.querySelector(`[data-id="${focusId}"] .blk__title`) as HTMLElement | null)?.focus();
  renderSide();
}
// Pointer-based drag (mouse, touch, pen). HTML5 drag-and-drop never fires for touch.
function dropIndex(y: number, from: number): number {
  const items = [...document.querySelectorAll<HTMLElement>("#blocks > li")];
  let to = items.length - 1;
  for (let k = 0; k < items.length; k++) { const r = items[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { to = k > from ? k - 1 : k; break; } }
  return Math.max(0, Math.min(items.length - 1, to));
}
function startDrag(e: PointerEvent, from: number, li: HTMLElement, h: HTMLElement) {
  if (e.button !== 0) return; e.preventDefault(); h.setPointerCapture?.(e.pointerId);
  const y0 = e.clientY; let to = from, live = false;
  const items = () => [...document.querySelectorAll<HTMLElement>("#blocks > li")];
  const onMove = (ev: PointerEvent) => {
    if (!live && Math.abs(ev.clientY - y0) < 4) return;
    live = true; li.classList.add("dragging"); to = dropIndex(ev.clientY, from);
    items().forEach((x, k) => x.classList.toggle("over", k === to && k !== from));
  };
  const end = (ev: PointerEvent) => {
    h.removeEventListener("pointermove", onMove); h.removeEventListener("pointerup", end); h.removeEventListener("pointercancel", end);
    li.classList.remove("dragging"); items().forEach(x => x.classList.remove("over"));
    if (live && ev.type === "pointerup" && to !== from) move(from, to, "handle");
  };
  h.addEventListener("pointermove", onMove); h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
}
function renderReq(li: HTMLElement, b: Block) {
  b.must ||= []; b.mustNot ||= []; b.text = reqText(b.must, b.mustNot);
  const lists: [("must" | "mustNot"), string, string][] = [["must", "Must follow", "e.g. Work fully offline"], ["mustNot", "Must not", "e.g. collect analytics"]];
  const box = document.createElement("div"); box.className = "req";
  box.innerHTML = `<p class="small req__intro">Your requirements. Added exactly as you type them; Must not items render as “Do not: …”.</p>` + lists.map(([k, lab, ph]) => {
    const items = b[k]!; const gid = `rq-${k}-${b.id}`;
    return `<fieldset class="req__list" data-req="${k}"><legend id="${gid}">${lab}</legend><ul class="req__items">${items.map((t, j) => `<li class="req-item"><label class="sr-only" for="${gid}-${j}">${lab} item ${j + 1}</label><input id="${gid}-${j}" class="inp" data-j="${j}" maxlength="2000" /><button type="button" class="icon-btn req-del" data-j="${j}" aria-label="Remove ${lab} item ${j + 1}">✕</button></li>`).join("")}</ul>
      <div class="req__add"><label class="sr-only" for="${gid}-new">Add ${lab} item</label><input id="${gid}-new" class="inp req-new" placeholder="${esc(ph)}" maxlength="2000" /><button type="button" class="btn btn--ghost btn--sm req-addbtn">Add</button></div></fieldset>`;
  }).join("");
  li.querySelector("textarea")!.replaceWith(box); li.querySelector(`label[for="x-${b.id}"]`)?.remove();
  const sync = () => { b.text = reqText(b.must, b.mustNot); li.querySelector(".blk__q")!.innerHTML = chips(b); renderSide(); };
  for (const [k, lab] of lists) {
    const fs = box.querySelector(`[data-req="${k}"]`)!;
    fs.querySelectorAll<HTMLInputElement>(".req-item input").forEach(inp => { inp.value = b[k]![+inp.dataset.j!]; inp.addEventListener("input", () => { b[k]![+inp.dataset.j!] = inp.value; sync(); }); });
    fs.querySelectorAll<HTMLButtonElement>(".req-del").forEach(btn => btn.addEventListener("click", () => { const j = +btn.dataset.j!; const [gone] = b[k]!.splice(j, 1); sync(); renderReqAgain(li, b, `[data-req="${k}"] .req-new`); announce(`Removed ${lab} item: ${gone}`); }));
    const nw = fs.querySelector<HTMLInputElement>(".req-new")!;
    const add = () => { const v = nw.value; if (!v.trim()) { nw.focus(); return; } b[k]!.push(v); sync(); renderReqAgain(li, b, `[data-req="${k}"] .req-new`); announce(`Added ${lab} item ${b[k]!.length}`); };
    nw.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } }); fs.querySelector(".req-addbtn")!.addEventListener("click", add);
  }
}
function renderReqAgain(li: HTMLElement, b: Block, focusSel: string) {
  const old = li.querySelector(".req")!; const ta = document.createElement("textarea"); old.replaceWith(ta); renderReq(li, b);
  (li.querySelector(focusSel) as HTMLElement | null)?.focus();
}
function move(from: number, to: number, keep: "up" | "down" | "handle") {
  if (to < 0 || to >= blocks.length) return;
  const [b] = blocks.splice(from, 1); blocks.splice(to, 0, b);
  render(); announce(`${b.title} moved to position ${to + 1} of ${blocks.length}`);
  const li = document.querySelector(`[data-id="${b.id}"]`)!;
  const target = (keep === "handle" ? li.querySelector(".handle") : li.querySelector(keep === "up" ? ".up:not([disabled])" : ".down:not([disabled])")) || li.querySelector(".handle");
  (target as HTMLElement).focus();
}
function add(kind: Kind, text = "") { const b: Block = kind === "requirements" ? { id: uid(), kind, title: LABEL[kind], text: "", must: [], mustNot: [] } : { id: uid(), kind, title: LABEL[kind], text }; blocks.push(b); render(undefined, b.id); (document.querySelector(`[data-id="${b.id}"] textarea, [data-id="${b.id}"] .req-new`) as HTMLElement).focus(); announce(`${b.title} block added`); }
function setBlocks(bs: Omit<Block, "id">[], msg: string) { blocks = bs.map(b => ({ ...b, id: uid() })); render(); announce(msg); }

export function toSpe(bs: Block[]): SpeFile { return { format: "spe.prompt", version: 1, name: bs.find(b => b.kind === "role")?.text.slice(0, 48) || "Untitled prompt", createdAt: new Date().toISOString(), blocks: bs.map(plain), versions, variables: { ...vars }, mode, rendered: output() }; }
export const MAX_FILE = 5 * 1024 * 1024, MAX_TEXT = 200_000;
export function parseSpeJson(raw: string, name = "This file"): any {
  try { return JSON.parse(raw); } catch { throw new Error(`“${name}” is not valid JSON, so it can't be a .spe file. It may be truncated or corrupted.`); }
}
export function fromSpe(raw: string | object): Omit<Block, "id">[] {
  const d: any = typeof raw === "string" ? parseSpeJson(raw) : raw;
  if (!d || typeof d !== "object") throw new Error("File content is not an SPE prompt object.");
  if (d.format !== "spe.prompt") throw new Error(`Unrecognised format ${d.format === undefined ? "(missing)" : `“${String(d.format).slice(0, 40)}”`}. Expected “spe.prompt”.`);
  if (d.version !== 1) throw new Error(`This file is .spe version ${String(d.version).slice(0, 10)}; this Studio reads version 1 only.`);
  if (!Array.isArray(d.blocks)) throw new Error("The file has no blocks list.");
  if (d.blocks.length > 200) throw new Error("Too many blocks (max 200).");
  return d.blocks.map((b: any, i: number) => {
    if (!(b && b.kind in LABEL && typeof b.text === "string" && typeof b.title === "string")) throw new Error(`Block ${i + 1} is malformed (needs a known kind, a title and text).`);
    if (b.text.length > MAX_TEXT) throw new Error(`Block ${i + 1} is longer than ${MAX_TEXT.toLocaleString("en")} characters.`);
    if (b.kind === "requirements") {
      const lst = (x: any, nm: string) => { if (x === undefined) return []; if (!Array.isArray(x) || x.length > 200 || x.some((y: any) => typeof y !== "string" || y.length > 2000)) throw new Error(`Block ${i + 1}: “${nm}” must be a list of up to 200 short text items.`); return x as string[]; };
      return plain({ kind: "requirements", title: b.title.slice(0, 80), text: "", must: lst(b.must, "must"), mustNot: lst(b.mustNot, "mustNot") });
    }
    return { kind: b.kind as Kind, title: b.title.slice(0, 80), text: b.text };
  });
}

$("#btn-add").addEventListener("click", () => add(($("#add-kind") as HTMLSelectElement).value as Kind));
const loadEx = () => setBlocks(EXAMPLE, "Example loaded");
$("#btn-example").addEventListener("click", loadEx); $("#btn-example2").addEventListener("click", loadEx);
$("#btn-starter").addEventListener("click", () => setBlocks((["role", "rules", "tone", "output"] as Kind[]).map(k => ({ kind: k, title: LABEL[k], text: "" })), "Starter blocks added"));
$("#btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(toSpe(blocks), null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "prompt.spe"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); announce("Exported prompt.spe");
});
$("#btn-import").addEventListener("click", () => $("#file-import").click());
const importErr = (m: string) => { const el = $("#import-err"); el.textContent = m; el.hidden = !m; };
$("#file-import").addEventListener("change", async e => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try {
    // Validate everything first; the current draft and versions are only replaced after the whole file parses.
    if (!/\.(spe|json)$/i.test(f.name)) throw new Error(`“${f.name}” is not a .spe file. Choose a file exported from Prompt Studio (.spe).`);
    if (f.size > MAX_FILE) throw new Error(`“${f.name}” is too large (${(f.size / 1048576).toFixed(1)} MB). The limit is 5 MB.`);
    const d = parseSpeJson(await f.text(), f.name); const bs = fromSpe(d);
    const vs: Version[] = Array.isArray(d.versions) ? d.versions.slice(0, 100).map((v: any, i: number) => { try { return { id: uid(), note: String(v.note || "Imported").slice(0, 80), at: String(v.at || new Date().toISOString()), blocks: fromSpe({ format: "spe.prompt", version: 1, blocks: v.blocks }), variables: cleanVars(v.variables) }; } catch (er) { throw new Error(`Version ${i + 1}: ${(er as Error).message}`); } }) : versions;
    versions = vs; vars = cleanVars(d.variables); mode = d.mode === "filled" ? "filled" : "template"; varSig = ""; importErr(""); setBlocks(bs, `Imported ${f.name}`); renderVersions();
  } catch (err) { const m = `Import failed: ${(err as Error).message} Your current draft was not changed.`; importErr(m); announce(m); }
  (e.target as HTMLInputElement).value = "";
});
$("#btn-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(output()); announce(`Prompt copied (${mode === "filled" ? "Filled" : "Template"})`); } catch { announce("Copy failed; select the preview text instead"); } });
(window as any).__spe = { TEMPLATES, findVars, filled, malformed, check, detSummary, assemble, toSpe, fromSpe };
$("#btn-save-v").addEventListener("click", () => { const inp = $("#v-name") as HTMLInputElement; versions.push({ id: uid(), note: inp.value.trim() || `Snapshot ${versions.length + 1}`, at: new Date().toISOString(), blocks: blocks.map(plain), variables: { ...vars } }); inp.value = ""; save(); renderVersions(); announce(`Saved version ${versions.length}`); });
$("#vlist").addEventListener("click", e => { const t = e.target as HTMLElement; const r = t.closest("[data-restore]") as HTMLElement | null, d = t.closest("[data-delv]") as HTMLElement | null;
  if (r) { const v = versions.find(x => x.id === r.dataset.restore)!; if (v.variables) { vars = { ...v.variables }; varSig = ""; } setBlocks(v.blocks, `Restored ${v.note}`); renderVersions(); }
  if (d) { versions = versions.filter(x => x.id !== d.dataset.delv); save(); renderVersions(); announce("Version deleted"); } });
["#d-from", "#d-to"].forEach(s => $(s).addEventListener("change", renderDiff)); ["#ab-a", "#ab-b"].forEach(s => $(s).addEventListener("change", renderAB));
const tabs = ["edit", "ver", "ab"];
function selectTab(k: string, focus = false) { tabs.forEach(t => { const on = t === k; const b = $(`#tab-${t}`); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; ($(`#view-${t}`) as HTMLElement).hidden = !on; if (on && focus) b.focus(); }); if (k !== "edit") renderVersions(); }
tabs.forEach((t, i) => { const b = $(`#tab-${t}`); b.addEventListener("click", () => selectTab(t)); b.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3], true); } }); });
(window as any).__spe.lineDiff = lineDiff; (window as any).__spe.selectTab = selectTab;
// Mobile: checks start collapsed to save space; desktop always shows them (toggle hidden by CSS).
const qToggle = $("#q-toggle") as HTMLButtonElement;
const setQ = (open: boolean) => { qToggle.setAttribute("aria-expanded", String(open)); qToggle.textContent = open ? "Hide checks" : "Show checks"; $("#q-panel").classList.toggle("q-collapsed", !open); };
qToggle.addEventListener("click", () => setQ(qToggle.getAttribute("aria-expanded") !== "true"));
if (matchMedia("(max-width:767px)").matches) setQ(false);
(["template", "filled"] as Mode[]).forEach(k => $(`#pv-${k}`).addEventListener("click", () => { mode = k; renderSide(); announce(`Preview shows ${k === "filled" ? "Filled" : "Template"}`); }));
// Template gallery (native <dialog>: focus trap + Escape for free)
const dlgEl = $("#tpl-dialog") as HTMLDialogElement;
const kindList = (t: typeof TEMPLATES[number]) => t.blocks.map(b => LABEL[b.kind]).join(", ");
const varList = (t: typeof TEMPLATES[number]) => findVars(t.blocks.map(b => b.kind === "requirements" ? reqText(b.must, b.mustNot) : b.text).join("\n")).map(([n]) => `{{${n}}}`).join(", ") || "none";
$("#tpl-list").innerHTML = TEMPLATES.map(t => `<li class="tpl-card" data-tpl="${t.id}" data-q="${esc((t.name + " " + t.purpose + " " + kindList(t) + " " + varList(t)).toLowerCase())}"><h3 class="h3" id="tpl-${t.id}">${esc(t.name)}</h3><p class="small">${esc(t.purpose)}</p><p class="tpl-meta"><b>Blocks:</b> ${esc(kindList(t))}</p><p class="tpl-meta"><b>Variables:</b> <code>${esc(varList(t))}</code></p><button type="button" class="btn btn--sm tpl-use" aria-describedby="tpl-${t.id}">Use template</button></li>`).join("");
$("#tpl-filter").addEventListener("input", e => { const q = (e.target as HTMLInputElement).value.trim().toLowerCase(); let n = 0;
  document.querySelectorAll<HTMLElement>(".tpl-card").forEach(li => { const on = !q || li.dataset.q!.includes(q); li.hidden = !on; if (on) n++; });
  ($("#tpl-none") as HTMLElement).hidden = n > 0; $("#tpl-count").textContent = `${n} of ${TEMPLATES.length} templates`; });
$("#btn-templates").addEventListener("click", () => { dlgEl.showModal(); ($("#tpl-filter") as HTMLInputElement).focus(); });
$("#tpl-close").addEventListener("click", () => dlgEl.close());
$("#tpl-list").addEventListener("click", e => { const btn = (e.target as HTMLElement).closest(".tpl-use"); if (!btn) return;
  const t = TEMPLATES.find(x => x.id === (btn.closest(".tpl-card") as HTMLElement).dataset.tpl)!;
  if (blocks.some(b => b.text.trim())) {
    if (!confirm(`Replace your current draft with “${t.name}”? Your current draft will be saved as a version first.`)) return;
    versions.push({ id: uid(), note: `Before template: ${t.name}`, at: new Date().toISOString(), blocks: blocks.map(plain), variables: { ...vars } });
  }
  dlgEl.close(); vars = {}; varSig = ""; setBlocks(t.blocks.map(b => plain(b)), `Loaded template ${t.name}${versions.length ? ". Previous draft saved in Versions." : ""}`); renderVersions(); });
// Command palette actions (from ../shared/shell)
const keepDraft = (note: string) => { if (!blocks.some(b => b.text.trim())) return true; if (!confirm("Replace your current draft? It will be saved as a version first.")) return false; versions.push({ id: uid(), note, at: new Date().toISOString(), blocks: blocks.map(plain), variables: { ...vars } }); return true; };
window.addEventListener("spe:action", e => { const id = (e as CustomEvent).detail;
  if (id === "new-prompt" && keepDraft("Before new prompt")) { vars = {}; varSig = ""; selectTab("edit"); setBlocks((["role", "rules", "tone", "output"] as Kind[]).map(k => ({ kind: k, title: LABEL[k], text: "" })), "New prompt started"); renderVersions(); (document.querySelector("#blocks textarea") as HTMLElement | null)?.focus(); }
  if (id === "templates") $("#btn-templates").click();
  if (id === "import") { $("#btn-import").focus(); $("#btn-import").click(); }
  if (id === "export-spe") $("#btn-export").click(); });
load(); render(); renderVersions();
