#!/usr/bin/env node
/**
 * R3-D browser product flow.
 * Runs the existing TS website-spec compiler through productFlow and
 * optionally the canonical MM-5 SceneCompiler owner (c08c692).
 * Does not fetch. Does not claim LIVE_URL_RECONSTRUCTION.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flowUrl = pathToFileURL(
  path.join(__dirname, "../src/website/productFlow.ts"),
).href;
const contractUrl = pathToFileURL(
  path.join(__dirname, "../src/website/mount-contract.ts"),
).href;
const ownerUrl = pathToFileURL(
  path.join(__dirname, "../src/engine/multimodal/sceneOwner.ts"),
).href;

const {
  runWebsiteProduct,
  SCENE_IR_WIRED,
  SCENE_3D,
  AI_GENERATION,
  LIVE_URL_RECONSTRUCTION,
  SHELL_MOUNT,
  SCENE_IR_SOURCE_SHA,
  SCENE_IR_OWNER_PATH,
  WEBGL_EXECUTION,
} = await import(flowUrl);
const { websiteMountContract } = await import(contractUrl);
const { SceneCompiler } = await import(ownerUrl);

const spec = {
  spec_version: "website-spec/1",
  title: "R3 Room",
  language: "en",
  summary: "Offline static page.",
  theme: "light",
  pages: [
    {
      path: "index.html",
      title: "Home",
      sections: [{ kind: "prose", heading: "Copy", body: "Local text." }],
    },
  ],
};

const multiPage = {
  ...structuredClone(spec),
  pages: [
    {
      path: "index.html",
      title: "Home",
      sections: [
        {
          kind: "cta",
          heading: "Next",
          cta_label: "About",
          cta_href: "about.html",
        },
      ],
    },
    {
      path: "about.html",
      title: "About",
      sections: [{ kind: "prose", heading: "About", body: "Second page." }],
    },
  ],
};

const validScene = {
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
      castShadow: true,
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
      scale: [1, 1, 1],
    },
  ],
  scrollTracks: [
    {
      objectId: "hero-orb",
      property: "rotation.y",
      startScrollRatio: 0.0,
      endScrollRatio: 1.0,
      fromValue: 0.0,
      toValue: 6.28,
    },
  ],
  performanceBudget: {
    maxDpr: 1.5,
    maxDrawCalls: 50,
    maxTriangles: 10000,
    targetFps: 60,
  },
  accessibilityFallback: {
    hero2dSvg: "<svg><circle r='50'/></svg>",
    textDescription: "A central quantum orb that rotates as you scroll.",
    ariaRegionLabel: "Interactive 3D Quantum Scene",
  },
};

let fetched = false;
globalThis.fetch = () => {
  fetched = true;
  throw new Error("fetch");
};

// --- plain website ---
const first = runWebsiteProduct({ kind: "website_spec", spec });
const second = runWebsiteProduct({ kind: "website_spec", spec });
assert.equal(first.status, "LOCAL_EXPORT_READY");
assert.equal(first.exportHtml, second.exportHtml);
assert.equal(first.fetchedUrl, false);
assert.equal(first.networkPerformed, false);
assert.equal(first.contentSecurityPolicy, true);
assert.equal(first.reducedMotion, true);
assert.match(first.exportHtml, /http-equiv="Content-Security-Policy"/);
assert.match(first.exportHtml, /prefers-reduced-motion/);
assert.doesNotMatch(first.exportHtml, /<\s*script/i);
assert.equal((first.exportHtml.match(/<!DOCTYPE html>/gi) || []).length, 1);
assert.equal(first.aiGeneration, "NOT_AVAILABLE");
assert.equal(first.scene3d, "NOT_AVAILABLE");
assert.equal(first.liveUrlReconstruction, "NOT_AVAILABLE");
assert.equal(first.sceneIrWired, true);
assert.equal(first.shellMount, "NOT_DONE");
assert.equal(first.sceneHtml, null);

// --- responsive (viewport + fluid reflow contract in compiler CSS) ---
assert.match(first.exportHtml, /viewport/);
assert.match(first.exportHtml, /max-width|@media|360/i);

// --- script breakout escaped ---
const scriptBody = structuredClone(spec);
scriptBody.pages[0].sections[0].body = '<script>alert("x")</script>';
const escaped = runWebsiteProduct({ kind: "website_spec", spec: scriptBody });
assert.equal(escaped.status, "LOCAL_EXPORT_READY");
assert.match(escaped.exportHtml, /&lt;script&gt;/);
assert.doesNotMatch(escaped.exportHtml, /<script>/);

// --- style breakout refused via compiler ---
const styleBody = structuredClone(spec);
styleBody.pages[0].sections[0].body = "</style><script>alert(1)</script>";
const styleEscaped = runWebsiteProduct({ kind: "website_spec", spec: styleBody });
assert.equal(styleEscaped.status, "LOCAL_EXPORT_READY");
assert.match(styleEscaped.exportHtml, /&lt;\/style&gt;/);
assert.doesNotMatch(styleEscaped.exportHtml, /<\/style><script>/i);

// --- malicious href ---
for (const href of ["javascript:alert(1)", "https://evil.example/", "//evil.example/x"]) {
  const bad = structuredClone(spec);
  bad.pages[0].sections[0] = {
    kind: "cta",
    heading: "Next",
    cta_label: "Go",
    cta_href: href,
  };
  const rejected = runWebsiteProduct({ kind: "website_spec", spec: bad });
  assert.equal(rejected.status, "REJECTED", href);
  assert.equal(rejected.previewHtml, null);
}

// --- invalid page path ---
const invalidPage = structuredClone(spec);
invalidPage.pages[0].path = "../evil.html";
const badPage = runWebsiteProduct({ kind: "website_spec", spec: invalidPage });
assert.equal(badPage.status, "REJECTED");

// --- multiple pages ---
const multi = runWebsiteProduct({ kind: "website_spec", spec: multiPage });
assert.equal(multi.status, "LOCAL_EXPORT_READY");
assert.match(multi.exportHtml, /about\.html/);

// --- raw HTML is not a spec ---
const rawHtml = runWebsiteProduct({
  kind: "website_spec",
  spec: "<!DOCTYPE html><html><script>alert(1)</script></html>",
});
assert.equal(rawHtml.status, "REJECTED");
assert.equal(rawHtml.reasons[0], "HTML_IS_NOT_A_WEBSITE_SPEC");

// --- local saved html is not live URL ---
const saved = runWebsiteProduct({
  kind: "local_saved_html",
  filename: "notes.html",
  html: "<!DOCTYPE html><html><body><p>saved</p></body></html>",
});
assert.equal(saved.status, "REFUSED");
assert.equal(saved.localSavedHtmlIsLiveUrl, false);
assert.equal(saved.previewHtml, null);
assert.notEqual(saved.sourceKind, "live_url");

const hostile = runWebsiteProduct({
  kind: "local_saved_html",
  filename: "bad.html",
  html: "<html><script>alert(1)</script></html>",
});
assert.equal(hostile.status, "REJECTED");
assert.equal(hostile.previewHtml, null);

// --- live URL stays unavailable / not fetched ---
const live = runWebsiteProduct({ kind: "live_url", url: "https://harbor.example/books" });
assert.equal(live.status, "REFUSED");
assert.equal(live.fetchedUrl, false);
assert.equal(live.liveUrlReconstruction, "NOT_AVAILABLE");
assert.equal(fetched, false);

// --- optional SceneIR via canonical owner ---
const withScene = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: validScene,
});
assert.equal(withScene.status, "LOCAL_EXPORT_READY");
assert.equal(withScene.scene3d, "AVAILABLE");
assert.notEqual(withScene.scene3d, "PASS");
assert.ok(withScene.sceneHtml);
assert.equal(withScene.sceneTriangles, 960);
assert.match(withScene.sceneHtml, /hero-orb/);
assert.match(withScene.sceneHtml, /SphereGeometry/);
assert.doesNotMatch(withScene.sceneHtml, /BoxGeometry/);
assert.match(withScene.sceneHtml, /#6366f1/);
assert.match(withScene.sceneHtml, /6\.28/);
assert.match(withScene.sceneHtml, /prefers-reduced-motion/);
assert.match(withScene.sceneHtml, /static-fallback/);
assert.match(withScene.sceneHtml, /__SPE_OFFLINE_FALLBACK/);
assert.match(withScene.sceneHtml, /__SPE_WEBGL_EXECUTION = "NOT_RUN"/);
assert.doesNotMatch(withScene.sceneHtml, /Rebuilding scene/);
assert.equal(withScene.scrollTracksSupported, true);
assert.equal(withScene.contextLossRecoverySupported, false);
assert.equal(withScene.contextRestoredSupported, false);
assert.equal(withScene.webglExecution, "EVIDENCE:/tmp/spe-webgl-r6c/frame.png@b73818629311a472936e64662ff5188e7e1db305d710c28c6d9ba8f979acf2cc;/tmp/spe-webgl-r6c/reduced-motion.json@82078622caf6f87f3285c0bdebd561bb787c4e44f9ada1ab8c2484656fc400a5;/tmp/spe-webgl-r6c/unavailable.json@13fe0860b8720301f8c820d52ddb825308f86afe12b974ffba73415f2609a0a7");
assert.equal(
  withScene.contextLossRecoverySupported,
  withScene.sceneHtml.includes("function rebuildSceneFromIR(") &&
    withScene.sceneHtml.includes("disposeRecoveredScene("),
);
assert.equal(withScene.liveUrlReconstruction, "NOT_AVAILABLE");
// website preview stays separate from scene one-file export artifact
assert.match(withScene.previewHtml, /Content-Security-Policy/);
assert.doesNotMatch(withScene.previewHtml, /THREE\.PerspectiveCamera/);
assert.equal((withScene.sceneHtml.match(/<!DOCTYPE html>/gi) || []).length, 1);

// reopen / deterministic second compile
const withScene2 = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: validScene,
});
assert.equal(withScene.sceneHtml, withScene2.sceneHtml);
assert.equal(withScene.sceneId, withScene2.sceneId);

// --- zero objects ---
const zero = structuredClone(validScene);
zero.objects = [];
const zeroResult = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: zero,
});
assert.equal(zeroResult.status, "REJECTED");
assert.ok(zeroResult.reasons.some((r) => /ZERO_OBJECTS|at least one/i.test(r)));

// --- invalid geometry ---
const badGeom = structuredClone(validScene);
badGeom.objects[0].geometry = { type: "malware-mesh", parameters: {} };
const badGeomResult = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: badGeom,
});
assert.equal(badGeomResult.status, "REJECTED");
assert.ok(badGeomResult.reasons.includes("SCENE_INVALID_GEOMETRY"));

// --- malicious SceneIR ---
const malicious = structuredClone(validScene);
malicious.title = '<script>alert(1)</script>';
const maliciousResult = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: malicious,
});
assert.equal(maliciousResult.status, "REJECTED");
assert.ok(maliciousResult.reasons.includes("MALICIOUS_SCENEIR_REFUSED"));

const remoteScene = structuredClone(validScene);
remoteScene.accessibilityFallback.textDescription = "see https://evil.example/";
const remoteSceneResult = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: remoteScene,
});
assert.equal(remoteSceneResult.status, "REJECTED");
assert.ok(remoteSceneResult.reasons.includes("MALICIOUS_SCENEIR_REFUSED"));

// --- large scene ---
const large = structuredClone(validScene);
large.objects = Array.from({ length: 40 }, (_, i) => ({
  ...structuredClone(validScene.objects[0]),
  id: `obj-${i}`,
  name: `Obj ${i}`,
  position: [i % 5, Math.floor(i / 5), 0],
}));
const largeResult = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: large,
});
assert.equal(largeResult.status, "LOCAL_EXPORT_READY");
assert.equal(largeResult.scene3d, "AVAILABLE");
assert.ok(largeResult.sceneTriangles > 0);

const tooLarge = structuredClone(validScene);
tooLarge.objects = Array.from({ length: 300 }, (_, i) => ({
  ...structuredClone(validScene.objects[0]),
  id: `obj-${i}`,
  name: `Obj ${i}`,
  position: [0, 0, 0],
}));
const tooLargeResult = runWebsiteProduct({
  kind: "website_spec",
  spec,
  sceneDefinition: tooLarge,
});
assert.equal(tooLargeResult.status, "REJECTED");
assert.ok(tooLargeResult.reasons.includes("SCENE_TOO_LARGE"));

// --- direct owner checks: WebGL unavailable / memory disposal markers ---
const owner = new SceneCompiler();
const compiled = owner.compile(validScene);
assert.equal(compiled.status, "AVAILABLE");
assert.equal(compiled.totalTriangles, 960);
assert.equal(compiled.webglExecution, "EVIDENCE:/tmp/spe-webgl-r6c/frame.png@b73818629311a472936e64662ff5188e7e1db305d710c28c6d9ba8f979acf2cc;/tmp/spe-webgl-r6c/reduced-motion.json@82078622caf6f87f3285c0bdebd561bb787c4e44f9ada1ab8c2484656fc400a5;/tmp/spe-webgl-r6c/unavailable.json@13fe0860b8720301f8c820d52ddb825308f86afe12b974ffba73415f2609a0a7");
assert.equal(compiled.threeVersion, "0.170.0");
assert.match(compiled.standaloneHtml, /\.\/vendor\/three\.min\.js/);
assert.match(compiled.standaloneHtml, /08fd7545d13d2c7fb65ab691530a802dafefd638596501854f267d0fb13c39e7/);
assert.match(compiled.standaloneHtml, /readPixels/);
assert.match(compiled.standaloneHtml, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(compiled.standaloneHtml, /putImageData/);
assert.equal(compiled.webglExecution, "EVIDENCE:/tmp/spe-webgl-r6c/frame.png@b73818629311a472936e64662ff5188e7e1db305d710c28c6d9ba8f979acf2cc;/tmp/spe-webgl-r6c/reduced-motion.json@82078622caf6f87f3285c0bdebd561bb787c4e44f9ada1ab8c2484656fc400a5;/tmp/spe-webgl-r6c/unavailable.json@13fe0860b8720301f8c820d52ddb825308f86afe12b974ffba73415f2609a0a7");
assert.equal(withScene.sceneHtml, compiled.standaloneHtml);
assert.equal(
  compiled.reducedMotionSupported,
  compiled.standaloneHtml.includes("prefers-reduced-motion") &&
    compiled.standaloneHtml.includes("static-fallback"),
);
assert.equal(compiled.contextLossRecoverySupported, false);
assert.equal(
  compiled.contextLossRecoverySupported,
  compiled.standaloneHtml.includes("function rebuildSceneFromIR(") &&
    compiled.standaloneHtml.includes("disposeRecoveredScene("),
);
assert.doesNotMatch(compiled.standaloneHtml, /webglcontextrestored/);
assert.doesNotMatch(compiled.standaloneHtml, /<h1>\s*<script>/i);
assert.doesNotMatch(compiled.standaloneHtml, /Rebuilding scene/);

const alpha = structuredClone(validScene);
alpha.title = "Alpha";
alpha.objects = [{
  ...structuredClone(validScene.objects[0]),
  id: "alpha-sphere",
  name: "Alpha",
  geometry: { type: "sphere", parameters: {} },
  material: { ...validScene.objects[0].material, color: "#112233" },
}];
alpha.accessibilityFallback = {
  ...alpha.accessibilityFallback,
  textDescription: "alpha-fallback-copy",
};
const beta = structuredClone(validScene);
beta.title = "Beta";
beta.objects = [{
  ...structuredClone(validScene.objects[0]),
  id: "beta-box",
  name: "Beta",
  geometry: { type: "box", parameters: {} },
  material: { ...validScene.objects[0].material, color: "#445566" },
}];
beta.accessibilityFallback = {
  ...beta.accessibilityFallback,
  textDescription: "beta-fallback-copy",
};
beta.scrollTracks = [];
const alphaCompiled = owner.compile(alpha);
const betaCompiled = owner.compile(beta);
assert.equal(alphaCompiled.totalTriangles, 960);
assert.equal(betaCompiled.totalTriangles, 12);
assert.notEqual(alphaCompiled.standaloneHtml, betaCompiled.standaloneHtml);
assert.match(alphaCompiled.standaloneHtml, /SphereGeometry/);
assert.match(alphaCompiled.standaloneHtml, /#112233/);
assert.match(alphaCompiled.standaloneHtml, /alpha-sphere/);
assert.match(alphaCompiled.standaloneHtml, /alpha-fallback-copy/);
assert.match(alphaCompiled.standaloneHtml, /6\.28/);
assert.doesNotMatch(alphaCompiled.standaloneHtml, /BoxGeometry/);
assert.doesNotMatch(alphaCompiled.standaloneHtml, /#445566/);
assert.doesNotMatch(alphaCompiled.standaloneHtml, /beta-box/);
assert.doesNotMatch(alphaCompiled.standaloneHtml, /beta-fallback-copy/);
assert.match(betaCompiled.standaloneHtml, /BoxGeometry/);
assert.match(betaCompiled.standaloneHtml, /#445566/);
assert.match(betaCompiled.standaloneHtml, /beta-box/);
assert.match(betaCompiled.standaloneHtml, /beta-fallback-copy/);
assert.doesNotMatch(betaCompiled.standaloneHtml, /SphereGeometry/);
assert.doesNotMatch(betaCompiled.standaloneHtml, /#112233/);
assert.doesNotMatch(betaCompiled.standaloneHtml, /alpha-sphere/);
assert.doesNotMatch(betaCompiled.standaloneHtml, /alpha-fallback-copy/);
assert.doesNotMatch(betaCompiled.standaloneHtml, /6\.28/);

const tampered = structuredClone(validScene);
tampered.objects[0].geometry = { type: "malware-mesh", parameters: {} };
assert.throws(() => owner.compile(tampered), /unsupported geometry/);

const evilTitle = structuredClone(validScene);
evilTitle.title = "<script>alert(1)</script>";
const evilCompiled = owner.compile(evilTitle);
assert.doesNotMatch(evilCompiled.standaloneHtml, /<h1>\s*<script>alert\(1\)<\/script>/i);
assert.doesNotMatch(evilCompiled.standaloneHtml, /<title>\s*<script>alert\(1\)<\/script>/i);
assert.match(
  evilCompiled.standaloneHtml,
  /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt; - SPE 3D Scene<\/title>/,
);
assert.match(
  evilCompiled.standaloneHtml,
  /<h1>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h1>/,
);
assert.equal(evilCompiled.totalTriangles, 960);

// --- module / mount contract truth ---
assert.equal(SCENE_IR_WIRED, true);
assert.equal(SCENE_3D, "OWNER_WIRED");
assert.notEqual(SCENE_3D, "PASS");
assert.equal(WEBGL_EXECUTION, "EVIDENCE:/tmp/spe-webgl-r6c/frame.png@b73818629311a472936e64662ff5188e7e1db305d710c28c6d9ba8f979acf2cc;/tmp/spe-webgl-r6c/reduced-motion.json@82078622caf6f87f3285c0bdebd561bb787c4e44f9ada1ab8c2484656fc400a5;/tmp/spe-webgl-r6c/unavailable.json@13fe0860b8720301f8c820d52ddb825308f86afe12b974ffba73415f2609a0a7");
assert.equal(AI_GENERATION, "NOT_AVAILABLE");
assert.equal(LIVE_URL_RECONSTRUCTION, "NOT_AVAILABLE");
assert.equal(SHELL_MOUNT, "NOT_DONE");
assert.equal(SCENE_IR_SOURCE_SHA, "c08c6929ad57885a3d16eb10f1cd07b2a5ed4949");
assert.equal(
  SCENE_IR_OWNER_PATH,
  "apps/web/src/engine/multimodal/sceneCompiler.ts",
);
assert.equal(websiteMountContract.routeMountStatus, "NOT_INTEGRATED");
assert.equal(websiteMountContract.shellMount, "NOT_DONE");
assert.equal(websiteMountContract.shellEditsInThisLane, false);
assert.equal(websiteMountContract.silentFetch, false);
assert.equal(websiteMountContract.sceneIrWired, true);
assert.equal(
  websiteMountContract.sceneIrSourceSha,
  "c08c6929ad57885a3d16eb10f1cd07b2a5ed4949",
);
assert.equal(
  websiteMountContract.reused.sceneEngine,
  "apps/web/src/engine/multimodal/sceneCompiler.ts",
);
assert.equal(websiteMountContract.capabilities.liveUrlReconstruction, "NOT_AVAILABLE");

const ui = readFileSync(
  path.join(__dirname, "../src/website/WebsiteProduct.tsx"),
  "utf8",
);
assert.match(ui, /sandbox=""/);
assert.match(ui, /data-scene-ir-wired="true"/);
assert.doesNotMatch(ui, /fetch\s*\(/);
assert.doesNotMatch(ui, /AI_GENERATION\s*=\s*"PASS"/);
assert.doesNotMatch(ui, /LIVE_URL_RECONSTRUCTION\s*=\s*"PASS"/);
assert.doesNotMatch(ui, /LIVE_URL_RECONSTRUCTION/);

const css = readFileSync(
  path.join(__dirname, "../src/website/website-product.css"),
  "utf8",
);
assert.match(css, /prefers-reduced-motion/);

// owner blob identity (import-extension port only on sceneCompiler)
const sceneCompilerSrc = readFileSync(
  path.join(__dirname, "../src/engine/multimodal/sceneCompiler.ts"),
  "utf8",
);
assert.match(sceneCompilerSrc, /MM-5: Deterministic SceneIR/);
assert.match(sceneCompilerSrc, /from "\.\.\/hashUtils\.ts"/);
assert.doesNotMatch(sceneCompilerSrc, /second SceneCompiler|invent/i);

console.log(
  "R3-D website product flow: local spec export, SceneIR owner wired, live URL unavailable, shell mount not done",
);
