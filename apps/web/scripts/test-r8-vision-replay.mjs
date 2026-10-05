#!/usr/bin/env node
/**
 * R8 selective Vision replay regression.
 * Proves text proposals are adaptive/metamorphic and that only genuine
 * observed OCR text may flow into Screenshot→Code output.
 * No fixture filename, fixture SHA, expected-text table, or pixel replay.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));

async function bundle(entryFile) {
  const bundled = await build({
    entryPoints: [join(mediaDir, entryFile)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    banner: {
      js: `class ImageData { constructor(data,w,h){ this.data=data; this.width=w; this.height=h; } }
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;`,
    },
  });
  return import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
}

function paintBars(originX, darkOnLight, y0 = 28) {
  const w = 220;
  const h = 80;
  const data = new Uint8ClampedArray(w * h * 4);
  const bg = darkOnLight ? 245 : 12;
  const fg = darkOnLight ? 10 : 245;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = bg;
    data[i + 3] = 255;
  }
  for (let n = 0; n < 8; n++) {
    const x0 = originX + n * 6;
    for (let y = y0; y < y0 + 18; y++) {
      for (let x = x0; x < x0 + 3; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = fg;
      }
    }
  }
  return new ImageData(data, w, h);
}

function unionBox(blocks, w, h) {
  assert.ok(blocks.length > 0, "text proposal expected");
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const block of blocks) {
    x0 = Math.min(x0, block.bounds.x);
    y0 = Math.min(y0, block.bounds.y);
    x1 = Math.max(x1, block.bounds.x + block.bounds.w);
    y1 = Math.max(y1, block.bounds.y + block.bounds.h);
  }
  return { x: x0*w, y: y0*h, w:(x1-x0)*w, h:(y1-y0)*h };
}

const ocrSource = readFileSync(join(mediaDir, "ocrLite.ts"), "utf8");
const shotSource = readFileSync(join(mediaDir, "screenshotToCode.ts"), "utf8");
const combined = ocrSource + "\n" + shotSource;

assert.equal(ocrSource.includes("const thresh = 0.22"), false, "fixed global 0.22 detector is forbidden");
assert.equal(ocrSource.includes("[text-like band"), false, "invented text-like labels are forbidden");
for (const marker of ["mobile-app.png", "screenshot_real_fixtures", "SYSTEM PROMPT ENGINE", "HELLO MAJOR"]) {
  assert.equal(combined.includes(marker), false, `fixture-aware marker forbidden: ${marker}`);
}

const ocr = await bundle("ocrLite.ts");
const shot = await bundle("screenshotToCode.ts");

const a = ocr.detectTextLikeRegions(paintBars(20, true));
const b = ocr.detectTextLikeRegions(paintBars(60, true));
const inv = ocr.detectTextLikeRegions(paintBars(20, false));
const held = ocr.detectTextLikeRegions(paintBars(15, true, 40));
const flat = new ImageData(new Uint8ClampedArray(220*80*4).map((_,i)=> i%4===3 ? 255 : 30),220,80);

assert.equal(ocr.detectTextLikeRegions(flat).length, 0, "flat image must not produce text proposals");
const boxA = unionBox(a,220,80);
const boxB = unionBox(b,220,80);
const boxInv = unionBox(inv,220,80);
assert.ok(Math.abs((boxB.x-boxA.x)-40) <= 5, `proposal should follow horizontal motion: ${boxB.x-boxA.x}`);
assert.ok(Math.abs(boxInv.x-boxA.x) <= 5, "proposal should survive polarity inversion");
assert.ok(held.length > 0, "held-out vertical placement must still produce a proposal");
assert.ok(a.every(x => x.text === ""), "detector must not invent OCR text");
assert.ok(a.every(x => x.provenance !== "observed-ocr"), "detector proposals must not claim observed OCR provenance");

const ir = {
  kind: "ui-observation",
  viewport: { width:220,height:80,sourceWidth:220,sourceHeight:80 },
  regions: [],
  textBlocks: [{
    id:"ocr-1",
    textGuess:"ZONE ALPHA",
    bounds:{x:0.1,y:0.2,w:0.3,h:0.08},
    confidence:"high",
    evidence:"canonical OCR response",
    method:"ocr-tesseract",
    provenance:"observed-ocr"
  }],
  controls: [],
  images: [],
  containers: [],
  columns:1,
  rows:1,
  spacing:{gutters:[],rowGaps:[],unitGuessPx:4},
  palette:[{hex:"#111111",share:1}],
  typography:{scaleGuess:["body"],density:"sparse",evidence:"observed OCR"},
  confidence:"medium",
  uncertainty:[],
  semantic:{
    kind:"semantic-image",tier:"LITE",
    lite:{kind:"image",width:220,height:80,sourceWidth:220,sourceHeight:80,aspectRatio:"11:4",megapixels:0.0176,fileName:null,fileBytes:null,mimeType:null,dominantColors:[{hex:"#111111",share:1}],brightness:{mean:17,darkShare:1,lightShare:0},edgeDensity:0,grid:[],notes:[],uncertainty:[],licenseNote:""},
    subjects:[],objects:[],
    composition:{ruleOfThirdsBias:{value:"balanced",confidence:"low",confidenceScore:0,method:"lite-pixel"},symmetry:{value:"low",confidence:"low",confidenceScore:0,method:"lite-pixel"},subjectPlacement:{value:"unknown",confidence:"low",confidenceScore:0,method:"lite-pixel"},orientation:{value:"landscape",confidence:"low",confidenceScore:0,method:"lite-pixel"}},
    style:{kind:{value:"ui-screenshot",confidence:"low",confidenceScore:0,method:"lite-pixel"},lighting:{value:"dark",confidence:"low",confidenceScore:0,method:"lite-pixel"},paletteMood:{value:"dark",confidence:"low",confidenceScore:0,method:"lite-pixel"}},
    palette:[{hex:"#111111",share:1}],ocrBlocks:[],humanSummary:"",uncertainty:[],methodNotes:[],modelBytesLoaded:0,elapsedMs:0
  }
};
const html = shot.screenshotIRToCodePackage(ir).scaffolds.find(x=>x.target==="html-css-js").code;
assert.match(html, /ZONE ALPHA/, "genuine OCR text must survive IR→UiSpec→HTML");
assert.match(html, /data-provenance="observed-ocr"/, "genuine OCR provenance must survive");
assert.equal(html.includes("[text-like band"), false);

console.log(JSON.stringify({
  ok:true,
  proposals:{a:a.length,b:b.length,inverted:inv.length,held:held.length},
  movePx:boxB.x-boxA.x,
  genuineOcrCarried:true,
  antiCheat:true
},null,2));
