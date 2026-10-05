import {
  validateCameraPlan,
  type CameraPlan,
  type CameraShot,
} from "../model/cameraPlan.ts";

export type CameraPreset =
  | "Hero Reveal"
  | "Luxury Orbit"
  | "Product Inspection"
  | "Dramatic Push-In"
  | "Architectural Flythrough"
  | "Macro Detail"
  | "Exploded Assembly"
  | "Story Journey";

function shot(
  id: string,
  intent: string,
  start: number,
  end: number,
  position: [number, number, number],
  target: [number, number, number],
): CameraShot {
  return {
    id,
    intent,
    start,
    end,
    position,
    target,
    fov: 55,
    easing: "cinematic",
    responsiveVariant: {
      position: [position[0] * 0.55, position[1] * 0.7, Math.max(5, position[2])],
      target,
      fov: 60,
    },
    reducedMotionVariant: {
      position: [0, 1.2, 7],
      target,
      fov: 60,
    },
  };
}

export function createCameraPlanFromPreset(preset: CameraPreset): CameraPlan {
  const target: [number, number, number] = [0, 0.4, 0];
  let shots: CameraShot[];
  switch (preset) {
    case "Luxury Orbit":
      shots = [
        shot("establish", "Establish premium subject", 0, 0.35, [-1.6, 1.4, 8], target),
        shot("orbit", "Controlled luxury orbit", 0.35, 0.72, [2.2, 1.1, 6.4], target),
        shot("settle", "Hero settle", 0.72, 1, [0.5, 1.0, 5.6], target),
      ];
      break;
    case "Dramatic Push-In":
      shots = [
        shot("establish", "Wide establish", 0, 0.45, [0, 1.2, 9], target),
        shot("push", "Dramatic push-in", 0.45, 1, [0, 0.9, 4.8], target),
      ];
      break;
    default:
      shots = [
        shot("establish", preset + " establish", 0, 0.5, [-1, 1.2, 7.5], target),
        shot("resolve", preset + " resolve", 0.5, 1, [1, 1.0, 5.8], target),
      ];
  }
  const plan: CameraPlan = { shots };
  validateCameraPlan(plan);
  return plan;
}
