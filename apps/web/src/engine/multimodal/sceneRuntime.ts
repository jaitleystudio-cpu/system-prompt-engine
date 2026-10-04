/**
 * Browser execution of an existing SceneIR.
 * Reuses SceneCompiler validation and the same procedural geometry
 * constructors as sceneCompiler.ts. This is not a second website compiler.
 *
 * The compile result stays webglExecution NOT_RUN. threeVersion is the export pin.
 * EXECUTED is assigned only after this module creates a context, builds a scene,
 * and reads back a frame that is not a clear-only buffer.
 */
import * as THREE from "three";
import threePackage from "../../../node_modules/three/package.json";
import { SceneCompiler, type SceneIR } from "./sceneOwner.ts";

export const BUNDLED_THREE_VERSION: string = threePackage.version;
export const THREE_BUNDLING = "vite-import-three-package" as const;

const compiler = new SceneCompiler();

/** Same fixture the website product flow already accepts. No external assets. */
export const WEBSITE_SCENE_IR: SceneIR = {
  sceneVersion: "scene-ir/1",
  title: "Quantum Accelerator Landing",
  theme: "dark",
  camera: {
    type: "perspective",
    fov: 60,
    position: [0, 2, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 1000,
  },
  environment: {
    backgroundColor: "#05070a",
    fogColor: "#05070a",
    fogDensity: 0.04,
  },
  lighting: [
    { id: "ambient", type: "ambient", color: "#ffffff", intensity: 0.6 },
    {
      id: "key",
      type: "directional",
      color: "#818cf8",
      intensity: 1.2,
      position: [5, 10, 5],
      castShadow: false,
    },
  ],
  objects: [
    {
      id: "hero-orb",
      name: "Central Core",
      geometry: { type: "sphere", parameters: { radius: 1.5 } },
      material: {
        type: "standard",
        color: "#6366f1",
        roughness: 0.2,
        metalness: 0.8,
      },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1.6, 1.6, 1.6],
    },
  ],
  scrollTracks: [
    {
      objectId: "hero-orb",
      property: "rotation.y",
      startScrollRatio: 0,
      endScrollRatio: 1,
      fromValue: 0,
      toValue: 6.28,
    },
  ],
  performanceBudget: {
    maxDpr: 1,
    maxDrawCalls: 50,
    maxTriangles: 10000,
    targetFps: 60,
  },
  accessibilityFallback: {
    hero2dSvg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='18' fill='#6366f1'/></svg>",
    textDescription: "A central quantum orb that rotates as you scroll.",
    ariaRegionLabel: "Interactive 3D Quantum Scene",
  },
};

const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 360;

const GEOMETRY: Record<string, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(1, 32, 32),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 32),
  plane: () => new THREE.PlaneGeometry(10, 10),
  torus: () => new THREE.TorusGeometry(1, 0.4, 16, 100),
};

export type WebglExecutionLabel = "NOT_RUN" | "EXECUTED" | "UNAVAILABLE";

export type SceneExecutionReport = {
  webglExecution: WebglExecutionLabel;
  threeVersion: string;
  threeRevision: string;
  bundling: typeof THREE_BUNDLING;
  contextCreated: boolean;
  sceneCreated: boolean;
  frameRendered: boolean;
  nonClearPixels: number;
  sampledPixels: number;
  clearColor: string;
  reducedMotion: boolean;
  fallbackShown: boolean;
  unavailableHonest: boolean;
  disposeThrew: string | null;
  disposed: boolean;
  contextLossRecovery: "NOT_RUN" | "REBUILT" | "FAILED";
  contextLossNonClearPixels: number | null;
  note: string;
};

type Built = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: THREE.Mesh[];
  lights: THREE.Light[];
};

export type SceneMountHandle = {
  report: SceneExecutionReport;
  dispose: () => void;
  loseAndRestore: () => Promise<SceneExecutionReport>;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function buildContents(ir: SceneIR): Built {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ir.environment.backgroundColor);
  if (ir.environment.fogColor) {
    scene.fog = new THREE.FogExp2(
      ir.environment.fogColor,
      ir.environment.fogDensity ?? 0.05,
    );
  }
  const camera = new THREE.PerspectiveCamera(
    ir.camera.fov,
    FRAME_WIDTH / FRAME_HEIGHT,
    ir.camera.near,
    ir.camera.far,
  );
  camera.position.set(ir.camera.position[0], ir.camera.position[1], ir.camera.position[2]);
  camera.lookAt(ir.camera.target[0], ir.camera.target[1], ir.camera.target[2]);
  const meshes: THREE.Mesh[] = [];
  const lights: THREE.Light[] = [];
  for (const light of ir.lighting) {
    if (light.type === "ambient") {
      const made = new THREE.AmbientLight(light.color, light.intensity);
      scene.add(made);
      lights.push(made);
      continue;
    }
    if (light.type === "directional") {
      const made = new THREE.DirectionalLight(light.color, light.intensity);
      const position = light.position ?? [5, 10, 5];
      made.position.set(position[0], position[1], position[2]);
      scene.add(made);
      lights.push(made);
      continue;
    }
    if (light.type === "point") {
      const made = new THREE.PointLight(light.color, light.intensity);
      const position = light.position ?? [0, 5, 0];
      made.position.set(position[0], position[1], position[2]);
      scene.add(made);
      lights.push(made);
    }
  }
  for (const obj of ir.objects) {
    const makeGeometry = GEOMETRY[obj.geometry.type];
    if (!makeGeometry) {
      throw new Error(`unsupported geometry ${obj.geometry.type}`);
    }
    const material = new THREE.MeshStandardMaterial({
      color: obj.material.color,
      roughness: obj.material.roughness,
      metalness: obj.material.metalness,
      wireframe: obj.material.wireframe === true,
    });
    const mesh = new THREE.Mesh(makeGeometry(), material);
    mesh.position.set(obj.position[0], obj.position[1], obj.position[2]);
    mesh.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
    mesh.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
    scene.add(mesh);
    meshes.push(mesh);
  }
  return { scene, camera, meshes, lights };
}

function releaseBuilt(built: Built | null): void {
  if (!built) return;
  for (const mesh of built.meshes) {
    built.scene.remove(mesh);
    try {
      mesh.geometry.dispose();
    } catch {
      /* context already gone */
    }
    const material = mesh.material;
    const list = Array.isArray(material) ? material : [material];
    for (const item of list) {
      try {
        item.dispose();
      } catch {
        /* context already gone */
      }
    }
  }
  for (const light of built.lights) {
    built.scene.remove(light);
  }
}

function hexBytes(clearHex: string): [number, number, number] {
  const hex = clearHex.replace("#", "");
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function countNonClear(gl: WebGLRenderingContext | WebGL2RenderingContext, clearHex: string): {
  nonClear: number;
  sampled: number;
} {
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  if (width < 2 || height < 2) return { nonClear: 0, sampled: 0 };
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const [clearR, clearG, clearB] = hexBytes(clearHex);
  let nonClear = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const delta =
      Math.abs(pixels[i] - clearR) +
      Math.abs(pixels[i + 1] - clearG) +
      Math.abs(pixels[i + 2] - clearB);
    if (delta > 18) nonClear += 1;
  }
  return { nonClear, sampled: width * height };
}

function baseReport(partial: Partial<SceneExecutionReport>): SceneExecutionReport {
  return {
    webglExecution: "NOT_RUN",
    threeVersion: BUNDLED_THREE_VERSION,
    threeRevision: THREE.REVISION,
    bundling: THREE_BUNDLING,
    contextCreated: false,
    sceneCreated: false,
    frameRendered: false,
    nonClearPixels: 0,
    sampledPixels: 0,
    clearColor: WEBSITE_SCENE_IR.environment.backgroundColor,
    reducedMotion: false,
    fallbackShown: false,
    unavailableHonest: false,
    disposeThrew: null,
    disposed: false,
    contextLossRecovery: "NOT_RUN",
    contextLossNonClearPixels: null,
    note: "",
    ...partial,
  };
}

export function mountBundledScene(container: HTMLElement, ir: SceneIR): SceneMountHandle {
  const validation = compiler.validateSceneIR(ir);
  const report = baseReport({
    clearColor: ir.environment?.backgroundColor || "#05070a",
  });
  let built: Built | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let disposed = false;

  const finishUnavailable = (note: string) => {
    report.webglExecution = "UNAVAILABLE";
    report.unavailableHonest = true;
    report.contextCreated = false;
    report.sceneCreated = false;
    report.frameRendered = false;
    report.note = note;
  };

  if (!validation.valid) {
    report.note = validation.errors.join("; ");
    return {
      report,
      dispose() {
        report.disposed = true;
      },
      async loseAndRestore() {
        return report;
      },
    };
  }

  if (prefersReducedMotion()) {
    report.reducedMotion = true;
    report.fallbackShown = true;
    report.webglExecution = "NOT_RUN";
    report.note = "prefers-reduced-motion: static fallback, WebGL not started";
    return {
      report,
      dispose() {
        report.disposed = true;
      },
      async loseAndRestore() {
        report.note = "reduced-motion path has no WebGL context to lose";
        return report;
      },
    };
  }

  const probe = document.createElement("canvas");
  const glProbe =
    probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
    probe.getContext("webgl", { failIfMajorPerformanceCaveat: false });
  if (!glProbe) {
    finishUnavailable("getContext(webgl) returned null");
    return {
      report,
      dispose() {
        report.disposed = true;
      },
      async loseAndRestore() {
        return report;
      },
    };
  }
  const loseProbe = glProbe.getExtension("WEBGL_lose_context");
  loseProbe?.loseContext();

  try {
    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: false,
    });
  } catch (error) {
    finishUnavailable(error instanceof Error ? error.message : "WebGLRenderer threw");
    return {
      report,
      dispose() {
        report.disposed = true;
      },
      async loseAndRestore() {
        return report;
      },
    };
  }

  const context = renderer.getContext();
  if (!context) {
    finishUnavailable("WebGLRenderer.getContext() returned null");
    try {
      renderer.dispose();
    } catch {
      /* already unavailable */
    }
    renderer = null;
    return {
      report,
      dispose() {
        report.disposed = true;
      },
      async loseAndRestore() {
        return report;
      },
    };
  }

  report.contextCreated = true;
  renderer.setPixelRatio(1);
  renderer.setSize(FRAME_WIDTH, FRAME_HEIGHT, false);
  renderer.setClearColor(ir.environment.backgroundColor, 1);
  container.replaceChildren(renderer.domElement);

  try {
    built = buildContents(ir);
  } catch (error) {
    report.note = error instanceof Error ? error.message : "scene build failed";
    report.webglExecution = "NOT_RUN";
    try {
      renderer.dispose();
    } catch {
      /* leave NOT_RUN */
    }
    return {
      report,
      dispose() {
        report.disposed = true;
      },
      async loseAndRestore() {
        return report;
      },
    };
  }
  report.sceneCreated = built.meshes.length > 0 && built.scene.children.length > 0;

  const drawAndCount = () => {
    if (!renderer || !built) return { nonClear: 0, sampled: 0 };
    renderer.render(built.scene, built.camera);
    return countNonClear(renderer.getContext(), ir.environment.backgroundColor);
  };

  const first = drawAndCount();
  const second = drawAndCount();
  const nonClear = Math.max(first.nonClear, second.nonClear);
  report.nonClearPixels = nonClear;
  report.sampledPixels = Math.max(first.sampled, second.sampled);
  report.frameRendered = nonClear >= 50;
  if (report.contextCreated && report.sceneCreated && report.frameRendered) {
    report.webglExecution = "EXECUTED";
    report.note = "readPixels found a non-clear frame";
  } else {
    report.webglExecution = "NOT_RUN";
    report.note = "context or scene existed but the frame was clear-only or empty";
  }

  const onLost = (event: Event) => {
    event.preventDefault();
    releaseBuilt(built);
    built = null;
    report.sceneCreated = false;
  };
  const onRestored = () => {
    if (!renderer || disposed) return;
    try {
      built = buildContents(ir);
      const counted = drawAndCount();
      report.sceneCreated = true;
      report.contextLossNonClearPixels = counted.nonClear;
      report.contextLossRecovery = counted.nonClear >= 50 ? "REBUILT" : "FAILED";
    } catch {
      report.contextLossRecovery = "FAILED";
    }
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost, false);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored, false);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      renderer?.domElement.removeEventListener("webglcontextlost", onLost, false);
      renderer?.domElement.removeEventListener("webglcontextrestored", onRestored, false);
      releaseBuilt(built);
      built = null;
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
      report.disposed = true;
      report.disposeThrew = null;
    } catch (error) {
      report.disposed = true;
      report.disposeThrew = error instanceof Error ? error.message : String(error);
      throw error;
    }
  };

  return {
    report,
    dispose,
    async loseAndRestore() {
      if (!renderer || disposed) {
        report.contextLossRecovery = "FAILED";
        return report;
      }
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_lose_context");
      if (!ext) {
        report.contextLossRecovery = "FAILED";
        report.note = `${report.note}; WEBGL_lose_context missing`;
        return report;
      }
      let restored = false;
      await new Promise<void>((resolve) => {
        renderer?.domElement.addEventListener(
          "webglcontextrestored",
          () => {
            restored = true;
            resolve();
          },
          { once: true },
        );
        ext.loseContext();
        window.setTimeout(() => ext.restoreContext(), 40);
        window.setTimeout(() => resolve(), 1000);
      });
      if (!restored) report.contextLossRecovery = "FAILED";
      return report;
    },
  };
}
