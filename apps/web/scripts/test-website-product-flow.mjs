#!/usr/bin/env node
/**
 * R3-D browser product flow. Runs the existing TS compiler through productFlow.
 * Does not fetch. Does not claim AI, SceneIR, or live URL reconstruction.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flowUrl = pathToFileURL(
  path.join(__dirname, "../src/website/productFlow.ts"),
).href;
const contractUrl = pathToFileURL(
  path.join(__dirname, "../src/website/mount-contract.ts"),
).href;

const { runWebsiteProduct, SCENE_IR_WIRED, SCENE_3D, AI_GENERATION, LIVE_URL_RECONSTRUCTION } =
  await import(flowUrl);
const { websiteMountContract } = await import(contractUrl);

const spec = {
  spec_version: "website-spec/1",
  title: "R3 Room",
  language: "en",
  summary: "Offline static page.",
  theme: "light",
  pages: [
    {
      path: "index.html",
      title: "Home",
      sections: [{ kind: "prose", heading: "Copy", body: "Local text." }],
    },
  ],
};

let fetched = false;
globalThis.fetch = () => {
  fetched = true;
  throw new Error("fetch");
};

const first = runWebsiteProduct({ kind: "website_spec", spec });
const second = runWebsiteProduct({ kind: "website_spec", spec });
assert.equal(first.status, "LOCAL_EXPORT_READY");
assert.equal(first.exportHtml, second.exportHtml);
assert.equal(first.fetchedUrl, false);
assert.equal(first.networkPerformed, false);
assert.equal(first.contentSecurityPolicy, true);
assert.equal(first.reducedMotion, true);
assert.match(first.exportHtml, /http-equiv="Content-Security-Policy"/);
assert.match(first.exportHtml, /prefers-reduced-motion/);
assert.doesNotMatch(first.exportHtml, /<\s*script/i);
assert.equal((first.exportHtml.match(/<!DOCTYPE html>/gi) || []).length, 1);
assert.equal(first.aiGeneration, "NOT_AVAILABLE");
assert.equal(first.scene3d, "NOT_AVAILABLE");
assert.equal(first.liveUrlReconstruction, "NOT_AVAILABLE");
assert.equal(first.sceneIrWired, false);

const scriptBody = structuredClone(spec);
scriptBody.pages[0].sections[0].body = '<script>alert("x")</script>';
const escaped = runWebsiteProduct({ kind: "website_spec", spec: scriptBody });
assert.equal(escaped.status, "LOCAL_EXPORT_READY");
assert.match(escaped.exportHtml, /&lt;script&gt;/);
assert.doesNotMatch(escaped.exportHtml, /<script>/);

for (const href of ["javascript:alert(1)", "https://evil.example/", "//evil.example/x"]) {
  const bad = structuredClone(spec);
  bad.pages[0].sections[0] = {
    kind: "cta",
    heading: "Next",
    cta_label: "Go",
    cta_href: href,
  };
  const rejected = runWebsiteProduct({ kind: "website_spec", spec: bad });
  assert.equal(rejected.status, "REJECTED", href);
  assert.equal(rejected.previewHtml, null);
}

const rawHtml = runWebsiteProduct({
  kind: "website_spec",
  spec: "<!DOCTYPE html><html><script>alert(1)</script></html>",
});
assert.equal(rawHtml.status, "REJECTED");
assert.equal(rawHtml.reasons[0], "HTML_IS_NOT_A_WEBSITE_SPEC");

const saved = runWebsiteProduct({
  kind: "local_saved_html",
  filename: "notes.html",
  html: "<!DOCTYPE html><html><body><p>saved</p></body></html>",
});
assert.equal(saved.status, "REFUSED");
assert.equal(saved.localSavedHtmlIsLiveUrl, false);
assert.equal(saved.previewHtml, null);
assert.notEqual(saved.sourceKind, "live_url");

const hostile = runWebsiteProduct({
  kind: "local_saved_html",
  filename: "bad.html",
  html: "<html><script>alert(1)</script></html>",
});
assert.equal(hostile.status, "REJECTED");
assert.equal(hostile.previewHtml, null);

const live = runWebsiteProduct({ kind: "live_url", url: "https://harbor.example/books" });
assert.equal(live.status, "REFUSED");
assert.equal(live.fetchedUrl, false);
assert.equal(live.liveUrlReconstruction, "NOT_AVAILABLE");
assert.equal(fetched, false);

assert.equal(SCENE_IR_WIRED, false);
assert.equal(SCENE_3D, "NOT_AVAILABLE");
assert.equal(AI_GENERATION, "NOT_AVAILABLE");
assert.equal(LIVE_URL_RECONSTRUCTION, "NOT_AVAILABLE");
assert.equal(websiteMountContract.routeMountStatus, "NOT_INTEGRATED");
assert.equal(websiteMountContract.shellEditsInThisLane, false);
assert.equal(websiteMountContract.silentFetch, false);
assert.equal(websiteMountContract.sceneIrWired, false);

const ui = readFileSync(
  path.join(__dirname, "../src/website/WebsiteProduct.tsx"),
  "utf8",
);
assert.match(ui, /sandbox=""/);
assert.doesNotMatch(ui, /fetch\s*\(/);
assert.doesNotMatch(ui, /AI_GENERATION\s*=\s*"PASS"/);
assert.doesNotMatch(ui, /SCENE_3D\s*=\s*"PASS"/);
assert.doesNotMatch(ui, /LIVE_URL_RECONSTRUCTION\s*=\s*"PASS"/);

const css = readFileSync(
  path.join(__dirname, "../src/website/website-product.css"),
  "utf8",
);
assert.match(css, /prefers-reduced-motion/);

console.log("R3-D website product flow: measured local spec export, refusal, and no fetch");
