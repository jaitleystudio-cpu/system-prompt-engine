// CoWorkie (Pro Studio assistant). Deterministic: a command parser plus explanations computed from real
// Pro Studio state. No language model is connected, so it never writes or rewrites prompt text itself.
import { TOOLS, toolById, type ToolId } from "../proRoutes.ts";
import { type PlainBlock, type Version, check, assemble, findVars, tokens } from "./studio.ts";
import { scan } from "./scanner.ts";

export interface CwState { tool: ToolId | "home" | null; sessionTitle: string | null; projectName: string | null; blocks: PlainBlock[] | null; vars: Record<string, string>; versions: Version[] }
export type Intent =
  | { type: "open"; tool: ToolId } | { type: "home" }
  | { type: "action"; tool: ToolId; action: string; label: string }
  | { type: "fill"; text: string } | { type: "explain" } | { type: "suggest" } | { type: "help" } | { type: "unknown"; text: string };
export interface Suggestion { label: string; why: string; intent: Intent }

const ACTIONS: { re: RegExp; tool: ToolId; action: string; label: string }[] = [
  { re: /\b(scan|secrets?|pii|leak|redact)\b/, tool: "scanner", action: "scan-session", label: "Scan the current session for secrets" },
  { re: /\b(run|start)\b.*\b(tests?|suite|regression)\b|\bregression run\b/, tool: "regression", action: "run", label: "Run the regression suite (simulated runner)" },
  { re: /\bsign\b/, tool: "releases", action: "sign", label: "Sign a release" },
  { re: /\bsave\b.*\bversion\b|\bsnapshot\b/, tool: "studio", action: "save-version", label: "Save a version" },
  { re: /\btemplates?\b/, tool: "studio", action: "templates", label: "Browse templates" },
  { re: /\bimport\b/, tool: "studio", action: "import", label: "Import a .spe file" },
  { re: /\bexport\b.*\b(spe|file)\b/, tool: "studio", action: "export", label: "Export a .spe file" },
];
const ALIASES: [RegExp, ToolId][] = [
  [/\b(living|loop|goal|must-?haves?|proof|certificate|retry)\b/, "living"], [/\b(blind|a\/b|ab test)\b/, "blind"], [/\b(cross[- ]?model|portability|portable|models)\b/, "portability"],
  [/\b(python|javascript|js|curl|sdk|code)\b/, "code"], [/\b(csv|batch|bulk|rows)\b/, "batch"], [/\b(cost|price|budget|tokens?)\b/, "cost"],
  [/\b(brand|style|voice)\b/, "brand"], [/\b(xml|json|markdown|format|convert)\b/, "formats"], [/\b(audit|log)\b/, "audit"],
  [/\b(library|pack|share|team)\b/, "library"], [/\b(report|handoff|client)\b/, "report"], [/\b(agents?|blueprint|handoffs?)\b/, "blueprint"],
  [/\b(release|verify)\b/, "releases"], [/\b(tests?|regression|cases?)\b/, "regression"], [/\b(editor|studio|blocks?|prompt studio)\b/, "studio"],
];

export function parseCommand(input: string): Intent {
  const raw = input.trim(); const t = raw.toLowerCase();
  if (!t) return { type: "unknown", text: raw };
  const fill = raw.match(/^(?:fill|draft|compose|write|start)(?:\s+(?:the\s+)?composer)?\s*(?:with)?\s*[:：]\s*([\s\S]+)$/i);
  if (fill && fill[1].trim()) return { type: "fill", text: fill[1].trim() };
  if (/^(help|\?|what can you do)/.test(t)) return { type: "help" };
  if (/\b(explain|what does this mean|why|summari[sz]e)\b/.test(t)) return { type: "explain" };
  if (/\b(next|suggest|what should i do|recommend)\b/.test(t)) return { type: "suggest" };
  if (/^(go\s+)?home$|\bnew session\b/.test(t)) return { type: "home" };
  for (const a of ACTIONS) if (a.re.test(t)) return { type: "action", tool: a.tool, action: a.action, label: a.label };
  const exact = TOOLS.find((x) => t.includes(x.label.toLowerCase()) || new RegExp(`\\b${x.id}\\b`).test(t));
  if (exact) return { type: "open", tool: exact.id };
  for (const [re, id] of ALIASES) if (re.test(t)) return { type: "open", tool: id };
  return { type: "unknown", text: raw };
}

export function describeContext(s: CwState): string {
  const where = s.tool === "home" ? "Home" : s.tool ? toolById(s.tool)?.label ?? s.tool : "Pro Studio";
  return [`You're in ${where}.`, s.sessionTitle ? `Session: “${s.sessionTitle}”.` : "No session is open.", s.projectName ? `Project: ${s.projectName}.` : ""].filter(Boolean).join(" ");
}

/** Plain-language explanation built only from real check, scan and variable results. */
export function explain(s: CwState): string[] {
  const out = [describeContext(s)];
  if (s.tool && s.tool !== "home" && s.tool !== "studio") out.push(`${toolById(s.tool)?.label}: ${toolById(s.tool)?.blurb}`);
  if (!s.blocks) { out.push("Start a session to get explanations of checks, variables and scans."); return out; }
  const qs = check(s.blocks, s.vars); const text = assemble(s.blocks);
  const det = qs.filter((q) => q.type === "deterministic"); const fails = det.filter((q) => q.level === "bad"); const warns = qs.filter((q) => q.level === "warn");
  out.push(`${s.blocks.length} blocks, about ${tokens(text)} tokens (characters ÷ 4, approximate).`);
  out.push(`${det.length - fails.length - det.filter((q) => q.level === "warn").length} of ${det.length} deterministic checks pass.`);
  for (const f of fails) out.push(`Failing: ${f.title}. ${f.detail}`);
  for (const w of warns.slice(0, 3)) out.push(`Warning: ${w.title}. ${w.detail}`);
  const fs = scan(text); if (fs.length) out.push(`The secret scanner matches ${fs.length} item${fs.length > 1 ? "s" : ""} (${[...new Set(fs.map((f) => f.label))].join(", ")}). Review before sharing.`);
  out.push("These are static text checks. No model has evaluated the prompt's answers.");
  return out;
}

export function suggest(s: CwState): Suggestion[] {
  const out: Suggestion[] = [];
  if (!s.blocks) return [{ label: "Start a session", why: "Most tools work on a Prompt Studio session.", intent: { type: "home" } }, { label: "Browse templates", why: "Seven starter templates to begin from.", intent: { type: "action", tool: "studio", action: "templates", label: "Browse templates" } }];
  const qs = check(s.blocks, s.vars); const text = assemble(s.blocks);
  if (qs.some((q) => q.type === "deterministic" && q.level === "bad")) out.push({ label: "Fix failing checks in Prompt Studio", why: qs.filter((q) => q.level === "bad").map((q) => q.title).join(", "), intent: { type: "open", tool: "studio" } });
  if (scan(text).length) out.push({ label: "Review secrets and personal data", why: "The scanner found matches in this session.", intent: { type: "action", tool: "scanner", action: "scan-session", label: "Scan the current session" } });
  const vs = findVars(text);
  if (vs.length) out.push({ label: "Fill variables from a CSV", why: `${vs.length} variable${vs.length > 1 ? "s" : ""} can be filled per row.`, intent: { type: "open", tool: "batch" } });
  if (!s.versions.length) out.push({ label: "Save a version", why: "No versions yet; versions enable diff and compare.", intent: { type: "action", tool: "studio", action: "save-version", label: "Save a version" } });
  else out.push({ label: "Sign a release", why: `${s.versions.length} version${s.versions.length > 1 ? "s" : ""} saved; sign one to share a verifiable pack.`, intent: { type: "action", tool: "releases", action: "sign", label: "Sign a release" } });
  const req = s.blocks.filter((b) => b.kind === "requirements").flatMap((b) => b.must ?? []);
  if (req.length) out.unshift({ label: "Prove it on your model", why: `${req.length} must-have${req.length > 1 ? "s" : ""} in this session can become protected, checked requirements in a Living .spe project.`, intent: { type: "open", tool: "living" } });
  out.push({ label: "Export to code", why: "Get Python, JavaScript or cURL with this prompt embedded.", intent: { type: "open", tool: "code" } });
  return out.slice(0, 4);
}
export const HELP = [
  "I can open any Pro tool: try “open living”, “blind compare”, “open batch” or “cost”.",
  "I can run tool actions: “scan for secrets”, “run tests”, “save version”, “sign release”, “templates”.",
  "I can fill the Home composer: “fill: You are a support assistant for…”.",
  "“explain” summarises the current session's checks and scan; “next” suggests what to do.",
  "No AI model is connected here, so I don't write or rewrite prompts myself.",
];
