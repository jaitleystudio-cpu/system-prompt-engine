import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "../node_modules/esbuild/lib/main.js";

const source = readFileSync(new URL("../src/media/imageObserve.ts", import.meta.url), "utf8");
const bundled = await build({
  stdin: {
    contents: `
class ImageData { constructor(data, w, h){ this.data=data; this.width=w; this.height=h; } }
globalThis.ImageData = ImageData;
${source}
`,
    resolveDir: new URL("../src/media", import.meta.url).pathname,
    sourcefile: "imageObserve-test.ts",
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
assert.equal(mod.aspectRatioLabel(1920, 1080), "16:9");
const w = 32, h = 32;
const data = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < data.length; i += 4) {
  data[i] = 200; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
}
const obs = mod.observeImageData(
  new ImageData(data, w, h),
  { fileName: "t.png", fileBytes: 12, mimeType: "image/png" },
);
assert.equal(obs.width, 32);
assert.ok(obs.dominantColors.length >= 1);
assert.ok(obs.dominantColors[0].hex.startsWith("#"));
const block = mod.observationToPromptBlock(obs);
assert.match(block, /Image observations|browser-local|Dominant colors/i);
assert.match(block, /32/);
console.log(JSON.stringify({ ok: true, colors: obs.dominantColors.length, edgeDensity: obs.edgeDensity }));
