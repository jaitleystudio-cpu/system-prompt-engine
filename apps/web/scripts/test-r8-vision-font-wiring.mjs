#!/usr/bin/env node
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../node_modules/esbuild/lib/main.js";

const mediaDir = fileURLToPath(new URL("../src/media/", import.meta.url));
const bundled = await build({
  entryPoints:[join(mediaDir,"uiObservation.ts")],
  bundle:true, write:false, format:"esm", platform:"node",
  banner:{js:`class ImageData { constructor(data,w,h){ this.data=data; this.width=w; this.height=h; } }
if (typeof globalThis.ImageData === "undefined") globalThis.ImageData = ImageData;`}
});
const ui = await import("data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].text).toString("base64"));

const w=160,h=80;
const px=new Uint8ClampedArray(w*h*4);
for(let i=0;i<px.length;i+=4){px[i]=px[i+1]=px[i+2]=245;px[i+3]=255;}
for(let y=20;y<42;y++) for(let x=20;x<80;x++){
  if((x%9)<3 || y<23 || y>38){const i=(y*w+x)*4;px[i]=px[i+1]=px[i+2]=12;}
}
const image=new ImageData(px,w,h);
const lite={
  kind:"image",width:w,height:h,sourceWidth:w,sourceHeight:h,aspectRatio:"2:1",
  megapixels:(w*h)/1_000_000,fileName:null,fileBytes:null,mimeType:null,
  dominantColors:[{hex:"#f5f5f5",share:1}],
  brightness:{mean:230,darkShare:0.1,lightShare:0.9},
  edgeDensity:0.05,grid:[],notes:[],uncertainty:[],licenseNote:""
};
const semantic={
  kind:"semantic-image",tier:"STANDARD",lite,
  subjects:[],objects:[],
  composition:{ruleOfThirdsBias:{value:"balanced",confidence:"low",confidenceScore:0,method:"lite-pixel"},symmetry:{value:"low",confidence:"low",confidenceScore:0,method:"lite-pixel"},subjectPlacement:{value:"unknown",confidence:"low",confidenceScore:0,method:"lite-pixel"},orientation:{value:"landscape",confidence:"low",confidenceScore:0,method:"lite-pixel"}},
  style:{kind:{value:"ui-screenshot",confidence:"low",confidenceScore:0,method:"lite-pixel"},lighting:{value:"bright",confidence:"low",confidenceScore:0,method:"lite-pixel"},paletteMood:{value:"light",confidence:"low",confidenceScore:0,method:"lite-pixel"}},
  palette:[{hex:"#f5f5f5",share:1}],
  ocrBlocks:[{text:"ZONE",bounds:{x:0.1,y:0.2,w:0.45,h:0.4},confidence:"high",method:"ocr-tesseract",provenance:"observed-ocr",confidenceScore:0.99}],
  humanSummary:"",uncertainty:[],methodNotes:["canonical OCR"],modelBytesLoaded:0,elapsedMs:1
};
const ir=ui.buildUIObservationIR(image,semantic);
assert.equal(ir.textBlocks.length,1);
assert.equal(ir.textBlocks[0].provenance,"observed-ocr");
assert.ok(ir.textBlocks[0].fontInk,"production UIObservationIR must carry measured ink for genuine OCR text");
assert.ok(ir.textBlocks[0].fontInk.h>0 && ir.textBlocks[0].fontInk.w>0);
assert.match(ir.textBlocks[0].fontInk.color,/^#[0-9a-f]{6}$/i);
assert.match(ir.typography.evidence,/measured OCR ink/i,"typography evidence must describe the measured path");
assert.equal(ir.uncertainty.some(x=>/guessed from band height, not measured fonts/i.test(x)),false,"stale typography uncertainty is forbidden after measured ink");
console.log(JSON.stringify({ok:true,fontInk:ir.textBlocks[0].fontInk,typography:ir.typography.evidence},null,2));
