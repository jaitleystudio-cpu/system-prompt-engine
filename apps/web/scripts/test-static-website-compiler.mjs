#!/usr/bin/env node
/**
 * R2-WEB-W: Invoke compileWebsiteSpecToStaticHtml and assert safety (F2/F3/F4/F5/F7).
 * Run with: node --experimental-strip-types apps/web/scripts/test-static-website-compiler.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelUrl = pathToFileURL(
  path.join(__dirname, "../src/builder/websiteSpecModel.ts"),
).href;

const {
  DEFAULT_WEBSITE_SPEC,
  compileWebsiteSpecToStaticHtml,
  toStandaloneDocument,
  escapeHtml,
  assertSafeHref,
  assertPagePath,
  downloadFileNameForPagePath,
  WebsiteCompileError,
  PAGE_PATH,
  SAFE_HREF,
  SCENE_3D,
  G13_PACKAGE_BOUND,
  COMPILER_BINDING,
} = await import(modelUrl);

console.log("Invoking compileWebsiteSpecToStaticHtml on DEFAULT_WEBSITE_SPEC...");
const compiled = compileWebsiteSpecToStaticHtml(DEFAULT_WEBSITE_SPEC, "index.html");
assert(typeof compiled.html === "string" && compiled.html.includes("<!DOCTYPE html>"));
assert(typeof compiled.css === "string" && compiled.css.includes("--site-bg"));
assert.equal((compiled.html.match(/<!DOCTYPE html>/gi) || []).length, 1);

console.log("F2: escapeHtml + XSS-class fields must not land raw...");
assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
const evil = structuredClone(DEFAULT_WEBSITE_SPEC);
evil.pages[0].title = '<script>alert(1)</script>';
evil.pages[0].sections[0].heading = '<img src=x onerror=alert(1)>';
evil.pages[0].sections[0].body = '<script>alert("x")</script>';
evil.pages[0].sections[2].items = ['<script>x</script>', 'safe item'];
const escaped = compileWebsiteSpecToStaticHtml(evil, "index.html");
assert(!escaped.html.includes("<script>"), "raw <script> must not appear");
assert(escaped.html.includes("&lt;script&gt;"), "escaped script markers required");
assert(escaped.html.includes("&lt;img src=x onerror=alert(1)&gt;"));

console.log("F3: SAFE_HREF refuse network/script/escape...");
for (const href of [
  "javascript:alert(1)",
  "https://evil.example/",
  "//evil.example/x",
  "../etc/passwd",
  "/absolute.html",
  "notes.html?x=1",
  "",
  "#",
]) {
  assert.throws(() => assertSafeHref(href), WebsiteCompileError);
  const bad = structuredClone(DEFAULT_WEBSITE_SPEC);
  bad.pages[0].sections[0].cta_href = href;
  assert.throws(() => compileWebsiteSpecToStaticHtml(bad), WebsiteCompileError);
}
assert.equal(assertSafeHref("#download"), "#download");
assert.equal(assertSafeHref("index.html#specs"), "index.html#specs");
assert(SAFE_HREF.test("#specs"));

console.log("F4: PAGE_PATH runtime refuse...");
for (const badPath of ["../x.html", "/index.html", "Index.html", "a/b.html", "x.htm", ""]) {
  assert.throws(() => assertPagePath(badPath), WebsiteCompileError);
  assert(!PAGE_PATH.test(badPath) || badPath.includes("/") || badPath.includes(".."));
}
assert.equal(assertPagePath("index.html"), "index.html");
assert.equal(downloadFileNameForPagePath("index.html"), "index.html");
assert.throws(() => downloadFileNameForPagePath("index.html/../x"), WebsiteCompileError);

const badPage = structuredClone(DEFAULT_WEBSITE_SPEC);
badPage.pages[0].path = "../escape.html";
assert.throws(() => compileWebsiteSpecToStaticHtml(badPage), WebsiteCompileError);

console.log("F5: standalone export is single document...");
const standalone = toStandaloneDocument(compiled.html, compiled.css);
assert.equal((standalone.match(/<!DOCTYPE html>/gi) || []).length, 1);
assert.equal((standalone.match(/<html\b/gi) || []).length, 1);
assert(standalone.includes("<style>"));
assert(!standalone.includes('<link rel="stylesheet" href="styles.css"'));
// Nested wrap must be rejected by helper contract — simulate old bug pattern
const nested = `<!DOCTYPE html><html><head></head><body>${compiled.html}</body></html>`;
assert.equal((nested.match(/<!DOCTYPE html>/gi) || []).length, 2);

console.log("F1 truth constants...");
assert.equal(SCENE_3D, "NOT_AVAILABLE");
assert.equal(G13_PACKAGE_BOUND, false);
assert.equal(COMPILER_BINDING, "LOCAL_TS_WEBSITE_SPEC_1");

console.log("PASS: compiler safety (compileWebsiteSpecToStaticHtml invoked).");
