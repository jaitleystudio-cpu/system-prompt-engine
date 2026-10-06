/**
 * Structured Agent Protocol Execution Engine.
 * MCP & AI agent entrypoint with strict capability bounds and conflict detection.
 */
import type { AgentReceipt } from "./agentReceipt.ts";
import { createAgentReceipt } from "./agentReceipt.ts";
import { validateAgentCapability } from "./validateAgentCommand.ts";

export function executeAgentCommand(
  cmd: { command?: string; name?: string; beforeHash?: string; [key: string]: unknown },
  session: { agentId: string; capabilities: any },
  spec: { provenance?: { editHash?: string } },
): AgentReceipt {
  validateAgentCapability(cmd, session.capabilities);

  const commandName = cmd.command || cmd.name || "";

  switch (commandName) {
    case "getWebsiteSpec":
      return createAgentReceipt(session.agentId, commandName, "SUCCESS", spec);

    case "applyApprovedPatch": {
      const currentHash = spec.provenance?.editHash;
      if (!cmd.beforeHash || cmd.beforeHash !== currentHash) {
        throw new Error(
          `PATCH_CONFLICT: Canonical state hash mismatch. Expected "${currentHash}", got "${cmd.beforeHash}". Agent must re-read state.`,
        );
      }
      return createAgentReceipt(session.agentId, commandName, "SUCCESS", {
        patched: true,
        newHash: `hash-${Date.now()}`,
      });
    }

    case "exportSite":
    case "exportProject":
      return createAgentReceipt(session.agentId, commandName, "SUCCESS", { exported: true });

    default:
      return createAgentReceipt(session.agentId, commandName, "SUCCESS", { executed: true });
  }
}
