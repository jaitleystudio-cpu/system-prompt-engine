// SPE Pro shell behaviour: Cmd/Ctrl+K command palette (APG combobox + listbox) and the mobile drawer. No network.
type Item = { id: string; label: string; kind: "Page" | "Action"; href: string; kw: string };
const P = { home: "/pro/", studio: "/pro/studio/", bp: "/pro/blueprint/", rl: "/pro/regression-lab/", rel: "/pro/releases/" };
export const ITEMS: Item[] = [
  { id: "go-home", label: "Pro overview", kind: "Page", href: P.home, kw: "home main features" },
  { id: "go-studio", label: "Prompt Studio", kind: "Page", href: P.studio, kw: "editor blocks prompt" },
  { id: "go-bp", label: "Agent Blueprint", kind: "Page", href: P.bp, kw: "agents team multi-agent design handoff" },
  { id: "go-rl", label: "Regression Lab", kind: "Page", href: P.rl, kw: "tests cases compare versions" },
  { id: "go-rel", label: "Signed Releases", kind: "Page", href: P.rel, kw: "sign verify version ed25519" },
  { id: "new-prompt", label: "New prompt", kind: "Action", href: P.studio, kw: "create start blank starter" },
  { id: "templates", label: "Browse templates", kind: "Action", href: P.studio, kw: "gallery starter examples" },
  { id: "import", label: "Import .spe file", kind: "Action", href: P.studio, kw: "open load file" },
  { id: "export-spe", label: "Export .spe file", kind: "Action", href: P.studio, kw: "save download" },
  { id: "export-config", label: "Export agent config", kind: "Action", href: P.bp, kw: "json mcp openai anthropic download" },
  { id: "add-agent", label: "Add agent", kind: "Action", href: P.bp, kw: "new agent" },
  { id: "add-case", label: "Add test case", kind: "Action", href: P.rl, kw: "new test" },
  { id: "run-tests", label: "Run test suite", kind: "Action", href: P.rl, kw: "compare run" },
  { id: "sign", label: "Sign a release", kind: "Action", href: P.rel, kw: "new version publish" },
  { id: "verify", label: "Verify a release pack", kind: "Action", href: P.rel, kw: "check signature" },
];
const here = () => location.pathname.replace(/index\.html$/, "");
export function run(it: Item) {
  if (it.kind === "Page") { location.href = it.href; return; }
  if (here() === it.href) window.dispatchEvent(new CustomEvent("spe:action", { detail: it.id }));
  else location.href = `${it.href}#do=${it.id}`;
}
const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const dlg = document.createElement("dialog"); dlg.className = "cmdk"; dlg.id = "cmdk"; dlg.setAttribute("aria-label", "Command palette");
dlg.innerHTML = `<div class="cmdk__in">${SEARCH}<label for="cmdk-q" class="sr-only">Search features and actions</label><input id="cmdk-q" class="cmdk__q" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" autocomplete="off" placeholder="Search features and actions…" /></div>
<ul id="cmdk-list" class="cmdk__list" role="listbox" aria-label="Results"></ul><p id="cmdk-empty" class="cmdk__empty" hidden>No matches. Try “studio”, “sign” or “export”.</p>
<p class="cmdk__foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></p><p id="cmdk-status" class="sr-only" aria-live="polite"></p>`;
document.body.appendChild(dlg);
const q = dlg.querySelector<HTMLInputElement>("#cmdk-q")!, list = dlg.querySelector<HTMLUListElement>("#cmdk-list")!;
let shown: Item[] = [], act = 0;
function paint() {
  const t = q.value.trim().toLowerCase();
  shown = ITEMS.filter(i => !t || (i.label + " " + i.kw + " " + i.kind).toLowerCase().includes(t)).sort((a, b) => (+(b.href === here()) - +(a.href === here())) * (t ? 0 : 1));
  act = Math.min(act, Math.max(0, shown.length - 1));
  list.innerHTML = shown.map((i, k) => `<li id="cmdk-o-${i.id}" class="cmdk__opt" role="option" aria-selected="${k === act}" data-k="${k}">${i.label}<small>${i.kind === "Page" ? "Go to" : "Action"}</small></li>`).join("");
  (dlg.querySelector("#cmdk-empty") as HTMLElement).hidden = shown.length > 0;
  if (shown[act]) q.setAttribute("aria-activedescendant", `cmdk-o-${shown[act].id}`); else q.removeAttribute("aria-activedescendant");
  dlg.querySelector("#cmdk-status")!.textContent = `${shown.length} result${shown.length === 1 ? "" : "s"}`;
  list.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}
export function openPalette() { if (dlg.open) return; q.value = ""; act = 0; paint(); dlg.showModal(); q.focus(); }
q.addEventListener("input", () => { act = 0; paint(); });
q.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (shown.length) act = (act + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length; paint(); }
  else if (e.key === "Enter") { e.preventDefault(); const it = shown[act]; if (it) { dlg.close(); run(it); } }
});
list.addEventListener("click", e => { const li = (e.target as HTMLElement).closest<HTMLElement>("[data-k]"); if (!li) return; const it = shown[+li.dataset.k!]; dlg.close(); run(it); });
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
document.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? dlg.close() : openPalette(); } });
document.querySelectorAll("[data-palette]").forEach(b => b.addEventListener("click", openPalette));
const isMac = /Mac|iPhone|iPad/.test(navigator.platform); document.querySelectorAll("kbd[data-mod]").forEach(k => (k.textContent = isMac ? "⌘K" : "Ctrl K"));
const drawer = document.getElementById("shell-drawer") as HTMLDialogElement | null;
document.querySelectorAll("[data-drawer-open]").forEach(b => b.addEventListener("click", () => drawer?.showModal()));
document.querySelectorAll("[data-drawer-close]").forEach(b => b.addEventListener("click", () => drawer?.close()));
drawer?.addEventListener("click", e => { if (e.target === drawer) drawer.close(); });
window.addEventListener("load", () => { const m = location.hash.match(/^#do=([\w-]+)$/); if (!m) return; history.replaceState(null, "", location.pathname); setTimeout(() => window.dispatchEvent(new CustomEvent("spe:action", { detail: m[1] })), 0); });
(window as any).__shell = { ITEMS, openPalette };
