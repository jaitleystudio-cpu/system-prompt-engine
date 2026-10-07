/**
 * SPE-R9-H lab perf fixtures. Harness-only (not product copy, not a schema).
 * Uses the existing MM-5 SceneIR shape owned by engine/multimodal.
 *
 * studio-representative-v1 is a non-empty Studio hero scene with real
 * geometry, three light types and fog, rendered every sampled frame by the
 * existing scene runtime. It is a lab workload, not a production claim.
 */
export const REPRESENTATIVE_FIXTURE_ID = "studio-representative-v1";
export const EMPTY_FIXTURE_ID = "studio-empty-v1";

const ring = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return {
    id: `ring-box-${i}`,
    name: `Ring box ${i}`,
    geometry: { type: "box", parameters: { width: 1, height: 1, depth: 1 } },
    material: {
      type: "standard",
      color: i % 2 ? "#22d3ee" : "#a78bfa",
      roughness: 0.35,
      metalness: 0.4,
    },
    position: [Number((Math.cos(angle) * 4).toFixed(4)), 0.4, Number((Math.sin(angle) * 4).toFixed(4))],
    rotation: [0, angle, 0],
    scale: [0.6, 0.6, 0.6],
  };
});

export const STUDIO_REPRESENTATIVE_SCENE = {
  sceneVersion: "scene-ir/1",
  title: "Studio Representative Hero",
  theme: "dark",
  camera: {
    type: "perspective",
    fov: 55,
    position: [0, 2.4, 9],
    target: [0, 0.4, 0],
    near: 0.1,
    far: 200,
  },
  environment: { backgroundColor: "#05070a", fogColor: "#05070a", fogDensity: 0.035 },
  lighting: [
    { id: "ambient", type: "ambient", color: "#ffffff", intensity: 0.45 },
    { id: "key", type: "directional", color: "#c7d2fe", intensity: 1.1, position: [5, 10, 5], castShadow: false },
    { id: "rim", type: "point", color: "#22d3ee", intensity: 0.9, position: [-4, 3, -2] },
  ],
  objects: [
    {
      id: "hero-core",
      name: "Hero core",
      geometry: { type: "sphere", parameters: { radius: 1.4 } },
      material: { type: "standard", color: "#6366f1", roughness: 0.2, metalness: 0.8 },
      position: [0, 0.6, 0],
      rotation: [0, 0, 0],
      scale: [1.4, 1.4, 1.4],
    },
    {
      id: "hero-halo",
      name: "Hero halo",
      geometry: { type: "torus", parameters: { radius: 2.2, tube: 0.2 } },
      material: { type: "standard", color: "#f472b6", roughness: 0.3, metalness: 0.6 },
      position: [0, 0.6, 0],
      rotation: [1.2, 0, 0],
      scale: [1.6, 1.6, 1.6],
    },
    {
      id: "pillar-left",
      name: "Pillar left",
      geometry: { type: "cylinder", parameters: { radius: 0.4, height: 3 } },
      material: { type: "standard", color: "#94a3b8", roughness: 0.6, metalness: 0.2 },
      position: [-5.5, 0, -2],
      rotation: [0, 0, 0],
      scale: [0.5, 1.2, 0.5],
    },
    {
      id: "pillar-right",
      name: "Pillar right",
      geometry: { type: "cylinder", parameters: { radius: 0.4, height: 3 } },
      material: { type: "standard", color: "#94a3b8", roughness: 0.6, metalness: 0.2 },
      position: [5.5, 0, -2],
      rotation: [0, 0, 0],
      scale: [0.5, 1.2, 0.5],
    },
    {
      id: "floor",
      name: "Floor",
      geometry: { type: "plane", parameters: { width: 10, height: 10 } },
      material: { type: "standard", color: "#0f172a", roughness: 0.9, metalness: 0 },
      position: [0, -1.4, 0],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [3, 3, 3],
    },
    ...ring,
  ],
  scrollTracks: [],
  performanceBudget: { maxDpr: 1.5, maxDrawCalls: 50, maxTriangles: 10000, targetFps: 60 },
  accessibilityFallback: {
    hero2dSvg:
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='30' r='14' fill='#6366f1'/></svg>",
    textDescription: "A glowing core inside a ring of shapes.",
    ariaRegionLabel: "Studio hero scene",
  },
};
