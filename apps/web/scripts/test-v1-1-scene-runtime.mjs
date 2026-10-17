#!/usr/bin/env node
/**
 * Test: Scene Runtime Action Dispatchers (Workstream E)
 * RED -> GREEN -> MUTATION
 */
import assert from "node:assert/strict";

let runtime;
try {
  runtime = await import("../src/website-studio/behavior/executeSceneAction.ts");
} catch (e) {
  console.log("RED: Failed to import executeSceneAction - expected before implementation:", e.message);
  process.exit(1);
}

const { executeSceneAction } = runtime;
const { executeCameraAction } = await import("../src/website-studio/behavior/executeCameraAction.ts");
const { executeMaterialAction } = await import("../src/website-studio/behavior/executeMaterialAction.ts");

console.log("Running Workstream E scene runtime tests...");

// 1. Scene Object Action Execution
const mockScene = {
  objects: new Map([
    ["hero-shoe", { id: "hero-shoe", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true }]
  ])
};

executeSceneAction(
  { type: "rotate-object", targetId: "hero-shoe", angle: 90, axis: "y" },
  mockScene
);
const shoe = mockScene.objects.get("hero-shoe");
assert.equal(shoe.rotation[1], 90, "Rotate-object must update rotation along y-axis");

executeSceneAction(
  { type: "scale-object", targetId: "hero-shoe", scale: [2, 2, 2] },
  mockScene
);
assert.deepEqual(shoe.scale, [2, 2, 2], "Scale-object must update scale vector");

// 2. Camera Action Execution
const mockCamera = {
  position: [0, 2, 5],
  target: [0, 0, 0],
  fov: 45
};

executeCameraAction(
  { type: "camera-dolly", delta: -1.5 },
  mockCamera
);
assert.equal(mockCamera.position[2], 3.5, "Camera dolly must adjust distance along view vector");

// 3. Material Action Execution
const mockMaterials = new Map([
  ["mat-shoe", { roughness: 0.5, metalness: 0.1, color: "#ffffff" }]
]);

executeMaterialAction(
  { type: "set-material-property", targetId: "mat-shoe", property: "roughness", value: 0.1 },
  mockMaterials
);
assert.equal(mockMaterials.get("mat-shoe").roughness, 0.1, "Material property must update to new value");

// 4. Zero-eval security: passing raw code or unhandled action must be rejected
assert.throws(() => {
  executeSceneAction(
    { type: "eval-code", code: "alert('pwned')" },
    mockScene
  );
}, /UNSUPPORTED_ACTION|SECURITY_VIOLATION/i, "Unrecognized or dangerous action types must be rejected");

console.log("PASS: Workstream E scene runtime tests passed.");
