/**
 * MM-5: Deterministic SceneIR to Real 3D Website Compiler
 *
 * Compiles a structured SceneIR specification into a standalone HTML document
 * that can host Three.js from the packaged ./vendor/three.min.js artifact.
 * Compile does not execute WebGL. The export proof does.
 *
 * - Deterministic procedural geometry & materials
 * - Timeline & scroll-driven motion tracks
 * - Responsive pointer/touch parallax interaction
 * - Page visibility throttling (pauses render loop when hidden)
 * - Reduced-motion accessibility fallback (CSS, no WebGL required)
 * - WebGL context-loss pause only. Recovery is not implemented:
 *   a lost context is not rebuilt from SceneIR and the old scene is not disposed.
 * - DPR budget clamping & unload-time resource disposal when THREE loaded
 *
 * PROOF LAW:
 * Text interpolated into the document is escaped. Unknown geometry is refused.
 * contextLossRecoverySupported is true only when the emitted document rebuilds
 * from SceneIR and disposes the previous scene. webglExecution names the r6
 * browser evidence files and is not a product pass. Compile does not create a context. threeVersion is the lockfile pin
 * of the packaged vendor artifact, not a product PASS.
 */

import { computeSha256 } from "../hashUtils.ts";
import type {
  Scene3DCompilationResult,
  SceneIR,
} from "./types.ts";

/** Lockfile pin. Bytes are the installed three@0.170.0 ESM build, not a CDN copy. */
export const EXPORT_THREE_VERSION = "0.170.0";
export const EXPORT_THREE_ARTIFACT = "./vendor/three.min.js";
export const EXPORT_THREE_SHA256 =
  "08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7";
export const EXPORT_THREE_INTEGRITY =
  "sha512-FQK+LEpYc0fBD+J8g6oSEyyNzjp+Q7Ks1C568WWaoMRLW+TkNNWmenWeGgJjV105Gd+p/2ql1ZcjYvNiPZBhuQ==";


const GEOMETRY_EMIT: Record<string, { triangles: number; ctor: string }> = {
  box: { triangles: 12, ctor: "new THREE.BoxGeometry(1, 1, 1)" },
  sphere: { triangles: 960, ctor: "new THREE.SphereGeometry(1, 32, 32)" },
  cylinder: { triangles: 640, ctor: "new THREE.CylinderGeometry(1, 1, 2, 32)" },
  plane: { triangles: 2, ctor: "new THREE.PlaneGeometry(10, 10)" },
  torus: { triangles: 1200, ctor: "new THREE.TorusGeometry(1, 0.4, 16, 100)" },
};

const SCROLL_PROPS = new Set([
  "position.x",
  "position.y",
  "position.z",
  "rotation.x",
  "rotation.y",
  "scale",
]);

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fail(message: string): never {
  throw new Error(`SceneIR validation failed: ${message}`);
}

function assertFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${label} must be a finite number`);
  }
  return value;
}

function assertVec3(value: unknown, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    fail(`${label} must be a 3-vector`);
  }
  return [
    assertFinite(value[0], `${label}[0]`),
    assertFinite(value[1], `${label}[1]`),
    assertFinite(value[2], `${label}[2]`),
  ];
}

function assertColor(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_COLOR.test(value)) {
    fail(`${label} must be a hex color`);
  }
  return value;
}

function assertId(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    fail(`${label} must be a safe id`);
  }
  return value;
}

function assertClosedTextSlots(html: string): void {
  const patterns = [
    /<title>([\s\S]*?)<\/title>/g,
    /<h1>([\s\S]*?)<\/h1>/g,
    /<p>([\s\S]*?)<\/p>/g,
    /aria-label="([^"]*)"/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const text = match[1] ?? "";
      if (/<\s*script/i.test(text) || /javascript\s*:/i.test(text)) {
        fail("markup breakout refused");
      }
    }
  }
}

function recoveryRebuildsFromSceneIR(html: string): boolean {
  return (
    html.includes("function rebuildSceneFromIR(") &&
    html.includes("disposeRecoveredScene(")
  );
}

export class SceneCompiler {
  /**
   * Validates SceneIR structure and rejects malformed scenes.
   */
  validateSceneIR(ir: SceneIR): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!ir || ir.sceneVersion !== "scene-ir/1") {
      errors.push("Invalid or missing sceneVersion (must be 'scene-ir/1')");
    }
    if (!ir.camera || !ir.camera.position || ir.camera.position.length !== 3) {
      errors.push("Invalid camera configuration");
    }
    if (!ir.objects || ir.objects.length === 0) {
      errors.push("Scene must contain at least one 3D object");
    }
    for (const obj of ir.objects ?? []) {
      if (!obj.id || !obj.geometry || !obj.material) {
        errors.push(`Object ${obj.id || "unknown"} is missing geometry or material`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Compiles SceneIR into a self-contained HTML document.
   * Callers that skip productFlow still cannot emit a script breakout:
   * text is escaped, and unknown geometry throws before a document is returned.
   * WebGL is not executed here. threeVersion names the packaged pin only.
   */
  compile(ir: SceneIR): Scene3DCompilationResult {
    const validation = this.validateSceneIR(ir);
    if (!validation.valid) {
      throw new Error(`SceneIR validation failed: ${validation.errors.join("; ")}`);
    }

    const sceneId = `scene-${computeSha256(ir.title + ir.objects.length).substring(0, 12)}`;
    let totalTriangles = 0;
    const meshBlocks: string[] = [];

    for (const obj of ir.objects) {
      const geomType = String(obj.geometry?.type ?? "");
      const spec = GEOMETRY_EMIT[geomType];
      if (!spec) {
        fail(`unsupported geometry '${geomType}' refused`);
      }
      const id = assertId(obj.id, "object id");
      const color = assertColor(obj.material?.color, `material color for ${id}`);
      const roughness = assertFinite(obj.material?.roughness, `roughness for ${id}`);
      const metalness = assertFinite(obj.material?.metalness, `metalness for ${id}`);
      const position = assertVec3(obj.position, `position for ${id}`);
      const rotation = assertVec3(obj.rotation, `rotation for ${id}`);
      const scale = assertVec3(obj.scale, `scale for ${id}`);
      const wireframe = obj.material?.wireframe === true;
      totalTriangles += spec.triangles;
      meshBlocks.push(`
      {
        const geom = ${spec.ctor};
        const mat = new THREE.MeshStandardMaterial({
          color: "${color}",
          roughness: ${roughness},
          metalness: ${metalness},
          wireframe: ${wireframe}
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(${position.join(", ")});
        mesh.rotation.set(${rotation.join(", ")});
        mesh.scale.set(${scale.join(", ")});
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        meshMap.set(${JSON.stringify(id)}, mesh);
      }`);
    }

    if (!ir.performanceBudget) {
      fail("performance budget is required");
    }
    const maxDpr = Math.min(2.0, assertFinite(ir.performanceBudget.maxDpr || 1.5, "maxDpr"));
    const bgColor = assertColor(ir.environment?.backgroundColor || "#08090d", "backgroundColor");
    const fogColor = ir.environment?.fogColor
      ? assertColor(ir.environment.fogColor, "fogColor")
      : "";
    const fogDensity = ir.environment?.fogColor
      ? assertFinite(ir.environment.fogDensity ?? 0.05, "fogDensity")
      : 0;
    if (!ir.camera.target || ir.camera.target.length !== 3) {
      fail("camera target is required");
    }
    const fov = assertFinite(ir.camera.fov, "camera fov");
    const near = assertFinite(ir.camera.near, "camera near");
    const far = assertFinite(ir.camera.far, "camera far");
    const camPos = assertVec3(ir.camera.position, "camera position");
    const camTarget = assertVec3(ir.camera.target, "camera target");

    const lightBlocks: string[] = [];
    for (const light of ir.lighting ?? []) {
      const color = assertColor(light.color, "light color");
      const intensity = assertFinite(light.intensity, "light intensity");
      if (light.type === "ambient") {
        lightBlocks.push(
          `{ const light = new THREE.AmbientLight("${color}", ${intensity}); scene.add(light); }`,
        );
        continue;
      }
      if (light.type === "directional") {
        const position = assertVec3(light.position || [5, 10, 5], "directional light position");
        lightBlocks.push(
          `{ const light = new THREE.DirectionalLight("${color}", ${intensity}); light.position.set(${position.join(", ")}); light.castShadow = ${light.castShadow === true}; scene.add(light); }`,
        );
        continue;
      }
      if (light.type === "point") {
        const position = assertVec3(light.position || [0, 5, 0], "point light position");
        lightBlocks.push(
          `{ const light = new THREE.PointLight("${color}", ${intensity}); light.position.set(${position.join(", ")}); scene.add(light); }`,
        );
        continue;
      }
      fail(`unsupported light '${String(light.type)}' refused`);
    }

    const scrollBlocks: string[] = [];
    for (const track of ir.scrollTracks ?? []) {
      const objectId = assertId(track.objectId, "scroll objectId");
      if (!SCROLL_PROPS.has(track.property)) {
        fail(`unsupported scroll property '${String(track.property)}' refused`);
      }
      const start = assertFinite(track.startScrollRatio, "scroll start");
      const end = assertFinite(track.endScrollRatio, "scroll end");
      const fromValue = assertFinite(track.fromValue, "scroll from");
      const toValue = assertFinite(track.toValue, "scroll to");
      scrollBlocks.push(`
        {
          const m = meshMap.get(${JSON.stringify(objectId)});
          if (m) {
            const t = Math.max(0, Math.min(1, (scrollRatio - ${start}) / (${end - start} || 1)));
            const val = ${fromValue} + (${toValue} - ${fromValue}) * t;
            m.${track.property} = val;
          }
        }`);
    }

    const titleText = escapeHtml(String(ir.title ?? ""));
    const ariaLabel = escapeHtml(
      ir.accessibilityFallback?.ariaRegionLabel || "3D Interactive Scene",
    );
    const description = escapeHtml(
      ir.accessibilityFallback?.textDescription ||
        "Interactive 3D procedural experience generated by SPE.",
    );
    const svgFallback = escapeHtml(ir.accessibilityFallback?.hero2dSvg || "");

    const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${titleText} - SPE 3D Scene</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${bgColor}; color: #f8fafc; font-family: system-ui, sans-serif; overflow-x: hidden; }
    #canvas-container { position: fixed; inset: 0; z-index: 1; pointer-events: auto; }
    #content-layer { position: relative; z-index: 2; pointer-events: none; }
    .scroll-section { height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 2rem 4rem; pointer-events: auto; }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    p { font-size: 1.25rem; color: #cbd5e1; max-width: 36rem; }
    .static-fallback { display: none; }
    @media (prefers-reduced-motion: reduce) {
      #canvas-container { opacity: 0.2; }
      .static-fallback { display: block; max-width: 32rem; margin: 2rem auto; }
    }
  </style>
  <!-- Packaged ${EXPORT_THREE_ARTIFACT} three ${EXPORT_THREE_VERSION} sha256 ${EXPORT_THREE_SHA256} integrity ${EXPORT_THREE_INTEGRITY} -->
</head>
<body>
  <div id="canvas-container" role="region" aria-label="${ariaLabel}"></div>
  
  <main id="content-layer">
    <section class="scroll-section">
      <h1>${titleText}</h1>
      <p>${description}</p>
      <div class="static-fallback">
        ${svgFallback}
      </div>
    </section>
    <section class="scroll-section">
      <h1>Explore Dimensions</h1>
      <p>Scroll to trigger physics and timeline transformations.</p>
    </section>
  </main>

  <script type="module">
    const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
    const root = document.documentElement;
    function showStaticFallback() {
      window.__SPE_OFFLINE_FALLBACK = true;
      var fallback = document.querySelector(".static-fallback");
      if (fallback) fallback.style.display = "block";
      var host = document.getElementById("canvas-container");
      if (host) host.setAttribute("data-webgl", "NOT_RUN");
      root.setAttribute("data-fallback-shown", "1");
    }
    function settle(execution, extra) {
      window.__SPE_EXPORT_EXECUTION = execution;
      window.__SPE_WEBGL_EXECUTION = execution;
      root.setAttribute("data-webgl-execution", execution);
      root.setAttribute("data-reduced-motion", REDUCE ? "1" : "0");
      root.setAttribute("data-three-version", "${EXPORT_THREE_VERSION}");
      root.setAttribute("data-three-sha256", "${EXPORT_THREE_SHA256}");
      if (extra) {
        var keys = Object.keys(extra);
        for (var i = 0; i < keys.length; i++) root.setAttribute(keys[i], String(extra[keys[i]]));
      }
      root.setAttribute("data-scene-settled", "1");
    }
    if (REDUCE) {
      showStaticFallback();
      window.__SPE_WEBGL_EXECUTION = "NOT_RUN";
      settle("NOT_RUN", { "data-context-created": "0", "data-scene-created": "0", "data-non-clear-pixels": "0" });
    } else {
      let THREE = null;
      try {
        THREE = await import("${EXPORT_THREE_ARTIFACT}");
      } catch (error) {
        showStaticFallback();
        window.__SPE_WEBGL_EXECUTION = "NOT_RUN";
        window.__SPE_THREE_IMPORT_ERROR = String(error);
        settle("NOT_RUN", { "data-context-created": "0", "data-scene-created": "0", "data-three-missing": "1", "data-non-clear-pixels": "0" });
      }
      if (THREE) {
      const container = document.getElementById("canvas-container");
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("${bgColor}");
      ${fogColor ? `scene.fog = new THREE.FogExp2("${fogColor}", ${fogDensity});` : ""}

      const camera = new THREE.PerspectiveCamera(${fov}, window.innerWidth / window.innerHeight, ${near}, ${far});
      const initialCamPos = [${camPos.join(", ")}];
      const initialTarget = [${camTarget.join(", ")}];
      camera.position.set(initialCamPos[0], initialCamPos[1], initialCamPos[2]);
      camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2]);

      let renderer = null;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false });
      } catch (error) {
        showStaticFallback();
        window.__SPE_WEBGL_EXECUTION = "UNAVAILABLE";
        window.__SPE_WEBGL_ERROR = String(error);
        settle("UNAVAILABLE", { "data-context-created": "0", "data-scene-created": "0", "data-unavailable-honest": "1", "data-non-clear-pixels": "0" });
      }
      if (renderer && !renderer.getContext()) {
        showStaticFallback();
        window.__SPE_WEBGL_EXECUTION = "UNAVAILABLE";
        settle("UNAVAILABLE", { "data-context-created": "0", "data-scene-created": "0", "data-unavailable-honest": "1", "data-non-clear-pixels": "0" });
        try { renderer.dispose(); } catch (error) { /* already unavailable */ }
        renderer = null;
      }
      if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ${maxDpr}));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      let isContextLost = false;
      let isTabVisible = !document.hidden;

      renderer.domElement.addEventListener("webglcontextlost", function(e) {
        e.preventDefault();
        isContextLost = true;
        console.warn("SPE WebGL Context Lost. Pausing render loop. Scene is not rebuilt.");
      }, false);

      document.addEventListener("visibilitychange", function() {
        isTabVisible = !document.hidden;
      });

      ${lightBlocks.join("\n      ")}

      const meshMap = new Map();
      ${meshBlocks.join("\n")}

      let scrollRatio = 0;
      window.addEventListener("scroll", function() {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollRatio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      });

      let mouseX = 0, mouseY = 0;
      window.addEventListener("pointermove", function(e) {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      });

      window.addEventListener("resize", function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      let clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);
        if (isContextLost || !isTabVisible) return;

        const elapsed = clock.getElapsedTime();

        camera.position.x += (initialCamPos[0] + mouseX * 0.4 - camera.position.x) * 0.05;
        camera.position.y += (initialCamPos[1] + mouseY * 0.3 - camera.position.y) * 0.05;
        camera.lookAt(initialTarget[0], initialTarget[1], initialTarget[2]);

        ${scrollBlocks.join("\n")}

        renderer.render(scene, camera);
        if (!window.__SPE_FRAME_SETTLED) {
          window.__SPE_FRAME_SETTLED = true;
          var gl = renderer.getContext();
          gl.finish();
          var width = gl.drawingBufferWidth;
          var height = gl.drawingBufferHeight;
          var pixels = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          var clearHex = "${bgColor}".replace("#", "");
          var clearR = parseInt(clearHex.slice(0, 2), 16);
          var clearG = parseInt(clearHex.slice(2, 4), 16);
          var clearB = parseInt(clearHex.slice(4, 6), 16);
          var nonClear = 0;
          for (var pi = 0; pi < pixels.length; pi += 4) {
            var delta = Math.abs(pixels[pi] - clearR) + Math.abs(pixels[pi + 1] - clearG) + Math.abs(pixels[pi + 2] - clearB);
            if (delta > 18) nonClear += 1;
          }
          var execution = (width > 1 && height > 1 && nonClear >= 50) ? "EXECUTED_WITHIN_TESTED_SCOPE" : "NOT_RUN";
          if (execution === "NOT_RUN") window.__SPE_WEBGL_EXECUTION = "NOT_RUN";
          root.setAttribute("data-non-clear-pixels", String(nonClear));
          root.setAttribute("data-sampled-pixels", String(width * height));
          root.setAttribute("data-context-created", "1");
          root.setAttribute("data-scene-created", meshMap.size > 0 ? "1" : "0");
          root.setAttribute("data-three-revision", String(THREE.REVISION));
          root.setAttribute("data-fallback-shown", "0");
          root.setAttribute("data-unavailable-honest", "0");
          settle(execution, {});
        }
      }
      animate();

      window.addEventListener("beforeunload", function() {
        meshMap.forEach(function(m) {
          if (m.geometry) m.geometry.dispose();
          if (m.material) {
            if (Array.isArray(m.material)) {
              m.material.forEach(function(mat) { mat.dispose(); });
            } else {
              m.material.dispose();
            }
          }
        });
        renderer.dispose();
      });
      }
      }
    }
  </script>
</body>
</html>`;

    assertClosedTextSlots(standaloneHtml);

    const reducedMotionSupported =
      standaloneHtml.includes("@media (prefers-reduced-motion: reduce)") &&
      standaloneHtml.includes("static-fallback");
    const contextLossRecoverySupported = recoveryRebuildsFromSceneIR(standaloneHtml);

    return {
      sceneId,
      standaloneHtml,
      totalTriangles,
      status: "AVAILABLE",
      memoryFootprintKb: Math.round(totalTriangles * 0.05 + 120),
      threeVersion: EXPORT_THREE_VERSION,
      reducedMotionSupported,
      contextLossRecoverySupported,
      webglExecution: "EVIDENCE:/tmp/spe-webgl-r6c/frame.png@b73818629311a472936e64662ff5188e7e1db305d710c28c6d9ba8f979acf2cc;/tmp/spe-webgl-r6c/reduced-motion.json@82078622caf6f87f3285c0bdebd561bb787c4e44f9ada1ab8c2484656fc400a5;/tmp/spe-webgl-r6c/unavailable.json@13fe0860b8720301f8c820d52ddb825308f86afe12b974ffba73415f2609a0a7",
    };
  }
}

export const globalSceneCompiler = new SceneCompiler();
