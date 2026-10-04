#!/usr/bin/env node
/** Route registration for the local website mount and the stored research route. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRoute } from "../src/routing.ts";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(webRoot, path), "utf8");

for (const [routePath, view] of [
  ["/website", "website"],
  ["/research", "research"],
]) {
  const resolved = resolveRoute(routePath);
  assert.equal(resolved.kind, "view");
  assert.equal(resolved.view, view);
  assert.equal(resolved.canonicalPath, routePath);
}

const app = read("src/App.tsx");
const nav = read("src/layout/Nav.tsx");
const ledger = read("src/shell/mountStatus.ts");
const flow = read("src/website/productFlow.ts");

assert.match(app, /WebsiteProduct/);
assert.match(app, /view === "website"/);
assert.match(app, /ResearchRoute/);
assert.match(app, /view === "research"/);
assert.match(nav, /id: "website"/);
assert.match(nav, /id: "research"/);
assert.match(ledger, /route: "\/website"/);
assert.match(ledger, /route: "\/research"/);
assert.match(ledger, /WEBSITE_PRODUCT:\s*"MOUNTED_LOCAL"/);
assert.match(ledger, /SCENE3D:\s*"OWNER_WIRED"/);
assert.match(ledger, /LIVE_URL:\s*"NOT_AVAILABLE"/);
assert.match(ledger, /WEBGL_EXECUTION:\s*"NOT_RUN"/);
assert.doesNotMatch(ledger, /SCENE3D_PASS/);
assert.doesNotMatch(ledger, /LIVE_URL_PASS/);
assert.doesNotMatch(ledger, /SCENE3D:\s*"PASS"/);
assert.doesNotMatch(ledger, /LIVE_URL:\s*"PASS"/);
assert.doesNotMatch(ledger, /WEBGL_EXECUTION:\s*"PASS"/);
assert.match(flow, /LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE"/);
assert.match(flow, /WEBGL_EXECUTION = "NOT_RUN"/);
assert.doesNotMatch(flow, /LIVE_URL_RECONSTRUCTION = "PASS"/);
assert.doesNotMatch(flow, /WEBGL_EXECUTION = "PASS"/);
assert.doesNotMatch(flow, /SCENE_3D = "PASS"/);

console.log(
  "PASS /website and /research registered; WEBSITE_PRODUCT=MOUNTED_LOCAL; SCENE3D=OWNER_WIRED; LIVE_URL=NOT_AVAILABLE; WEBGL_EXECUTION=NOT_RUN",
);
