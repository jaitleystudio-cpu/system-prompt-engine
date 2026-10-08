/**
 * Typed dispatcher for MaterialActions.
 */
import type { MaterialAction } from "../model/behaviorGraph.ts";

export interface MutableMaterialState {
  roughness?: number;
  metalness?: number;
  color?: string;
  wireframe?: boolean;
}

export function executeMaterialAction(
  action: MaterialAction | { type: string; [key: string]: unknown },
  materials: Map<string, MutableMaterialState>
): void {
  switch (action.type) {
    case "set-material-property": {
      const targetId = action.targetId as string;
      const mat = materials.get(targetId);
      if (mat) {
        const prop = action.property as keyof MutableMaterialState;
        (mat as Record<string, unknown>)[prop] = action.value;
      }
      break;
    }

    default:
      throw new Error(`UNSUPPORTED_ACTION: Action type "${action.type}" is not a recognized typed MaterialAction`);
  }
}
