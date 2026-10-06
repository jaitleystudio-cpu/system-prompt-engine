/**
 * Validates command schema and agent capability boundaries.
 */
import type { AgentCapabilities } from "./agentCapabilities.ts";

export function validateAgentCapability(
  cmd: { command?: string; name?: string; [key: string]: unknown },
  capabilities: AgentCapabilities,
): void {
  const name = cmd.command || cmd.name || "";

  if (name.startsWith("get") || name.startsWith("run") || name.startsWith("render")) {
    if (!capabilities.read.includes(name) && !capabilities.read.includes("all")) {
      throw new Error(`UNAUTHORIZED_AGENT_ACTION: Agent lacks read capability for "${name}"`);
    }
  } else if (name === "proposePatch") {
    if (!capabilities.propose.includes("proposePatch") && !capabilities.propose.includes("all")) {
      throw new Error(`UNAUTHORIZED_AGENT_ACTION: Agent lacks proposal capability for "${name}"`);
    }
  } else if (
    name === "applyApprovedPatch" ||
    name.startsWith("create") ||
    name.startsWith("update") ||
    name === "optimizeScene"
  ) {
    if (
      !capabilities.execute.includes(name) &&
      !capabilities.execute.includes("applyApprovedPatch") &&
      !capabilities.execute.includes("all")
    ) {
      throw new Error(`UNAUTHORIZED_AGENT_ACTION: Agent lacks execute capability for "${name}"`);
    }
  } else if (name.startsWith("export")) {
    if (!capabilities.export) {
      throw new Error(`UNAUTHORIZED_AGENT_ACTION: Agent lacks export capability for "${name}"`);
    }
  } else {
    throw new Error(`UNKNOWN_COMMAND: Unrecognized command "${name}"`);
  }
}
