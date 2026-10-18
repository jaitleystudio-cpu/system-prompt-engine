// Pro Studio internal routes: /pro-studio and /pro-studio/<tool>. Pure functions, unit-tested.
export type ToolId =
  | "living" | "blind" | "portability"
  | "studio" | "blueprint" | "regression" | "releases"
  | "code" | "batch" | "brand" | "formats" | "cost" | "scanner" | "audit" | "library" | "report";
export type Group = "Prove" | "Build" | "Test & ship" | "Scale" | "Govern";
export interface ToolDef { id: ToolId; label: string; group: Group; blurb: string; isNew: boolean; keywords: string }
export const BASE = "/pro-studio";
export const TOOLS: ToolDef[] = [
  { id: "living", label: "Living .spe", group: "Prove", isNew: true, blurb: "Keep a goal and its must-haves, run on your own model, check real outputs, repair and retry within your budget.", keywords: "living loop project goal requirements verify repair retry budget proof certificate byok closed loop" },
  { id: "blind", label: "Blind A/B", group: "Prove", isNew: true, blurb: "Compare two prompts on your model without knowing which wrote which answer; order is random per case.", keywords: "blind compare ab a/b judge random order human preference" },
  { id: "portability", label: "Cross-model check", group: "Prove", isNew: true, blurb: "Run one prompt and its checks on up to four of your models and see where it holds and where it breaks.", keywords: "cross model portability models compare providers groq gemini openrouter" },
  { id: "studio", label: "Prompt Studio", group: "Build", isNew: false, blurb: "Block editor with variables, static checks, versions, diff and compare.", keywords: "editor blocks prompt variables versions diff compare templates import export spe" },
  { id: "brand", label: "Brand Guide", group: "Build", isNew: true, blurb: "Write voice rules and banned or required terms, then check any prompt against them.", keywords: "style voice tone banned required agency marketing" },
  { id: "formats", label: "Format Converter", group: "Build", isNew: true, blurb: "Render the same prompt as Markdown, XML tags, JSON or plain text.", keywords: "xml markdown json convert structure" },
  { id: "blueprint", label: "Agent Blueprint", group: "Build", isNew: false, blurb: "Design a team of agents with tools, limits and handoffs; export draft configs.", keywords: "agents multi-agent handoff mcp openai anthropic config" },
  { id: "regression", label: "Regression Lab", group: "Test & ship", isNew: false, blurb: "Test cases for two prompt versions, run on your own model or a labelled simulation.", keywords: "tests cases suite compare versions regression simulated" },
  { id: "releases", label: "Signed Releases", group: "Test & ship", isNew: false, blurb: "Sign a prompt release with the SPE Pro service key and verify packs and proof certificates.", keywords: "sign verify ed25519 version release" },
  { id: "code", label: "Export to Code", group: "Scale", isNew: true, blurb: "Starter code for Python, JavaScript and cURL with your prompt embedded safely.", keywords: "python javascript curl sdk api developer snippet" },
  { id: "batch", label: "Batch from CSV", group: "Scale", isNew: true, blurb: "Fill {{variables}} from every CSV row and download all prompts at once.", keywords: "csv bulk rows variables jsonl batch" },
  { id: "cost", label: "Cost Estimator", group: "Scale", isNew: true, blurb: "Token budget and monthly cost from prices you enter. No built-in price list.", keywords: "tokens budget price cost usage context window" },
  { id: "scanner", label: "Secret Scanner", group: "Govern", isNew: true, blurb: "Find API keys, private keys and personal data in a prompt before it ships.", keywords: "secrets pii keys redact privacy security compliance" },
  { id: "audit", label: "Audit Log", group: "Govern", isNew: true, blurb: "Hash-chained log of your Pro Studio actions, written by the server.", keywords: "audit log history compliance chain sha256" },
  { id: "library", label: "Library Packs", group: "Govern", isNew: true, blurb: "Bundle sessions into one file to share with your team; import with an integrity check.", keywords: "team share library pack import export workspace" },
  { id: "report", label: "Handoff Report", group: "Govern", isNew: true, blurb: "A Markdown report of a prompt, its checks, scan and versions, ready for a client.", keywords: "report client handoff markdown agency deliverable" },
];
export const GROUPS: Group[] = ["Prove", "Build", "Test & ship", "Scale", "Govern"];
export const toolById = (id: string): ToolDef | undefined => TOOLS.find((t) => t.id === id);
export type ProRoute = { kind: "home" } | { kind: "tool"; tool: ToolId } | { kind: "not-found"; segment: string };
export function parseProPath(pathname: string): ProRoute {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === BASE || clean === "/pro") return { kind: "home" };
  if (!clean.startsWith(BASE + "/")) return { kind: "not-found", segment: clean };
  const seg = clean.slice(BASE.length + 1);
  const t = toolById(seg);
  return t ? { kind: "tool", tool: t.id } : { kind: "not-found", segment: seg };
}
export const pathFor = (r: { kind: "home" } | { kind: "tool"; tool: ToolId }) => (r.kind === "home" ? BASE : `${BASE}/${r.tool}`);
export const isProStudioPath = (pathname: string) => { const c = pathname.replace(/\/+$/, "") || "/"; return c === BASE || c === "/pro" || c.startsWith(BASE + "/"); };
