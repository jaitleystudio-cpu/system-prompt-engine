/**
 * Diagnoses performance issues and assigns quality tiers (TIER_A, B, C, FAIL).
 */
import type { ScenePerformanceReceipt, QualityTier, PerformanceFinding } from "./scenePerformanceReceipt.ts";

export interface PerformanceDiagnosis {
  tier: QualityTier;
  findings: PerformanceFinding[];
}

export function diagnosePerformance(receipt: ScenePerformanceReceipt): PerformanceDiagnosis {
  const findings: PerformanceFinding[] = [];

  if (receipt.drawCalls > 80) {
    findings.push({
      severity: "WARNING",
      category: "draw-calls",
      message: `High draw calls (${receipt.drawCalls} > 80). Consider batching materials.`,
      metricValue: receipt.drawCalls,
      threshold: 80
    });
  }

  if (receipt.textureBytes > 15 * 1024 * 1024) {
    findings.push({
      severity: "WARNING",
      category: "textures",
      message: `Large texture payload (${(receipt.textureBytes / (1024 * 1024)).toFixed(1)} MB > 15 MB). Compress or resize.`,
      metricValue: receipt.textureBytes,
      threshold: 15 * 1024 * 1024
    });
  }

  if (receipt.triangles > 250000) {
    findings.push({
      severity: "INFO",
      category: "geometry",
      message: `High triangle count (${receipt.triangles} > 250k). Generate LODs for mobile.`,
      metricValue: receipt.triangles,
      threshold: 250000
    });
  }

  let tier: QualityTier = "TIER_A";
  if (findings.length >= 2) {
    tier = "TIER_C";
  } else if (findings.length === 1) {
    tier = "TIER_B";
  }

  return { tier, findings };
}
