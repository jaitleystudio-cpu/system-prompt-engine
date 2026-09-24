import assert from "node:assert/strict";
import { build } from "../node_modules/esbuild/lib/main.js";
import { join } from "node:path";
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
  "data:text/javascript;base64," +
    Buffer.from(bundled.outputFiles[0].text).toString("base64")
);

function frame(mean, edge, hex) {
  return {
    kind: "image",
    width: 32,
    height: 32,
    sourceWidth: 32,
    sourceHeight: 32,
    aspectRatio: "1:1",
    megapixels: 0.001,
    fileName: null,
    fileBytes: null,
    mimeType: null,
    brightness: {
      mean,
      darkShare: mean < 40 ? 0.8 : 0.1,
      lightShare: mean > 180 ? 0.8 : 0.1,
    },
    edgeDensity: edge,
    dominantColors: [{ hex, share: 1 }],
    grid: Array.from({ length: 9 }, (_, i) => ({
      row: Math.floor(i / 3),
      col: i % 3,
      meanBrightness: mean + (i % 3) * 2,
    })),
    notes: [],
    uncertainty: [],
    licenseNote: "fixture",
  };
}

const frames = [
  frame(20, 0.1, "#101010"),
  frame(200, 0.4, "#f0f0f0"),
  frame(90, 0.35, "#3a8f4a"),
  frame(92, 0.36, "#3a8f4a"),
  frame(60, 0.55, "#c08060"),
];
const times = [0, 1.2, 2.5, 2.7, 4.0];

const deduped = vid.dedupeFrames(frames, times);
assert.ok(deduped.frames.length <= frames.length);
assert.ok(deduped.frames.length >= 3, "should keep distinct scenes");
assert.ok(
  deduped.frames.length < frames.length,
  "near-duplicate outdoor frames must collapse",
);

const scenes = vid.selectSceneKeyframes(frames, times, 0.25);
assert.ok(scenes.frames.length >= 3);
assert.strictEqual(scenes.times[0], 0, "first keyframe retained");
assert.ok(
  scenes.times[scenes.times.length - 1] >= 3.5,
  "late key moment retained",
);
assert.ok(
  scenes.times.some((t) => t >= 1.0 && t <= 1.5),
  "title-card change retained",
);

const summary = vid.summarizeSequence(scenes.frames, scenes.times, 5, [
  "title card",
  "outdoor cut",
  "title card",
]);
assert.match(summary, /Audio is not transcribed|not transcribed/i);
assert.match(summary, /Scene changes:/i);
assert.match(
  summary,
  /brightens|darkens|palette shift|gains detail|loses detail/i,
);
assert.match(summary, /Key moments:/i);
assert.match(summary, /Brightness trend:/i);

const cueMatches = summary.match(/title card/g) || [];
assert.strictEqual(
  cueMatches.length,
  1,
  "duplicate pacing cues must collapse to one mention",
);

const lines = summary
  .split(/[.\n]/)
  .map((s) => s.trim())
  .filter(Boolean);
assert.ok(
  new Set(lines).size >= Math.min(4, lines.length),
  "summary should not be pure duplicate spam",
);
assert.ok(summary.length < 1200, "summary must stay lean (no bloat)");

console.log(
  JSON.stringify({
    ok: true,
    inputFrames: frames.length,
    deduped: deduped.frames.length,
    sceneKeyframes: scenes.frames.length,
    summaryChars: summary.length,
    hasChangeSignals: /Scene changes:/i.test(summary),
    hasKeyMoments: /Key moments:/i.test(summary),
  }),
);
