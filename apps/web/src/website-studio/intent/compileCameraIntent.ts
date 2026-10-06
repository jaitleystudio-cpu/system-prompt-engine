import { validateCameraPlan, type CameraPlan, type CameraShot } from "../model/cameraPlan.ts";

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

export function compileCameraIntent(raw: string): CameraPlan | undefined {
  const lower = raw.trim().toLowerCase();
  if (!/camera|orbit|push[- ]?in|flythrough|shot|cinematic|automotive/.test(lower)) {
    return undefined;
  }

  const shots: CameraShot[] = [
    shot("establish", "Establish subject", 0, 0.45, [-1.8, 1.4, 8], [0, 0.4, 0]),
  ];

  if (/orbit|automotive|cinematic/.test(lower)) {
    shots.push(shot("orbit", "Reveal volume with a controlled orbit", 0.45, 0.75, [2.2, 1.2, 6.5], [0, 0.25, 0]));
  }
  if (/push[- ]?in|dramatic|automotive|cinematic/.test(lower)) {
    shots.push(shot("settle", "Push toward hero detail and settle", shots.at(-1)?.end ?? 0.45, 1, [0.4, 0.9, 5.2], [0, 0.35, 0]));
  } else {
    const last = shots[shots.length - 1];
    last.end = 1;
  }

  const plan: CameraPlan = { shots };
  validateCameraPlan(plan);
  return plan;
}
