import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons.tsx";
export interface PaletteItem { id: string; label: string; group: string; hint?: string; keywords?: string; icon?: string; run: () => void }
/** Scores a query against an item: every query word must appear; label hits rank above keyword hits. Exported for tests. */
export function scoreItem(q: string, it: Pick<PaletteItem, "label" | "keywords" | "group">): number {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean); if (!words.length) return 1;
  const label = it.label.toLowerCase(), hay = `${label} ${it.group.toLowerCase()} ${(it.keywords ?? "").toLowerCase()}`;
  let s = 0; for (const w of words) { if (!hay.includes(w)) return 0; s += label.startsWith(w) ? 4 : label.includes(w) ? 2 : 1; } return s;
}
export function filterItems<T extends PaletteItem>(q: string, items: T[]): T[] {
  return items.map((it, i) => ({ it, i, s: scoreItem(q, it) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.it);
}
export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const ref = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(""); const [idx, setIdx] = useState(0);
  const list = useMemo(() => filterItems(q, items), [q, items]);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) { setQ(""); setIdx(0); d.showModal(); requestAnimationFrame(() => input.current?.focus()); } if (!open && d.open) d.close(); }, [open]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { document.getElementById(`ps-opt-${list[idx]?.id}`)?.scrollIntoView({ block: "nearest" }); }, [idx, list]);
  const run = (it?: PaletteItem) => { if (!it) return; onClose(); setTimeout(it.run, 0); };
  let lastGroup = "";
  return (
    <dialog ref={ref} className="ps-dialog ps-cmdk" aria-label="Command palette" onClose={onClose} onCancel={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="ps-cmdk-in">
        <div className="ps-cmdk-bar"><Icon name="search" size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls="ps-cmdk-list" aria-autocomplete="list" aria-activedescendant={list[idx] ? `ps-opt-${list[idx].id}` : undefined} aria-label="Search tools, actions and sessions" placeholder="Search tools, actions and sessions…"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => (list.length ? (i + 1) % list.length : 0)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => (list.length ? (i - 1 + list.length) % list.length : 0)); }
              else if (e.key === "Home") { e.preventDefault(); setIdx(0); } else if (e.key === "End") { e.preventDefault(); setIdx(Math.max(0, list.length - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(list[idx]); }
            }} />
          <kbd>Esc</kbd></div>
        <ul id="ps-cmdk-list" role="listbox" aria-label="Results" className="ps-cmdk-list">
          {list.length === 0 && <li className="ps-cmdk-empty" role="presentation">No matches for “{q}”.</li>}
          {list.map((it, i) => { const head = it.group !== lastGroup ? it.group : null; lastGroup = it.group; return (
            <li key={it.id} role="presentation">
              {head && <div className="ps-cmdk-g" role="presentation" aria-hidden="true">{head}</div>}
              <div id={`ps-opt-${it.id}`} role="option" aria-selected={i === idx} className="ps-cmdk-opt" onMouseMove={() => setIdx(i)} onClick={() => run(it)}>
                <Icon name={it.icon ?? (it.group === "Actions" ? "send" : it.group === "View" ? "panel" : it.group === "Help" ? "keyboard" : "home")} size={16} /><span>{it.label}</span><span className="sr-only">, {it.group}</span>{it.hint && <kbd>{it.hint}</kbd>}
              </div>
            </li>); })}
        </ul>
        <div className="ps-cmdk-foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
      </div>
    </dialog>
  );
}
