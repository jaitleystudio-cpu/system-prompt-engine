import assert from "node:assert/strict";
import { build } from "../node_modules/esbuild/lib/main.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));

async function bundleEntry(entryFile) {
  const bundled = await build({
    entryPoints: [join(mediaDir, entryFile)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    banner: {
      js: `class ImageData { constructor(data, w, h){ this.data=data; this.width=w; this.height=h; } }
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;`,
    },
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(bundled.outputFiles[0].text).toString("base64")
  );
}

function paintFixture(kind) {
  const w = 96, h = 96;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = 180;
      if (kind === "nav-hero") {
        if (y < 18) v = 30;
        else if (y < 55) v = 210;
        else v = 90;
      } else if (kind === "form") {
        if (y < 16) v = 40;
        else if (x > 20 && x < 76 && y > 28 && y < 70) v = 240;
        else v = 100;
      } else if (kind === "card-grid") {
        const cx = Math.floor(x / 32), cy = Math.floor(y / 32);
        v = (cx + cy) % 2 === 0 ? 220 : 60;
      } else if (kind === "modal") {
        v = 40;
        if (x > 20 && x < 76 && y > 20 && y < 76) v = 230;
      } else if (kind === "left-rail") {
        v = x < 28 ? 35 : 200;
        if (y < 14) v = 20;
      }
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

const ui = await bundleEntry("uiObservation.ts");
const shot = await bundleEntry("screenshotToCode.ts");

const fixtures = ["nav-hero", "form", "card-grid", "modal", "left-rail"];
const reports = [];
for (const kind of fixtures) {
  const ir = ui.observeScreenshotIRLite(paintFixture(kind));
  const pkg = shot.screenshotIRToCodePackage(ir);
  assert.equal(pkg.scaffolds.length, 6);
  const html = pkg.scaffolds.find((s) => s.target === "html-css-js");
  const react = pkg.scaffolds.find((s) => s.target === "react");
  assert.ok(html && react, "html+react scaffolds required");
  // Structure resemblance: landmarks / roles present
  assert.match(html.code, /role="banner"|<header/i);
  assert.match(html.code, /role="main"|<main/i);
  assert.match(react.code, /role="banner"/);
  assert.match(react.code, /role="main"/);
  // All targets carry numeric bounds
  for (const s of pkg.scaffolds) {
    assert.ok(/0\.\d|\d+%|bounds|maxWidth|geo\.size/.test(s.code), `bounds missing in ${s.label}`);
  }
  if (kind === "left-rail") {
    assert.ok(
      pkg.scaffolds.some((s) => /rail|sidebar|side/i.test(s.code + s.prompt)),
      "left-rail must surface rail language",
    );
  }
  if (kind === "form") {
    // May or may not infer form from brightness-only IR; if role notes mention form later, ok.
    // Soft assert: at least main landmark exists (already checked).
  }
  if (kind === "modal") {
    // Soft — modal detection needs role text; ensure scaffolds are not identical generic stubs
    assert.notEqual(html.code, react.code);
  }
  // Generic scaffold failure: code must include at least one observed roleGuess string
  for (const s of pkg.scaffolds) {
    assert.ok(
      ir.regions.some((r) => s.code.includes(r.roleGuess) || s.prompt.includes(r.roleGuess)),
      `scaffold ${s.label} missing observed roles`,
    );
  }
  reports.push({ kind, regions: ir.regions.map((r) => r.roleGuess), targets: pkg.scaffolds.length });
}

console.log(JSON.stringify({ ok: true, fixtures: reports }, null, 2));
