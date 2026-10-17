export type Vec3 = [number, number, number];

export interface CameraVariant {
  position?: Vec3;
  target?: Vec3;
  fov?: number;
}

export interface CameraShot {
  id: string;
  intent: string;
  start: number;
  end: number;
  position: Vec3;
  target: Vec3;
  fov?: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "cinematic";
  responsiveVariant?: CameraVariant;
  reducedMotionVariant?: CameraVariant;
}

export interface CameraPlan {
  shots: CameraShot[];
}

function validVec3(value: unknown): value is Vec3 {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function validateCameraPlan(plan: CameraPlan): void {
  if (!plan || !Array.isArray(plan.shots)) throw new Error("camera shots must be an array");
  const ids = new Set<string>();
  for (const shot of plan.shots) {
    if (!shot.id || ids.has(shot.id)) throw new Error("camera shot ids must be unique");
    ids.add(shot.id);
    if (!Number.isFinite(shot.start) || !Number.isFinite(shot.end) || shot.start < 0 || shot.end > 1 || shot.end < shot.start) {
      throw new Error("camera shots must stay within normalized timeline");
    }
    if (!validVec3(shot.position) || !validVec3(shot.target)) throw new Error("camera vectors must be finite vec3 values");
    if (shot.fov != null && (!Number.isFinite(shot.fov) || shot.fov < 10 || shot.fov > 140)) {
      throw new Error("camera fov must be between 10 and 140");
    }
  }
}
