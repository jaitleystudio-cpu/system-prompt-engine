import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./pro-studio.css";
import { ProCtx, type ProCtxValue, type SyncState, usePro } from "./context.ts";
import { Icon } from "./icons.tsx";
import { TOOLS, GROUPS, toolById, parseProPath, pathFor, type ToolId, type ProRoute } from "./proRoutes.ts";
import { accessFromSession, hasAccess, CHECKING, type Access } from "./proGate.ts";
import { newSession, sessionTitle, groupByProject, deleteProject, emptyWorkspace, type Workspace, type Session } from "./shared/workspace.ts";
import { uid, type PlainBlock } from "./shared/constants.ts";
import { proApi, getKey, setKey, setUnauthorizedHandler, ApiError, EMPTY_BYOK, type Byok, type SessionInfo } from "./api.ts";
import { readThemePreference, applyTheme, cycleTheme, themeLabel, type ThemePreference } from "../ui/theme.ts";
import { CommandPalette, type PaletteItem } from "./CommandPalette.tsx";
const CoWorkiePanel = lazy(() => import("./CoWorkiePanel.tsx"));

const Living = lazy(() => import("./tools/Living.tsx"));
const Blind = lazy(() => import("./tools/Blind.tsx"));
const Portability = lazy(() => import("./tools/Portability.tsx"));
const PromptStudio = lazy(() => import("./tools/PromptStudio.tsx"));
const Blueprint = lazy(() => import("./tools/Blueprint.tsx"));
const Regression = lazy(() => import("./tools/Regression.tsx"));
const Releases = lazy(() => import("./tools/Releases.tsx"));
const CodeExport = lazy(() => import("./tools/CodeExport.tsx"));
const Batch = lazy(() => import("./tools/Batch.tsx"));
const Brand = lazy(() => import("./tools/Brand.tsx"));
const Formats = lazy(() => import("./tools/Formats.tsx"));
const Cost = lazy(() => import("./tools/Cost.tsx"));
const Scanner = lazy(() => import("./tools/Scanner.tsx"));
const Audit = lazy(() => import("./tools/Audit.tsx"));
const Library = lazy(() => import("./tools/Library.tsx"));
const Report = lazy(() => import("./tools/Report.tsx"));
const VIEWS: Record<ToolId, React.LazyExoticComponent<() => JSX.Element>> = { living: Living, blind: Blind, portability: Portability, studio: PromptStudio, blueprint: Blueprint, regression: Regression, releases: Releases, code: CodeExport, batch: Batch, brand: Brand, formats: Formats, cost: Cost, scanner: Scanner, audit: Audit, library: Library, report: Report };

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = isMac ? "⌘" : "Ctrl";

/** Asks the SPE Pro service to verify the stored key. The server is the only authority. */
async function checkAccess(): Promise<{ access: Access; info: SessionInfo | null }> {
  const key = getKey();
  if (!key) return { access: accessFromSession({ reason: "MISSING_KEY" }), info: null };
  try { const info = await proApi<SessionInfo>("/session", undefined, { key }); return { access: accessFromSession(info), info }; }
  catch (e) { const err = e as ApiError; if (err.status === 0) return { access: accessFromSession(null, { network: true }), info: null }; if (err.status === 429) return { access: { ...accessFromSession({ reason: "RATE_LIMITED" }) }, info: null }; return { access: accessFromSession({ reason: err.reason ?? "MISSING_KEY" }), info: null }; }
}

export const PREF_KEY = "spe.pro.studio.v2.layout";
export interface LayoutPrefs { leftPinned: boolean; rightPinned: boolean }
export function readPrefs(): LayoutPrefs {
  const wide = typeof window !== "undefined" && window.innerWidth >= 1280;
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); return { leftPinned: p.leftPinned !== false, rightPinned: typeof p.rightPinned === "boolean" ? p.rightPinned : wide }; } catch { return { leftPinned: true, rightPinned: wide }; }
}
const EDGE = 8;

export default function ProStudioApp({ onExit }: { onExit?: () => void }) {
  const [route, setRoute] = useState<ProRoute>(() => parseProPath(window.location.pathname));
  const [access, setAccess] = useState<Access>(CHECKING);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [ws, setWsState] = useState<Workspace>(emptyWorkspace);
  const [sync, setSync] = useState<SyncState>("loading");
  const [byok, setByok] = useState<Byok>(EMPTY_BYOK);
  const loadedWs = useRef(false);
  const [prefs, setPrefs] = useState<LayoutPrefs>(readPrefs);
  const [leftPeek, setLeftPeek] = useState(false);
  const [rightPeek, setRightPeek] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cwDrawerOpen, setCwDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [composer, setComposer] = useState("");
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());
  const [live, setLive] = useState("");
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const bus = useMemo(() => new EventTarget(), []);
  const mainRef = useRef<HTMLDivElement>(null);
  const hideT = useRef<{ l?: number; r?: number }>({});

  useEffect(() => { applyTheme(theme); }, [theme]);
  const recheck = useCallback(async () => { setAccess(CHECKING); const r = await checkAccess(); setAccess(r.access); setInfo(r.info); }, []);
  useEffect(() => { void recheck(); setUnauthorizedHandler((reason) => { setAccess(accessFromSession({ reason })); setInfo(null); }); return () => setUnauthorizedHandler(() => {}); }, [recheck]);
  // Workspace lives on the SPE Pro server (per key). Load after unlock; save (debounced) on change.
  useEffect(() => {
    if (access.state !== "pro") { loadedWs.current = false; return; }
    let live = true; setSync("loading");
    proApi<{ workspace: Workspace }>("/workspace").then((d) => { if (!live) return; setWsState(d.workspace); loadedWs.current = true; setSync("idle"); }).catch(() => { if (live) setSync("error"); });
    return () => { live = false; };
  }, [access.state]);
  useEffect(() => {
    if (!loadedWs.current || access.state !== "pro") return;
    setSync("saving");
    const t = setTimeout(() => { proApi("/workspace", { workspace: ws }, { method: "PUT" }).then(() => setSync("saved")).catch(() => setSync("error")); }, 600);
    return () => clearTimeout(t);
  }, [ws, access.state]);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }, [prefs]);
  useEffect(() => {
    const onPop = () => setRoute(parseProPath(window.location.pathname));
    const onOff = () => setAccess(accessFromSession(null, { network: true }));
    const onOn = () => { void recheck(); };
    window.addEventListener("popstate", onPop); window.addEventListener("offline", onOff); window.addEventListener("online", onOn);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("offline", onOff); window.removeEventListener("online", onOn); };
  }, [recheck]);
  useEffect(() => {
    const t = route.kind === "tool" ? toolById(route.tool)?.label : route.kind === "home" ? "Home" : "Not found";
    document.title = `${t} · SPE Pro Studio`;
  }, [route]);

  const isMobile = () => window.matchMedia("(max-width: 899px)").matches;
  // Auto-hide: an unpinned panel is revealed by hovering its rail/handle or by moving the pointer to the screen edge.
  const peek = useCallback((side: "l" | "r", on: boolean, delay = 0) => {
    const set = side === "l" ? setLeftPeek : setRightPeek;
    window.clearTimeout(hideT.current[side]);
    if (on || !delay) set(on); else hideT.current[side] = window.setTimeout(() => set(false), delay);
  }, []);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isMobile()) return;
      if (!prefs.leftPinned && e.clientX <= EDGE) peek("l", true);
      if (!prefs.rightPinned && e.clientX >= window.innerWidth - EDGE) peek("r", true);
    };
    window.addEventListener("mousemove", onMove); return () => window.removeEventListener("mousemove", onMove);
  }, [prefs.leftPinned, prefs.rightPinned, peek]);

  const announce = useCallback((msg: string) => { setLive(""); requestAnimationFrame(() => setLive(msg)); setToast({ id: Date.now(), msg }); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);
  const log = useCallback((action: string, detail = "") => {
    proApi("/audit/append", { action, detail: detail.slice(0, 500) }).then(() => window.dispatchEvent(new Event("spe-pro-audit"))).catch(() => { /* the server records its own actions; UI events are best-effort */ });
  }, []);
  const go = useCallback((r: { kind: "home" } | { kind: "tool"; tool: ToolId }) => {
    const p = pathFor(r); if (window.location.pathname !== p) window.history.pushState({ view: "pro-studio" }, "", p);
    setRoute(r); setDrawerOpen(false); setLeftPeek(false); requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }, []);
  const setWs = useCallback((fn: (w: Workspace) => Workspace) => setWsState(fn), []);
  const updateSession = useCallback((id: string, fn: (s: Session) => Session) => setWsState((w) => ({ ...w, sessions: w.sessions.map((s) => (s.id === id ? { ...fn(s), updatedAt: new Date().toISOString() } : s)) })), []);
  const createSession = useCallback((s: Session, open = true) => {
    setWsState((w) => ({ ...w, sessions: [s, ...w.sessions], activeId: s.id })); log("session.create", sessionTitle(s));
    if (open) go({ kind: "tool", tool: "studio" });
  }, [go, log]);
  const active = ws.sessions.find((s) => s.id === ws.activeId) ?? null;
  const ok = hasAccess(access);

  const newBlank = useCallback(() => { go({ kind: "home" }); requestAnimationFrame(() => document.getElementById("ps-composer")?.focus()); }, [go]);
  const runAction = useCallback((tool: ToolId, id: string) => { go({ kind: "tool", tool }); setTimeout(() => bus.dispatchEvent(new CustomEvent("action", { detail: id })), 80); }, [bus, go]);
  const toggleLeft = useCallback(() => { if (isMobile()) setDrawerOpen((o) => !o); else { setPrefs((p) => ({ ...p, leftPinned: !p.leftPinned })); setLeftPeek(false); } }, []);
  const toggleRight = useCallback(() => { if (isMobile()) setCwDrawerOpen((o) => !o); else { setPrefs((p) => ({ ...p, rightPinned: !p.rightPinned })); setRightPeek(false); } }, []);
  const fillComposer = useCallback((text: string) => { setComposer(text); go({ kind: "home" }); requestAnimationFrame(() => document.getElementById("ps-composer")?.focus()); }, [go]);

  // Global shortcuts. Ignored while typing, except the Mod-combos.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
      if (mod && k === "k") { e.preventDefault(); setPaletteOpen((o) => !o); return; }
      if (mod && e.shiftKey && k === "o") { e.preventDefault(); newBlank(); return; }
      if (mod && !e.shiftKey && k === "b") { e.preventDefault(); toggleLeft(); return; }
      if (mod && !e.shiftKey && k === "i") { e.preventDefault(); toggleRight(); return; }
      if (mod && k === ".") { e.preventDefault(); setPanelOpen((o) => !o); return; }
      if (e.key === "Escape") { setLeftPeek(false); setRightPeek(false); }
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (!typing && !mod && !e.altKey && e.key === "?") { e.preventDefault(); setKeysOpen(true); }
      if (!typing && e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) { const t = TOOLS[+e.code.slice(5) - 1]; if (t) { e.preventDefault(); go({ kind: "tool", tool: t.id }); } }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [go, newBlank, toggleLeft, toggleRight]);

  const ctx: ProCtxValue = { ws, setWs, active, updateSession, createSession, go, announce, log, access, info, sync, byok, setByok, panelOpen, togglePanel: () => setPanelOpen((o) => !o), actionBus: bus, route, runAction, composer, setComposer, fillComposer };

  const paletteItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      { id: "go-home", label: "Home", group: "Go to", hint: "New session", keywords: "home start composer", run: () => go({ kind: "home" }) },
      ...TOOLS.map((t, i) => ({ id: `go-${t.id}`, label: t.label, group: "Tools", hint: i < 9 ? `Alt ${i + 1}` : undefined, keywords: t.keywords + " " + t.blurb, icon: t.id, run: () => go({ kind: "tool", tool: t.id }) })),
      { id: "a-new", label: "New session", group: "Actions", hint: `${MOD} ⇧ O`, keywords: "create start blank", run: newBlank },
      { id: "a-cw", label: "Ask CoWorkie", group: "Actions", hint: `${MOD} I`, keywords: "assistant help coworkie panel", run: () => { if (isMobile()) setCwDrawerOpen(true); else setPrefs((p) => ({ ...p, rightPinned: true })); requestAnimationFrame(() => document.getElementById("ps-cw-input")?.focus()); } },
      { id: "a-templates", label: "Browse templates", group: "Actions", keywords: "gallery starter examples", run: () => runAction("studio", "templates") },
      { id: "a-import", label: "Import .spe file", group: "Actions", keywords: "open load file", run: () => runAction("studio", "import") },
      { id: "a-export", label: "Export .spe file", group: "Actions", keywords: "save download", run: () => runAction("studio", "export") },
      { id: "a-version", label: "Save a version", group: "Actions", keywords: "snapshot history", run: () => runAction("studio", "save-version") },
      { id: "a-living", label: "New Living .spe project", group: "Actions", keywords: "living loop goal requirements verify", run: () => runAction("living", "new") },
      { id: "a-run", label: "Run regression suite", group: "Actions", keywords: "tests run", run: () => runAction("regression", "run") },
      { id: "a-sign", label: "Sign a release", group: "Actions", keywords: "ed25519 publish", run: () => runAction("releases", "sign") },
      { id: "a-scan", label: "Scan current session for secrets", group: "Actions", keywords: "pii keys", run: () => runAction("scanner", "scan-session") },
      { id: "a-project", label: "New project folder", group: "Actions", keywords: "folder organise", run: () => { const name = window.prompt("Project name"); if (name?.trim()) { setWsState((w) => ({ ...w, projects: [...w.projects, { id: uid(), name: name.trim().slice(0, 80), createdAt: new Date().toISOString() }] })); log("project.create", name.trim()); announce(`Project “${name.trim()}” created`); } } },
      { id: "a-side", label: prefs.leftPinned ? "Unpin sidebar (auto-hide)" : "Pin sidebar", group: "View", hint: `${MOD} B`, keywords: "toggle sidebar collapse auto hide pin", run: toggleLeft },
      { id: "a-cwpin", label: prefs.rightPinned ? "Unpin CoWorkie (auto-hide)" : "Pin CoWorkie panel", group: "View", hint: `${MOD} I`, keywords: "assistant panel right auto hide pin", run: toggleRight },
      { id: "a-panel", label: panelOpen ? "Hide output panel" : "Show output panel", group: "View", hint: `${MOD} .`, keywords: "toggle panel inspector", run: () => setPanelOpen((o) => !o) },
      { id: "a-theme", label: `Theme: switch from ${themeLabel(theme)}`, group: "View", keywords: "dark light system appearance", run: () => setTheme((t) => cycleTheme(t)) },
      { id: "a-keys", label: "Keyboard shortcuts", group: "Help", hint: "?", keywords: "help keys", run: () => setKeysOpen(true) },
      { id: "a-exit", label: "Back to SPE home", group: "Go to", keywords: "exit leave site", run: () => onExit?.() },
    ];
    for (const s of ws.sessions.slice(0, 30)) items.push({ id: `s-${s.id}`, label: sessionTitle(s), group: "Sessions", keywords: "session history", icon: "chat", run: () => { setWsState((w) => ({ ...w, activeId: s.id })); go({ kind: "tool", tool: "studio" }); } });
    return items;
  }, [go, newBlank, runAction, prefs, panelOpen, theme, ws.sessions, log, announce, onExit, toggleLeft, toggleRight]);

  const title = route.kind === "tool" ? toolById(route.tool)!.label : route.kind === "home" ? "New session" : "Not found";
  let body: ReactNode;
  if (route.kind === "not-found") body = <NotFoundState segment={route.segment} />;
  else if (access.state === "checking") body = <div className="ps-loading" role="status"><span className="ps-spinner" aria-hidden="true" />Checking your Pro key with the SPE Pro service…</div>;
  else if (!ok) body = <ProGate access={access} tool={route.kind === "tool" ? route.tool : null} onRecheck={recheck} />;
  else if (route.kind === "home") body = <Home />;
  else { const V = VIEWS[route.tool]; body = <Suspense fallback={<div className="ps-loading" role="status"><span className="ps-spinner" aria-hidden="true" />Loading {title}…</div>}><ErrorBoundary key={route.tool}><V /></ErrorBoundary></Suspense>; }

  const sideProps = { route, pinned: prefs.leftPinned, onPin: toggleLeft, onPalette: () => { setDrawerOpen(false); setPaletteOpen(true); }, onNew: newBlank, theme, onTheme: () => setTheme((t) => cycleTheme(t)), onKeys: () => { setDrawerOpen(false); setKeysOpen(true); }, onExit, onRemoveKey: () => { if (!window.confirm("Remove the Pro key from this browser? Your work stays on the SPE Pro server under this key.")) return; setKey(""); setWsState(emptyWorkspace()); loadedWs.current = false; void recheck(); } };
  const cwProps = { pinned: prefs.rightPinned, onPin: toggleRight, onClose: () => { if (prefs.rightPinned) toggleRight(); setRightPeek(false); setCwDrawerOpen(false); } };
  return (
    <ProCtx.Provider value={ctx}>
      <div className="ps" data-left={prefs.leftPinned ? "pinned" : "rail"} data-left-peek={leftPeek ? "1" : "0"} data-right={prefs.rightPinned ? "pinned" : "hidden"} data-right-peek={rightPeek ? "1" : "0"} data-panel={panelOpen ? "open" : "closed"}>
        <a className="ps-skip" href="#ps-main">Skip to workspace</a>
        <aside className="ps-side" aria-label="Pro Studio sidebar" data-testid="ps-left"
          onMouseEnter={() => { if (!prefs.leftPinned) peek("l", true); }} onMouseLeave={() => { if (!prefs.leftPinned) peek("l", false, 280); }}
          onFocus={() => { if (!prefs.leftPinned) peek("l", true); }} onBlur={(e) => { if (!prefs.leftPinned && !e.currentTarget.contains(e.relatedTarget as Node)) peek("l", false, 120); }}>
          {prefs.leftPinned || leftPeek ? <SidebarContent {...sideProps} /> : <Rail onNew={newBlank} onPalette={() => setPaletteOpen(true)} onPin={toggleLeft} route={route} />}
        </aside>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Pro Studio menu" side="left">
          <SidebarContent {...sideProps} onPin={() => setDrawerOpen(false)} inDrawer />
        </Drawer>
        <div className="ps-main">
          <header className="ps-top">
            <button type="button" className="ps-iconbtn ps-only-mobile" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
            <nav aria-label="Breadcrumb" className="ps-crumb"><ol><li><a href="/pro-studio" onClick={(e) => { e.preventDefault(); go({ kind: "home" }); }}>Pro Studio</a></li><li aria-current="page">{title}</li></ol></nav>
            <div className="ps-toast-slot">{toast && <div className="ps-toast" key={toast.id} aria-hidden="true" title={toast.msg}><Icon name="check" size={14} /><span>{toast.msg}</span></div>}</div>
            <div className="ps-top-r">
              <span className={`ps-plan ps-plan--${access.state}`} title={access.detail}>{access.state !== "locked" ? access.label : <><Icon name="lock" size={14} /> Pro only</>}</span>
              <button type="button" className="ps-search" onClick={() => setPaletteOpen(true)} aria-label={`Search tools and actions (${MOD} K)`}><Icon name="search" size={16} /><span className="ps-only-desktop">Search</span><kbd className="ps-only-desktop">{MOD} K</kbd></button>
              {route.kind === "tool" && ok && <button type="button" className="ps-iconbtn" aria-pressed={panelOpen} aria-label={`Output panel (${MOD} .)`} title={`Output panel (${MOD} .)`} onClick={() => setPanelOpen((o) => !o)}><Icon name="panel" /></button>}
              <button type="button" className="ps-cwbtn" aria-pressed={prefs.rightPinned} aria-label={`CoWorkie assistant (${MOD} I)`} title={`CoWorkie (${MOD} I)`} onClick={toggleRight} data-testid="cw-toggle"><Icon name="sparkles" size={16} /><span className="ps-only-desktop">CoWorkie</span></button>
            </div>
          </header>
          <div id="ps-main" className="ps-content" ref={mainRef} tabIndex={-1}>{body}</div>
        </div>
        <aside className="ps-cw" aria-label="CoWorkie assistant" data-testid="ps-right"
          onMouseEnter={() => { if (!prefs.rightPinned) peek("r", true); }} onMouseLeave={() => { if (!prefs.rightPinned) peek("r", false, 280); }}
          onFocus={() => { if (!prefs.rightPinned) peek("r", true); }} onBlur={(e) => { if (!prefs.rightPinned && !e.currentTarget.contains(e.relatedTarget as Node)) peek("r", false, 120); }}>
          {prefs.rightPinned || rightPeek ? <Suspense fallback={<div className="ps-loading" role="status">Loading CoWorkie…</div>}><CoWorkiePanel {...cwProps} /></Suspense>
            : <button type="button" className="ps-cw-handle" onClick={() => peek("r", true)} aria-label={`Show CoWorkie (${MOD} I to pin)`} data-testid="cw-handle"><Icon name="sparkles" size={16} /><span>CoWorkie</span></button>}
        </aside>
        <Drawer open={cwDrawerOpen} onClose={() => setCwDrawerOpen(false)} label="CoWorkie assistant" side="right">
          <Suspense fallback={null}><CoWorkiePanel {...cwProps} inDrawer onClose={() => setCwDrawerOpen(false)} /></Suspense>
        </Drawer>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
        <ShortcutsDialog open={keysOpen} onClose={() => setKeysOpen(false)} />
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{live}</div>
      </div>
    </ProCtx.Provider>
  );
}

function Rail({ onNew, onPalette, onPin, route }: { onNew: () => void; onPalette: () => void; onPin: () => void; route: ProRoute }) {
  const { go } = usePro(); const cur = route.kind === "tool" ? route.tool : null;
  const [tip, setTip] = useState<{ t: string; x: number; y: number } | null>(null);
  const show = (t: string) => (e: React.SyntheticEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ t, x: r.right + 10, y: r.top + r.height / 2 }); };
  const hide = () => setTip(null);
  const tp = (t: string) => ({ onMouseEnter: show(t), onFocus: show(t), onMouseLeave: hide, onBlur: hide });
  return (
    <div className="ps-rail" data-testid="ps-rail" onScroll={hide}>
      <button type="button" className="ps-iconbtn" onClick={onPin} aria-label={`Pin sidebar (${MOD} B)`} {...tp(`Pin sidebar · ${MOD} B`)}><Icon name="sidebar" /></button>
      <button type="button" className="ps-iconbtn" onClick={onNew} aria-label="New session" {...tp(`New session · ${MOD} ⇧ O`)}><Icon name="plus" /></button>
      <button type="button" className="ps-iconbtn" onClick={onPalette} aria-label={`Search (${MOD} K)`} {...tp(`Search · ${MOD} K`)}><Icon name="search" /></button>
      {GROUPS.map((g) => <div key={g} className="ps-rail-g" role="group" aria-label={g}>
        <span className="ps-rail-sep" aria-hidden="true" />
        {TOOLS.filter((t) => t.group === g).map((t) => <a key={t.id} href={pathFor({ kind: "tool", tool: t.id })} className="ps-rail-a" aria-current={cur === t.id ? "page" : undefined} aria-label={t.label} {...tp(`${t.label} · ${g}`)} onClick={(e) => { e.preventDefault(); hide(); go({ kind: "tool", tool: t.id }); }}><Icon name={t.id} /></a>)}
      </div>)}
      {tip && <div className="ps-tipbox" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.t}</div>}
    </div>
  );
}

function SidebarContent({ route, pinned, onPin, onPalette, onNew, theme, onTheme, onKeys, onExit, onRemoveKey, inDrawer }: { route: ProRoute; pinned: boolean; onPin: () => void; onPalette: () => void; onNew: () => void; theme: ThemePreference; onTheme: () => void; onKeys: () => void; onExit?: () => void; onRemoveKey: () => void; inDrawer?: boolean }) {
  const { ws, setWs, go, access, announce, log, info, sync } = usePro();
  const ok = hasAccess(access);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const cur = route.kind === "tool" ? route.tool : route.kind === "home" ? "home" : null;
  const groups = groupByProject(ws);
  const addProject = () => { const name = window.prompt("Project name"); if (!name?.trim()) return; setWs((w) => ({ ...w, projects: [...w.projects, { id: uid(), name: name.trim().slice(0, 80), createdAt: new Date().toISOString() }] })); log("project.create", name.trim()); announce(`Project “${name.trim()}” created`); };
  return (
    <div className="ps-side-in">
      <div className="ps-side-head">
        <a className="ps-brand" href="/pro-studio" onClick={(e) => { e.preventDefault(); go({ kind: "home" }); }}><span className="ps-logo" aria-hidden="true"><Icon name="sparkles" size={14} /></span><span>SPE <b>Pro Studio</b></span></a>
        <button type="button" className="ps-iconbtn" onClick={onPin} aria-pressed={inDrawer ? undefined : pinned} aria-label={inDrawer ? "Close menu" : pinned ? `Unpin sidebar, auto-hide (${MOD} B)` : `Pin sidebar (${MOD} B)`} title={inDrawer ? "Close menu" : pinned ? `Unpin sidebar (${MOD} B)` : `Pin sidebar (${MOD} B)`} data-testid={inDrawer ? undefined : "left-pin"}><Icon name={inDrawer ? "close" : "sidebar"} /></button>
      </div>
      <div className="ps-side-actions">
        <button type="button" className="ps-newbtn" onClick={onNew}><Icon name="plus" size={16} /> New session <kbd>{MOD} ⇧ O</kbd></button>
        <button type="button" className="ps-sidebtn" onClick={onPalette}><Icon name="search" size={16} /> Search <kbd>{MOD} K</kbd></button>
      </div>
      <nav className="ps-nav" aria-label="Pro tools">
        {GROUPS.map((g) => (
          <div key={g} className="ps-nav-group">
            <h2 className="ps-nav-h">{g}</h2>
            <ul>{TOOLS.filter((t) => t.group === g).map((t) => (
              <li key={t.id}><a href={pathFor({ kind: "tool", tool: t.id })} className="ps-nav-a" aria-current={cur === t.id ? "page" : undefined} onClick={(e) => { e.preventDefault(); go({ kind: "tool", tool: t.id }); }}>
                <Icon name={t.id} size={16} /><span>{t.label}</span>{!ok && <span className="ps-lock" aria-label="Pro only"><Icon name="lock" size={12} /></span>}{ok && t.id === "living" && <span className="ps-new">New</span>}</a></li>))}</ul>
          </div>))}
        <div className="ps-nav-group">
          <div className="ps-nav-hrow"><h2 className="ps-nav-h">Projects &amp; history</h2>{ok && <button type="button" className="ps-iconbtn ps-iconbtn--sm" onClick={addProject} aria-label="New project folder" title="New project folder"><Icon name="plus" size={14} /></button>}</div>
          {!ok ? <p className="ps-side-note">Your sessions appear here on Pro.</p> : ws.sessions.length === 0 && ws.projects.length === 0 ? <p className="ps-side-note">No sessions yet. Start one from Home.</p> : (
            groups.map(({ project, sessions }) => {
              if (!project && !sessions.length) return null;
              const key = project?.id ?? "none"; const isOpen = openGroups[key] !== false;
              return (
                <div key={key} className="ps-proj">
                  {project && <div className="ps-proj-row">
                    <button type="button" className="ps-proj-h" aria-expanded={isOpen} onClick={() => setOpenGroups((o) => ({ ...o, [key]: !isOpen }))}><Icon name="folder" size={14} /><span>{project.name}</span><span className="ps-count">{sessions.length}</span></button>
                    <button type="button" className="ps-iconbtn ps-iconbtn--sm" aria-label={`Delete project ${project.name} (sessions are kept)`} title="Delete project (sessions are kept)" onClick={() => { if (!window.confirm(`Delete project “${project.name}”? Its sessions move to “No project”.`)) return; setWs((w) => deleteProject(w, project.id)); log("project.delete", project.name); announce(`Project “${project.name}” deleted. Sessions kept.`); }}><Icon name="trash" size={13} /></button>
                  </div>}
                  {!project && ws.projects.length > 0 && <h3 className="ps-proj-sub">No project</h3>}
                  {isOpen && <ul className="ps-hist">{sessions.map((s) => <SessionRow key={s.id} s={s} />)}</ul>}
                </div>);
            })
          )}
        </div>
      </nav>
      <div className="ps-side-foot">
        <div className={`ps-acct ps-acct--${access.state}`}>
          <span className="ps-avatar" aria-hidden="true"><Icon name={access.state === "locked" ? "lock" : "releases"} size={16} /></span>
          <span className="ps-acct-t"><b>{access.label}</b><small>{access.detail}</small></span>
        </div>
        {ok && <p className="ps-sync" data-testid="ps-sync" role="status" title={info?.storage === "memory" ? "Development storage: server memory, lost on restart." : undefined}>{SYNC_TEXT[sync]}{info?.storage === "memory" && <span className="ps-sync-dev" title="Development storage: server memory, lost on restart.">Dev storage · memory</span>}</p>}
        <div className="ps-foot-row">
          <button type="button" className="ps-sidebtn" onClick={onTheme} aria-label={`Theme: ${themeLabel(theme)}. Switch theme`}><Icon name={theme === "light" ? "sun" : "moon"} size={16} /> {themeLabel(theme)}</button>
          <button type="button" className="ps-sidebtn" onClick={onKeys} aria-label="Keyboard shortcuts"><Icon name="keyboard" size={16} /> Keys</button>
          <a className="ps-sidebtn" href="/pricing">Plans</a>
          {getKey() && <button type="button" className="ps-sidebtn" onClick={onRemoveKey}>Remove key</button>}
        </div>
        <a className="ps-back" href="/" onClick={(e) => { if (onExit) { e.preventDefault(); onExit(); } }}><Icon name="back" size={14} /> Back to SPE</a>
      </div>
    </div>
  );
}

const SYNC_TEXT: Record<SyncState, string> = { loading: "Loading your workspace…", idle: "Workspace loaded from SPE Pro.", saving: "Saving…", saved: "Saved to SPE Pro.", error: "Couldn't save to SPE Pro. Changes are only on this page until the connection is back." };
function SessionRow({ s }: { s: Session }) {
  const { ws, setWs, go, announce, log } = usePro();
  const [menu, setMenu] = useState(false);
  const t = sessionTitle(s); const on = ws.activeId === s.id && window.location.pathname.endsWith("/studio");
  return (
    <li className="ps-hist-li">
      <a href="/pro-studio/studio" className="ps-hist-a" aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); setWs((w) => ({ ...w, activeId: s.id })); go({ kind: "tool", tool: "studio" }); }}><span>{t}</span></a>
      <details className="ps-hist-menu" open={menu} onToggle={(e) => setMenu((e.target as HTMLDetailsElement).open)}>
        <summary aria-label={`Options for ${t}`} className="ps-iconbtn ps-iconbtn--sm">⋯</summary>
        <div className="ps-menu" role="group" aria-label={`Options for ${t}`}>
          <button type="button" onClick={() => { const n = window.prompt("Rename session", t); if (n !== null) { setWs((w) => ({ ...w, sessions: w.sessions.map((x) => (x.id === s.id ? { ...x, title: n.trim().slice(0, 120) } : x)) })); log("session.rename", n.trim()); } setMenu(false); }}>Rename</button>
          <label className="ps-menu-sel">Move to
            <select value={s.projectId ?? ""} onChange={(e) => { const v = e.target.value || null; setWs((w) => ({ ...w, sessions: w.sessions.map((x) => (x.id === s.id ? { ...x, projectId: v } : x)) })); log("session.move", `${t} → ${ws.projects.find((p) => p.id === v)?.name ?? "No project"}`); setMenu(false); }}>
              <option value="">No project</option>{ws.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          <button type="button" className="danger" onClick={() => { if (!window.confirm(`Delete “${t}”? This cannot be undone.`)) return; setWs((w) => { const ss = w.sessions.filter((x) => x.id !== s.id); return { ...w, sessions: ss, activeId: w.activeId === s.id ? ss[0]?.id ?? null : w.activeId }; }); log("session.delete", t); announce(`Deleted “${t}”`); }}>Delete</button>
        </div>
      </details>
    </li>
  );
}

function Drawer({ open, onClose, children, label, side }: { open: boolean; onClose: () => void; children: ReactNode; label: string; side: "left" | "right" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (<dialog ref={ref} className={`ps-drawer ps-drawer--${side}`} aria-label={label} onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>{open && children}</dialog>);
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const rows: [string, string][] = [[`${MOD} K`, "Search tools, actions and sessions"], [`${MOD} ⇧ O`, "New session"], [`${MOD} B`, "Pin or unpin (auto-hide) the sidebar"], [`${MOD} I`, "Pin or unpin (auto-hide) the CoWorkie panel"], ["Screen edge", "Move the pointer to the left or right edge to reveal a hidden panel"], [`${MOD} .`, "Show or hide the output panel"], ["Alt 1–9", "Open the first nine tools"], ["?", "This list"], ["Esc", "Close dialogs and the menu"], ["Enter", "Start a session from the composer (Shift Enter for a new line)"]];
  return (
    <dialog ref={ref} className="ps-dialog" aria-labelledby="ps-keys-h" onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="ps-dialog-in"><div className="ps-dialog-head"><h2 id="ps-keys-h">Keyboard shortcuts</h2><button type="button" className="ps-iconbtn" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <table className="ps-keys"><tbody>{rows.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table></div>
    </dialog>
  );
}

const FEATURED: { id: ToolId; title: string; text: string; tag?: string }[] = [
  { id: "living", title: "Living .spe", text: "Give it a goal and protected requirements. It runs, captures crashes, repairs the prompt and stops only on proof.", tag: "Flagship" },
  { id: "studio", title: "Prompt Studio", text: "Structure a prompt into blocks, version it and export a portable .spe file." },
  { id: "blind", title: "Blind A/B", text: "Compare two prompts on the same inputs without knowing which is which." },
];
function Home() {
  const { createSession, go, ws, setWs, composer: text, setComposer: setText } = usePro();
  const slash = text.startsWith("/") ? TOOLS.filter((t) => (t.id + " " + t.label.toLowerCase()).includes(text.slice(1).trim().toLowerCase())) : [];
  const start = () => {
    const v = text.trim(); if (!v) return;
    if (v.startsWith("/")) { if (slash[0]) go({ kind: "tool", tool: slash[0].id }); return; }
    const kind = /^(you are|you're|act as)\b/i.test(v) ? "role" : "custom";
    const blocks: PlainBlock[] = [{ kind, title: kind === "role" ? "Role" : "Brief", text: v }];
    createSession(newSession(blocks)); setText("");
  };
  const recent = [...ws.sessions].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).slice(0, 4);
  const toolLink = (id: ToolId) => ({ href: pathFor({ kind: "tool", tool: id }), onClick: (e: React.MouseEvent) => { e.preventDefault(); go({ kind: "tool", tool: id }); } });
  return (
    <section className="ps-home" aria-labelledby="ps-home-h">
      <span className="ps-home-mark" aria-hidden="true"><Icon name="sparkles" size={22} /></span>
      <h1 id="ps-home-h" className="ps-home-h">What are you building today?</h1>
      <p className="ps-home-sub">Start a prompt session, or type <kbd>/</kbd> to jump to a tool.</p>
      <form className="ps-composer" onSubmit={(e) => { e.preventDefault(); start(); }}>
        <label htmlFor="ps-composer" className="sr-only">Describe the assistant or paste a prompt</label>
        <textarea id="ps-composer" rows={3} value={text} placeholder="Paste a prompt, or start with “You are…”" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); start(); } }} aria-describedby="ps-composer-hint" />
        <div className="ps-composer-bar">
          <div className="ps-composer-tools">
            <button type="button" className="ps-chip ps-chip--sm" onClick={() => setText(text.startsWith("/") ? text : "/")}><Icon name="search" size={14} />Tools</button>
            <span id="ps-composer-hint" className="ps-hint">Enter to start · Shift Enter for a new line</span>
          </div>
          <button type="submit" className="ps-send" disabled={!text.trim()} aria-label="Start session"><Icon name="send" size={16} /></button>
        </div>
        {slash.length > 0 && <ul className="ps-slash" aria-label="Matching tools">{slash.slice(0, 6).map((t) => <li key={t.id}><button type="button" onClick={() => go({ kind: "tool", tool: t.id })}><Icon name={t.id} size={16} />{t.label}<small>{t.blurb}</small></button></li>)}</ul>}
      </form>
      <div className="ps-chips" aria-label="Quick starts">
        <button type="button" className="ps-chip" onClick={() => go({ kind: "tool", tool: "blueprint" })}><Icon name="blueprint" size={14} />Design an agent team</button>
        <button type="button" className="ps-chip" onClick={() => go({ kind: "tool", tool: "batch" })}><Icon name="batch" size={14} />Batch from CSV</button>
        <button type="button" className="ps-chip" onClick={() => go({ kind: "tool", tool: "scanner" })}><Icon name="scanner" size={14} />Scan for secrets</button>
        <button type="button" className="ps-chip" onClick={() => go({ kind: "tool", tool: "regression" })}><Icon name="regression" size={14} />Run regression tests</button>
      </div>
      <div className="ps-home-sec"><h2>Start with</h2>
        <div className="ps-feature">{FEATURED.map((f) => <a key={f.id} className={`ps-card${f.tag ? " ps-card--hero" : ""}`} {...toolLink(f.id)}>
          <span className="ps-card-i" aria-hidden="true"><Icon name={f.id} size={18} /></span>
          <b>{f.title}{f.tag && <span className="ps-new">{f.tag}</span>}</b><small>{f.text}</small>
          <span className="ps-card-go" aria-hidden="true"><Icon name="right" size={16} /></span></a>)}</div>
      </div>
      {recent.length > 0 && (<div className="ps-home-sec ps-recent"><h2>Recent sessions</h2><ul>{recent.map((s) => <li key={s.id}><button type="button" onClick={() => { setWs((w) => ({ ...w, activeId: s.id })); go({ kind: "tool", tool: "studio" }); }}><Icon name="chat" size={16} /><span>{sessionTitle(s)}</span><small>{s.blocks.length} blocks</small></button></li>)}</ul></div>)}
      <div className="ps-home-sec"><h2>All tools</h2>
        <nav className="ps-alltools" aria-label="All Pro tools">{TOOLS.map((t) => <a key={t.id} {...toolLink(t.id)}><span className="ps-card-i" aria-hidden="true"><Icon name={t.id} size={15} /></span><b>{t.label}</b><small>{t.blurb}</small></a>)}</nav>
      </div>
      <p className="ps-home-foot"><Icon name="shield" size={12} /> Tools run on the SPE Pro service. Model runs use your own provider key; SPE never pays for or stores it.</p>
    </section>
  );
}

export function ProGate({ access, tool, onRecheck }: { access: Access; tool: ToolId | null; onRecheck: () => void | Promise<void> }) {
  const t = tool ? toolById(tool) : null;
  const [k, setK] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => { const v = k.trim(); if (!v) return; setBusy(true); setKey(v); setK(""); await onRecheck(); setBusy(false); };
  return (
    <section className="ps-gate" aria-labelledby="ps-gate-h" data-testid="pro-gate">
      <span className="ps-gate-i" aria-hidden="true"><Icon name="lock" size={22} /></span>
      <h1 id="ps-gate-h">{access.state === "offline" ? "Pro Studio is an online service" : t ? `${t.label} is a Pro tool` : "Pro Studio is for Pro and Team plans"}</h1>
      <p role={access.reason && access.reason !== "MISSING_KEY" ? "alert" : undefined} data-testid="gate-reason">{access.detail}</p>
      {access.state !== "offline" ? (
        <form className="ps-gate-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label htmlFor="ps-key">Pro access key</label>
          <div className="ps-row">
            <input id="ps-key" className="ps-inp ps-mono" type="password" autoComplete="off" spellCheck={false} value={k} onChange={(e) => setK(e.target.value)} placeholder="spe_pro.v1.…" aria-describedby="ps-key-hint" />
            <button type="submit" className="ps-btn ps-btn--primary" disabled={!k.trim() || busy}>{busy ? "Checking…" : "Unlock"}</button>
          </div>
          <small id="ps-key-hint" className="ps-hint">No account or password. The SPE Pro service checks the key's signature, expiry and revocation on every request. The key is kept in this browser until you remove it.</small>
        </form>
      ) : <button type="button" className="ps-btn ps-btn--primary" onClick={() => void onRecheck()}>Try again</button>}
      <details className="ps-details"><summary>What's included ({TOOLS.length} tools)</summary>
      <ul className="ps-gate-list">{TOOLS.map((x) => <li key={x.id}><Icon name={x.id} size={16} /><span><b>{x.label}</b> — {x.blurb}</span></li>)}</ul></details>
      <div className="ps-gate-cta"><a className="ps-btn" href="/pricing">See plans</a></div>
      <p className="ps-fine">Pro Studio never takes payment. Keys are not on sale yet.</p>
    </section>
  );
}

function NotFoundState({ segment }: { segment: string }) {
  const { go } = usePro();
  return (<section className="ps-empty" aria-labelledby="ps-nf-h"><h1 id="ps-nf-h">No Pro tool called “{segment}”</h1><p>Pick a tool from the sidebar, or go back to Home.</p><button type="button" className="ps-btn ps-btn--primary" onClick={() => go({ kind: "home" })}>Go to Home</button></section>);
}

class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return (<section className="ps-empty" role="alert"><h1>This tool hit an error</h1><p>Your saved work is on the SPE Pro server. Reload to try again.</p><pre className="ps-pre">{this.state.err.message}</pre><button type="button" className="ps-btn" onClick={() => this.setState({ err: null })}>Try again</button></section>);
    return this.props.children;
  }
}
