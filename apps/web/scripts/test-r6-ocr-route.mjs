#!/usr/bin/env node
/** /ocr is registered. It does not claim a static OCR pass. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NOINDEX_VIEWS, ROUTE_META, resolveRoute } from "../src/routing.ts";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(webRoot, "../..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");
const readRepo = (path) => readFileSync(join(repoRoot, path), "utf8");

const resolved = resolveRoute("/ocr");
assert.equal(resolved.kind, "view");
assert.equal(resolved.view, "ocr");
assert.equal(resolved.canonicalPath, "/ocr");
assert.equal(NOINDEX_VIEWS.has("ocr"), true);
assert.equal(ROUTE_META.ocr.path, "/ocr");

const app = read("src/App.tsx");
const route = read("src/media/OcrRoute.tsx");
const owner = read("src/media/ocrLite.ts");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");
const manifest = readRepo("ocr-pack/PACK_MANIFEST.json");

assert.match(app, /OcrRoute/);
assert.match(app, /view === "ocr"/);
assert.match(robots, /Disallow:\s*\/ocr/);
assert.doesNotMatch(sitemap, /<loc>[^<]*\/ocr<\/loc>/);
assert.match(route, /data-testid="ocr-file"/);
assert.match(route, /data-testid="ocr-copy"/);
assert.match(route, /data-testid="ocr-export-text"/);
assert.match(route, /recognizeImageFile/);
assert.doesNotMatch(route, /detectTextLikeRegions/);
assert.match(owner, /\/api\/ocr\/recognize/);
assert.doesNotMatch(owner, /return null;\s*}\s*$/);
assert.doesNotMatch(manifest, /\/Volumes\//);
assert.doesNotMatch(manifest, /spe-worktrees/);
assert.match(read("vite.config.ts"), /localOcrHostPlugin/);
assert.match(readRepo("spe_runtime/ocr_product/local_backend.py"), /PINNED_MODEL_SHA256/);

console.log("PASS /ocr registered; OCR owner is the pinned local route");
