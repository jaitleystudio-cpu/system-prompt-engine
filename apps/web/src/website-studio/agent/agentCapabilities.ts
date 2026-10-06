import type { AgentCommandName } from "./commandTypes.ts";
import type { AgentPolicy } from "../model/agentPolicy.ts";

export type AgentCapabilities = AgentPolicy;

const READ = new Set<AgentCommandName>([
  "getWebsiteSpec",
  "getPageTree",
  "getScene",
  "getSelectedObjects",
  "getBehaviorGraph",
  "getTimeline",
  "getCameraPlan",
  "getPerformanceReceipt",
  "getAccessibilityReceipt",
]);
const PROPOSE = new Set<AgentCommandName>(["proposePatch"]);
const EXECUTE = new Set<AgentCommandName>([
  "applyApprovedPatch",
  "createSceneObject",
  "updateSceneObject",
  "createBehaviorRule",
  "updateMotionBlock",
  "updateCameraPlan",
  "optimizeScene",
  "renderPreview",
  "runQualityAudit",
  "runAccessibilityAudit",
  "runPerformanceAudit",
  "runResponsiveAudit",
]);
const EXPORT = new Set<AgentCommandName>(["exportSite", "exportProject"]);

export function commandAllowed(
  policy: AgentPolicy,
  command: AgentCommandName,
): boolean {
  if (READ.has(command)) return policy.read.includes(command);
  if (PROPOSE.has(command)) return policy.propose.includes(command);
  if (EXECUTE.has(command)) return policy.execute.includes(command);
  if (EXPORT.has(command)) return policy.export;
  return false;
}
