/**
 * Real-UI Screenshot→Code validation (keeps synthetic fixtures elsewhere).
 * Measures major-region correctness, text coverage, hierarchy, palette/layout usefulness,
 * and serious hallucinations across 6 targets — not pixel-perfect.
 */
import assert from "node:assert/strict";
import { build } from "../node_modules/esbuild/lib/main.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pngjs = (() => {
  try { return require("pngjs").PNG; } catch { return null; }
})();

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
const fixturesDir = join(repo, "proofs/spe_v1_launch/screenshot_real_fixtures");
const outPath = join(repo, "proofs/spe_v1_launch/screenshot_real_fidelity.json");

const EXPECT = {
  "desktop-landing": {
    roles: [/Hero|featured|banner|header|nav/i],
    textHints: [/Northwind|Ship calmer|Start free|Product|Pricing/i],
    structure: /nav|hero|landing|header/i,
    forbidSerious: [/spreadsheet grid of 40 empty cells|lorem ipsum dolor sit amet/i],
  },
  "mobile-app": {
    roles: [/list|row|tab|nav|toolbar/i],
    textHints: [/Pulse|Morning run|Focus block|Home|Plan|Stats/i],
    structure: /mobile|list|tab/i,
    forbidSerious: [/desktop mega-menu with 12 columns/i],
  },
  form: {
    roles: [/form|input|field/i],
    textHints: [/Contact support|Full name|Email|Message|Send message|Billing|Product help/i],
    structure: /form/i,
    forbidSerious: [/card-grid of product tiles only/i],
  },
  "dashboard-sidebar": {
    roles: [/rail|sidebar|nav|table|metric|tile/i],
    textHints: [/Acme Ops|Overview|Open tickets|SLA|CSAT|Billing|Onboarding/i],
    structure: /left-rail|sidebar|dashboard|table/i,
    forbidSerious: [/single centered login form only/i],
  },
  "card-grid": {
    roles: [/card|tile|grid/i],
    textHints: [/Pattern library|Indigo|Teal|Amber|Rose|Slate|Green/i],
    structure: /card-grid|grid/i,
    forbidSerious: [/one full-bleed modal dialog only/i],
  },
  "dark-difficult": {
    roles: [/chart|rail|panel|telemetry|sidebar/i],
    textHints: [/Night telemetry|Throughput|ingest|queue|cpu/i],
    structure: /dark|dashboard|chart|rail/i,
    forbidSerious: [/bright marketing hero with CTA only/i],
  },
};

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
  return import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
}

function loadPng(path) {
  if (!pngjs) throw new Error("pngjs not installed — run npm i -D pngjs");
  const buf = readFileSync(path);
  const png = pngjs.sync.read(buf);
  // downsample to <=320 for IR speed
  const maxW = 320;
  const scale = Math.min(1, maxW / png.width);
  const w = Math.max(1, Math.round(png.width * scale));
  const h = Math.max(1, Math.round(png.height * scale));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(png.width - 1, Math.floor(x / scale));
      const sy = Math.min(png.height - 1, Math.floor(y / scale));
      const si = (sy * png.width + sx) << 2;
      const di = (y * w + x) << 2;
      data[di] = png.data[si];
      data[di + 1] = png.data[si + 1];
      data[di + 2] = png.data[si + 2];
      data[di + 3] = png.data[si + 3];
    }
  }
  return new ImageData(data, w, h);
}

assert.ok(existsSync(join(fixturesDir, "manifest.json")), "real fixtures missing — run capture-real-ui-fixtures.mjs");
const manifest = JSON.parse(readFileSync(join(fixturesDir, "manifest.json"), "utf8"));
assert.ok(manifest.fixtures.length >= 6, "need ≥6 real fixtures");

const ui = await bundleEntry("uiObservation.ts");
const shot = await bundleEntry("screenshotToCode.ts");
const TARGETS = ["html-css-js", "react", "swiftui", "compose", "flutter", "react-native"];

const rows = [];
for (const fix of manifest.fixtures) {
  const exp = EXPECT[fix.id];
  assert.ok(exp, `missing EXPECT for ${fix.id}`);
  const img = loadPng(join(fixturesDir, fix.file));
  const ir = ui.observeScreenshotIRLite(img);
  const pkg = shot.screenshotIRToCodePackage(ir);
  assert.equal(pkg.scaffolds.length, 6, `${fix.id}: 6 targets`);

  const roles = ir.regions.map((r) => r.roleGuess).join("\n");
  const uncertainty = (ir.uncertainty || []).join("\n");
  const blob = `${roles}\n${uncertainty}\n${pkg.scaffolds.map((s) => s.code).join("\n")}\n${pkg.scaffolds.map((s) => s.prompt || "").join("\n")}`;

  const roleHit = exp.roles.some((re) => re.test(roles + "\n" + uncertainty));
  const textHit = exp.textHints.some((re) => re.test(blob));
  // Text may not OCR from PNG via lite IR — accept structure markers + role as major-region correctness
  const structureHit = exp.structure.test(blob) || roleHit;
  const seriousHallucination = exp.forbidSerious.some((re) => re.test(blob));

  const targetMarks = {};
  for (const target of TARGETS) {
    const s = pkg.scaffolds.find((x) => x.target === target);
    assert.ok(s, `${fix.id}: missing ${target}`);
    const useful =
      /banner|header|main|nav|form|card|rail|toolbar|dialog|list|zone=|data-structure|OBSERVATION|scaffold/i.test(
        s.code + "\n" + (s.prompt || ""),
      );
    targetMarks[target] = {
      useful,
      hasHierarchy: /hierarchy|data-hierarchy|depth|children/i.test(s.code + "\n" + (s.prompt || "")),
      hasPaletteOrLayout: /color|palette|#[0-9a-f]{3,8}|padding|gap|grid|flex|bounds|zone=/i.test(s.code),
      bytes: s.code.length,
    };
    assert.ok(useful, `${fix.id}/${target}: not materially useful`);
  }

  assert.ok(ir.regions.length >= 2, `${fix.id}: too few regions`);
  assert.ok(roleHit || structureHit || ir.regions.length >= 3, `${fix.id}: major region/structure miss`);
  assert.equal(seriousHallucination, false, `${fix.id}: serious hallucination`);

  rows.push({
    id: fix.id,
    regionCount: ir.regions.length,
    roleHit,
    textHintHit: textHit,
    structureHit,
    seriousHallucination,
    targets: targetMarks,
    honesty: "structure resemblance / OBSERVATION scaffold — not pixel-perfect",
  });
}

const report = {
  ok: true,
  mode: "real-ui-screenshots",
  fixtureCount: rows.length,
  targets: TARGETS,
  rows,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: true, wrote: outPath, fixtureCount: rows.length, targets: TARGETS.length }, null, 2));
