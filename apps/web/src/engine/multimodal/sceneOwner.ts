/**
 * SceneIR owner surface for the website product lane.
 * Reuses the multimodal MM-5 SceneCompiler without inventing a second engine.
 * Source SHA: c08c6929ad57885a3d16eb10f1cd07b2a5ed4949
 */
export { SceneCompiler, globalSceneCompiler } from "./sceneCompiler.ts";
export type {
  SceneIR,
  Scene3DCompilationResult,
  Scene3DStatus,
  Scene3DCamera,
  Scene3DGeometry,
  Scene3DMaterial,
  Scene3DLight,
  Scene3DObject,
  Scene3DScrollTrack,
  Scene3DPerformanceBudget,
} from "./types.ts";
