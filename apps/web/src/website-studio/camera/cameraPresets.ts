/**
 * 8 Cinematic Camera Presets for the Camera Director.
 */
import type { CameraPlan } from "../model/cameraPlan.ts";

export const CAMERA_PRESETS: Record<string, CameraPlan> = {
  "Hero Reveal": {
    shots: [
      {
        id: "hero-shot-1",
        intent: "wide-arrival",
        start: 0,
        end: 1500,
        position: [0, 3, 8],
        target: [0, 0, 0],
        fov: 45,
        easing: { type: "ease-out" },
        reducedMotionVariant: { dampingFactor: 0.1 }
      }
    ]
  },
  "Luxury Orbit": {
    shots: [
      {
        id: "orbit-shot-1",
        intent: "slow-luxury-orbit",
        start: 0,
        end: 3000,
        position: [2.5, 1.5, 4],
        target: [0, 0.2, 0],
        fov: 40,
        easing: { type: "cinematic" }
      }
    ]
  },
  "Product Inspection": {
    shots: [
      {
        id: "inspect-shot-1",
        intent: "dolly-close-inspection",
        start: 0,
        end: 2000,
        position: [0, 0.8, 2.5],
        target: [0, 0, 0],
        fov: 35,
        easing: { type: "ease-in-out" }
      }
    ]
  },
  "Dramatic Push-In": {
    shots: [
      {
        id: "push-shot-1",
        intent: "dramatic-push-in",
        start: 0,
        end: 1200,
        position: [0, 1.2, 3],
        target: [0, 0.5, 0],
        fov: 50,
        easing: { type: "ease-in" }
      }
    ]
  },
  "Architectural Flythrough": {
    shots: [
      {
        id: "arch-shot-1",
        intent: "high-angle-flythrough",
        start: 0,
        end: 4000,
        position: [5, 6, 8],
        target: [0, 0, 0],
        fov: 55,
        easing: { type: "cinematic" }
      }
    ]
  },
  "Macro Detail": {
    shots: [
      {
        id: "macro-shot-1",
        intent: "macro-texture-focus",
        start: 0,
        end: 2500,
        position: [0.5, 0.3, 1.2],
        target: [0, 0, 0],
        fov: 28,
        easing: { type: "ease-out" }
      }
    ]
  },
  "Exploded Assembly": {
    shots: [
      {
        id: "assembly-shot-1",
        intent: "isometric-assembly-view",
        start: 0,
        end: 3500,
        position: [4, 4, 4],
        target: [0, 0, 0],
        fov: 38,
        easing: { type: "cinematic" }
      }
    ]
  },
  "Story Journey": {
    shots: [
      {
        id: "story-shot-1",
        intent: "multi-stage-narrative",
        start: 0,
        end: 5000,
        position: [0, 2, 6],
        target: [0, 0, 0],
        fov: 45,
        easing: { type: "cinematic" }
      }
    ]
  }
};

export function getCameraPreset(name: string): CameraPlan | undefined {
  return CAMERA_PRESETS[name];
}
