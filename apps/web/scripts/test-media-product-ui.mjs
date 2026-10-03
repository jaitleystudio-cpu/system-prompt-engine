import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const here = dirname(fileURLToPath(import.meta.url));
const mediaDir = join(here, "../src/media");

const bundled = await build({
  stdin: {
    contents: [
      'export * from "./mediaProductModel.ts";',
      'export * from "./mount-contract.ts";',
    ].join("\n"),
    resolveDir: mediaDir,
    sourcefile: "media-product-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

assert.equal(mod.MEDIA_PRODUCT_ROUTE_PATH, "/media");
assert.equal(mod.MEDIA_PRODUCT_COMPONENT_NAME, "MediaProductPanel");
assert.equal(mod.MEDIA_PRODUCT_MOUNT.productMediaV1, "NOT_PASS");
assert.equal(mod.MEDIA_PRODUCT_MOUNT.uiMounted, false);
assert.equal(mod.MEDIA_PRODUCT_MOUNT.remainingGap, "SHELL_MOUNT");

assert.equal(
  mod.resolveMediaMode({ provider: "whisper-cli", assetsReady: true, neuralSessionRan: true }),
  "LOCAL_NEURAL",
);
assert.equal(
  mod.resolveMediaMode({ provider: "whisper-cli", assetsReady: true, neuralSessionRan: false }),
  "LOCAL_FALLBACK",
);
assert.equal(
  mod.resolveMediaMode({ provider: "web-speech", assetsReady: true, neuralSessionRan: true }),
  "BROWSER_SERVICE",
);
assert.equal(
  mod.resolveMediaMode({ provider: "whisper-cli", assetsReady: false, neuralSessionRan: false }),
  "UNAVAILABLE",
);
assert.equal(mod.acceptModelProgress([1421]), null);
assert.equal(mod.acceptModelProgress([10, 40]), 40);

let state = mod.initialMediaPanelState();
state = mod.reduceMediaPanel(state, { type: "select", fileName: "amma.wav" });
assert.equal(state.phase, "selected");
assert.equal(state.fileKind, "audio");
assert.equal(state.fileLeavesDevice, false);
state = mod.reduceMediaPanel(state, { type: "start" });
assert.equal(state.phase, "working");
assert.equal(state.attempts, 1);
assert.equal(state.egressAttempts, 0);
state = mod.reduceMediaPanel(state, {
  type: "result",
  result: {
    status: "SPEECH",
    text: "అమ్మా",
    mode: "LOCAL_NEURAL",
    errorCode: null,
    neuralSessionRan: false,
    timestampsProven: true,
    segments: [{ startMs: 0, endMs: 2000, text: "అమ్మా" }],
    progressPercent: 100,
    egressAttempts: 0,
  },
});
assert.equal(state.mode, "UNAVAILABLE");
assert.equal(state.errorCode, "FALSE_NEURAL");
assert.equal(state.text, "");

state = mod.reduceMediaPanel(mod.initialMediaPanelState(), { type: "select", fileName: "clip.mp4" });
state = mod.reduceMediaPanel(state, { type: "start" });
state = mod.reduceMediaPanel(state, {
  type: "result",
  result: {
    status: "NO_SPEECH",
    text: "",
    mode: "LOCAL_FALLBACK",
    errorCode: null,
    neuralSessionRan: false,
    timestampsProven: false,
    segments: [],
    progressPercent: null,
    egressAttempts: 0,
  },
});
assert.equal(state.phase, "review");
assert.equal(state.mode, "LOCAL_FALLBACK");
assert.equal(state.timestampsProven, false);

state = mod.reduceMediaPanel(state, { type: "retry" });
assert.equal(state.phase, "working");
assert.equal(state.attempts, 2);
state = mod.reduceMediaPanel(state, { type: "cancel" });
assert.equal(state.status, "CANCELLED");

const panel = readFileSync(join(mediaDir, "MediaProductPanel.tsx"), "utf8");
assert.match(panel, /export function MediaProductPanel/);
assert.equal(panel.includes("fetch("), false);
assert.equal(panel.includes("SpeechRecognition"), false);
assert.equal(panel.includes("webkitSpeechRecognition"), false);
assert.match(panel, /The file stayed on this device/);

const contract = readFileSync(join(mediaDir, "mount-contract.ts"), "utf8");
assert.match(contract, /MEDIA_PRODUCT_ROUTE_PATH/);
assert.match(contract, /MediaProductPanel/);

console.log("media-product-ui tests: 1 file, assertions passed");
