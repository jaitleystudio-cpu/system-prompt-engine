// Agent Blueprint Builder — pure model + draft exporters. Exports are DRAFT formats: verify before use.
import { AGENT_TOOLS as TOOLS, RISKY, DRAFT_NOTE, type Blueprint } from "../shared/constants.ts";
export { AGENT_TOOLS as TOOLS, RISKY, DRAFT_NOTE, type Agent, type Handoff, type Blueprint } from "../shared/constants.ts";

export function validate(bp: Blueprint): string[] {
  const errs: string[] = []; const ids = new Set<string>(); const names = new Set<string>();
  for (const a of bp.agents) {
    if (ids.has(a.id)) errs.push(`Duplicate agent id ${a.id}.`); ids.add(a.id);
    if (!a.name.trim()) errs.push("Every agent needs a name.");
    else if (names.has(a.name.trim().toLowerCase())) errs.push(`Two agents are named ${a.name}.`); names.add(a.name.trim().toLowerCase());
    if (!(a.maxSteps >= 1 && a.maxSteps <= 100)) errs.push(`${a.name || a.id}: step limit must be 1 to 100.`);
    for (const t of a.tools) if (!(t in TOOLS)) errs.push(`${a.name}: unknown tool ${t}.`);
    if (a.tools.some((t) => RISKY.has(t)) && !a.needsApproval) errs.push(`${a.name}: has a tool that changes things, so it should require human approval.`);
  }
  for (const h of bp.handoffs) {
    if (!ids.has(h.from) || !ids.has(h.to)) errs.push("A handoff points to an agent that no longer exists.");
    else if (h.from === h.to) errs.push("An agent cannot hand off to itself.");
  }
  return errs;
}
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "agent";
const nameOf = (bp: Blueprint, id: string) => slug(bp.agents.find((a) => a.id === id)?.name ?? id);
const live = (bp: Blueprint) => bp.handoffs.filter((h) => h.from !== h.to && bp.agents.some((a) => a.id === h.from) && bp.agents.some((a) => a.id === h.to));

export function toOpenAI(bp: Blueprint) {
  return { _note: DRAFT_NOTE, format: "openai-agents-style-draft", name: bp.name, agents: bp.agents.map((a) => ({
    name: slug(a.name), instructions: [a.role, a.instructions].filter(Boolean).join("\n\n"),
    tools: a.tools.map((t) => ({ type: "function", function: { name: t, description: TOOLS[t], parameters: { type: "object", properties: {} } } })),
    handoffs: live(bp).filter((h) => h.from === a.id).map((h) => ({ agent: nameOf(bp, h.to), when: h.when })),
    max_turns: a.maxSteps, require_approval_for: a.needsApproval ? a.tools.filter((t) => RISKY.has(t)) : [] })) };
}
export function toAnthropic(bp: Blueprint) {
  return { _note: DRAFT_NOTE, format: "anthropic-messages-style-draft", name: bp.name, agents: bp.agents.map((a) => ({
    name: slug(a.name), system: [a.role, a.instructions].filter(Boolean).join("\n\n"),
    tools: a.tools.map((t) => ({ name: t, description: TOOLS[t], input_schema: { type: "object", properties: {} } })),
    handoffs: live(bp).filter((h) => h.from === a.id).map((h) => ({ to: nameOf(bp, h.to), when: h.when })),
    max_steps: a.maxSteps, human_approval: a.needsApproval })) };
}
export function toMcpStyle(bp: Blueprint) {
  return { _note: DRAFT_NOTE + " MCP defines servers and tools, not agents; this is an SPE-specific layout.", format: "mcp-style-draft", name: bp.name,
    tools: Object.fromEntries([...new Set(bp.agents.flatMap((a) => a.tools))].map((t) => [t, { description: TOOLS[t], annotations: { destructiveHint: RISKY.has(t), readOnlyHint: !RISKY.has(t) } }])),
    agents: bp.agents.map((a) => ({ name: slug(a.name), role: a.role, allowedTools: a.tools, limits: { maxSteps: a.maxSteps, humanApproval: a.needsApproval } })),
    handoffs: live(bp).map((h) => ({ from: nameOf(bp, h.from), to: nameOf(bp, h.to), when: h.when })) };
}
