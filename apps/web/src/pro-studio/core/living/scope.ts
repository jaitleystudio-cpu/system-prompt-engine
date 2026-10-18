// Scoped repair guard for the Living loop.
//
// After a run crashes, the next prompt (V2) must (1) keep every protected requirement frozen, (2) point at the
// exact failing call-site taken from the real error (line and expression), and (3) add negative constraints
// derived from the error class plus a hard scope rule. The constraints alone prove nothing, so after V2 runs
// the guard VERIFIES the change: it diffs the crashing code (baseline) against the new code and rejects the
// attempt as drift when edits land outside the pinned region beyond a small allowance, when imports or
// libraries change, when styling changes, when declared features disappear, or when a requirement that used
// to pass now fails. Everything here is deterministic and re-runnable from the recorded evidence.
import type { ExecEvidence } from "./types.ts";

export interface CallSite { line: number; col?: number; expression: string; source: "stack" | "search" }
export interface DriftPolicy { window: number; allowance: number }
export const DRIFT_POLICY: DriftPolicy = { window: 2, allowance: 8 };
export interface DriftReport {
  linesBefore: number; linesAfter: number; added: number; removed: number; changed: number;
  touchedRegions: { start: number; end: number; inPin: boolean }[]; outsidePin: number; allowance: number;
  importsAdded: string[]; importsRemoved: string[]; stylingChanged: string[]; featuresRemoved: string[];
  ok: boolean; reasons: string[];
}
export interface ScopeReport {
  verdict: "ACCEPTED" | "REJECTED_DRIFT";
  baseline: { attempt: number; codeSha: string; code: string; error: string };
  pin: CallSite | null; drift: DriftReport;
  /** Requirements other than the execution check: status in the baseline attempt vs now. */
  preserved: { reqId: string; before: string; now: string }[]; regressions: string[];
}

export const SCOPE_RULE = "MUST NOT touch working UI, layout, styling or libraries. ONLY modify the broken expression. Preserve all props, features, imports and existing behaviour.";
export const FREEZE_RULE = "The goal and every protected requirement above stay exactly as written (frozen); this fix must not change them.";

const BROWSER_GLOBALS = ["window", "document", "localStorage", "sessionStorage", "navigator", "location", "requestAnimationFrame", "HTMLElement"];

/** Finds the failing call-site: first the line from the real stack trace, else the first line using the failing name. */
export function pinCallSite(error: string, code: string, sites?: ExecEvidence["sites"]): CallSite | null {
  const lines = code.split("\n");
  const s = sites?.find((x) => x.line >= 1 && x.line <= lines.length);
  if (s) return { line: s.line, col: s.col, expression: lines[s.line - 1].trim().slice(0, 200), source: "stack" };
  const name = failingName(error); if (!name) return null;
  const re = new RegExp(`(^|[^\\w$.])${name.replace(/[$.]/g, (c) => "\\" + c)}([^\\w$]|$)`);
  const i = lines.findIndex((l) => re.test(l) || (name.startsWith(".") && l.includes(name)));
  return i >= 0 ? { line: i + 1, expression: lines[i].trim().slice(0, 200), source: "search" } : null;
}
function failingName(error: string): string | null {
  let m = /ReferenceError: ([A-Za-z_$][\w$]*) is not defined/.exec(error); if (m) return m[1];
  m = /Cannot read propert(?:y|ies) of (?:undefined|null) \(reading '([^']+)'\)/.exec(error); if (m) return "." + m[1];
  m = /TypeError: ([\w$.]+) is not a function/.exec(error); if (m) return m[1];
  m = /does not provide an export named '([^']+)'/.exec(error); if (m) return m[1];
  return null;
}

/** Targeted negative constraints derived from the class of the real error. */
export function errorClassConstraints(error: string): string[] {
  const out: string[] = []; const e = error;
  const ref = /ReferenceError: ([A-Za-z_$][\w$]*) is not defined/.exec(e);
  if (ref && BROWSER_GLOBALS.includes(ref[1])) out.push(`MUST NOT use \`${ref[1]}\` during server-side rendering. Guard it with \`typeof ${ref[1]} !== "undefined"\` or move it into client-only code.`);
  else if (ref) out.push(`MUST NOT reference \`${ref[1]}\` before it is declared and initialised.`);
  if (/does not provide an export named|default export|is not a constructor|\.default is not a function|Element type is invalid/i.test(e)) out.push("MUST NOT switch between default and named imports blindly: import exactly what the module exports (default vs named).");
  if (/Rendered (?:more|fewer) hooks|Invalid hook call|called conditionally|change in the order of Hooks/i.test(e)) out.push("MUST NOT call React hooks conditionally, inside loops or after an early return; call them unconditionally at the top level of the component.");
  const prop = /Cannot read propert(?:y|ies) of (undefined|null) \(reading '([^']+)'\)/.exec(e);
  if (prop) out.push(`MUST NOT read \`.${prop[2]}\` from a value that can be ${prop[1]}; check it exists first.`);
  const fn = /TypeError: ([\w$.]+) is not a function/.exec(e);
  if (fn) out.push(`MUST NOT call \`${fn[1]}\` unless it is a function.`);
  if (/^SyntaxError/.test(e)) out.push("MUST NOT output code that does not parse.");
  return out;
}

/** The V2 clause for a crash: real error, pinned call-site, error-class constraints, scope rule, freeze rule. */
export function scopedRepairText(baseClause: string, error: string, pin: CallSite | null): string {
  const parts = [baseClause];
  if (pin) parts.push(`The failing call-site is line ${pin.line}${pin.col ? `, column ${pin.col}` : ""}: \`${pin.expression}\`. Fix that expression.`);
  for (const c of errorClassConstraints(error)) if (!baseClause.includes(c)) parts.push(c);
  parts.push(SCOPE_RULE, FREEZE_RULE);
  return parts.join(" ");
}

// ---------- drift verification ----------
type Op = { t: "=" | "-" | "+"; a: number; b: number };
/** Line diff (LCS). a/b are 1-based line numbers in the old/new code. */
function diffLines(A: string[], B: string[]): Op[] {
  const n = A.length, m = B.length;
  if (n * m > 4_000_000) return [...A.map((_, i): Op => ({ t: "-", a: i + 1, b: 0 })), ...B.map((_, j): Op => ({ t: "+", a: n, b: j + 1 }))];
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops: Op[] = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { ops.push({ t: "=", a: i + 1, b: j + 1 }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { ops.push({ t: "-", a: i + 1, b: j }); i++; } else { ops.push({ t: "+", a: i, b: j + 1 }); j++; } }
  while (i < n) { ops.push({ t: "-", a: i + 1, b: m }); i++; }
  while (j < m) { ops.push({ t: "+", a: n, b: j + 1 }); j++; }
  return ops;
}
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const IMPORT_RE = /^\s*import\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)|<script[^>]*\ssrc=["']([^"']+)["']|<link[^>]*\shref=["']([^"']+\.css[^"']*)["']/g;
export function importsOf(code: string): string[] { const s = new Set<string>(); for (const m of code.matchAll(IMPORT_RE)) s.add(m[1] || m[2] || m[3] || m[4] || m[5]); return [...s].sort(); }
const STYLE_RE = /\bstyle\s*[=.:{]|\.style\b|className\s*=|\bclass\s*=|<style|\bcss`|styled\.|\b(?:color|background|font(?:-\w+)?|margin|padding|border|display|flex|grid|width|height|gap|opacity|transform)\s*:/i;
const FEATURE_RE = /\b(?:function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=|export\s+(?:default\s+)?(?:function|class|const)\s+([A-Za-z_$][\w$]*))|\bid\s*=\s*\\?["']([\w-]+)\\?["']|\.id\s*=\s*["']([\w-]+)["']/g;
export function featuresOf(code: string): string[] { const s = new Set<string>(); for (const m of code.matchAll(FEATURE_RE)) { const v = m.slice(1).find(Boolean); if (v) s.add(m[5] || m[6] ? `#${v}` : v); } return [...s].sort(); }

/** Verifies that the change from the crashing code to the new code stays inside the pinned region. */
export function driftCheck(before: string, after: string, pin: CallSite | null, policy: DriftPolicy = DRIFT_POLICY): DriftReport {
  const A = before.split("\n"), B = after.split("\n");
  const ops = diffLines(A.map(norm), B.map(norm));
  const lo = pin ? pin.line - policy.window : -Infinity, hi = pin ? pin.line + policy.window : Infinity;
  const inPin = (a: number) => a >= lo && a <= hi;
  const regions: DriftReport["touchedRegions"] = []; let outside = 0, added = 0, removed = 0, atPin = 0;
  const changedText: string[] = [];
  let cur: { start: number; end: number; inPin: boolean } | null = null;
  for (const o of ops) {
    if (o.t === "=") { cur = null; continue; }
    if (o.t === "+") { added++; changedText.push(B[o.b - 1]); } else { removed++; changedText.push(A[o.a - 1]); }
    const at = Math.max(1, o.a); const pinned = pin ? inPin(at) : false;
    if (norm(o.t === "+" ? B[o.b - 1] : A[o.a - 1])) { if (pinned) atPin++; else outside++; }
    if (cur && cur.inPin === pinned && at <= cur.end + 1) cur.end = Math.max(cur.end, at); else { cur = { start: at, end: at, inPin: pinned }; regions.push(cur); }
  }
  // The pinned region holds 2*window+1 lines; rewriting it (removed + added) may touch twice that. Anything
  // beyond, even if inserted right at the call-site, counts as outside the region.
  const pinRoom = 2 * (2 * policy.window + 1); if (atPin > pinRoom) outside += atPin - pinRoom;
  const ib = importsOf(before), ia = importsOf(after);
  const importsAdded = ia.filter((x) => !ib.includes(x)), importsRemoved = ib.filter((x) => !ia.includes(x));
  const stylingChanged = ops.filter((o) => o.t !== "=" && !(pin && inPin(Math.max(1, o.a)))).map((o) => (o.t === "+" ? B[o.b - 1] : A[o.a - 1])).filter((l) => STYLE_RE.test(l)).map((l) => l.trim().slice(0, 120)).slice(0, 10);
  const fa = featuresOf(after); const featuresRemoved = featuresOf(before).filter((f) => !fa.includes(f));
  const reasons: string[] = [];
  if (!pin) reasons.push("The failing call-site could not be pinned, so the change cannot be confined; treated as unscoped.");
  if (outside > policy.allowance) reasons.push(`${outside} changed lines fall outside the pinned region (allowance ${policy.allowance}).`);
  if (importsAdded.length || importsRemoved.length) reasons.push(`Imports or libraries changed (${[...importsAdded.map((x) => "+" + x), ...importsRemoved.map((x) => "−" + x)].join(", ")}).`);
  if (stylingChanged.length) reasons.push(`Styling changed outside the pinned region (${stylingChanged.length} line${stylingChanged.length > 1 ? "s" : ""}).`);
  if (featuresRemoved.length) reasons.push(`Features removed: ${featuresRemoved.join(", ")}.`);
  return { linesBefore: A.length, linesAfter: B.length, added, removed, changed: added + removed, touchedRegions: regions.slice(0, 50), outsidePin: outside, allowance: policy.allowance, importsAdded, importsRemoved, stylingChanged, featuresRemoved, ok: reasons.length === 0, reasons };
}

export function driftRepairText(r: ScopeReport): string {
  const where = r.pin ? `line ${r.pin.line}: \`${r.pin.expression}\`` : "the failing expression";
  return `Your last fix ran, but it was rejected as drift: ${r.drift.reasons.join(" ")} Start again from the earlier code and change ONLY ${where}. ${SCOPE_RULE}`;
}
