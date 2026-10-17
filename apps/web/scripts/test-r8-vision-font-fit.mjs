#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const fontPath = join(mediaDir, "fontMetricFit.ts");

assert.equal(existsSync(fontPath), true, "fontMetricFit.ts must exist before font-fit qualification");

const bundled = await build({
  entryPoints: [join(mediaDir, "screenshotToCode.ts")],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  banner: {
    js: `class ImageData { constructor(data,w,h){ this.data=data; this.width=w; this.height=h; } }
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;`,
  },
});
const shot = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
assert.equal(typeof shot.measureObservedInk, "function", "measured-ink helper must be exported from screenshotToCode");

const w = 120, h = 48;
const px = new Uint8ClampedArray(w*h*4);
for (let i=0;i<px.length;i+=4) { px[i]=px[i+1]=px[i+2]=245; px[i+3]=255; }
for (let y=12;y<30;y++) for (let x=18;x<58;x++) {
  if ((x%8)<3 || y<15 || y>26) {
    const i=(y*w+x)*4; px[i]=px[i+1]=px[i+2]=18;
  }
}
const image = new ImageData(px,w,h);
const ink = shot.measureObservedInk(image,[{text:"ZONE",bounds:{x:0.1,y:0.1,w:0.5,h:0.65}}])[0];
assert.ok(ink, "observed glyph ink must be measurable");
assert.ok(ink.h > 0 && ink.w > 0 && ink.stroke > 0, "ink geometry must be positive");
assert.match(ink.color,/^#[0-9a-f]{6}$/i,"ink color must be measured");

const ir = {
  kind:"ui-observation",
  viewport:{width:w,height:h,sourceWidth:w,sourceHeight:h},
  regions:[],
  textBlocks:[{
    id:"ocr-1",textGuess:"ZONE",bounds:{x:0.1,y:0.1,w:0.5,h:0.65},
    confidence:"high",evidence:"canonical OCR response",method:"ocr-tesseract",
    provenance:"observed-ocr",fontInk:ink
  }],
  controls:[],images:[],containers:[],columns:1,rows:1,
  spacing:{gutters:[],rowGaps:[],unitGuessPx:4},
  palette:[{hex:"#f5f5f5",share:1}],
  typography:{scaleGuess:["body"],density:"sparse",evidence:"observed OCR"},
  confidence:"medium",uncertainty:[],
  semantic:{
    kind:"semantic-image",tier:"LITE",
    lite:{kind:"image",width:w,height:h,sourceWidth:w,sourceHeight:h,aspectRatio:"5:2",megapixels:0.00576,fileName:null,fileBytes:null,mimeType:null,dominantColors:[{hex:"#f5f5f5",share:1}],brightness:{mean:245,darkShare:0,lightShare:1},edgeDensity:0,grid:[],notes:[],uncertainty:[],licenseNote:""},
    subjects:[],objects:[],
    composition:{ruleOfThirdsBias:{value:"balanced",confidence:"low",confidenceScore:0,method:"lite-pixel"},symmetry:{value:"low",confidence:"low",confidenceScore:0,method:"lite-pixel"},subjectPlacement:{value:"unknown",confidence:"low",confidenceScore:0,method:"lite-pixel"},orientation:{value:"landscape",confidence:"low",confidenceScore:0,method:"lite-pixel"}},
    style:{kind:{value:"ui-screenshot",confidence:"low",confidenceScore:0,method:"lite-pixel"},lighting:{value:"bright",confidence:"low",confidenceScore:0,method:"lite-pixel"},paletteMood:{value:"light",confidence:"low",confidenceScore:0,method:"lite-pixel"}},
    palette:[{hex:"#f5f5f5",share:1}],ocrBlocks:[],humanSummary:"",uncertainty:[],methodNotes:[],modelBytesLoaded:0,elapsedMs:0
  }
};
const html = shot.screenshotIRToCodePackage(ir).scaffolds.find(x=>x.target==="html-css-js").code;
assert.match(html,/id="spe-font-metric"/,"font metric layer must be emitted");
assert.match(html,/data-ink-h=/,"measured ink height must be carried");
assert.match(html,/data-stroke=/,"measured stroke width must be carried");
assert.match(html,/document\.fonts\.check/,"runtime fit must select from installed faces");
assert.equal(/font-size\s*:\s*(12|14|16|18|20|24|32)px/i.test(html),false,"no preset OCR font size");
assert.equal(html.includes("mobile-app.png"),false);
assert.equal(html.includes("screenshot_real_fixtures"),false);

console.log(JSON.stringify({ok:true,ink,fontMetricLayer:true,antiCheat:true},null,2));
