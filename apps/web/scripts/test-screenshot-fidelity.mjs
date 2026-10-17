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
  const w = 96;
  const h = 96;
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
        const cx = Math.floor(x / 32);
        const cy = Math.floor(y / 32);
        v = (cx + cy) % 2 === 0 ? 220 : 60;
      } else if (kind === "modal") {
        v = 40;
        if (x > 20 && x < 76 && y > 20 && y < 76) v = 230;
      } else if (kind === "left-rail") {
        v = x < 28 ? 35 : 200;
        if (y < 14) v = 20;
      } else if (kind === "toolbar-list") {
        if (y < 14) v = 25;
        else if (y < 28) v = 50;
        else {
          const row = Math.floor((y - 28) / 14);
          v = row % 2 === 0 ? 200 : 140;
          if (x < 8 || x > 88) v = 90;
        }
      }
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

const EXPECT = {
  "nav-hero": {
    role: /Hero \/ featured/i,
    hint: /nav-hero-candidate/,
    html: /data-structure="nav-hero"/,
    forbidHtml: /data-structure="card-grid"/,
  },
  form: {
    role: /Form \/ input/i,
    hint: /form-panel-candidate/,
    html: /data-structure="form"|<form/i,
    forbidHtml: /data-structure="modal"/,
  },
  "card-grid": {
    role: /Card \/ tile/i,
    hint: /card-grid-candidate/,
    html: /data-structure="card-grid"/,
    minCards: 3,
  },
  modal: {
    role: /Modal \/ dialog/i,
    hint: /modal-or-dialog-candidate/,
    html: /data-structure="modal"|role="dialog"/i,
    forbidHtml: /data-structure="form"/,
  },
  "left-rail": {
    role: /Side rail/i,
    hint: /left-rail-candidate/,
    html: /data-structure="left-rail"|spe-rail/i,
  },
  "toolbar-list": {
    role: /Toolbar \/ tool|List row/i,
    hint: /toolbar-list-candidate/,
    html: /data-structure="toolbar-list"|role="toolbar"/i,
  },
};

const ui = await bundleEntry("uiObservation.ts");
const shot = await bundleEntry("screenshotToCode.ts");

const fixtures = Object.keys(EXPECT);
const reports = [];
const htmlByKind = {};

for (const kind of fixtures) {
  const ir = ui.observeScreenshotIRLite(paintFixture(kind));
  const pkg = shot.screenshotIRToCodePackage(ir);
  assert.equal(pkg.scaffolds.length, 6, `${kind}: 6 targets`);

  const roles = ir.regions.map((r) => r.roleGuess);
  const blob = `${roles.join("\n")}\n${(ir.uncertainty || []).join("\n")}`;
  const exp = EXPECT[kind];
  assert.match(blob, exp.role, `${kind}: expected role`);
  assert.match(blob, exp.hint, `${kind}: expected structure hint`);

  const html = pkg.scaffolds.find((s) => s.target === "html-css-js");
  const react = pkg.scaffolds.find((s) => s.target === "react");
  assert.ok(html && react, `${kind}: html+react`);
  assert.match(html.code, /role="banner"|<header/i);
  assert.match(html.code, /role="main"|<main/i);
  assert.match(html.code, exp.html, `${kind}: html structure`);
  if (exp.forbidHtml) {
    assert.doesNotMatch(html.code, exp.forbidHtml, `${kind}: forbid wrong structure`);
  }
  if (exp.minCards) {
    const cards = roles.filter((r) => /Card \/ tile/i.test(r)).length;
    assert.ok(cards >= exp.minCards, `${kind}: card count`);
  }

  // Relative layout / hierarchy markers across targets
  for (const s of pkg.scaffolds) {
    assert.ok(
      /0\.\d|\d+%|bounds|maxWidth|geo\.size|size\.width/.test(s.code),
      `${kind}/${s.target}: bounds`,
    );
    assert.ok(
      ir.regions.some(
        (r) => s.code.includes(r.roleGuess) || s.prompt.includes(r.roleGuess),
      ),
      `${kind}/${s.target}: observed role present`,
    );
    assert.ok(
      /data-zone=|zone=|"zone":/.test(s.code),
      `${kind}/${s.target}: zone marker`,
    );
    assert.ok(
      /data-hierarchy=|hierarchy|OBSERVATION scaffold|structure resemblance/i.test(
        s.code + s.prompt,
      ),
      `${kind}/${s.target}: hierarchy/honesty`,
    );
  }

  // Order: header before main before footer in HTML source when all present
  const hIdx = html.code.search(/role="banner"|<header/i);
  const mIdx = html.code.search(/role="main"|<main/i);
  const fIdx = html.code.search(/role="contentinfo"|<footer/i);
  assert.ok(hIdx >= 0 && mIdx > hIdx && fIdx > mIdx, `${kind}: landmark order`);

  htmlByKind[kind] = html.code;
  reports.push({
    kind,
    regions: roles,
    targets: pkg.scaffolds.length,
    structure: [...blob.matchAll(/[a-z0-9-]+-candidate/g)].map((m) => m[0]),
  });
}

// Fixtures must not collapse to one generic scaffold
const unique = new Set(Object.values(htmlByKind));
assert.equal(unique.size, fixtures.length, "fixtures must produce distinct HTML");

// Cross-fixture: form HTML must not equal modal HTML
assert.notEqual(htmlByKind.form, htmlByKind.modal);
assert.notEqual(htmlByKind["nav-hero"], htmlByKind["card-grid"]);
assert.notEqual(htmlByKind["left-rail"], htmlByKind["toolbar-list"]);

console.log(
  JSON.stringify(
    {
      ok: true,
      honesty:
        "STRUCTURE_SCAFFOLD resemblance across 6 targets — not pixel-perfect reconstruction",
      fixtures: reports,
    },
    null,
    2,
  ),
);
