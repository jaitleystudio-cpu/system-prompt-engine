// Batch fill: one rendered prompt per CSV row. Rendering only; no model is called.
import { findVars, filled } from "./studio.ts";
export const MAX_ROWS = 5000;

/** RFC 4180-style CSV parser: quoted fields, doubled quotes, CRLF/LF, commas inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let f = ""; let q = false; let i = 0;
  const s = text.replace(/^\uFEFF/, "");
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
      f += c; i++; continue;
    }
    if (c === '"' && f === "") { q = true; i++; continue; }
    if (c === ",") { row.push(f); f = ""; i++; continue; }
    if (c === "\r" || c === "\n") { row.push(f); f = ""; rows.push(row); row = []; if (c === "\r" && s[i + 1] === "\n") i++; i++; continue; }
    f += c; i++;
  }
  if (q) throw new Error("A quoted field is never closed.");
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
export const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(rows: string[][]): string { return rows.map((r) => r.map(csvCell).join(",")).join("\n"); }

export interface BatchRow { index: number; values: Record<string, string>; output: string; missing: string[] }
export interface BatchResult { headers: string[]; vars: string[]; unusedColumns: string[]; rows: BatchRow[]; complete: number }

export function batchFill(template: string, csv: string): BatchResult {
  const table = parseCsv(csv);
  if (!table.length) throw new Error("The CSV is empty.");
  const headers = table[0].map((h) => h.trim());
  if (headers.some((h) => !/^[a-zA-Z0-9_]+$/.test(h))) throw new Error("Header names must use letters, digits or _ only, to match {{name}} variables.");
  if (new Set(headers).size !== headers.length) throw new Error("Two columns have the same header.");
  const body = table.slice(1);
  if (body.length > MAX_ROWS) throw new Error(`Too many rows (${body.length}). The limit is ${MAX_ROWS}.`);
  const vars = findVars(template).map(([n]) => n);
  const rows = body.map((r, i) => {
    const values: Record<string, string> = {}; headers.forEach((h, j) => { values[h] = (r[j] ?? "").trim(); });
    const missing = vars.filter((v) => !values[v]);
    return { index: i + 1, values, output: filled(template, values), missing };
  });
  return { headers, vars, unusedColumns: headers.filter((h) => !vars.includes(h)), rows, complete: rows.filter((r) => !r.missing.length).length };
}
export function batchToJsonl(r: BatchResult): string { return r.rows.map((x) => JSON.stringify({ row: x.index, prompt: x.output, missing: x.missing })).join("\n"); }
