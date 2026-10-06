import type { SitePatch } from "../history/sitePatch.ts";
import type { AgentPolicy } from "../model/agentPolicy.ts";
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";

export type AgentCommandName =
  | "getWebsiteSpec"
  | "getPageTree"
  | "getScene"
  | "getSelectedObjects"
  | "getBehaviorGraph"
  | "getTimeline"
  | "getCameraPlan"
  | "getPerformanceReceipt"
  | "getAccessibilityReceipt"
  | "proposePatch"
  | "applyApprovedPatch"
  | "createSceneObject"
  | "updateSceneObject"
  | "createBehaviorRule"
  | "updateMotionBlock"
  | "updateCameraPlan"
  | "optimizeScene"
  | "renderPreview"
  | "runQualityAudit"
  | "runAccessibilityAudit"
  | "runPerformanceAudit"
  | "runResponsiveAudit"
  | "exportSite"
  | "exportProject";

export interface AgentCommand {
  name: AgentCommandName;
  args: Record<string, unknown>;
}

export interface AgentCommandContext {
  policy: AgentPolicy;
  websiteSpec: WebsiteSpecV2;
  currentHash: string;
  selectedObjects?: string[];
  performanceReceipt?: unknown;
  qualityReceipt?: unknown;
}

export type AgentCommandResult =
  | { ok: true; code: "OK"; value: unknown; patch?: SitePatch }
  | { ok: false; code: "CAPABILITY_DENIED" | "COMMAND_REFUSED" | "PATCH_CONFLICT"; value?: undefined };
