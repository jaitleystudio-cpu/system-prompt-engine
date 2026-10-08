/**
 * Data contracts for Scene Performance receipts and findings.
 */

export type MeasurementState = "MEASURED" | "ESTIMATED" | "UNKNOWN";

export type QualityTier = "TIER_A" | "TIER_B" | "TIER_C" | "TIER_FAIL";

export interface PerformanceFinding {
  severity: "INFO" | "WARNING" | "CRITICAL";
  category: "geometry" | "draw-calls" | "textures" | "particles" | "framerate";
  message: string;
  metricValue: number;
  threshold: number;
}

export interface ScenePerformanceReceipt {
  triangles: number;
  drawCalls: number;
  textureBytes: number;
  geometryBytes?: number;
  materials: number;
  lights: number;
  particles: number;
  webglContexts: number;
  measurementState: MeasurementState;
  desktopFrameP95Ms?: number;
  mobileFrameP95Ms?: number;
  findings: PerformanceFinding[];
}

export interface ScenePerformanceEstimate {
  estimatedTriangles: number;
  estimatedDrawCalls: number;
  estimatedTextureBytes: number;
  estimatedMobileFps: number;
  measurementState: "ESTIMATED";
}
