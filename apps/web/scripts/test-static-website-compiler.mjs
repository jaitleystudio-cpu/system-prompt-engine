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

console.log("G4 reproduced defects: fail-closed page identity, kind, style breakout, CSP, a11y, determinism...");

function srgb(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function lum(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function contrast(a, b) {
  const L1 = lum(a);
  const L2 = lum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const missing = structuredClone(DEFAULT_WEBSITE_SPEC);
assert.throws(
  () => compileWebsiteSpecToStaticHtml(missing, "missing.html"),
  WebsiteCompileError,
  "active page outside the spec must not silently fall back",
);

const dup = structuredClone(DEFAULT_WEBSITE_SPEC);
dup.pages.push({ ...dup.pages[0], title: "Second copy" });
assert.throws(
  () => compileWebsiteSpecToStaticHtml(dup, "index.html"),
  WebsiteCompileError,
  "duplicate page paths must be refused",
);

const unknown = structuredClone(DEFAULT_WEBSITE_SPEC);
unknown.pages[0].sections.push({ kind: "script", heading: "Nope", body: "x" });
assert.throws(
  () => compileWebsiteSpecToStaticHtml(unknown, "index.html"),
  WebsiteCompileError,
  "unknown section kind must be refused",
);

const emptyHeading = structuredClone(DEFAULT_WEBSITE_SPEC);
emptyHeading.pages[0].sections[0].heading = "   ";
assert.throws(() => compileWebsiteSpecToStaticHtml(emptyHeading, "index.html"), WebsiteCompileError);

const badCss = "body{color:red}</style><script>alert(1)</script>";
assert.throws(
  () => toStandaloneDocument(compiled.html, badCss),
  WebsiteCompileError,
  "standalone export must refuse style-tag breakout",
);

for (const theme of ["dark", "light"]) {
  const themed = structuredClone(DEFAULT_WEBSITE_SPEC);
  themed.theme = theme;
  const out = compileWebsiteSpecToStaticHtml(themed, "index.html");
  const accent = out.css.match(/--site-accent:\s*(#[0-9a-fA-F]{6})/);
  assert(accent, "exported CSS must declare --site-accent");
  const ratio = contrast("#ffffff", accent[1]);
  assert(ratio >= 4.5, `white on ${accent[1]} contrast ${ratio.toFixed(2)} must be >= 4.5`);
  assert(out.css.includes(":focus-visible"), "exported CSS must style :focus-visible");
  assert(out.css.includes("prefers-reduced-motion: reduce"), "exported CSS must include reduced-motion");
  assert.equal((out.html.match(/<main\b/g) || []).length, 1, "exported HTML needs one main");
  assert(out.html.includes('http-equiv="Content-Security-Policy"'), "exported HTML needs CSP");
  assert(out.html.includes("script-src 'none'"), "CSP must refuse scripts");
  assert(!out.html.includes("<script"), "export must not emit a script element");
  const doc = toStandaloneDocument(out.html, out.css);
  assert(doc.includes("script-src 'none'"));
  assert.equal((doc.match(/<!DOCTYPE html>/gi) || []).length, 1);
  const again = compileWebsiteSpecToStaticHtml(themed, "index.html");
  assert.equal(out.html, again.html, "html export must be deterministic");
  assert.equal(out.css, again.css, "css export must be deterministic");
  assert.equal(doc, toStandaloneDocument(again.html, again.css), "standalone export must be deterministic");
}

console.log("PASS: compiler safety (compileWebsiteSpecToStaticHtml invoked).");
