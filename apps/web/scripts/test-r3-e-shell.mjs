#!/usr/bin/env node
/**
 * R3-E product shell. Real Chrome on this Mac. ₹0.
 * Not a full WCAG audit. Criteria named at the bottom are the ones this file ran.
 * Production static /media evidence uses serve-local-product.mjs and the
 * relative media-pack in this candidate. No sibling worktree path.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, closeSync, copyFileSync, existsSync, ftruncateSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "../..");
const src = (rel) => readFileSync(join(webRoot, rel), "utf8");
let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
  console.log("PASS", name);
}

const FROZEN = "53028b17d28a233bef3076f33f38e9817d6fdb37";
const frozenFiles = [
  "apps/web/src/website/mount-contract.ts",
  "apps/web/src/website/WebsiteProduct.tsx",
  "apps/web/src/website/productFlow.ts",
  "apps/web/src/website/website-product.css",
  "apps/web/src/builder/websiteSpecModel.ts",
];
for (const rel of frozenFiles) {
  const want = execFileSync("git", ["rev-parse", `${FROZEN}:${rel}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const got = execFileSync("git", ["hash-object", join(repoRoot, rel)], {
    encoding: "utf8",
  }).trim();
  assert.equal(got, want, rel);
}
checks += 1;
console.log("PASS frozen website UI and compiler blobs match", FROZEN);

const routing = await import(pathToFileURL(join(webRoot, "src/routing.ts")).href);
const guards = await import(pathToFileURL(join(webRoot, "src/shell/shellGuards.ts")).href);
const mount = await import(pathToFileURL(join(webRoot, "src/shell/mountStatus.ts")).href);

check("unknown route is not-found and is not Home", () => {
  assert.equal(routing.resolveRoute("/no-such-route").kind, "not-found");
  assert.equal(routing.viewFromPath("/no-such-route"), null);
  assert.equal(routing.resolveRoute("/").view, "home");
  const app = src("src/App.tsx");
  assert.match(app, /kind === "not-found"/);
  assert.doesNotMatch(app, /viewFromPath\(window\.location\.pathname\)/);
  assert.doesNotMatch(app, /replaceState\(\{ view: "home" \}/);
});

check("website mounted and /media route owns the whisper runtime", () => {
  assert.equal(routing.resolveRoute("/website").view, "website");
  assert.equal(routing.resolveRoute("/media").view, "media");
  assert.deepEqual(mount.MOUNT_PENDING, []);
  assert.equal(mount.MEDIA_MOUNT.sha, "a93e87d0efb247204883ecbd18203fe248c5c8e5");
  assert.equal(mount.WEBSITE_MOUNT.sha, FROZEN);
  assert.equal(mount.WEBSITE_MOUNT.status, "MOUNTED");
  const app = src("src/App.tsx");
  const route = src("src/media/MediaRoute.tsx");
  const harness = src("scripts/r3-e-dom-entry.tsx");
  assert.match(app, /WebsiteProduct/);
  assert.match(app, /<MediaRoute \/>/);
  assert.doesNotMatch(app, /<MediaProductPanel/);
  assert.doesNotMatch(app, /runtime=\{/);
  assert.match(route, /runtime=\{pinnedWhisperRuntime\}/);
  assert.doesNotMatch(harness, /runtime=\{/);
  assert.doesNotMatch(harness, /whisperRuntime/);
  assert.doesNotMatch(app, /StaticWebsiteBuilder/);
  const contract = src("src/media/mount-contract.ts");
  const statusSrc = src("src/shell/mountStatus.ts");
  assert.doesNotMatch(contract, /productMediaV1:\s*"PASS"/);
  assert.doesNotMatch(statusSrc, /productMediaV1:\s*"PASS"/);
  assert.match(contract, /media-pack/);
  assert.doesNotMatch(contract, /SPE_MEDIA_ROOT/);
  assert.doesNotMatch(contract, /\/Volumes\//);
  assert.equal(mount.MEDIA_MOUNT.productMediaV1, "NOT_PASS");
  assert.equal(mount.MEDIA_MOUNT.remainingGap, "JOURNEY_NOT_RECORDED");
  assert.match(contract, /remainingGap:/);
  assert.match(contract, /remainingGap: "JOURNEY_NOT_RECORDED"/);
  assert.doesNotMatch(contract, /remainingGap:\s*"NONE"/);
  assert.equal(mount.MEDIA_MOUNT.runtime, "pinnedWhisperRuntime");
  assert.match(src("src/media/pinnedWhisperRuntime.ts"), /\/api\/media\/transcribe/);
  assert.doesNotMatch(src("src/media/pinnedWhisperRuntime.ts"), /__speWhisper/);
  assert.match(src("scripts/local-media-host.mjs"), /spe_runtime\.media_product\.route_host/);
  assert.match(src("scripts/local-media-host-plugin.mjs"), /createLocalMediaHost/);
  assert.match(src("scripts/serve-local-product.mjs"), /createLocalMediaHost/);
  assert.equal(existsSync(join(here, "r3-e-whisper-bridge.py")), false);
  assert.equal(existsSync(join(webRoot, "src/media/MediaProductPanel.tsx")), true);
});

function sourceFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.(tsx?|jsx?|mjs|cjs|html)$/.test(ent.name)) out.push(path);
  }
  return out;
}

check("productMediaV1 is not a test-injected page global", () => {
  const contract = src("src/media/mount-contract.ts");
  const statusSrc = src("src/shell/mountStatus.ts");
  const assign = /(?:window|globalThis)\.__speWhisper\s*=|exposeFunction\(\s*["']__speWhisper["']/;
  const harnessPath = fileURLToPath(import.meta.url);
  const productHits = [];
  for (const path of [...sourceFiles(join(webRoot, "src")), ...sourceFiles(join(webRoot, "scripts"))]) {
    if (path === harnessPath) continue;
    if (assign.test(readFileSync(path, "utf8"))) productHits.push(path);
  }
  const testInjects = assign.test(readFileSync(harnessPath, "utf8"));
  const sourcePass =
    /productMediaV1:\s*"PASS"/.test(contract) ||
    /productMediaV1:\s*"PASS"/.test(statusSrc);
  if (sourcePass) {
    throw new Error("productMediaV1 PASS is a source literal, not a journey");
  }
  if (testInjects || productHits.length > 0) {
    throw new Error("a page global is still the runtime");
  }
  assert.equal(sourcePass, false);
  assert.equal(mount.MEDIA_MOUNT.productMediaV1, "NOT_PASS");
  assert.equal(mount.MEDIA_MOUNT.remainingGap, "JOURNEY_NOT_RECORDED");
  assert.equal(testInjects, false);
  assert.deepEqual(productHits, []);
  assert.match(contract, /remainingGap:\s*"JOURNEY_NOT_RECORDED"/);
  assert.doesNotMatch(contract, /productMediaV1:\s*"PASS"/);
  const host = readFileSync(join(repoRoot, "spe_runtime/media_product/route_host.py"), "utf8");
  const owner = readFileSync(join(repoRoot, "spe_runtime/media_product/local_backend.py"), "utf8");
  assert.match(host, /LocalMediaSession\.open/);
  assert.doesNotMatch(host, /spe-lane-r3-b-media/);
  assert.doesNotMatch(src("scripts/local-media-host-plugin.mjs"), /spe-lane-r3-b-media/);
  assert.doesNotMatch(src("scripts/local-media-host.mjs"), /spe-lane-r3-b-media/);
  assert.doesNotMatch(src("scripts/serve-local-product.mjs"), /spe-lane-r3-b-media/);
  assert.doesNotMatch(src("src/media/pinnedWhisperRuntime.ts"), /__speWhisper/);
  assert.doesNotMatch(src("src/media/MediaRoute.tsx"), /__speWhisper/);
  assert.doesNotMatch(src("src/media/MediaProductPanel.tsx"), /__speWhisper/);
  assert.match(owner, /class LocalMediaSession/);
});

check("production static server and relative media-pack share one host owner", () => {
  const contract = src("src/media/mount-contract.ts");
  const statusSrc = src("src/shell/mountStatus.ts");
  const plugin = src("scripts/local-media-host-plugin.mjs");
  const hostOwner = src("scripts/local-media-host.mjs");
  const productServe = src("scripts/serve-local-product.mjs");
  const vite = src("vite.config.ts");
  const owner = readFileSync(join(repoRoot, "spe_runtime/media_product/local_backend.py"), "utf8");
  const sourcePass =
    /productMediaV1:\s*"PASS"/.test(contract) ||
    /productMediaV1:\s*"PASS"/.test(statusSrc);
  if (sourcePass) {
    throw new Error("productMediaV1 PASS is a source literal, not a journey");
  }
  assert.match(hostOwner, /spe_runtime\.media_product\.route_host/);
  assert.match(hostOwner, /export function createLocalMediaHost/);
  assert.match(plugin, /createLocalMediaHost/);
  assert.match(plugin, /configureServer/);
  assert.match(plugin, /configurePreviewServer/);
  assert.match(productServe, /createLocalMediaHost/);
  assert.match(productServe, /PRODUCT_STATIC/);
  assert.match(productServe, /dist/);
  assert.doesNotMatch(vite, /route_host/);
  assert.doesNotMatch(owner, /spe-g12[a-z]-/);
  assert.doesNotMatch(owner, /_CLI_CANDIDATES/);
  assert.doesNotMatch(owner, /_MODEL_CANDIDATES/);
  assert.doesNotMatch(owner, /SPE_MEDIA_ROOT/);
  assert.doesNotMatch(owner, /\/Volumes\//);
  assert.match(owner, /media-pack/);
  assert.match(owner, /PACK_MANIFEST.json/);
  assert.match(owner, /MODEL_PACK_ID/);
  assert.match(owner, /REAL_SHA256/);
  assert.match(owner, /EXPECTED_BYTES/);
  assert.match(owner, /_acquire_absent_model/);
  assert.match(owner, /_acquire_absent_cli/);
  assert.match(owner, /CMAKE_SKIP_RPATH/);
  assert.match(owner, /MEDIA_MODEL_INGRESS/);
  assert.match(owner, /MEDIA_CLI_BUILD/);
  assert.doesNotMatch(owner, /"PRODUCT_MEDIA_V1": "PASS" if mounted else "NOT_PASS"/);
  assert.match(owner, /def journey_gap/);
  assert.match(owner, /def commit_product_journey/);
  assert.match(owner, /browser_journey` is reported and does not change the verdict/);
  const host = readFileSync(join(repoRoot, "spe_runtime/media_product/route_host.py"), "utf8");
  assert.match(host, /product_gates/);
  assert.match(host, /commit_product_journey/);
  assert.match(host, /File proof does not flip v1/);
  assert.equal(sourcePass, false);
  assert.equal(mount.MEDIA_MOUNT.productMediaV1, "NOT_PASS");
  assert.equal(mount.MEDIA_MOUNT.remainingGap, "JOURNEY_NOT_RECORDED");
  const manifest = JSON.parse(readFileSync(join(repoRoot, "media-pack/PACK_MANIFEST.json"), "utf8"));
  for (const key of [
    "MODEL_PACK_ID",
    "VERSION",
    "REAL_SHA256",
    "EXPECTED_BYTES",
    "LICENSE",
    "SOURCE",
    "RUNTIME_COMPATIBILITY",
    "LANGUAGE_SCOPE",
  ]) {
    assert.ok(manifest[key], key);
  }
  assert.deepEqual(manifest.LANGUAGE_SCOPE, ["te"]);
  const packed = JSON.stringify(manifest);
  assert.doesNotMatch(packed, /\/Volumes\//);
  assert.doesNotMatch(packed, /\.\.\//);
  assert.equal(manifest.RUNTIME_COMPATIBILITY.model_relative_path, "models/ggml-te-small.bin");
  assert.equal(manifest.RUNTIME_COMPATIBILITY.cli_relative_path, "whisper-cli");
});

check("private and tool routes are noindex and off the sitemap", () => {
  const robots = src("public/robots.txt");
  const sitemap = src("public/sitemap.xml");
  for (const path of ["/my-work", "/workspace", "/website", "/media", "/research"]) {
    assert.match(robots, new RegExp(`Disallow:\\s*${path}`));
    assert.doesNotMatch(sitemap, new RegExp(`<loc>[^<]*${path}</loc>`));
    const view = path === "/my-work" ? "my-work" : path.slice(1);
    assert.equal(routing.NOINDEX_VIEWS.has(view), true);
  }
  assert.match(sitemap, /<loc>https:\/\/systempromptengine\.com\/<\/loc>/);
  assert.doesNotMatch(robots, /Allow:\s*\/my-work/);
  assert.match(src("src/ui/SeoHead.tsx"), /NOINDEX_VIEWS/);
});

check("empty build guard is an honest empty brief", () => {
  assert.equal(guards.workspaceBuildDisabled(false, ""), true);
  assert.equal(guards.workspaceBuildDisabled(false, "  "), true);
  assert.equal(guards.workspaceBuildDisabled(false, "a brief"), false);
  assert.equal(guards.EMPTY_IDEA_MESSAGE, "Enter what you want SPE to build.");
  assert.match(src("src/App.tsx"), /code:\s*"EMPTY_BRIEF"/);
  assert.doesNotMatch(src("src/ui/HumanError.tsx").split("EMPTY_BRIEF")[1].slice(0, 240), /interrupted/i);
});

check("wasm pin unchanged", () => {
  const pin = JSON.parse(src("public/spe_wasm.sha256.json"));
  assert.equal(
    pin.sha256,
    "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
  );
});

function loadShellCss() {
  const tokens = readFileSync(join(webRoot, "../../packages/design-system/src/tokens.css"), "utf8");
  const workspace = readFileSync(join(webRoot, "src/workspace.css"), "utf8");
  const product = src("src/website/website-product.css");
  return (
    src("src/index.css")
      .replace('@import "@spe/design-system";', tokens)
      .replace('@import "./workspace.css";', workspace) + product
  );
}

const outfile = "/tmp/r3-e-dom-entry.js";
await esbuild.build({
  absWorkingDir: webRoot,
  entryPoints: [join(here, "r3-e-dom-entry.tsx")],
  bundle: true,
  format: "iife",
  outfile,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  alias: {
    "@spe/human-perspective": join(webRoot, "../../packages/human-perspective/src/index.ts"),
    "@spe/web-runtime": join(webRoot, "../../packages/web-runtime/src/index.ts"),
  },
  loader: { ".css": "empty" },
});

let appServer = null;
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});

const cssText = loadShellCss();

async function openCase(caseName, viewport, theme = "dark") {
  const page = await browser.newPage({ viewport });
  const htmlPath = `/tmp/r3-e-${caseName}.html`;
  writeFileSync(
    htmlPath,
    `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><style>${cssText}</style></head><body><div id="root"></div><script>window.__r3Want=${JSON.stringify(caseName)};</script><script src="${pathToFileURL(outfile).href}"></script></body></html>`,
  );
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction((name) => window.__r3Case === name, caseName, { timeout: 30000 });
  return page;
}

function contrastRatio(fg, bg) {
  const parse = (c) => {
    const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) throw new Error(`unparsed color ${c}`);
    return [1, 2, 3].map((i) => {
      const s = Number(m[i]) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
  };
  const L = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const l1 = L(parse(fg));
  const l2 = L(parse(bg));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

let absencePark = "";
try {
  const desktop = { width: 1280, height: 800 };

  const keys = await openCase("nav", desktop);
  await keys.keyboard.press("Tab");
  const first = await keys.evaluate(() => document.activeElement?.className);
  assert.equal(first, "skip-link");
  const skipOutline = await keys.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { style: s.outlineStyle, width: s.outlineWidth };
  });
  assert.notEqual(skipOutline.style, "none");
  assert.notEqual(skipOutline.width, "0px");
  await keys.keyboard.press("Enter");
  const focusedMain = await keys.evaluate(() => document.activeElement?.id);
  assert.equal(focusedMain, "main");
  console.log("PASS 2.4.1 skip link and 2.4.7 focus visible");
  checks += 1;
  await keys.close();

  const order = await openCase("nav", desktop);
  const seen = [];
  for (let i = 0; i < 12; i += 1) {
    await order.keyboard.press("Tab");
    const label = await order.evaluate(() => {
      const el = document.activeElement;
      return el?.textContent?.trim().slice(0, 40) || el?.getAttribute("aria-label") || el?.id || "";
    });
    seen.push(label);
  }
  assert.equal(seen[0], "Skip to main content");
  for (const label of ["Home", "Create", "Code", "Website", "Daily Lab"]) {
    assert.ok(seen.some((item) => item.includes(label)), `missing ${label} in ${JSON.stringify(seen)}`);
  }
  console.log("PASS 2.1.1 / 2.4.3 keyboard traversal", JSON.stringify(seen));
  checks += 1;
  await order.close();

  const mobile = await openCase("nav", { width: 360, height: 700 });
  await mobile.emulateMedia({ reducedMotion: "reduce" });
  const motion = await mobile.evaluate(() => ({
    reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
    animation: getComputedStyle(document.querySelector("header.spe-nav")).animationName,
  }));
  assert.equal(motion.reduce, true);
  assert.equal(motion.scroll, "auto");
  assert.equal(motion.animation, "none");
  const burger = mobile.locator(".spe-nav-burger");
  await burger.click();
  assert.equal(await burger.getAttribute("aria-expanded"), "true");
  assert.equal(await burger.getAttribute("aria-controls"), "spe-primary-nav");
  await mobile.keyboard.press("Escape");
  assert.equal(await burger.getAttribute("aria-expanded"), "false");
  const hidden = await mobile.evaluate(() =>
    [...document.querySelectorAll("#spe-primary-nav a")].every((a) => a.getClientRects().length === 0),
  );
  assert.equal(hidden, true);
  await burger.click();
  let left = false;
  for (let i = 0; i < 24; i += 1) {
    await mobile.keyboard.press("Tab");
    left = await mobile.evaluate(() => document.activeElement?.id === "after-nav");
    if (left) break;
  }
  assert.equal(left, true);
  const fit = await mobile.evaluate(() => ({
    nav: document.querySelector("header.spe-nav").getBoundingClientRect().width,
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(fit.nav <= fit.client + 1, JSON.stringify(fit));
  assert.ok(fit.scroll <= fit.client + 1, JSON.stringify(fit));
  console.log("PASS Escape, mobile nav, 2.1.2 no trap, reduced motion", JSON.stringify(fit));
  checks += 1;
  await mobile.close();

  const themePage = await openCase("nav", desktop, "dark");
  await themePage.evaluate(() => localStorage.setItem("spe-theme", "dark"));
  await themePage.reload({ waitUntil: "domcontentloaded" });
  await themePage.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  async function ctaSample() {
    return themePage.evaluate(() => {
      const cta = document.querySelector("a.spe-nav-cta");
      const s = getComputedStyle(cta);
      return {
        theme: document.documentElement.getAttribute("data-theme"),
        fg: s.color,
        bg: s.backgroundColor,
        size: s.fontSize,
        weight: s.fontWeight,
      };
    });
  }
  const darkCta = await ctaSample();
  assert.equal(darkCta.theme, "dark");
  const darkRatio = contrastRatio(darkCta.fg, darkCta.bg);
  assert.ok(darkRatio >= 4.5, JSON.stringify(darkCta));
  await themePage.getByRole("button", { name: /Theme:/ }).click();
  await themePage.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
  const lightCta = await ctaSample();
  assert.equal(lightCta.theme, "light");
  assert.notEqual(lightCta.bg, darkCta.bg, "light CTA fill must differ from dark");
  const lightRatio = contrastRatio(lightCta.fg, lightCta.bg);
  assert.ok(lightRatio >= 4.5, JSON.stringify(lightCta));
  await themePage.evaluate(() => localStorage.setItem("spe-theme", "dark"));
  console.log("PASS 1.4.3 dark nav CTA", darkRatio.toFixed(2), JSON.stringify(darkCta));
  console.log("PASS 1.4.3 light nav CTA", lightRatio.toFixed(2), JSON.stringify(lightCta));
  checks += 2;
  await themePage.close();

  const media = await openCase("media", desktop, "dark");
  const panel = await media.evaluate(() => {
    const root = document.querySelector(".spe-media-product");
    const mode = document.querySelector("[data-testid=media-mode]")?.textContent ?? "";
    return {
      heading: root?.querySelector("h2")?.textContent ?? "",
      mode,
      hasFile: !!root?.querySelector('input[type="file"]'),
    };
  });
  assert.equal(panel.heading, "Local media");
  assert.match(panel.mode, /UNAVAILABLE/);
  assert.doesNotMatch(panel.mode, /LOCAL_NEURAL/);
  assert.doesNotMatch(panel.mode, /Local neural session/);
  assert.equal(panel.hasFile, true);
  await media.getByTestId("media-file").setInputFiles({
    name: "note.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("RIFF"),
  });
  await media.getByTestId("media-start").click();
  const after = await media.locator("[data-testid=media-mode]").innerText();
  const err = await media.locator("[data-testid=media-error]").innerText();
  assert.match(after, /UNAVAILABLE/);
  assert.doesNotMatch(after, /LOCAL_NEURAL/);
  assert.doesNotMatch(after, /Local neural session/);
  assert.match(err, /NOT_MOUNTED/);
  const owner = await media.evaluate(() => document.querySelector("[data-runtime-owner]")?.getAttribute("data-runtime-owner"));
  assert.equal(owner, "route");
  console.log("PASS file harness without the app host stays NOT_MOUNTED");
  checks += 1;
  await media.close();

  const packCli = join(repoRoot, "media-pack/whisper-cli");
  const packModel = join(repoRoot, "media-pack/models/ggml-te-small.bin");
  const packManifestPath = join(repoRoot, "media-pack/PACK_MANIFEST.json");
  const packManifestText = readFileSync(packManifestPath, "utf8");
  const speechFixture = join(here, "fixtures/media/te_amma_16k.wav");
  const cancelFixture = join(here, "fixtures/media/te_dengue_intro_30s.wav");
  assert.equal(existsSync(speechFixture), true);
  assert.equal(existsSync(cancelFixture), true);
  const siblingAside = "/tmp/r3e-whisper-cli.sibling-not-restored";
  if (existsSync(packCli) && existsSync(siblingAside)) unlinkSync(siblingAside);
  if (existsSync(packCli)) relocate(packCli, siblingAside);
  assert.equal(existsSync(packCli), false, "pre-seeded whisper-cli stays aside; the product must build it");
  assert.equal(existsSync(packModel), true, "place models/ggml-te-small.bin in media-pack/");
  execFileSync("python3", [
    "-c",
    "import wave; p='/tmp/r3e-silence-16k.wav'; w=wave.open(p,'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(b'\\x00\\x00'*16000); w.close()",
  ]);

  {
    const py = [
      "import os, sys",
      "from pathlib import Path",
      "root = Path(" + JSON.stringify(repoRoot) + ")",
      "sys.path.insert(0, str(root))",
      "for key in ('SPE_MEDIA_ROOT', 'SPE_WHISPER_CLI', 'SPE_WHISPER_MODEL'):",
      "    os.environ.pop(key, None)",
      "from spe_runtime.media_product.local_backend import IntegrityError, discover_qualified_assets",
      "import json",
      "model = root / 'media-pack' / 'models' / 'ggml-te-small.bin'",
      "manifest_path = root / 'media-pack' / 'PACK_MANIFEST.json'",
      "original = manifest_path.read_text()",
      "import shutil",
      "kept = Path('/tmp/r3e-ggml-te-small.bin.keep')",
      "if kept.exists():",
      "    kept.unlink()",
      "shutil.move(str(model), str(kept))",
      "payload = json.loads(original)",
      "payload['SOURCE'] = 'https://127.0.0.1:9/ggml-te-small.bin'",
      "manifest_path.write_text(json.dumps(payload))",
      "try:",
      "    discover_qualified_assets()",
      "    raise SystemExit('expected fail-closed')",
      "except IntegrityError as exc:",
      "    assert 'MISSING_MODEL' in str(exc), exc",
      "    assert not model.exists(), 'dead source must not create a model'",
      "    print('FAIL_CLOSED', exc)",
      "finally:",
      "    manifest_path.write_text(original)",
      "    if not model.exists() and kept.exists():",
      "        shutil.move(str(kept), str(model))",
    ].join("\n");
    const failClosed = execFileSync("python3", ["-c", py], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, SPE_MEDIA_ROOT: "", SPE_WHISPER_CLI: "", SPE_WHISPER_MODEL: "" },
    });
    assert.match(failClosed, /FAIL_CLOSED/);
    assert.match(failClosed, /MISSING_MODEL/);
    console.log("PASS asset discovery fail-closed without the relative model");
    checks += 1;
  }

  console.log("building apps/web dist for production static /media evidence");
  execFileSync(process.execPath, [join(webRoot, "node_modules/vite/bin/vite.js"), "build"], {
    cwd: webRoot,
    env: process.env,
    stdio: "inherit",
  });
  const distIndex = join(webRoot, "dist/index.html");
  assert.equal(existsSync(distIndex), true);

  const appPort = 4187;
  const appUrl = `http://127.0.0.1:${appPort}`;
  const serveEnv = { ...process.env, SPE_PRODUCT_PORT: String(appPort) };
  delete serveEnv.SPE_MEDIA_ROOT;
  delete serveEnv.SPE_WHISPER_CLI;
  delete serveEnv.SPE_WHISPER_MODEL;
  appServer = spawn(process.execPath, [join(here, "serve-local-product.mjs"), String(appPort)], {
    cwd: webRoot,
    env: serveEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let appLog = "";
  appServer.stdout.on("data", (chunk) => {
    appLog += chunk.toString();
  });
  appServer.stderr.on("data", (chunk) => {
    appLog += chunk.toString();
  });
  const appExit = new Promise((resolve) => appServer.on("exit", resolve));
  const ready = await Promise.race([
    new Promise((resolve) => {
      const timer = setInterval(() => {
        if (appLog.includes("PRODUCT_STATIC")) {
          clearInterval(timer);
          resolve(true);
        }
      }, 200);
    }),
    appExit.then((code) => {
      throw new Error(`product static server exited ${code}: ${appLog.slice(-1500)}`);
    }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`product static server did not listen: ${appLog.slice(-1500)}`)),
        90000,
      ),
    ),
  ]);
  assert.equal(ready, true);
  console.log("ASSET_DISCOVERY relative media-pack (no SPE_MEDIA_ROOT)");

  async function openAppMedia(expectClaim = "PASS") {
    const context = await browser.newContext({ viewport: desktop, serviceWorkers: "block" });
    const page = await context.newPage();
    const external = [];
    page.on("request", (req) => {
      const hostName = new URL(req.url()).hostname;
      if (hostName !== "127.0.0.1" && hostName !== "localhost") external.push(req.url());
    });
    await page.goto(appUrl + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.goto(appUrl + "/media", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("[data-testid=media-file]", { timeout: 120000 });
    assert.equal(new URL(page.url()).pathname, "/media");
    await page.locator(`[data-product-media-v1="${expectClaim}"][data-claim-source="route"]`).waitFor({ timeout: 20000 });
    const mounted = await page.evaluate(() => ({
      owner: document.querySelector("[data-runtime-owner]")?.getAttribute("data-runtime-owner") ?? "",
      claim: document.querySelector("[data-product-media-v1]")?.getAttribute("data-product-media-v1") ?? "",
      injected: typeof window.__speWhisper,
    }));
    assert.equal(mounted.owner, "route");
    assert.equal(mounted.claim, expectClaim);
    assert.equal(mounted.injected, "undefined");
    const health = await page.evaluate(async () => {
      const res = await fetch("/api/media/health");
      return { ok: res.ok, body: await res.json() };
    });
    assert.equal(health.ok, true);
    assert.equal(health.body.owner, "LocalMediaSession");
    assert.equal(health.body.egressAttempts, 0);
    return { context, page, external };
  }

  async function waitClean(page, timeout = 180000) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeout) {
      last = await page.evaluate(async () => {
        const res = await fetch("/api/media/health");
        return res.json();
      });
      if (
        last &&
        last.owner === "LocalMediaSession" &&
        last.activeJobs === 0 &&
        last.lastTempFilesRemaining === 0 &&
        last.lastUploadRemoved === true &&
        last.egressAttempts === 0
      ) {
        return;
      }
      await page.waitForTimeout(300);
    }
    throw new Error(`media host did not clean up: ${JSON.stringify(last)} log ${appLog.slice(-800)}`);
  }

  async function readPanel(page) {
    return page.evaluate(() => ({
      mode: document.querySelector("[data-testid=media-mode]")?.textContent ?? "",
      text: document.querySelector("[data-testid=media-transcript]")?.textContent ?? "",
      error: document.querySelector("[data-testid=media-error]")?.textContent ?? "",
      egress: document.querySelector("[data-testid=media-egress]")?.textContent ?? "",
      status: document.querySelector("[data-testid=media-panel]")?.getAttribute("data-status") ?? "",
      phase: document.querySelector("[data-testid=media-panel]")?.getAttribute("data-phase") ?? "",
      errorCode: document.querySelector("[data-testid=media-panel]")?.getAttribute("data-error-code") ?? "",
      lang: document.querySelector("[data-testid=media-transcript]")?.getAttribute("lang") ?? "",
    }));
  }

  const speech = await openAppMedia("NOT_PASS");
  await speech.page.getByTestId("media-file").setInputFiles(speechFixture);
  absencePark = `/tmp/r3e-absence-park-${process.pid}-${Date.now().toString(36)}`;
  mkdirSync(absencePark, { recursive: true });
  const parkAside = (from, to) => {
    if (!existsSync(from)) return;
    mkdirSync(dirname(to), { recursive: true });
    execFileSync("mv", [from, to]);
  };
  parkAside(packModel, join(absencePark, "ggml-te-small.bin"));
  parkAside(join(repoRoot, "media-pack/.whisper-build"), join(absencePark, "whisper-build"));
  parkAside(packCli, join(absencePark, "whisper-cli"));
  assert.equal(existsSync(packModel), false, "model file gone before fetch");
  assert.equal(existsSync(join(repoRoot, "media-pack/.whisper-build")), false, "whisper src gone before fetch");
  assert.equal(existsSync(join(repoRoot, "media-pack/.whisper-build/src")), false, "whisper src gone before fetch");
  assert.equal(existsSync(packCli), false, "whisper-cli gone before fetch");
  const absenceLog = appLog.length;
  const absenceSource = JSON.parse(readFileSync(packManifestPath, "utf8")).SOURCE;
  assert.equal(
    absenceSource,
    "https://huggingface.co/ukta-app/indic-whisper-ggml/resolve/a3d637b81797a1d680e6933b71058ac9e00681fd/ggml-te-small.bin",
  );
  console.log("ABSENCE_BEFORE_FETCH", JSON.stringify({ model: false, whisperSrc: false, cli: false, source: absenceSource }));
  await speech.page.getByTestId("media-start").click();
  await speech.page.getByTestId("media-transcript").waitFor({ timeout: 1800000 });
  await speech.page.getByTestId("media-mode").filter({ hasText: "LOCAL_NEURAL" }).waitFor({ timeout: 5000 });
  const speechSeen = await readPanel(speech.page);
  assert.match(speechSeen.mode, /LOCAL_NEURAL/);
  assert.equal(speechSeen.status, "SPEECH");
  assert.equal(speechSeen.text.trim(), "\u0c05\u0c2e\u0c4d\u0c2e\u0c3e");
  assert.equal(speechSeen.lang, "te");
  assert.equal(speechSeen.error, "");
  assert.match(speechSeen.egress, /Network sends for this file: 0/);
  await waitClean(speech.page);
  assert.deepEqual(speech.external, []);
  const acquired = appLog.slice(absenceLog);
  assert.match(acquired, /MEDIA_MODEL_INGRESS/);
  assert.match(acquired, /MEDIA_CLI_BUILD/);
  assert.ok(acquired.includes(absenceSource), acquired.slice(-1500));
  assert.match(acquired, /https:\/\/github\.com\/ggml-org\/whisper\.cpp\.git/);
  assert.match(acquired, /sha256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e/);
  assert.match(acquired, /bytes=190085487/);
  assert.doesNotMatch(acquired, /127\.0\.0\.1/);
  const ingressAt = acquired.indexOf("MEDIA_MODEL_INGRESS");
  const neuralAt = acquired.indexOf("LOCAL_NEURAL");
  const passAt = acquired.indexOf("PRODUCT_MEDIA_V1 PASS");
  assert.ok(ingressAt >= 0, acquired.slice(-1500));
  assert.ok(neuralAt > ingressAt, acquired.slice(-1500));
  assert.ok(passAt > neuralAt, acquired.slice(-1500));
  assert.equal(acquired.slice(0, passAt).includes("PRODUCT_MEDIA_V1 PASS"), false);
  assert.doesNotMatch(src("src/media/mount-contract.ts"), /productMediaV1:\s*"PASS"/);
  assert.doesNotMatch(src("src/shell/mountStatus.ts"), /productMediaV1:\s*"PASS"/);
  console.log("PRODUCT-STATIC EVIDENCE /media speech LOCAL_NEURAL", JSON.stringify(speechSeen));
  console.log("ABSENCE_JOURNEY", acquired.split("\n").filter((line) => line.includes("MEDIA_MODEL_INGRESS") || line.includes("MEDIA_CLI_BUILD") || line.includes("LOCAL_NEURAL") || line.includes("PRODUCT_MEDIA_V1")).join(" | "));
  checks += 1;

  await speech.page.route("**/*", (route) => {
    const hostName = new URL(route.request().url()).hostname;
    if (hostName === "127.0.0.1" || hostName === "localhost") return route.continue();
    return route.abort();
  });
  await speech.page.getByTestId("media-retry").click();
  await speech.page.waitForSelector("[data-testid=media-progress]", { timeout: 15000 });
  await speech.page.getByTestId("media-transcript").waitFor({ timeout: 180000 });
  await speech.page.getByTestId("media-mode").filter({ hasText: "LOCAL_NEURAL" }).waitFor({ timeout: 5000 });
  const offlineSeen = await readPanel(speech.page);
  assert.match(offlineSeen.mode, /LOCAL_NEURAL/);
  assert.equal(offlineSeen.status, "SPEECH");
  assert.equal(offlineSeen.text.trim(), "\u0c05\u0c2e\u0c4d\u0c2e\u0c3e");
  assert.match(offlineSeen.egress, /Network sends for this file: 0/);
  assert.deepEqual(speech.external, []);
  console.log("PRODUCT-STATIC EVIDENCE /media offline-after-acquire retry LOCAL_NEURAL", JSON.stringify(offlineSeen));
  checks += 1;
  await waitClean(speech.page);

  await speech.page.getByTestId("media-file").setInputFiles(cancelFixture);
  await speech.page.getByTestId("media-start").click();
  await speech.page.waitForSelector("[data-testid=media-progress]", { timeout: 15000 });
  await speech.page.getByTestId("media-cancel").click();
  await speech.page.getByTestId("media-progress").waitFor({ state: "detached", timeout: 20000 });
  await waitClean(speech.page, 20000);
  const cancelSeen = await readPanel(speech.page);
  assert.equal(cancelSeen.status, "CANCELLED");
  assert.equal(cancelSeen.phase, "cancelled");
  assert.match(cancelSeen.mode, /UNAVAILABLE/);
  assert.doesNotMatch(cancelSeen.mode, /LOCAL_NEURAL/);
  assert.equal(cancelSeen.text, "");
  assert.match(cancelSeen.egress, /Network sends for this file: 0/);
  assert.deepEqual(speech.external, []);
  console.log("PRODUCT-STATIC EVIDENCE /media cancel CANCELLED", JSON.stringify(cancelSeen));
  checks += 1;

  await speech.page.reload({ waitUntil: "domcontentloaded" });
  await speech.page.waitForSelector("[data-testid=media-file]", { timeout: 120000 });
  assert.equal(new URL(speech.page.url()).pathname, "/media");
  await speech.page.locator('[data-product-media-v1="PASS"][data-claim-source="route"]').waitFor({ timeout: 20000 });
  const reloaded = await speech.page.evaluate(() => ({
    injected: typeof window.__speWhisper,
    claim: document.querySelector("[data-product-media-v1]")?.getAttribute("data-product-media-v1") ?? "",
  }));
  assert.equal(reloaded.injected, "undefined");
  assert.equal(reloaded.claim, "PASS");
  await speech.page.getByTestId("media-file").setInputFiles("/tmp/r3e-silence-16k.wav");
  await speech.page.getByTestId("media-start").click();
  await speech.page.getByTestId("media-mode").filter({ hasText: "LOCAL_FALLBACK" }).waitFor({ timeout: 180000 });
  const reloadedSilence = await readPanel(speech.page);
  assert.match(reloadedSilence.mode, /LOCAL_FALLBACK/);
  assert.doesNotMatch(reloadedSilence.mode, /LOCAL_NEURAL/);
  assert.equal(reloadedSilence.status, "NO_SPEECH");
  assert.equal(reloadedSilence.text, "");
  assert.match(reloadedSilence.egress, /Network sends for this file: 0/);
  console.log("PRODUCT-STATIC EVIDENCE /media reload then silence LOCAL_FALLBACK", JSON.stringify(reloadedSilence));
  checks += 1;
  await speech.context.close();

  const silence = await openAppMedia();
  await silence.page.getByTestId("media-file").setInputFiles("/tmp/r3e-silence-16k.wav");
  await silence.page.getByTestId("media-start").click();
  await silence.page.getByTestId("media-mode").filter({ hasText: "LOCAL_FALLBACK" }).waitFor({ timeout: 180000 });
  const silenceSeen = await readPanel(silence.page);
  assert.match(silenceSeen.mode, /LOCAL_FALLBACK/);
  assert.doesNotMatch(silenceSeen.mode, /LOCAL_NEURAL/);
  assert.equal(silenceSeen.status, "NO_SPEECH");
  assert.equal(silenceSeen.text, "");
  assert.match(silenceSeen.egress, /Network sends for this file: 0/);
  await waitClean(silence.page);
  assert.deepEqual(silence.external, []);
  console.log("PRODUCT-STATIC EVIDENCE /media silence LOCAL_FALLBACK", JSON.stringify(silenceSeen));
  checks += 1;
  await silence.context.close();

  const corrupt = await openAppMedia();
  await corrupt.page.getByTestId("media-file").setInputFiles({
    name: "corrupt.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("RIFF not a media file"),
  });
  await corrupt.page.getByTestId("media-start").click();
  await corrupt.page.waitForSelector("[data-testid=media-error]", { timeout: 180000 });
  const corruptSeen = await readPanel(corrupt.page);
  assert.match(corruptSeen.error, /CORRUPT/);
  assert.match(corruptSeen.mode, /UNAVAILABLE/);
  assert.doesNotMatch(corruptSeen.mode, /LOCAL_FALLBACK/);
  assert.doesNotMatch(corruptSeen.mode, /LOCAL_NEURAL/);
  assert.equal(corruptSeen.status, "ERROR");
  assert.equal(corruptSeen.text, "");
  assert.match(corruptSeen.egress, /Network sends for this file: 0/);
  await waitClean(corrupt.page);
  assert.deepEqual(corrupt.external, []);
  console.log("PRODUCT-STATIC EVIDENCE /media corrupt UNAVAILABLE", JSON.stringify(corruptSeen));
  checks += 1;
  await corrupt.context.close();

  const unsupported = await openAppMedia();
  await unsupported.page.getByTestId("media-file").setInputFiles({
    name: "clip.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not-audio"),
  });
  const unsupportedSeen = await readPanel(unsupported.page);
  assert.equal(unsupportedSeen.errorCode, "UNSUPPORTED_TYPE");
  assert.match(unsupportedSeen.mode, /UNAVAILABLE/);
  assert.doesNotMatch(unsupportedSeen.mode, /LOCAL_NEURAL/);
  assert.equal(unsupportedSeen.phase, "error");
  assert.equal(unsupportedSeen.text, "");
  assert.deepEqual(unsupported.external, []);
  console.log("PRODUCT-STATIC EVIDENCE /media unsupported codec UNAVAILABLE", JSON.stringify(unsupportedSeen));
  checks += 1;
  await unsupported.context.close();

  async function expectPackError(code) {
    const session = await openAppMedia();
    try {
      await session.page.getByTestId("media-file").setInputFiles("/tmp/r3e-silence-16k.wav");
      await session.page.getByTestId("media-start").click();
      await session.page.waitForSelector("[data-testid=media-error]", { timeout: 180000 });
      const seen = await readPanel(session.page);
      assert.match(seen.error, new RegExp(code));
      assert.match(seen.mode, /UNAVAILABLE/);
      assert.doesNotMatch(seen.mode, /LOCAL_NEURAL/);
      assert.equal(seen.status, "ERROR");
      assert.equal(seen.text, "");
      assert.match(seen.egress, /Network sends for this file: 0/);
      assert.deepEqual(session.external, []);
      console.log("PRODUCT-STATIC EVIDENCE /media " + code, JSON.stringify(seen));
      checks += 1;
    } finally {
      await session.context.close();
    }
  }


  function relocate(from, to, mode = null) {
    copyFileSync(from, to);
    if (mode != null) chmodSync(to, mode);
    unlinkSync(from);
  }

  const modelKeep = "/tmp/r3e-ggml-te-small.browser-keep";
  relocate(packModel, modelKeep);
  const deadManifest = JSON.parse(packManifestText);
  deadManifest.SOURCE = "https://127.0.0.1:9/ggml-te-small.bin";
  writeFileSync(packManifestPath, JSON.stringify(deadManifest, null, 2) + "\n");
  try {
    await expectPackError("MISSING_MODEL");
    writeFileSync(packManifestPath, packManifestText);
    const fd = openSync(packModel, "w");
    try {
      writeSync(fd, Buffer.from("short"));
    } finally {
      closeSync(fd);
    }
    await expectPackError("MODEL_LOAD_INTERRUPTED");
    const wrong = openSync(packModel, "w");
    try {
      writeSync(wrong, Buffer.from("lmgg"));
      ftruncateSync(wrong, 190085487);
    } finally {
      closeSync(wrong);
    }
    await expectPackError("HASH_MISMATCH");
  } finally {
    writeFileSync(packManifestPath, packManifestText);
    if (existsSync(packModel)) unlinkSync(packModel);
    if (existsSync(modelKeep) && !existsSync(packModel)) relocate(modelKeep, packModel);
  }

  const manifest = JSON.parse(packManifestText);
  manifest.RUNTIME_COMPATIBILITY.architectures = ["x86_64"];
  writeFileSync(packManifestPath, JSON.stringify(manifest, null, 2) + "\n");
  try {
    await expectPackError("UNSUPPORTED_ARCHITECTURE");
  } finally {
    writeFileSync(packManifestPath, packManifestText);
  }

  const cliAside = "/tmp/r3e-whisper-cli.clean-aside";
  if (existsSync(cliAside)) unlinkSync(cliAside);
  assert.equal(existsSync(packCli), true, "the product speech path must have built whisper-cli");
  relocate(packCli, cliAside);
  assert.equal(existsSync(packCli), false);
  try {
    const clean = await openAppMedia();
    try {
      await clean.page.getByTestId("media-file").setInputFiles(speechFixture);
      await clean.page.getByTestId("media-start").click();
      await clean.page.getByTestId("media-transcript").waitFor({ timeout: 540000 });
      await clean.page.getByTestId("media-mode").filter({ hasText: "LOCAL_NEURAL" }).waitFor({ timeout: 5000 });
      const cleanSeen = await readPanel(clean.page);
      assert.match(cleanSeen.mode, /LOCAL_NEURAL/);
      assert.equal(cleanSeen.status, "SPEECH");
      assert.equal(cleanSeen.text.trim(), "\u0c05\u0c2e\u0c4d\u0c2e\u0c3e");
      assert.equal(cleanSeen.lang, "te");
      assert.equal(cleanSeen.error, "");
      assert.match(cleanSeen.egress, /Network sends for this file: 0/);
      assert.deepEqual(clean.external, []);
      const built = execFileSync("python3", ["-c", [
        "import hashlib, json, subprocess",
        "from pathlib import Path",
        "path = Path(" + JSON.stringify(packCli) + ")",
        "model = Path(" + JSON.stringify(packModel) + ")",
        "manifest = json.loads(Path(" + JSON.stringify(packManifestPath) + ").read_text())",
        "data = path.read_bytes()",
        "print(hashlib.sha256(data).hexdigest())",
        "print(len(data))",
        "print(manifest['RUNTIME_COMPATIBILITY']['cli_sha256'])",
        "print(hashlib.sha256(model.read_bytes()).hexdigest())",
        "text = subprocess.check_output(['otool', '-l', str(path)], text=True)",
        "rpaths = []",
        "lines = text.splitlines()",
        "for i, line in enumerate(lines):",
        "    if 'LC_RPATH' in line:",
        "        for nxt in lines[i:i+6]:",
        "            if 'path ' in nxt:",
        "                rpaths.append(nxt.split('path ', 1)[1].split(' (', 1)[0].strip())",
        "print('RPATH', '|'.join(rpaths))",
        "print(subprocess.check_output(['otool', '-L', str(path)], text=True))",
      ].join("\n")], { encoding: "utf8" });
      console.log("CLEAN_BUILD_CLI", built);
      const expectSha = JSON.parse(packManifestText).RUNTIME_COMPATIBILITY.cli_sha256;
      assert.match(built, new RegExp(expectSha));
      assert.notEqual(expectSha, "784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7");
      assert.match(built, /47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e/);
      assert.doesNotMatch(built, /RPATH \//);
      assert.doesNotMatch(built, /@rpath\//);
      assert.doesNotMatch(built, /spe-g12/);
      assert.match(appLog, /MEDIA_CLI_BUILD/);
      assert.match(cleanSeen.egress, /Network sends for this file: 0/);
      checks += 1;
    } finally {
      await clean.context.close();
    }
  } finally {
    const restoreIfMissing = (parked, dest, mode = null) => {
      if (existsSync(dest) || !existsSync(parked)) return;
      execFileSync("mv", [parked, dest]);
      if (mode != null) chmodSync(dest, mode);
    };
    restoreIfMissing(siblingAside, packCli, 0o755);
    restoreIfMissing(cliAside, packCli, 0o755);
    if (absencePark) {
      restoreIfMissing(join(absencePark, "whisper-cli"), packCli, 0o755);
      restoreIfMissing(join(absencePark, "ggml-te-small.bin"), packModel);
      restoreIfMissing(join(absencePark, "whisper-build"), join(repoRoot, "media-pack/.whisper-build"));
    }
  }

  async function robotsOf(caseName) {
    const page = await openCase(caseName, desktop);
    await page.waitForFunction(() => document.querySelector('meta[name="robots"]')?.content);
    const data = await page.evaluate(() => ({
      title: document.title,
      robots: document.querySelector('meta[name="robots"]')?.content ?? "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      jsonld: document.getElementById("spe-jsonld-app")?.textContent ?? null,
    }));
    await page.close();
    return data;
  }

  const home = await robotsOf("seo-home");
  assert.match(home.robots, /index, follow/);
  assert.doesNotMatch(home.robots, /noindex/);
  assert.equal(home.canonical, "https://systempromptengine.com");
  assert.ok(home.jsonld);
  assert.match(home.title, /SPE/);
  console.log("PASS public home indexable canonical title");
  checks += 1;

  for (const [name, titleBit] of [
    ["seo-workspace", /Workspace/],
    ["seo-my-work", /My Work/],
    ["seo-not-found", /Page not found/],
  ]) {
    const data = await robotsOf(name);
    assert.match(data.robots, /noindex, nofollow/);
    assert.equal(data.canonical, null);
    assert.equal(data.jsonld, null);
    assert.match(data.title, titleBit);
    console.log("PASS noindex", name);
    checks += 1;
  }

  const missing = await openCase("unknown", desktop);
  const route = await missing.evaluate(() => window.__r3Route);
  assert.equal(route.kind, "not-found");
  assert.equal(route.rewritten, false);
  assert.match(await missing.locator("h1").innerText(), /Page not found/);
  assert.equal(await missing.locator("h1").count(), 1);
  const url = new URL(missing.url());
  assert.notEqual(url.pathname, "/");
  console.log("PASS unknown route stays not-found, url", url.pathname);
  checks += 1;
  await missing.close();

  const empty = await openCase("empty-build", desktop);
  await empty.getByRole("button", { name: "Build" }).click();
  const alertText = await empty.locator("[role=alert]").innerText();
  assert.match(alertText, /Add an idea first/);
  assert.match(alertText, /Enter what you want SPE to build\./);
  assert.doesNotMatch(alertText, /interrupted/i);
  console.log("PASS empty Build is an honest empty brief");
  checks += 1;
  await empty.close();

  const site = await openCase("website", desktop, "light");
  const product = await site.evaluate(() => {
    const root = document.querySelector(".website-product");
    const s = getComputedStyle(root);
    return {
      mount: document.querySelector("[data-shell-mount=website]")?.getAttribute("data-shell-mount"),
      contract: root?.getAttribute("data-route-mount"),
      fg: s.color,
      bg: s.backgroundColor,
      heading: root?.querySelector("h1")?.textContent,
    };
  });
  assert.equal(product.mount, "website");
  assert.equal(product.contract, "NOT_INTEGRATED");
  assert.equal(product.heading, "Website");
  const productRatio = contrastRatio(product.fg, product.bg);
  assert.ok(productRatio >= 4.5, JSON.stringify(product));
  await site.getByRole("button", { name: "Build preview" }).click();
  await site.waitForFunction(() =>
    document.querySelector('[aria-label="Website result"]')?.textContent?.includes("LOCAL_EXPORT_READY"),
  );
  const frame = site.locator("iframe[title='Local website preview']");
  assert.equal(await frame.getAttribute("sandbox"), "");
  console.log("PASS mounted website product preview", productRatio.toFixed(2));
  checks += 1;
  await site.close();
} finally {
  if (appServer && !appServer.killed) appServer.kill("SIGTERM");
  await browser.close();
  const restoreIfMissing = (parked, dest) => {
    if (existsSync(dest) || !existsSync(parked)) return;
    try {
      execFileSync("mv", [parked, dest]);
    } catch (err) {
      console.error("RESTORE_FAILED", parked, err);
    }
  };
  if (absencePark) {
    restoreIfMissing(join(absencePark, "ggml-te-small.bin"), join(repoRoot, "media-pack/models/ggml-te-small.bin"));
    restoreIfMissing(join(absencePark, "whisper-build"), join(repoRoot, "media-pack/.whisper-build"));
    restoreIfMissing(join(absencePark, "whisper-cli"), join(repoRoot, "media-pack/whisper-cli"));
  }
  restoreIfMissing("/tmp/r3e-whisper-cli.sibling-not-restored", join(repoRoot, "media-pack/whisper-cli"));
}

await esbuild.stop();
console.log(`R3-E shell checks: ${checks}`);
