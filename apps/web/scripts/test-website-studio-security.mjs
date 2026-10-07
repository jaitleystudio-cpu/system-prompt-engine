#!/usr/bin/env node
/**
 * SPE-R9-G — Website Studio security acceptance gate.
 * URL/content injection, XSS (SVG sink), export safety, resource/DoS bounds.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "../src/website-studio");

async function load(rel) {
  return import(pathToFileURL(path.join(src, rel)).href);
}

const security = await load("security/studioSecurity.ts");
const dataBinding = await load("model/dataBinding.ts");
const extract = await load("reference/extractDesignDNAFromHtml.ts");
const project = await load("export/projectPackage.ts");
const history = await load("history/sitePatch.ts");
const specModel = await load("model/websiteSpecV2.ts");
const sceneIR = await load("model/sceneIR.ts");

console.log("F1: SSRF / URL injection on PUBLIC_FETCH...");
assert.throws(
  () =>
    dataBinding.validateDataBinding({
      id: "b1",
      variable: "x",
      consumers: [],
      source: { type: "PUBLIC_FETCH", url: "http://127.0.0.1/secret" },
      privacyBoundary: "PUBLIC_FETCH",
    }),
  /STUDIO_URL_SSRF_REFUSED|LOOPBACK/,
);
assert.throws(
  () =>
    dataBinding.validateDataBinding({
      id: "b2",
      variable: "x",
      consumers: [],
      source: { type: "PUBLIC_FETCH", url: "https://example.com/data" },
      privacyBoundary: "LOCAL",
    }),
  /PUBLIC_FETCH_BOUNDARY_REQUIRED/,
);
assert.throws(
  () => security.assertSafeStudioFetchUrl("javascript:alert(1)"),
  /STUDIO_URL/,
);
security.assertSafeStudioFetchUrl("https://example.com/api");

console.log("F2: XSS — malicious SVG refused; inert SVG allowed...");
assert.throws(
  () =>
    security.sanitizeStudioSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ),
  /MALICIOUS_STUDIO_CONTENT_REFUSED/,
);
assert.throws(
  () =>
    security.sanitizeStudioSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
    ),
  /MALICIOUS_STUDIO_CONTENT_REFUSED/,
);
assert.throws(
  () =>
    security.sanitizeStudioSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    ),
  /MALICIOUS_STUDIO_CONTENT_REFUSED/,
);
const safeSvg = security.sanitizeStudioSvg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="10"/></svg>',
);
assert.match(safeSvg, /^<svg/i);
assert.equal(
  security.resolveStudioHeroSvg(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>',
  ),
  security.INERT_STUDIO_FALLBACK_SVG,
);

console.log("F3: content injection in reference HTML / templates...");
assert.throws(
  () =>
    extract.extractDesignDNAFromHtml(
      '<html><script>alert(1)</script><body style="color:#111111"></body></html>',
    ),
  /MALICIOUS_STUDIO_CONTENT_REFUSED/,
);
const dna = extract.extractDesignDNAFromHtml(
  '<!doctype html><html><head><meta name="theme-color" content="#101218"></head><body style="background:#101218;color:#f6f7fb"><h1>Reference</h1></body></html>',
);
assert.equal(dna.colors.background.toLowerCase(), "#101218");
assert.throws(
  () =>
    dataBinding.validateDataBinding({
      id: "t1",
      variable: "v",
      consumers: [],
      source: { type: "LOCAL_CONSTANT", value: "x" },
      privacyBoundary: "LOCAL",
      transform: {
        type: "string-template",
        template: '<script>alert({value})</script>',
      },
    }),
  /MALICIOUS_STUDIO_CONTENT_REFUSED|STUDIO_TEMPLATE/,
);

console.log("F4: export safety — format, integrity, proto pollution...");
const spec = specModel.createDefaultWebsiteSpecV2();
spec.scene = sceneIR.createEmptySceneIR();
const packed = await project.serializeProjectPackage(spec);
const restored = await project.deserializeProjectPackage(packed);
assert.equal(restored.integrityVerified, true);
assert.equal(restored.websiteSpec.metadata.title, spec.metadata.title);

await assert.rejects(
  () => project.deserializeProjectPackage('{"format":"evil/1","websiteSpec":{},"integrity":"x"}'),
  /SPE_SITE_FORMAT_REFUSED|SPE_SITE/,
);

const tampered = JSON.parse(packed);
tampered.websiteSpec.metadata.title = "Hijacked";
await assert.rejects(
  () => project.deserializeProjectPackage(JSON.stringify(tampered)),
  /SPE_SITE_INTEGRITY_MISMATCH/,
);

assert.throws(
  () =>
    security.safeStudioJsonParse(
      '{"format":"spe-site/1","__proto__":{"admin":true},"websiteSpec":{},"integrity":"x"}',
    ),
  /PROTOTYPE_POLLUTION_REFUSED/,
);

console.log("F5: resource / DoS bounds...");
assert.throws(
  () => security.assertStudioHtmlBounds("x".repeat(security.MAX_STUDIO_HTML_BYTES + 1)),
  /STUDIO_HTML_TOO_LARGE/,
);
assert.throws(
  () => security.assertStudioPackageBounds("y".repeat(security.MAX_STUDIO_PACKAGE_BYTES + 1)),
  /STUDIO_PACKAGE_TOO_LARGE/,
);
assert.throws(
  () => security.assertStudioSceneObjectBounds(security.MAX_STUDIO_SCENE_OBJECTS + 1),
  /STUDIO_SCENE_TOO_LARGE/,
);
assert.throws(
  () => security.assertStudioDataBindingBounds(security.MAX_STUDIO_DATA_BINDINGS + 1),
  /STUDIO_BINDINGS_TOO_MANY/,
);
assert.throws(
  () =>
    security.assertStudioStringTemplateBounds(
      "z".repeat(security.MAX_STUDIO_STRING_TEMPLATE_LEN + 1),
    ),
  /STUDIO_TEMPLATE_TOO_LARGE/,
);
assert.throws(
  () =>
    security.sanitizeStudioSvg(
      `<svg xmlns="http://www.w3.org/2000/svg">${"a".repeat(security.MAX_STUDIO_SVG_BYTES)}</svg>`,
    ),
  /STUDIO_SVG_TOO_LARGE/,
);

const hugeScene = structuredClone(spec);
hugeScene.scene = sceneIR.createEmptySceneIR();
hugeScene.scene.objects = Array.from(
  { length: security.MAX_STUDIO_SCENE_OBJECTS + 1 },
  (_, i) => ({
    id: `o${i}`,
    name: `O${i}`,
    geometry: { type: "box", parameters: {} },
    material: { type: "standard", color: "#fff", roughness: 1, metalness: 0 },
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  }),
);
assert.throws(() => specModel.validateWebsiteSpecV2(hugeScene), /STUDIO_SCENE_TOO_LARGE/);

console.log("F6: prototype pollution refused on SitePatch paths...");
assert.throws(
  () =>
    history.createSitePatch(
      { title: "A" },
      [{ op: "set", path: ["__proto__", "polluted"], value: true }],
      "USER_UI",
    ),
  /PROTOTYPE_POLLUTION_REFUSED|PATCH_PATH_REFUSED/,
);

console.log("PASS: SPE-R9-G Website Studio security acceptance.");
