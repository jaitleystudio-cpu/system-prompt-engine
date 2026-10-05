import type { SceneIR } from "../model/sceneIR.ts";

export type MeasurementState = "MEASURED" | "ESTIMATED" | "UNKNOWN";

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

export function attachMeasuredFrameTiming(
  receipt: ScenePerformanceReceipt,
  desktopFrameP95: number,
  mobileFrameP95?: number,
): ScenePerformanceReceipt {
  if (!Number.isFinite(desktopFrameP95) || desktopFrameP95 < 0) {
    throw new Error("PERFORMANCE_MEASUREMENT_INVALID");
  }
  return {
    ...receipt,
    desktopFrameP95,
    mobileFrameP95,
    frameMeasurementState: "MEASURED",
  };
}
