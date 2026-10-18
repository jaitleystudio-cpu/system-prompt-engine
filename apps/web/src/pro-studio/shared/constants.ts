// Client-safe constants and types shared by the browser UI and the Pro API. No Pro logic lives here:
// checks, scans, exports and the Living loop run on the server (core/), the browser only renders results.
export type Kind = "role" | "rules" | "tone" | "output" | "examples" | "requirements" | "custom";
export interface Block { id: string; kind: Kind; title: string; text: string; must?: string[]; mustNot?: string[] }
export type PlainBlock = Omit<Block, "id">;
export interface Version { id: string; note: string; at: string; blocks: PlainBlock[]; variables?: Record<string, string> }
export type Mode = "template" | "filled";
export interface SpeFile { format: "spe.prompt"; version: 1; name: string; createdAt: string; blocks: PlainBlock[]; versions?: Version[]; variables?: Record<string, string>; mode?: Mode; rendered?: string }

export const KINDS: Kind[] = ["role", "rules", "tone", "output", "examples", "requirements", "custom"];
export const LABEL: Record<Kind, string> = { role: "Role", rules: "Rules", tone: "Tone", output: "Output format", examples: "Examples", requirements: "Requirements", custom: "Custom" };
export const HINT: Record<Kind, string> = {
  role: "Who the assistant is and who it serves, e.g. You are a support agent for…",
  rules: "One rule per line. Prefer concrete, testable rules.",
  tone: "Voice and register, e.g. Warm, concise, plain English.",
  output: "Exact shape of the answer: sections, JSON keys, length limits.",
  examples: "Input → ideal output pairs.",
  requirements: "Your requirements: what the prompt must follow and must not do.",
  custom: "Anything else the model needs.",
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function reqText(must: string[] = [], mustNot: string[] = []): string {
  const m = must.map((x) => x.trim()).filter(Boolean), n = mustNot.map((x) => x.trim()).filter(Boolean);
  return [m.length ? "Must:\n" + m.map((x) => `- ${x}`).join("\n") : "", n.length ? "Must not:\n" + n.map((x) => `- Do not: ${x}`).join("\n") : ""].filter(Boolean).join("\n");
}
export const plain = (b: PlainBlock): PlainBlock => b.kind === "requirements"
  ? { kind: b.kind, title: b.title, text: reqText(b.must, b.mustNot), must: [...(b.must || [])], mustNot: [...(b.mustNot || [])] }
  : { kind: b.kind, title: b.title, text: b.text };
export const withIds = (bs: PlainBlock[]): Block[] => bs.map((b) => ({ ...plain(b), id: uid() }));
export type QType = "deterministic" | "heuristic" | "tokens" | "model";
export type Level = "ok" | "warn" | "bad" | "na";
export interface Q { level: Level; type: QType; title: string; detail: string }
export const QTYPE_LABEL: Record<QType, string> = { deterministic: "Deterministic check", heuristic: "Heuristic warning", tokens: "Token estimate (approximate)", model: "Model evaluation" };
export const MAX_FILE = 5 * 1024 * 1024, MAX_TEXT = 200_000;
export const EXAMPLE: PlainBlock[] = [
  { kind: "role", title: "Role", text: "You are Ledger, a billing support assistant for Northwind Cloud. You help small-business customers understand invoices, refunds and plan changes." },
  { kind: "rules", title: "Rules", text: "Only answer questions about Northwind billing; politely redirect anything else.\nNever ask for full card numbers or passwords.\nIf a refund is over $500, hand off to a human agent.\nCite the invoice ID whenever you reference a charge." },
  { kind: "tone", title: "Tone", text: "Calm, friendly and concise. Plain English, no jargon. Acknowledge frustration in one sentence, then solve." },
  { kind: "output", title: "Output format", text: "Reply in at most 120 words.\nStart with a one-line answer, then up to 3 bullet steps.\nEnd with: \"Anything else on your bill?\"" },
];
export const STARTER: PlainBlock[] = (["role", "rules", "tone", "output"] as Kind[]).map((k) => ({ kind: k, title: LABEL[k], text: "" }));

export type CodeTarget = "curl-openai" | "python-openai" | "js-openai" | "curl-anthropic" | "python-anthropic";
export const CODE_TARGETS: { id: CodeTarget; label: string; file: string }[] = [
  { id: "python-openai", label: "Python · OpenAI SDK", file: "prompt_openai.py" },
  { id: "js-openai", label: "JavaScript · OpenAI SDK", file: "prompt_openai.mjs" },
  { id: "curl-openai", label: "cURL · OpenAI Chat Completions", file: "prompt_openai.sh" },
  { id: "python-anthropic", label: "Python · Anthropic SDK", file: "prompt_anthropic.py" },
  { id: "curl-anthropic", label: "cURL · Anthropic Messages", file: "prompt_anthropic.sh" },
];
export type Fmt = "markdown" | "xml" | "json" | "plain";
export const FORMATS: { id: Fmt; label: string; ext: string }[] = [
  { id: "markdown", label: "Markdown headings", ext: "md" }, { id: "xml", label: "XML tags", ext: "xml" },
  { id: "json", label: "JSON sections", ext: "json" }, { id: "plain", label: "Plain text", ext: "txt" },
];
export interface BrandGuide { name: string; voice: string; required: string[]; banned: string[]; replace: { from: string; to: string }[]; maxSentenceWords: number | null }
export interface BrandFinding { rule: "required" | "banned" | "replace" | "sentence"; level: "bad" | "warn" | "ok"; message: string }
export const EMPTY_GUIDE: BrandGuide = { name: "", voice: "", required: [], banned: [], replace: [], maxSentenceWords: null };
export const AGENT_TOOLS: Record<string, string> = {
  web_search: "Search the web and return result snippets.",
  read_file: "Read a file from an allowed folder.",
  write_file: "Write a file to an allowed folder.",
  run_code: "Run code in a sandbox.",
  send_email: "Send an email on the user's behalf.",
};
export const RISKY = new Set(["write_file", "run_code", "send_email"]);
export interface Agent { id: string; name: string; role: string; instructions: string; tools: string[]; maxSteps: number; needsApproval: boolean; x: number; y: number; }
export interface Handoff { from: string; to: string; when: string; }
export interface Blueprint { name: string; agents: Agent[]; handoffs: Handoff[]; }
export const DRAFT_NOTE = "Draft format, verify before use.";
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;
