import { commandAllowed } from "./agentCapabilities.ts";
import type {
  AgentCommand,
  AgentCommandContext,
  AgentCommandResult,
} from "./commandTypes.ts";
import {
  applySitePatch,
  createSitePatch,
  hashCanonicalState,
  type PatchOperation,
  type SitePatch,
} from "../history/sitePatch.ts";

function denied(): AgentCommandResult {
  return { ok: false, code: "CAPABILITY_DENIED" };
}

export function createCommandRegistry(): {
  execute(command: AgentCommand, context: AgentCommandContext): AgentCommandResult;
} {
  return {
    execute(command, context) {
      if (!command || typeof command.name !== "string" || !command.args) {
        return { ok: false, code: "COMMAND_REFUSED" };
      }
      if (!commandAllowed(context.policy, command.name)) return denied();

      switch (command.name) {
        case "getWebsiteSpec":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec) };
        case "getPageTree":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec.pages) };
        case "getScene":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec.scene ?? null) };
        case "getSelectedObjects":
          return { ok: true, code: "OK", value: structuredClone(context.selectedObjects ?? []) };
        case "getBehaviorGraph":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec.behaviorGraph) };
        case "getTimeline":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec.motion) };
        case "getCameraPlan":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec.cameraPlan ?? null) };
        case "getPerformanceReceipt":
          return { ok: true, code: "OK", value: structuredClone(context.performanceReceipt ?? null) };
        case "getAccessibilityReceipt":
          return { ok: true, code: "OK", value: structuredClone(context.websiteSpec.accessibility) };
        case "proposePatch": {
          const operations = command.args.operations;
          if (!Array.isArray(operations)) return { ok: false, code: "COMMAND_REFUSED" };
          const patch = createSitePatch(
            context.websiteSpec,
            operations as PatchOperation[],
            "AGENT",
          );
          return { ok: true, code: "OK", value: patch, patch };
        }
        case "applyApprovedPatch": {
          const patch = command.args.patch as SitePatch | undefined;
          if (!patch) return { ok: false, code: "COMMAND_REFUSED" };
          if (
            context.currentHash !== patch.beforeHash ||
            hashCanonicalState(context.websiteSpec) !== patch.beforeHash
          ) {
            return { ok: false, code: "PATCH_CONFLICT" };
          }
          try {
            const next = applySitePatch(context.websiteSpec, patch);
            return { ok: true, code: "OK", value: next, patch };
          } catch {
            return { ok: false, code: "PATCH_CONFLICT" };
          }
        }
        case "exportSite":
        case "exportProject":
          return { ok: true, code: "OK", value: { authorized: true, kind: command.name } };
        default:
          return { ok: false, code: "COMMAND_REFUSED" };
      }
    },
  };
}
