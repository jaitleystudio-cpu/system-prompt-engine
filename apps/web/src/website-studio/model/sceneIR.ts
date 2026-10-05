import type { SceneIR } from "../../engine/multimodal/types.ts";

export type { SceneIR } from "../../engine/multimodal/types.ts";

/**
 * Studio uses the existing MM-5 SceneIR authority. This factory only
 * supplies a canonical initial value; it does not define a second schema.
 */
export function createEmptySceneIR(): SceneIR {
  return {
    sceneVersion: "scene-ir/1",
    title: "Untitled 3D Scene",
    theme: "dark",
    camera: {
      type: "perspective",
      fov: 60,
      position: [0, 1.2, 7],
      target: [0, 0, 0],
      near: 0.1,
      far: 1000,
    },
    environment: {
      backgroundColor: "#0b0d12",
      fogColor: "#0b0d12",
      fogDensity: 0.02,
    },
    lighting: [],
    objects: [],
    scrollTracks: [],
    performanceBudget: {
      maxDpr: 1.5,
      maxDrawCalls: 50,
      maxTriangles: 10000,
      targetFps: 60,
    },
    accessibilityFallback: {
      hero2dSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0b0d12"/></svg>',
      textDescription: "3D scene preview",
      ariaRegionLabel: "Interactive 3D scene",
    },
  };
}
