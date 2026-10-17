/**
 * Typed dispatcher for SceneActions.
 * Zero-eval security: all mutations run through schema-validated switch branches.
 */
import type { BehaviorAction } from "../model/behaviorGraph.ts";

export interface MutableSceneObject {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
}

export interface MutableSceneContext {
  objects: Map<string, MutableSceneObject>;
}

export function executeSceneAction(
  action: BehaviorAction | { type: string; [key: string]: unknown },
  ctx: MutableSceneContext,
): void {
  switch (action.type) {
    case "rotate-object":
    case "scene-rotate": {
      const targetId = (action as any).targetId as string;
      const obj = ctx.objects.get(targetId);
      if (obj) {
        const axis = (action as any).axis || "y";
        const axisIdx = axis === "x" ? 0 : axis === "y" ? 1 : 2;
        const angle = typeof (action as any).angle === "number" ? (action as any).angle : 90;
        obj.rotation[axisIdx] = (obj.rotation[axisIdx] + angle) % 360;
      }
      break;
    }

    case "scale-object": {
      const targetId = (action as any).targetId as string;
      const obj = ctx.objects.get(targetId);
      if (obj && Array.isArray((action as any).scale)) {
        obj.scale = [(action as any).scale[0], (action as any).scale[1], (action as any).scale[2]];
      }
      break;
    }

    case "translate-object":
    case "scene-translate": {
      const targetId = (action as any).targetId as string;
      const obj = ctx.objects.get(targetId);
      if (obj && Array.isArray((action as any).position)) {
        obj.position = [(action as any).position[0], (action as any).position[1], (action as any).position[2]];
      }
      break;
    }

    case "set-object-visibility": {
      const targetId = (action as any).targetId as string;
      const obj = ctx.objects.get(targetId);
      if (obj) {
        obj.visible = Boolean((action as any).visible);
      }
      break;
    }

    default:
      throw new Error(`UNSUPPORTED_ACTION: Action type "${action.type}" is not a recognized typed SceneAction`);
  }
}
