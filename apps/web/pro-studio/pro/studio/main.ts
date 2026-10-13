// SPE Pro Prompt Studio r1 — runs fully client-side. No network calls (CSP connect-src 'none').
type Kind = "role" | "rules" | "tone" | "output" | "examples" | "custom";
interface Block { id: string; kind: Kind; title: string; text: string }
interface SpeFile { format: "spe.prompt"; version: 1; name: string; createdAt: string; blocks: Omit<Block, "id">[]; versions?: Version[] }

const LABEL: Record<Kind, string> = { role: "Role", rules: "Rules", tone: "Tone", output: "Output format", examples: "Examples", custom: "Custom" };
const HINT: Record<Kind, string> = {
  role: "Who the assistant is and who it serves, e.g. You are a support agent for…",
  rules: "One rule per line. Prefer concrete, testable rules.",
  tone: "Voice and register, e.g. Warm, concise, plain English.",
  output: "Exact shape of the answer: sections, JSON keys, length limits.",
  examples: "Input → ideal output pairs.",
  custom: "Anything else the model needs.",
};
const STORE = "spe.pro.studio.r1.draft";
const VSTORE = "spe.pro.studio.r1.versions";
interface Version { id: string; note: string; at: string; blocks: Omit<Block, "id">[] }
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

function load() { try { const r = localStorage.getItem(STORE); if (r) blocks = JSON.parse(r); const v = localStorage.getItem(VSTORE); if (v) versions = JSON.parse(v); } catch { blocks = []; versions = []; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(blocks)); localStorage.setItem(VSTORE, JSON.stringify(versions)); } catch { /* storage disabled: editor still works */ } }
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
  $("#preview").innerHTML = text ? esc(text) : '<span class="ph">Your assembled prompt appears here as you type.</span>';
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  $("#stats").textContent = `${blocks.length} blocks · ${words} words · ${text.length} chars · ~${tokens(text)} tokens`;
  $("#quality").innerHTML = qHtml(check(blocks));
  save();
}

function render(focusId?: string, enterId?: string) {
  const ol = $("#blocks"); ol.innerHTML = "";
  ($("#empty") as HTMLElement).hidden = blocks.length > 0;
  blocks.forEach((b, i) => {
    const li = document.createElement("li");
    li.className = "blk" + (b.id === enterId ? " enter" : ""); li.dataset.k = b.kind; li.dataset.id = b.id;
    const tid = `t-${b.id}`, xid = `x-${b.id}`;
    li.innerHTML = `<div class="blk__bar">
      <button type="button" class="handle" draggable="true" aria-label="Reorder ${esc(b.title || LABEL[b.kind])}, position ${i + 1} of ${blocks.length}. Alt plus arrow keys to move.">⠿</button>
      <span class="blk__label">${LABEL[b.kind]}</span>
      <label class="sr-only" for="${tid}">Block title</label><input id="${tid}" class="blk__title" value="${esc(b.title).replace(/"/g, "&quot;")}" />
      <button type="button" class="icon-btn up" aria-label="Move ${esc(b.title)} up" ${i === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="icon-btn down" aria-label="Move ${esc(b.title)} down" ${i === blocks.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="icon-btn del" aria-label="Remove ${esc(b.title)} block">✕</button></div>
      <label class="sr-only" for="${xid}">${esc(b.title)} content</label><textarea id="${xid}" class="blk__ta" placeholder="${esc(HINT[b.kind])}" aria-describedby="bq-${b.id}"></textarea><div class="blk__q" id="bq-${b.id}" aria-label="Block checks">${chips(b)}</div>`;
    (li.querySelector("textarea") as HTMLTextAreaElement).value = b.text;
    li.querySelector("textarea")!.addEventListener("input", e => { b.text = (e.target as HTMLTextAreaElement).value; li.querySelector(".blk__q")!.innerHTML = chips(b); renderSide(); });
    li.querySelector(".blk__title")!.addEventListener("input", e => { b.title = (e.target as HTMLInputElement).value; renderSide(); });
    li.querySelector(".up")!.addEventListener("click", () => move(i, i - 1, "up"));
    li.querySelector(".down")!.addEventListener("click", () => move(i, i + 1, "down"));
    li.querySelector(".del")!.addEventListener("click", () => { blocks.splice(i, 1); announce(`${b.title} removed`); render(blocks[Math.min(i, blocks.length - 1)]?.id); });
    const h = li.querySelector(".handle") as HTMLButtonElement;
    h.addEventListener("keydown", e => { if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); move(i, e.key === "ArrowUp" ? i - 1 : i + 1, "handle"); } });
    h.addEventListener("dragstart", e => { e.dataTransfer!.setData("text/plain", b.id); e.dataTransfer!.effectAllowed = "move"; li.classList.add("dragging"); });
    h.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", e => { e.preventDefault(); li.classList.add("over"); });
    li.addEventListener("dragleave", () => li.classList.remove("over"));
    li.addEventListener("drop", e => { e.preventDefault(); li.classList.remove("over"); const from = blocks.findIndex(x => x.id === e.dataTransfer!.getData("text/plain")); if (from >= 0 && from !== i) move(from, i, "handle"); });
    ol.appendChild(li);
  });
  if (focusId) (ol.querySelector(`[data-id="${focusId}"] .blk__title`) as HTMLElement | null)?.focus();
  renderSide();
}
function move(from: number, to: number, keep: "up" | "down" | "handle") {
  if (to < 0 || to >= blocks.length) return;
  const [b] = blocks.splice(from, 1); blocks.splice(to, 0, b);
  render(); announce(`${b.title} moved to position ${to + 1} of ${blocks.length}`);
  const li = document.querySelector(`[data-id="${b.id}"]`)!;
  const target = (keep === "handle" ? li.querySelector(".handle") : li.querySelector(keep === "up" ? ".up:not([disabled])" : ".down:not([disabled])")) || li.querySelector(".handle");
  (target as HTMLElement).focus();
}
function add(kind: Kind, text = "") { const b = { id: uid(), kind, title: LABEL[kind], text }; blocks.push(b); render(undefined, b.id); (document.querySelector(`[data-id="${b.id}"] textarea`) as HTMLElement).focus(); announce(`${b.title} block added`); }
function setBlocks(bs: Omit<Block, "id">[], msg: string) { blocks = bs.map(b => ({ ...b, id: uid() })); render(); announce(msg); }

export function toSpe(bs: Block[]): SpeFile { return { format: "spe.prompt", version: 1, name: bs.find(b => b.kind === "role")?.text.slice(0, 48) || "Untitled prompt", createdAt: new Date().toISOString(), blocks: bs.map(({ kind, title, text }) => ({ kind, title, text })), versions }; }
export function fromSpe(raw: string): Omit<Block, "id">[] {
  const d = JSON.parse(raw);
  if (!d || d.format !== "spe.prompt" || d.version !== 1 || !Array.isArray(d.blocks)) throw new Error("Not an SPE v1 prompt file.");
  if (d.blocks.length > 200) throw new Error("Too many blocks (max 200).");
  return d.blocks.map((b: any) => {
    if (!(b && b.kind in LABEL && typeof b.text === "string" && typeof b.title === "string")) throw new Error("A block is malformed.");
    return { kind: b.kind as Kind, title: b.title.slice(0, 80), text: b.text.slice(0, 20000) };
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
$("#file-import").addEventListener("change", async e => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try { if (f.size > 1_000_000) throw new Error("File is over 1 MB."); const raw = await f.text(); const bs = fromSpe(raw); const d = JSON.parse(raw); if (Array.isArray(d.versions)) versions = d.versions.slice(0, 100).map((v: any) => ({ id: uid(), note: String(v.note || "Imported").slice(0, 80), at: String(v.at || new Date().toISOString()), blocks: fromSpe(JSON.stringify({ format: "spe.prompt", version: 1, blocks: v.blocks })) })); setBlocks(bs, `Imported ${f.name}`); renderVersions(); }
  catch (err) { announce(`Import failed: ${(err as Error).message}`); alert(`Import failed: ${(err as Error).message}`); }
  (e.target as HTMLInputElement).value = "";
});
$("#btn-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(assemble(blocks)); announce("Prompt copied"); } catch { announce("Copy failed; select the preview text instead"); } });
(window as any).__spe = { check, detSummary, assemble, toSpe, fromSpe };
$("#btn-save-v").addEventListener("click", () => { const inp = $("#v-name") as HTMLInputElement; versions.push({ id: uid(), note: inp.value.trim() || `Snapshot ${versions.length + 1}`, at: new Date().toISOString(), blocks: blocks.map(({ kind, title, text }) => ({ kind, title, text })) }); inp.value = ""; save(); renderVersions(); announce(`Saved version ${versions.length}`); });
$("#vlist").addEventListener("click", e => { const t = e.target as HTMLElement; const r = t.closest("[data-restore]") as HTMLElement | null, d = t.closest("[data-delv]") as HTMLElement | null;
  if (r) { const v = versions.find(x => x.id === r.dataset.restore)!; setBlocks(v.blocks, `Restored ${v.note}`); renderVersions(); }
  if (d) { versions = versions.filter(x => x.id !== d.dataset.delv); save(); renderVersions(); announce("Version deleted"); } });
["#d-from", "#d-to"].forEach(s => $(s).addEventListener("change", renderDiff)); ["#ab-a", "#ab-b"].forEach(s => $(s).addEventListener("change", renderAB));
const tabs = ["edit", "ver", "ab"];
function selectTab(k: string, focus = false) { tabs.forEach(t => { const on = t === k; const b = $(`#tab-${t}`); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; ($(`#view-${t}`) as HTMLElement).hidden = !on; if (on && focus) b.focus(); }); if (k !== "edit") renderVersions(); }
tabs.forEach((t, i) => { const b = $(`#tab-${t}`); b.addEventListener("click", () => selectTab(t)); b.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3], true); } }); });
(window as any).__spe.lineDiff = lineDiff; (window as any).__spe.selectTab = selectTab;
load(); render(); renderVersions();
