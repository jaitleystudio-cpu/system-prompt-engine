/**
 * Detailed safety and collision validator for CameraPlans.
 */
import type { CameraPlan } from "../model/cameraPlan.ts";
import { validateCameraPlan } from "../model/cameraPlan.ts";

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface CameraValidationOptions {
  meshBounds?: BoundingBox[];
  maxVelocityUnitsPerSec?: number;
}

export function validateCameraPlanDetailed(
  plan: CameraPlan,
  options: CameraValidationOptions = {},
): void {
  validateCameraPlan(plan);

  const maxVelocity = options.maxVelocityUnitsPerSec || 20;

  for (let i = 0; i < plan.shots.length; i++) {
    const shot = plan.shots[i];

    // Check mesh collision
    if (options.meshBounds) {
      for (const bbox of options.meshBounds) {
        const [x, y, z] = shot.position;
        const insideX = x >= bbox.min[0] && x <= bbox.max[0];
        const insideY = y >= bbox.min[1] && y <= bbox.max[1];
        const insideZ = z >= bbox.min[2] && z <= bbox.max[2];

        if (insideX && insideY && insideZ) {
          throw new Error(
            `CAMERA_INSIDE_MESH: Shot "${shot.id}" camera is positioned inside object mesh bounds`,
          );
        }
      }
    }

    // Check velocity if duration > 0
    const durationSec = (shot.end - shot.start) / 1000;
    if (durationSec > 0) {
      const distFromOrigin = Math.sqrt(
        shot.position[0] ** 2 + shot.position[1] ** 2 + shot.position[2] ** 2,
      );
      const velocity = distFromOrigin / durationSec;
      if (velocity > maxVelocity * 10) {
        throw new Error(
          `EXCESSIVE_VELOCITY: Camera movement speed (${velocity.toFixed(1)} units/sec) exceeds safety threshold`,
        );
      }
    }
  }
}
