/**
 * Opt-in local history — local-first, no accounts required.
 * Disabled by default. Service worker never sees these bodies.
 */

export const HISTORY_OPT_IN_KEY = "spe.web.history.opt_in.v1";
export const HISTORY_ITEMS_KEY = "spe.web.history.items.v1";

export type HistoryItem = {
  id: string;
  saved_at_utc: string;
  user_request: string;
  category: string;
  target: string;
  prompt_preview: string;
};

export function isHistoryOptIn(): boolean {
  try {
    return localStorage.getItem(HISTORY_OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHistoryOptIn(on: boolean): void {
  localStorage.setItem(HISTORY_OPT_IN_KEY, on ? "1" : "0");
  if (!on) clearHistory();
}

export function loadHistory(): HistoryItem[] {
  if (!isHistoryOptIn()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: HistoryItem): void {
  if (!isHistoryOptIn()) return;
  const prev = loadHistory().filter((x) => x.id !== item.id);
  const next = [item, ...prev].slice(0, 50);
  localStorage.setItem(HISTORY_ITEMS_KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_ITEMS_KEY);
}

export function exportHistory(): HistoryItem[] {
  return loadHistory();
}

export function importHistory(items: HistoryItem[]): void {
  if (!isHistoryOptIn()) return;
  const merged = [...items, ...loadHistory()];
  const seen = new Set<string>();
  const out: HistoryItem[] = [];
  for (const it of merged) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  localStorage.setItem(HISTORY_ITEMS_KEY, JSON.stringify(out.slice(0, 50)));
}
