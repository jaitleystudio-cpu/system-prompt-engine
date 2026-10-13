// Prompt Regression Lab — pure logic (no DOM, no network). PREVIEW ONLY.
export type Format = "any" | "json" | "bullets";
export interface TestCase { id: string; name: string; input: string; mustInclude: string[]; mustNotInclude: string[]; format: Format; maxWords: number | null; }
export interface Check { kind: string; detail: string; pass: boolean; }
export interface CaseResult { id: string; name: string; output: string; pass: boolean; checks: Check[]; }
export type Change = "fixed" | "regressed" | "still-pass" | "still-fail" | "new" | "removed";
export interface DiffRow { id: string; name: string; a: CaseResult | null; b: CaseResult | null; change: Change; }
export interface DiffReport { rows: DiffRow[]; counts: Record<Change, number>; passA: number; passB: number; total: number; }

export function splitList(s: string): string[] { return s.split(",").map((x) => x.trim()).filter(Boolean); }

/** Parse the tiny directive grammar the DEMO runner understands. */
export function parseDirectives(prompt: string) {
  const include: string[] = [], never: string[] = []; let format: Format = "any"; let maxWords: number | null = null;
  for (const raw of prompt.split(/\r?\n/)) {
    const line = raw.trim(); let m: RegExpMatchArray | null;
    if ((m = line.match(/^always include:\s*(.+)$/i))) include.push(m[1].trim());
    else if ((m = line.match(/^never say:\s*(.+)$/i))) never.push(...splitList(m[1]));
    else if ((m = line.match(/^format:\s*(json|bullets)\s*$/i))) format = m[1].toLowerCase() as Format;
    else if ((m = line.match(/^max words:\s*(\d+)\s*$/i))) maxWords = Math.max(1, parseInt(m[1], 10));
  }
  return { include, never, format, maxWords };
}

/**
 * SIMULATED model. Deterministic, local, no AI. It exists so the report UI can be judged.
 * It writes a canned reply, and (like an unconstrained model) adds a refund promise when the user mentions refunds.
 */
export function simulateResponse(prompt: string, input: string): string {
  const d = parseDirectives(prompt);
  let sentences = [`Here is help with: ${input.trim().replace(/[.?!]+$/, "")}.`];
  if (/refund/i.test(input)) sentences.push("We will refund you in full today.");
  sentences.push("Let me know if you need anything else.");
  for (const inc of d.include) sentences.push(inc.endsWith(".") ? inc : inc + ".");
  if (d.never.length) sentences = sentences.filter((s) => !d.never.some((n) => s.toLowerCase().includes(n.toLowerCase())));
  if (d.maxWords) {
    const words = sentences.join(" ").split(/\s+/).filter(Boolean).slice(0, d.maxWords);
    sentences = [words.join(" ")];
  }
  if (d.format === "json") return JSON.stringify({ answer: sentences.join(" ") });
  if (d.format === "bullets") return sentences.map((s) => "- " + s).join("\n");
  return sentences.join(" ");
}

export function countWords(s: string): number { return s.split(/\s+/).filter(Boolean).length; }

export function evaluate(output: string, tc: TestCase): CaseResult {
  const lo = output.toLowerCase(); const checks: Check[] = [];
  for (const t of tc.mustInclude) checks.push({ kind: "must include", detail: t, pass: lo.includes(t.toLowerCase()) });
  for (const t of tc.mustNotInclude) checks.push({ kind: "must not include", detail: t, pass: !lo.includes(t.toLowerCase()) });
  if (tc.format === "json") { let ok = true; try { JSON.parse(output); } catch { ok = false; } checks.push({ kind: "format", detail: "valid JSON", pass: ok }); }
  if (tc.format === "bullets") { const lines = output.split(/\r?\n/).filter((l) => l.trim()); checks.push({ kind: "format", detail: "every line is a bullet", pass: lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l)) }); }
  if (tc.maxWords != null) { const n = countWords(output); checks.push({ kind: "max words", detail: `${n} of ${tc.maxWords}`, pass: n <= tc.maxWords }); }
  return { id: tc.id, name: tc.name, output, pass: checks.every((c) => c.pass), checks };
}

export function runSuite(prompt: string, cases: TestCase[], runner: (p: string, i: string) => string = simulateResponse): CaseResult[] {
  return cases.map((tc) => evaluate(runner(prompt, tc.input), tc));
}

export function diffReports(a: CaseResult[], b: CaseResult[]): DiffReport {
  const counts: Record<Change, number> = { fixed: 0, regressed: 0, "still-pass": 0, "still-fail": 0, new: 0, removed: 0 };
  const byA = new Map(a.map((r) => [r.id, r])), byB = new Map(b.map((r) => [r.id, r]));
  const ids = [...new Set([...a.map((r) => r.id), ...b.map((r) => r.id)])];
  const rows: DiffRow[] = ids.map((id) => {
    const ra = byA.get(id) ?? null, rb = byB.get(id) ?? null; let change: Change;
    if (!ra) change = "new"; else if (!rb) change = "removed";
    else if (ra.pass && rb.pass) change = "still-pass"; else if (!ra.pass && !rb.pass) change = "still-fail";
    else change = rb.pass ? "fixed" : "regressed";
    counts[change]++; return { id, name: (rb ?? ra)!.name, a: ra, b: rb, change };
  });
  return { rows, counts, passA: a.filter((r) => r.pass).length, passB: b.filter((r) => r.pass).length, total: ids.length };
}
