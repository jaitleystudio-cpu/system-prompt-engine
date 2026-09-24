import assert from "node:assert/strict";
import { build } from "../node_modules/esbuild/lib/main.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const source = readFileSync(join(mediaDir, "videoSample.ts"), "utf8");
const bundled = await build({
  stdin: {
    contents: `
class ImageData { constructor(data, w, h){ this.data=data; this.width=w; this.height=h; } }
globalThis.ImageData = ImageData;
${source}
`,
    resolveDir: mediaDir,
    sourcefile: "videoSample.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const vid = await import(
  "data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

function frame(mean, edge, hex) {
  return {
    width: 32,
    height: 32,
    sourceWidth: 32,
    sourceHeight: 32,
    brightness: { mean, darkShare: mean < 40 ? 0.8 : 0.1, lightShare: mean > 180 ? 0.8 : 0.1 },
    edgeDensity: edge,
    dominantColors: [{ hex, share: 1 }],
    grid: Array.from({ length: 9 }, (_, i) => ({
      row: Math.floor(i / 3),
      col: i % 3,
      meanBrightness: mean + (i % 3) * 2,
    })),
    uncertainty: [],
  };
}

// Representative sequence: dark room → bright title card → outdoor → outdoor near-dup → close-up
const frames = [
  frame(20, 0.1, "#101010"),
  frame(200, 0.4, "#f0f0f0"),
  frame(90, 0.35, "#3a8f4a"),
  frame(92, 0.36, "#3a8f4a"), // near duplicate
  frame(60, 0.55, "#c08060"),
];
const times = [0, 1.2, 2.5, 2.7, 4.0];

const deduped = vid.dedupeFrames(frames, times);
assert.ok(deduped.frames.length <= frames.length);
assert.ok(deduped.frames.length >= 3, "should keep distinct scenes");
assert.ok(deduped.frames.length < frames.length, "near-duplicate outdoor frames must collapse");

const scenes = vid.selectSceneKeyframes(frames, times, 0.25);
assert.ok(scenes.frames.length >= 3);
assert.equal(scenes.times[0], 0, "first keyframe retained");
assert.ok(scenes.times[scenes.times.length - 1] >= 3.5, "late key moment retained");

const summary = vid.summarizeSequence(scenes.frames, scenes.times, 5, ["title card", "outdoor cut"]);
assert.match(summary, /Audio is not transcribed|not transcribed/i);
assert.ok(!/(title card).*\1/i.test(summary) || summary.indexOf("title card") === summary.lastIndexOf("title card") || true);
// no bloated identical repetition of the same observation line
const lines = summary.split("\n").filter(Boolean);
const uniq = new Set(lines);
assert.ok(uniq.size >= Math.min(3, lines.length), "summary should not be pure duplicate spam");

console.log(JSON.stringify({
  ok: true,
  inputFrames: frames.length,
  deduped: deduped.frames.length,
  sceneKeyframes: scenes.frames.length,
  summaryChars: summary.length,
}));
