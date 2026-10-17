// VERIFIER (independent of the builder). Deterministic checks only. Nothing a model says about itself
// ("done", "all requirements met") is ever evidence; only these checks can produce VERIFIED.
// This module must not import compile.ts or loop.ts.
import type { Check, CheckResult, ExecEvidence, Requirement, Run, Status } from "./types.ts";
export const VERIFIER_ID = "spe-deterministic-verifier/1";
const enc = new TextEncoder();
export async function sha256Hex(s: string): Promise<string> { const d = await crypto.subtle.digest("SHA-256", enc.encode(s)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const norm = (s: string, cs?: boolean) => (cs ? s : s.toLowerCase());
const short = (s: string, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
function safeRe(src: string, flags: string): RegExp | null { if (src.length > 500) return null; try { return new RegExp(src, flags); } catch { return null; } }
function stripFence(s: string) { return s.trim(); } // JSON must be raw: code fences are a FORMAT failure, by design.

/** The code the harness should execute: the first fenced code block, otherwise the whole output. */
export function extractCode(output: string): string {
  const m = /```[ \t]*(?:js|javascript|jsx|mjs|html)?[ \t]*\r?\n([\s\S]*?)```/i.exec(output ?? "");
  return (m ? m[1] : output ?? "").trim();
}
export const firstExecError = (x: ExecEvidence | undefined): string => (x ? x.errors[0] ?? (x.consoleErrors[0] ? `console.error: ${x.consoleErrors[0]}` : "") : "");
function execCheck(c: Check, x: ExecEvidence | undefined): { status: Status; evidence: string } {
  if (!x) return { status: "NOT_RUN", evidence: "Not executed: no sandbox ran this output, so it is not a pass." };
  const err = firstExecError(x);
  if (err) return { status: "FAILED", evidence: `Crashed in ${x.engine}: ${short(err, 300)}` };
  if (c.value && !norm(x.rendered, c.caseSensitive).includes(norm(c.value, c.caseSensitive))) return { status: "FAILED", evidence: `Ran without errors in ${x.engine}, but the rendered output does not show “${short(c.value)}”.` };
  return { status: "VERIFIED", evidence: `Executed in ${x.engine}: 0 runtime errors, 0 console errors${c.value ? `, renders “${short(c.value)}”` : ""} (${x.ms} ms).` };
}

export function runCheck(c: Check, output: string, exec?: ExecEvidence): { status: Status; evidence: string } {
  const out = output ?? ""; const v = c.value ?? ""; const n = Number(c.n);
  const P = (e: string) => ({ status: "VERIFIED" as Status, evidence: e }); const F = (e: string) => ({ status: "FAILED" as Status, evidence: e });
  switch (c.kind) {
    case "contains": if (!v) return F("Check has no text to look for."); return norm(out, c.caseSensitive).includes(norm(v, c.caseSensitive)) ? P(`Found “${short(v)}”.`) : F(`“${short(v)}” not found in the output.`);
    case "not_contains": if (!v) return F("Check has no text to look for."); return norm(out, c.caseSensitive).includes(norm(v, c.caseSensitive)) ? F(`Forbidden text “${short(v)}” found.`) : P(`“${short(v)}” is absent.`);
    case "regex": case "not_regex": {
      const re = safeRe(v, c.caseSensitive ? "m" : "im"); if (!re) return F(`Invalid or too long pattern: ${short(v)}`);
      const hit = re.test(out); return c.kind === "regex" ? (hit ? P(`Pattern /${short(v)}/ matched.`) : F(`Pattern /${short(v)}/ did not match.`)) : (hit ? F(`Forbidden pattern /${short(v)}/ matched.`) : P(`Pattern /${short(v)}/ absent.`));
    }
    case "json_valid": try { JSON.parse(stripFence(out)); return P("Output parses as JSON."); } catch { return F("Output is not valid JSON (prose or code fences around JSON count as invalid)."); }
    case "json_keys": {
      let d: unknown; try { d = JSON.parse(stripFence(out)); } catch { return F("Output is not valid JSON."); }
      if (!d || typeof d !== "object" || Array.isArray(d)) return F("Output is JSON but not an object.");
      const missing = (c.keys ?? []).filter((k) => !(k in (d as Record<string, unknown>))); return missing.length ? F(`Missing keys: ${missing.join(", ")}.`) : P(`All ${(c.keys ?? []).length} keys present.`);
    }
    case "max_words": if (!(n >= 0)) return F("Check has no word limit."); return words(out) <= n ? P(`${words(out)} words ≤ ${n}.`) : F(`${words(out)} words > ${n}.`);
    case "min_words": if (!(n >= 0)) return F("Check has no word minimum."); return words(out) >= n ? P(`${words(out)} words ≥ ${n}.`) : F(`${words(out)} words < ${n}.`);
    case "max_chars": if (!(n >= 0)) return F("Check has no character limit."); return out.length <= n ? P(`${out.length} characters ≤ ${n}.`) : F(`${out.length} characters > ${n}.`);
    case "starts_with": if (!v) return F("Check has no text."); return norm(out.trimStart(), c.caseSensitive).startsWith(norm(v, c.caseSensitive)) ? P(`Starts with “${short(v)}”.`) : F(`Does not start with “${short(v)}”.`);
    case "ends_with": if (!v) return F("Check has no text."); return norm(out.trimEnd(), c.caseSensitive).endsWith(norm(v, c.caseSensitive)) ? P(`Ends with “${short(v)}”.`) : F(`Does not end with “${short(v)}”.`);
    case "line_count_max": { if (!(n >= 1)) return F("Check has no line limit."); const l = out.trim() ? out.trim().split("\n").length : 0; return l <= n ? P(`${l} lines ≤ ${n}.`) : F(`${l} lines > ${n}.`); }
    case "manual": return { status: "UNPROVEN", evidence: "No automatic check. Needs a human review." };
    case "runs_clean": return execCheck(c, exec);
    default: return F(`Unknown check kind.`);
  }
}

/** Runs every requirement's check on every run. A run with a provider error has NOT_RUN results. */
export function verifyRuns(reqs: Requirement[], runs: Run[]): CheckResult[] {
  const out: CheckResult[] = [];
  for (const r of runs) for (const q of reqs) {
    if (r.error) { out.push({ reqId: q.id, inputId: r.inputId, status: "NOT_RUN", evidence: `Not checked: ${r.error}` }); continue; }
    const c = runCheck(q.check, r.output, r.exec); out.push({ reqId: q.id, inputId: r.inputId, ...c });
  }
  return out;
}

/** Protected-intent firewall: the prompt must carry every requirement text verbatim. */
export function firewall(prompt: string, reqs: Requirement[]): { ok: boolean; missing: string[] } {
  const missing = reqs.filter((q) => !prompt.includes(q.text.trim())).map((q) => q.id);
  return { ok: missing.length === 0, missing };
}
export const isPass = (s: Status) => s === "VERIFIED" || s === "HUMAN_PASS";
