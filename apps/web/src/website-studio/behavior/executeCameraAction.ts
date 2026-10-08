/**
 * Typed dispatcher for CameraActions.
 */
import type { CameraAction } from "../model/behaviorGraph.ts";

export interface MutableCameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export function executeCameraAction(action: CameraAction | { type: string; [key: string]: unknown }, camera: MutableCameraState): void {
  switch (action.type) {
    case "camera-dolly": {
      const delta = (action.delta as number) || 0;
      // Adjust camera along Z / view depth
      camera.position[2] += delta;
      break;
    }

    case "camera-orbit": {
      const angleDeg = (action.angle as number) || 0;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = camera.position[0];
      const z = camera.position[2];

      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      camera.position[0] = x * cos - z * sin;
      camera.position[2] = x * sin + z * cos;
      break;
    }

    case "camera-switch-shot": {
      // Handled via Shot transitions in CameraDirector
      break;
    }

    default:
      throw new Error(`UNSUPPORTED_ACTION: Action type "${action.type}" is not a recognized typed CameraAction`);
  }
}
