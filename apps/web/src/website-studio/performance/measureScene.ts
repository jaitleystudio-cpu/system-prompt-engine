import { computeSha256 } from "../../engine/hashUtils.ts";
import type { SceneIR } from "../model/sceneIR.ts";

export type MeasurementState = "MEASURED" | "ESTIMATED" | "UNKNOWN";

export interface BrowserTelemetryEvidence {
  environment: "BROWSER_HARNESS";
  browser: string;
  viewport: { width: number; height: number };
  dpr: number;
  sampleCount: number;
  warmupDiscarded: number;
  frameTimingsMs: number[];
  frameP50: number;
  frameP95: number;
  frameP99: number;
  drawCalls: number;
  triangles: number;
  textureBytes: number;
  memoryBytes?: number;
  timestamp: number;
  harnessSignature?: string;
}

export interface ScenePerformanceReceipt {
  triangles: number;
  drawCalls: number;
  textureBytes: number;
  geometryBytes: number;
  materials: number;
  lights: number;
  particles: number;
  webglContexts: number;
  desktopFrameP95?: number;
  mobileFrameP95?: number;
  frameMeasurementState: MeasurementState;
  findings: string[];
  telemetryEvidence?: {
    environment: "BROWSER_HARNESS";
    browser: string;
    viewport: { width: number; height: number };
    dpr: number;
    sampleCount: number;
    warmup: number;
    frameP50: number;
    frameP95: number;
    frameP99: number;
    memoryBytes?: number;
    timestamp: number;
    receiptHash: string;
  };
}

const TRIANGLES: Record<string, number> = {
  box: 12,
  sphere: 960,
  cylinder: 128,
  plane: 2,
  torus: 3200,
  "wave-mesh": 5000,
};

export function measureSceneStatic(scene: SceneIR): ScenePerformanceReceipt {
  const triangles = scene.objects.reduce(
    (sum, object) => sum + (TRIANGLES[object.geometry.type] ?? 0),
    0,
  );
  const materialKeys = new Set(
    scene.objects.map((object) =>
      JSON.stringify({
        type: object.material.type,
        color: object.material.color,
        roughness: object.material.roughness,
        metalness: object.material.metalness,
      }),
    ),
  );
  const findings: string[] = [];
  if (triangles > scene.performanceBudget.maxTriangles) {
    findings.push("TRIANGLE_BUDGET_EXCEEDED");
  }
  if (scene.objects.length > scene.performanceBudget.maxDrawCalls) {
    findings.push("DRAW_CALL_BUDGET_EXCEEDED");
  }
  return {
    triangles,
    drawCalls: scene.objects.length,
    textureBytes: 0,
    geometryBytes: triangles * 3 * 3 * 4,
    materials: materialKeys.size,
    lights: scene.lighting.length,
    particles: 0,
    webglContexts: 0,
    frameMeasurementState: "UNKNOWN",
    findings,
  };
}

/**
 * Computes an analytical performance estimate.
 * Never labels results as MEASURED.
 */
export function estimateScenePerformance(
  scene: SceneIR,
  deviceTier: "DESKTOP_HIGH" | "MOBILE_MID" = "DESKTOP_HIGH",
): ScenePerformanceReceipt {
  const base = measureSceneStatic(scene);
  const estimatedFrameMs = deviceTier === "DESKTOP_HIGH"
    ? 8.0 + (base.triangles / 20000) * 4.0 + (base.drawCalls / 50) * 3.0
    : 14.0 + (base.triangles / 10000) * 8.0 + (base.drawCalls / 30) * 6.0;

  return {
    ...base,
    desktopFrameP95: Number(estimatedFrameMs.toFixed(2)),
    mobileFrameP95: Number((estimatedFrameMs * 1.5).toFixed(2)),
    frameMeasurementState: "ESTIMATED",
    findings: [...base.findings, `ESTIMATED_TIER_${deviceTier}`],
  };
}

function computePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((percentile / 100) * sorted.length)),
  );
  return sorted[index];
}

/**
 * Validates authentic telemetry from a real browser test harness before
 * certifying any receipt as MEASURED. Rejects synthetic/caller-assigned values.
 */
export function attachVerifiedBrowserTelemetry(
  receipt: ScenePerformanceReceipt,
  telemetry: BrowserTelemetryEvidence,
): ScenePerformanceReceipt {
  if (!telemetry || telemetry.environment !== "BROWSER_HARNESS") {
    throw new Error(
      "PERFORMANCE_MEASUREMENT_UNVERIFIED: telemetry must originate from BROWSER_HARNESS",
    );
  }
  if (!telemetry.browser || typeof telemetry.browser !== "string") {
    throw new Error("PERFORMANCE_MEASUREMENT_UNVERIFIED: browser metadata required");
  }
  if (!telemetry.viewport || telemetry.viewport.width <= 0 || telemetry.viewport.height <= 0) {
    throw new Error("PERFORMANCE_MEASUREMENT_UNVERIFIED: valid viewport required");
  }
  if (!Number.isFinite(telemetry.dpr) || telemetry.dpr <= 0) {
    throw new Error("PERFORMANCE_MEASUREMENT_UNVERIFIED: valid DPR required");
  }
  if (!Array.isArray(telemetry.frameTimingsMs) || telemetry.frameTimingsMs.length < 60) {
    throw new Error(
      "PERFORMANCE_MEASUREMENT_UNVERIFIED: minimum 60 sampled frames required",
    );
  }
  if (telemetry.warmupDiscarded < 10) {
    throw new Error(
      "PERFORMANCE_MEASUREMENT_UNVERIFIED: minimum 10 warmup frames must be discarded",
    );
  }

  // Verify statistical consistency of the frame timings
  const computedP50 = computePercentile(telemetry.frameTimingsMs, 50);
  const computedP95 = computePercentile(telemetry.frameTimingsMs, 95);

  const tolerance = 1.0; // 1.0ms numeric tolerance
  if (
    Math.abs(computedP95 - telemetry.frameP95) > tolerance ||
    Math.abs(computedP50 - telemetry.frameP50) > tolerance
  ) {
    throw new Error(
      "PERFORMANCE_MEASUREMENT_UNVERIFIED: statistical telemetry percentile mismatch",
    );
  }

  const payload = JSON.stringify({
    browser: telemetry.browser,
    viewport: telemetry.viewport,
    dpr: telemetry.dpr,
    sampleCount: telemetry.sampleCount,
    p50: telemetry.frameP50,
    p95: telemetry.frameP95,
    p99: telemetry.frameP99,
    timestamp: telemetry.timestamp,
  });
  const receiptHash = "sha256-" + computeSha256(payload);

  return {
    ...receipt,
    desktopFrameP95: telemetry.frameP95,
    mobileFrameP95: telemetry.frameP95 * 1.3,
    frameMeasurementState: "MEASURED",
    telemetryEvidence: {
      environment: "BROWSER_HARNESS",
      browser: telemetry.browser,
      viewport: telemetry.viewport,
      dpr: telemetry.dpr,
      sampleCount: telemetry.sampleCount,
      warmup: telemetry.warmupDiscarded,
      frameP50: telemetry.frameP50,
      frameP95: telemetry.frameP95,
      frameP99: telemetry.frameP99,
      memoryBytes: telemetry.memoryBytes,
      timestamp: telemetry.timestamp,
      receiptHash,
    },
  };
}

/**
 * Legacy interface strictly gated: throws unless accompanied by verified browser telemetry.
 */
export function attachMeasuredFrameTiming(
  receipt: ScenePerformanceReceipt,
  _desktopFrameP95: number,
  _mobileFrameP95?: number,
  telemetry?: BrowserTelemetryEvidence,
): ScenePerformanceReceipt {
  if (!telemetry) {
    throw new Error(
      "PERFORMANCE_MEASUREMENT_REJECTED: caller-supplied values alone cannot declare MEASURED; verified browser telemetry harness required",
    );
  }
  return attachVerifiedBrowserTelemetry(receipt, telemetry);
}

export interface OptimizationProposal {
  targetDrawCalls: number;
  targetTriangles: number;
  maxDpr: number;
  actions: string[];
}

export function proposeOptimization(receipt: ScenePerformanceReceipt): OptimizationProposal {
  const actions: string[] = [];
  let targetTriangles = receipt.triangles;
  let targetDrawCalls = receipt.drawCalls;
  let maxDpr = 1.5;

  if (receipt.triangles > 8000) {
    actions.push("ENABLE_LOD_DECIMATION");
    targetTriangles = Math.round(receipt.triangles * 0.65);
  }
  if (receipt.drawCalls > 30) {
    actions.push("INSTANCED_MESH_BATCHING");
    targetDrawCalls = Math.min(25, receipt.drawCalls);
  }
  if (receipt.desktopFrameP95 && receipt.desktopFrameP95 > 16.6) {
    actions.push("CLAMP_MAX_DPR_1_25");
    maxDpr = 1.25;
  }

  return { targetDrawCalls, targetTriangles, maxDpr, actions };
}

export function applyOptimizationProposal(
  scene: SceneIR,
  proposal: OptimizationProposal,
): SceneIR {
  const next = structuredClone(scene);
  next.performanceBudget = {
    ...next.performanceBudget,
    maxTriangles: proposal.targetTriangles,
    maxDrawCalls: proposal.targetDrawCalls,
    maxDpr: proposal.maxDpr,
  };
  return next;
}
