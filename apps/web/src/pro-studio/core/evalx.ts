// Evaluation extras: per-group breakdowns (no hiding behind an average) and blind A/B with random order.
export type RowStatus = "VERIFIED" | "FAILED" | "UNPROVEN" | "NOT_RUN" | "HUMAN_PASS" | "HUMAN_FAIL";
export interface Row { category?: string; language?: string; status: RowStatus }
export interface Group { group: string; n: number; pass: number; fail: number; unproven: number; notRun: number; passRate: number; smallSample: boolean }
export const SMALL_SAMPLE = 5;
export function breakdown(rows: Row[], by: "category" | "language"): Group[] {
  const m = new Map<string, Group>();
  for (const r of rows) {
    const k = (r[by] ?? "").trim() || "(none)";
    const g = m.get(k) ?? { group: k, n: 0, pass: 0, fail: 0, unproven: 0, notRun: 0, passRate: 0, smallSample: true };
    g.n++; if (r.status === "VERIFIED" || r.status === "HUMAN_PASS") g.pass++; else if (r.status === "FAILED" || r.status === "HUMAN_FAIL") g.fail++; else if (r.status === "UNPROVEN") g.unproven++; else g.notRun++;
    m.set(k, g);
  }
  return [...m.values()].map((g) => ({ ...g, passRate: g.n ? g.pass / g.n : 0, smallSample: g.n < SMALL_SAMPLE })).sort((a, b) => a.passRate - b.passRate || b.n - a.n || a.group.localeCompare(b.group));
}
export interface BlindView { caseId: string; x: string; y: string }
export interface BlindMap { caseId: string; xIs: "A" | "B" }
export function createBlind(cases: { id: string }[], outA: string[], outB: string[], rand: () => number): { view: BlindView[]; mapping: BlindMap[] } {
  const view: BlindView[] = []; const mapping: BlindMap[] = [];
  cases.forEach((c, i) => { const aFirst = rand() < 0.5; view.push({ caseId: c.id, x: aFirst ? outA[i] : outB[i], y: aFirst ? outB[i] : outA[i] }); mapping.push({ caseId: c.id, xIs: aFirst ? "A" : "B" }); });
  return { view, mapping };
}
export function revealBlind(mapping: BlindMap[], picks: Record<string, string>) {
  const totals = { A: 0, B: 0, tie: 0, unpicked: 0 };
  const rows = mapping.map((m) => {
    const p = picks[m.caseId]; let winner: "A" | "B" | "tie" | "unpicked";
    if (p === "tie") winner = "tie"; else if (p === "x") winner = m.xIs; else if (p === "y") winner = m.xIs === "A" ? "B" : "A"; else winner = "unpicked";
    totals[winner]++; return { caseId: m.caseId, xIs: m.xIs, pick: p ?? null, winner };
  });
  return { rows, totals };
}
/** Crypto-random number in [0,1). */
export const cryptoRand = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] / 2 ** 32; };
