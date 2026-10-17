/**
 * Automated Quality & Repair Loop.
 * Inspects, maps defect classes, proposes non-destructive SitePatches, and verifies resolution.
 */
import type { WebsiteSpecV2 } from "../model/websiteSpecV2.ts";

export type DefectClass =
  | "MISSING_MOBILE_FALLBACK"
  | "MISSING_REDUCED_MOTION_VARIANT"
  | "PERFORMANCE_BOTTLENECK"
  | "CAMERA_COLLISION"
  | "ENHANCEMENT_MISCLASSIFICATION";

export interface QualityDefect {
  defectClass: DefectClass;
  targetId: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export interface SitePatchOperation {
  type: string;
  targetId: string;
  payload: Record<string, unknown>;
}

export interface SitePatch {
  id: string;
  operations: SitePatchOperation[];
}

export function auditQualityDefects(spec: Partial<WebsiteSpecV2>): QualityDefect[] {
  const defects: QualityDefect[] = [];

  // 1. Audit BehaviorGraph for mobile fallback
  if (spec.behaviorGraph) {
    for (const rule of spec.behaviorGraph.rules) {
      if (!rule.fallback || rule.fallback.length === 0) {
        defects.push({
          defectClass: "MISSING_MOBILE_FALLBACK",
          targetId: rule.id,
          message: `Rule "${rule.id}" lacks mobile fallback action`,
          severity: "MEDIUM",
        });
      }
    }
  }

  // 2. Audit CameraPlan for reduced-motion variant
  if (spec.cameraPlan) {
    for (const shot of spec.cameraPlan.shots) {
      if (!shot.reducedMotionVariant) {
        defects.push({
          defectClass: "MISSING_REDUCED_MOTION_VARIANT",
          targetId: shot.id,
          message: `Camera shot "${shot.id}" lacks reducedMotionVariant`,
          severity: "HIGH",
        });
      }
    }
  }

  return defects;
}

export function proposeRepairPatch(defects: QualityDefect[], _spec: WebsiteSpecV2): SitePatch {
  const operations: SitePatchOperation[] = [];

  for (const defect of defects) {
    switch (defect.defectClass) {
      case "MISSING_MOBILE_FALLBACK":
        operations.push({
          type: "add-rule-fallback",
          targetId: defect.targetId,
          payload: {
            fallback: [{ type: "dom-show", targetId: "hero" }],
          },
        });
        break;

      case "MISSING_REDUCED_MOTION_VARIANT":
        operations.push({
          type: "add-camera-reduced-motion",
          targetId: defect.targetId,
          payload: {
            reducedMotionVariant: { position: [0, 1.2, 7], target: [0, 0, 0], fov: 60 },
          },
        });
        break;

      default:
        break;
    }
  }

  return {
    id: `repair-${Date.now()}`,
    operations,
  };
}

export function applyRepairPatch(spec: WebsiteSpecV2, patch: SitePatch): WebsiteSpecV2 {
  const nextSpec: WebsiteSpecV2 = structuredClone(spec);

  for (const op of patch.operations) {
    if (op.type === "add-rule-fallback") {
      const rule = nextSpec.behaviorGraph.rules.find((r) => r.id === op.targetId);
      if (rule) {
        rule.fallback = op.payload.fallback as typeof rule.fallback;
      }
    } else if (op.type === "add-camera-reduced-motion" && nextSpec.cameraPlan) {
      const shot = nextSpec.cameraPlan.shots.find((s) => s.id === op.targetId);
      if (shot) {
        shot.reducedMotionVariant = op.payload.reducedMotionVariant as typeof shot.reducedMotionVariant;
      }
    }
  }

  return nextSpec;
}
