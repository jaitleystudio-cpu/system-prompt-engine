export interface SceneObjectSpec {
  id: string;
  kind: "box" | "sphere" | "plane" | "model";
  position: [number, number, number];
}

export interface SceneIR {
  version: "scene-ir/1";
  camera: { position: [number, number, number]; target: [number, number, number] };
  lights: { id: string; kind: "ambient" | "directional" | "point"; intensity: number }[];
  objects: SceneObjectSpec[];
}

export function createEmptySceneIR(): SceneIR {
  return {
    version: "scene-ir/1",
    camera: { position: [0, 0, 5], target: [0, 0, 0] },
    lights: [],
    objects: [],
  };
}
