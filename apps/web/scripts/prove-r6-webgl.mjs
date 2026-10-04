#!/usr/bin/env node
/**
 * Browser proof for /website SceneIR WebGL.
 * Does not flip WEBGL_EXECUTION or threeVersion source constants.
 * Writes proofs/r6-webgl-20261004/execution.json from the live page.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");
const proofDir = join(repoRoot, "proofs/r6-webgl-20261004");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 5194;
const url = `http://127.0.0.1:${port}/website`;

function read(path) {
  return readFileSync(join(webRoot, path), "utf8");
}

const installed = JSON.parse(
  readFileSync(join(webRoot, "node_modules/three/package.json"), "utf8"),
).version;

const ledger = read("src/shell/mountStatus.ts");
const flow = read("src/website/productFlow.ts");
const compiler = read("src/engine/multimodal/sceneCompiler.ts");
const constants = {
  ledgerWebglNotRun: /WEBGL_EXECUTION:\s*"NOT_RUN"/.test(ledger),
  ledgerSceneNotPass: !/SCENE3D:\s*"PASS"/.test(ledger) && !/WEBGL_EXECUTION:\s*"PASS"/.test(ledger),
  flowNotRun: /export const WEBGL_EXECUTION = "NOT_RUN"/.test(flow),
  compilerNotBundled: /threeVersion:\s*"NOT_BUNDLED"/.test(compiler),
  compilerNotRun: /webglExecution:\s*"NOT_RUN"/.test(compiler),
};
if (Object.values(constants).some((ok) => !ok)) {
  console.error("SOURCE_CONSTANTS_MOVED", constants);
  process.exit(2);
}

mkdirSync(proofDir, { recursive: true });

const vite = spawn(
  join(webRoot, "node_modules/.bin/vite"),
  ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: webRoot, stdio: ["ignore", "pipe", "pipe"] },
);
let viteLog = "";
vite.stdout.on("data", (chunk) => {
  viteLog += chunk.toString();
});
vite.stderr.on("data", (chunk) => {
  viteLog += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      /* not up */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`vite did not serve /website\n${viteLog.slice(-2000)}`);
}

function watch(page, bucket) {
  page.on("console", (msg) => {
    bucket.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (error) => {
    bucket.push({ type: "pageerror", text: String(error) });
  });
}

async function readScene(page) {
  await page.waitForSelector("[data-scene-settled='1']", { timeout: 30000 });
  return page.locator(".website-scene").evaluate((node) => {
    const attr = (name) => node.getAttribute(name);
    const canvas = node.querySelector("canvas");
    return {
      webglExecution: attr("data-webgl-execution"),
      threeVersion: attr("data-three-version"),
      threeRevision: attr("data-three-revision"),
      contextCreated: attr("data-context-created"),
      sceneCreated: attr("data-scene-created"),
      nonClearPixels: Number(attr("data-non-clear-pixels")),
      sampledPixels: Number(attr("data-sampled-pixels")),
      reducedMotion: attr("data-reduced-motion"),
      fallbackShown: attr("data-fallback-shown"),
      unavailableHonest: attr("data-unavailable-honest"),
      bundling: attr("data-bundling"),
      note: attr("data-frame-note"),
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      dataUrl: canvas?.toDataURL("image/png") ?? null,
    };
  });
}

const evidence = {
  route: "/website",
  installedThreeVersion: installed,
  constants,
  executed: null,
  reducedMotion: null,
  unavailable: null,
  dispose: null,
  contextLoss: null,
  consoleErrors: [],
  framePng: null,
};

let exitCode = 1;
try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--use-angle=metal"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const logs = [];
  watch(page, logs);
  await page.goto(url, { waitUntil: "networkidle" });
  const scene = await readScene(page);
  evidence.executed = scene;
  if (scene.dataUrl) {
    const png = Buffer.from(scene.dataUrl.split(",")[1], "base64");
    writeFileSync(join(proofDir, "frame.png"), png);
    evidence.framePng = "proofs/r6-webgl-20261004/frame.png";
    delete scene.dataUrl;
  }
  const loss = await page.evaluate(async () => {
    const handle = window.__SPE_SCENE_HANDLE;
    if (!handle) return { error: "no handle" };
    const report = await handle.loseAndRestore();
    return {
      contextLossRecovery: report.contextLossRecovery,
      contextLossNonClearPixels: report.contextLossNonClearPixels,
      webglExecution: report.webglExecution,
    };
  });
  evidence.contextLoss = loss;
  const disposeLogs = [];
  page.on("pageerror", (error) => disposeLogs.push(String(error)));
  await page.getByRole("button", { name: "Unmount scene" }).click();
  await page.waitForTimeout(200);
  evidence.dispose = {
    label: await page.locator(".website-scene").getAttribute("data-dispose"),
    pageErrorsDuringDispose: disposeLogs,
  };
  evidence.consoleErrors = logs.filter(
    (entry) => entry.type === "error" || entry.type === "pageerror",
  );
  await browser.close();

  const reducedBrowser = await chromium.launch({
    executablePath: chrome,
    headless: true,
  });
  const reduced = await reducedBrowser.newPage();
  const reducedLogs = [];
  watch(reduced, reducedLogs);
  await reduced.emulateMedia({ reducedMotion: "reduce" });
  await reduced.goto(url, { waitUntil: "networkidle" });
  const reducedScene = await readScene(reduced);
  delete reducedScene.dataUrl;
  evidence.reducedMotion = {
    scene: reducedScene,
    consoleErrors: reducedLogs.filter((entry) => entry.type === "error" || entry.type === "pageerror"),
  };
  await reducedBrowser.close();

  const blocked = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-webgl",
      "--disable-webgl2",
      "--disable-3d-apis",
    ],
  });
  const blockedPage = await blocked.newPage();
  const blockedLogs = [];
  watch(blockedPage, blockedLogs);
  await blockedPage.goto(url, { waitUntil: "networkidle" });
  const blockedScene = await readScene(blockedPage);
  delete blockedScene.dataUrl;
  evidence.unavailable = {
    scene: blockedScene,
    consoleErrors: blockedLogs.filter((entry) => entry.type === "error" || entry.type === "pageerror"),
  };
  await blocked.close();

  const frameOk =
    evidence.executed.webglExecution === "EXECUTED" &&
    evidence.executed.contextCreated === "1" &&
    evidence.executed.sceneCreated === "1" &&
    evidence.executed.nonClearPixels >= 50 &&
    evidence.executed.threeVersion === installed &&
    evidence.executed.bundling === "vite-import-three-package";
  const fallbackOk =
    evidence.reducedMotion.scene.reducedMotion === "1" &&
    evidence.reducedMotion.scene.fallbackShown === "1" &&
    evidence.reducedMotion.scene.webglExecution !== "EXECUTED";
  const unavailableOk =
    evidence.unavailable.scene.webglExecution !== "EXECUTED" &&
    evidence.unavailable.scene.unavailableHonest === "1";
  const disposeOk = evidence.dispose.label === "ok";
  evidence.checks = { frameOk, fallbackOk, unavailableOk, disposeOk };
  writeFileSync(join(proofDir, "execution.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence.checks, null, 2));
  console.log("pixels", evidence.executed.nonClearPixels, "version", evidence.executed.threeVersion);
  console.log("consoleErrors", evidence.consoleErrors.length);
  exitCode = frameOk && fallbackOk && unavailableOk && disposeOk ? 0 : 1;
} catch (error) {
  evidence.fatal = String(error?.stack || error);
  writeFileSync(join(proofDir, "execution.json"), JSON.stringify(evidence, null, 2));
  console.error(evidence.fatal);
  exitCode = 1;
} finally {
  vite.kill("SIGTERM");
  setTimeout(() => vite.kill("SIGKILL"), 1500);
}
process.exit(exitCode);
