import { type Blueprint, type Agent, TOOLS, validate, toOpenAI, toAnthropic, toMcpStyle } from "../core/blueprint.ts";
import { $, esc, load, save, download, copy, uid } from "../core/ui.ts";
const KEY = "spe.pro.blueprint.v1";
const example = (): Blueprint => ({ name: "Bike shop help desk", agents: [
  { id: "triage", name: "Triage", role: "Reads each message and decides who should answer.", instructions: "Ask one clarifying question if the request is unclear.", tools: [], maxSteps: 4, needsApproval: false, x: 16, y: 168 },
  { id: "repairs", name: "Repair advisor", role: "Suggests the right repair and a price range.", instructions: "Use the shop's price list. Never promise refunds.", tools: ["read_file", "web_search"], maxSteps: 8, needsApproval: false, x: 232, y: 40 },
  { id: "billing", name: "Billing", role: "Drafts replies about invoices.", instructions: "Hand anything about refunds to a person.", tools: ["read_file", "send_email"], maxSteps: 6, needsApproval: true, x: 232, y: 296 },
  { id: "human", name: "Staff member", role: "A person who approves refunds.", instructions: "", tools: [], maxSteps: 1, needsApproval: false, x: 448, y: 296 }],
  handoffs: [{ from: "triage", to: "repairs", when: "the question is about a repair" }, { from: "triage", to: "billing", when: "the question is about billing" }, { from: "billing", to: "human", when: "a refund is requested" }] });
let bp = load<Blueprint>(KEY, example); let sel = bp.agents[0]?.id ?? "";
const inner = $("inner"), svg = $("edges") as unknown as SVGSVGElement, W = 176, H = 96;
const cur = () => bp.agents.find((a) => a.id === sel);
const persist = () => { save(KEY, bp); renderChecks(); renderExport(); };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function nodeHtml(a: Agent) {
  return `<button type="button" class="node" data-id="${a.id}" aria-pressed="${a.id === sel}"><b>${esc(a.name)}</b><span class="sr-only">. ${a.tools.length} tools, step limit ${a.maxSteps}${a.needsApproval ? ", asks a human first" : ""}.</span><small>${esc(a.role.slice(0, 60))}</small>
    <span class="chips">${a.tools.map((t) => `<span class="chip">${t}</span>`).join("")}</span></button>`;
}
function drawEdges() {
  const pos = new Map(bp.agents.map((a) => [a.id, a]));
  svg.querySelectorAll("path.e").forEach((p) => p.remove());
  for (const h of bp.handoffs) { const f = pos.get(h.from), t = pos.get(h.to); if (!f || !t || f === t) continue;
    const x1 = f.x + W, y1 = f.y + H / 2, x2 = t.x, y2 = t.y + H / 2, mx = (x1 + x2) / 2;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("class", "e");
    p.setAttribute("d", `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2 - 4} ${y2}`); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#8EF0C6"); p.setAttribute("stroke-opacity", ".55"); p.setAttribute("stroke-width", "1.5"); p.setAttribute("marker-end", "url(#arr)"); svg.appendChild(p); }
}
function renderCanvas() { inner.querySelectorAll(".node").forEach((n) => n.remove()); inner.insertAdjacentHTML("beforeend", bp.agents.map(nodeHtml).join(""));
  bp.agents.forEach((a) => { const n = inner.querySelector<HTMLElement>(`.node[data-id="${a.id}"]`); if (n) n.style.transform = `translate(${a.x}px,${a.y}px)`; }); drawEdges(); }
function renderEditor() {
  const a = cur(); const f = $<HTMLFormElement>("edit"); [...f.elements].forEach((el) => ((el as HTMLInputElement).disabled = !a)); if (!a) return;
  $<HTMLInputElement>("an").value = a.name; $<HTMLInputElement>("ar").value = a.role; $<HTMLTextAreaElement>("ai").value = a.instructions;
  $<HTMLInputElement>("am").value = String(a.maxSteps); $<HTMLInputElement>("aa").checked = a.needsApproval;
  $("tools").innerHTML = "<legend>Tools it may use</legend>" + Object.entries(TOOLS).map(([k, d]) => `<label class="opt"><input type="checkbox" value="${k}" ${a.tools.includes(k) ? "checked" : ""}><span><b class="mono">${k}</b><span class="hint">${esc(d)}</span></span></label>`).join("");
}
function renderHandoffs() {
  const opts = bp.agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join(""); $("hf").innerHTML = opts; $("ht").innerHTML = opts;
  if (bp.agents[1]) $<HTMLSelectElement>("ht").value = bp.agents[1].id;
  const nm = (id: string) => esc(bp.agents.find((a) => a.id === id)?.name ?? "missing agent");
  $("hlist").innerHTML = bp.handoffs.map((h, i) => `<li class="item"><div class="item__top"><p>${nm(h.from)} → ${nm(h.to)}</p><button class="btn btn--ghost btn--sm" type="button" data-h="${i}" aria-label="Remove handoff from ${nm(h.from)} to ${nm(h.to)}">Remove</button></div><p class="hint">When ${esc(h.when)}</p></li>`).join("") || '<li class="hint">No handoffs yet.</li>';
}
function renderChecks() { const e = validate(bp); $("checks").innerHTML = e.length ? e.map((x) => `<li class="item bad">${esc(x)}</li>`).join("") : '<li class="item ok">No problems found.</li>'; }
const fmt = () => (document.querySelector<HTMLInputElement>('input[name="fmt"]:checked')?.value ?? "mcp");
const exporters = { mcp: toMcpStyle, openai: toOpenAI, anthropic: toAnthropic } as const;
function renderExport() { $<HTMLTextAreaElement>("exp").value = JSON.stringify(exporters[fmt() as keyof typeof exporters](bp), null, 2); }
function renderAll() { renderCanvas(); renderEditor(); renderHandoffs(); renderChecks(); renderExport(); }
function select(id: string, focus = false) { sel = id; inner.querySelectorAll<HTMLElement>(".node").forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.id === id))); renderEditor(); if (focus) inner.querySelector<HTMLElement>(`.node[data-id="${id}"]`)?.focus(); }
function moveTo(a: Agent, x: number, y: number) { a.x = clamp(Math.round(x / 8) * 8, 0, 640 - W); a.y = clamp(Math.round(y / 8) * 8, 0, 480 - H - 8);
  const n = inner.querySelector<HTMLElement>(`.node[data-id="${a.id}"]`); if (n) n.style.transform = `translate(${a.x}px,${a.y}px)`; drawEdges(); }
inner.addEventListener("click", (e) => { const n = (e.target as HTMLElement).closest<HTMLElement>(".node"); if (n) select(n.dataset.id!); });
inner.addEventListener("keydown", (e) => {
  const n = (e.target as HTMLElement).closest<HTMLElement>(".node"); if (!n) return; const a = bp.agents.find((x) => x.id === n.dataset.id)!;
  const d = e.shiftKey ? 32 : 8; const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
  if (m[e.key]) { e.preventDefault(); if (sel !== a.id) select(a.id); moveTo(a, a.x + m[e.key][0], a.y + m[e.key][1]); save(KEY, bp); $("status").textContent = `${a.name} at ${a.x}, ${a.y}.`; }
});
let drag: { a: Agent; dx: number; dy: number; moved: boolean } | null = null;
inner.addEventListener("pointerdown", (e) => { const n = (e.target as HTMLElement).closest<HTMLElement>(".node"); if (!n) return; const a = bp.agents.find((x) => x.id === n.dataset.id)!; n.setPointerCapture(e.pointerId); drag = { a, dx: e.clientX - a.x, dy: e.clientY - a.y, moved: false }; });
inner.addEventListener("pointermove", (e) => { if (!drag) return; drag.moved = true; moveTo(drag.a, e.clientX - drag.dx, e.clientY - drag.dy); });
inner.addEventListener("pointerup", () => { if (drag?.moved) save(KEY, bp); drag = null; });
const bind = (id: string, f: (a: Agent, el: HTMLInputElement) => void) => $(id).addEventListener("input", () => { const a = cur(); if (!a) return; f(a, $<HTMLInputElement>(id)); renderCanvas(); renderHandoffs(); persist(); });
bind("an", (a, el) => (a.name = el.value)); bind("ar", (a, el) => (a.role = el.value)); bind("ai", (a, el) => (a.instructions = el.value));
bind("am", (a, el) => (a.maxSteps = parseInt(el.value, 10) || 0)); bind("aa", (a, el) => (a.needsApproval = el.checked));
$("tools").addEventListener("change", () => { const a = cur(); if (!a) return; a.tools = [...$("tools").querySelectorAll<HTMLInputElement>("input:checked")].map((i) => i.value); renderCanvas(); persist(); });
$("addagent").addEventListener("click", () => { const id = uid(); const n = bp.agents.length; bp.agents.push({ id, name: `Agent ${n + 1}`, role: "", instructions: "", tools: [], maxSteps: 5, needsApproval: false, x: 16 + (n % 3) * 216, y: 24 + Math.floor(n / 3) * 120 % 360 });
  renderAll(); select(id, true); persist(); $("status").textContent = `Added Agent ${n + 1}. Edit it on the right.`; });
$("del").addEventListener("click", () => { const a = cur(); if (!a) return; bp.agents = bp.agents.filter((x) => x.id !== a.id); bp.handoffs = bp.handoffs.filter((h) => h.from !== a.id && h.to !== a.id); sel = bp.agents[0]?.id ?? ""; renderAll(); persist(); $("status").textContent = `Removed ${a.name} and its handoffs.`; if (sel) select(sel, true); });
$("hform").addEventListener("submit", (e) => { e.preventDefault(); const from = $<HTMLSelectElement>("hf").value, to = $<HTMLSelectElement>("ht").value;
  if (from === to) { $("status").textContent = "Pick two different agents."; return; }
  bp.handoffs.push({ from, to, when: $<HTMLInputElement>("hw").value.trim() || "needed" }); renderHandoffs(); drawEdges(); persist(); $("status").textContent = "Handoff added."; });
$("hlist").addEventListener("click", (e) => { const i = (e.target as HTMLElement).closest<HTMLElement>("[data-h]")?.dataset.h; if (i == null) return; bp.handoffs.splice(+i, 1); renderHandoffs(); drawEdges(); persist(); $("status").textContent = "Handoff removed."; });
document.querySelectorAll('input[name="fmt"]').forEach((r) => r.addEventListener("change", renderExport));
$("copy").addEventListener("click", async () => { $("status").textContent = (await copy($<HTMLTextAreaElement>("exp").value)) ? "Draft config copied." : "Copy was blocked. Select the text and copy it instead."; });
$("dl").addEventListener("click", () => download(`blueprint-${fmt()}-draft.json`, $<HTMLTextAreaElement>("exp").value));
$("reset").addEventListener("click", () => { bp = example(); sel = bp.agents[0].id; renderAll(); persist(); $("status").textContent = "Example restored."; });
renderAll();
