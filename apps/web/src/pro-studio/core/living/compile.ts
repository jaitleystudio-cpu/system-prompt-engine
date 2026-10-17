// BUILDER: compiles the prompt for an attempt from the goal, the protected requirements, the current
// strategy and repair clauses. It never decides whether an attempt passed (that is verify.ts).
import type { Check, Repair, Requirement, Strategy } from "./types.ts";
export const BUILDER_ID = "spe-living-builder/1";
export const STRATEGIES: Strategy[] = ["direct", "checklist", "format-first", "decompose"];
export const STRATEGY_LABEL: Record<Strategy, string> = { direct: "Direct", checklist: "Requirement checklist", "format-first": "Format first", decompose: "Decompose then combine" };
const APPROACH: Record<Strategy, string> = {
  direct: "Answer the user's message directly. Every protected requirement above must hold in your answer.",
  checklist: "Before answering, go through the protected requirements one by one and make sure your answer meets each of them. Output only the final answer, not the checklist.",
  "format-first": "First fix the exact output shape the requirements demand (structure, length, required words, JSON keys). Then produce exactly that shape and nothing else: no preamble, no closing remarks.",
  decompose: "Split the task into the parts the requirements name, handle each part, then combine them into one answer that meets every protected requirement. Output only the combined answer.",
};
/** Turns a real captured runtime error into a targeted negative constraint. */
export function runtimeRepair(error: string): string {
  const e = error.replace(/\s+/g, " ").trim().slice(0, 240);
  let m = /ReferenceError: ([A-Za-z_$][\w$]*) is not defined/.exec(e);
  if (m) return `The previous code crashed when it ran: "${e}". Do not reference \`${m[1]}\` unless you declare and initialise it first in the same code.`;
  m = /TypeError: Cannot read propert(?:y|ies) of (undefined|null) \(reading '([^']+)'\)/.exec(e);
  if (m) return `The previous code crashed when it ran: "${e}". Do not read \`.${m[2]}\` from a value that can be ${m[1]}; make sure it exists before you use it.`;
  m = /TypeError: ([\w$.]+) is not a function/.exec(e);
  if (m) return `The previous code crashed when it ran: "${e}". Do not call \`${m[1]}\` as a function unless it is defined as one.`;
  if (/^SyntaxError/.test(e)) return `The previous code did not parse: "${e}". Output complete, syntactically valid JavaScript only.`;
  if (/timed out/i.test(e)) return `The previous code did not finish: "${e}". Do not use infinite loops or long blocking work.`;
  if (/^console\.error/.test(e)) return `The previous code logged an error: "${e}". Fix the cause so nothing is logged with console.error; do not hide errors.`;
  return `The previous code crashed when it ran: "${e}". Fix the cause; do not hide it with an empty try/catch.`;
}
/** One targeted repair instruction per failing check. */
export function repairClause(q: Requirement, evidence?: string): string {
  const c: Check = q.check; const v = c.value ?? ""; const n = c.n;
  switch (c.kind) {
    case "contains": return `Your previous answer missed a requirement. Your answer must include the exact text "${v}".`;
    case "not_contains": return `Your previous answer broke a requirement. Your answer must not contain "${v}" anywhere.`;
    case "regex": return `Your previous answer did not match the required pattern for: ${q.text}. Follow it exactly.`;
    case "not_regex": return `Your previous answer contained something forbidden by: ${q.text}. Remove it.`;
    case "json_valid": return "Output only valid JSON. No prose before or after it, and no code fences.";
    case "json_keys": return `Output only a JSON object with these keys: ${(c.keys ?? []).join(", ")}. No prose and no code fences.`;
    case "max_words": return `Your previous answer was too long. Use at most ${n} words.`;
    case "min_words": return `Your previous answer was too short. Use at least ${n} words.`;
    case "max_chars": return `Your previous answer was too long. Use at most ${n} characters.`;
    case "starts_with": return `Start your answer with exactly: "${v}".`;
    case "ends_with": return `End your answer with exactly: "${v}".`;
    case "line_count_max": return `Use at most ${n} lines.`;
    case "runs_clean": return evidence ? runtimeRepair(evidence) : "Output complete JavaScript in one code block that runs without errors.";
    default: return `Meet this requirement: ${q.text}`;
  }
}
export interface CompileInput { intent: string; requirements: Requirement[]; strategy: Strategy; repairs: Repair[] }
export function compilePrompt(x: CompileInput): string {
  const req = x.requirements.map((q, i) => `R${i + 1}. ${q.text.trim()}`).join("\n");
  const fixes = [...new Map(x.repairs.map((r) => [r.clause, r])).values()].map((r) => `- ${r.clause}`).join("\n");
  return [
    `## Goal\n${x.intent.trim()}`,
    `## Protected requirements (all must hold; none may be dropped)\n${req}`,
    `## Approach\n${APPROACH[x.strategy]}`,
    fixes ? `## Fixes from earlier attempts\n${fixes}` : "",
  ].filter(Boolean).join("\n\n");
}
