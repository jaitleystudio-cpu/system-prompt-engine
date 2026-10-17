/**
 * SPE Cross-Browser Packaging Engine
 * Compiles and packages SPE Extension for:
 * 1. Google Chrome (Manifest V3)
 * 2. Apple Safari (macOS & iOS Safari Web Extension)
 * 3. Mozilla Firefox (Manifest V3 with Gecko Settings)
 * 4. Microsoft Edge (Manifest V3 Edge Add-ons)
 * 5. Chromium Family (Brave, Opera, Vivaldi, Arc)
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const distRoot = resolve(pkgRoot, "dist");

const TARGETS = [
  {
    name: "chrome",
    manifestSrc: "manifest.chrome.json",
    outputDir: resolve(distRoot, "chrome"),
    zipName: "spe-extension-chrome.zip",
    browser: "Google Chrome / Brave / Arc / Opera"
  },
  {
    name: "firefox",
    manifestSrc: "manifest.firefox.json",
    outputDir: resolve(distRoot, "firefox"),
    zipName: "spe-extension-firefox.zip",
    browser: "Mozilla Firefox (AMO)"
  },
  {
    name: "safari",
    manifestSrc: "manifest.safari.json",
    outputDir: resolve(distRoot, "safari"),
    zipName: "spe-extension-safari.zip",
    browser: "Apple Safari (macOS & iOS)"
  },
  {
    name: "edge",
    manifestSrc: "manifest.edge.json",
    outputDir: resolve(distRoot, "edge"),
    zipName: "spe-extension-edge.zip",
    browser: "Microsoft Edge Add-ons"
  }
];

const SHARED_FILES = [
  "popup.html",
  "popup.js",
  "content.js",
  "content.css",
  "background.js"
];

const SHARED_DIRS = [
  "icons",
  "src"
];

console.log("==================================================================");
console.log("🌐 SPE Universal Cross-Browser Extension Compiler");
console.log("==================================================================");

// 1. Reset / Prepare dist directory
if (existsSync(distRoot)) {
  rmSync(distRoot, { recursive: true, force: true });
}
mkdirSync(distRoot, { recursive: true });

const results = [];

for (const target of TARGETS) {
  console.log(`\n📦 Building target: ${target.browser} [${target.name}]...`);
  mkdirSync(target.outputDir, { recursive: true });

  // Copy shared files
  for (const file of SHARED_FILES) {
    const srcPath = resolve(pkgRoot, file);
    if (existsSync(srcPath)) {
      cpSync(srcPath, resolve(target.outputDir, file));
    } else {
      console.warn(`  ⚠️ Warning: Shared file ${file} not found!`);
    }
  }

  // Copy shared directories
  for (const dir of SHARED_DIRS) {
    const srcDir = resolve(pkgRoot, dir);
    if (existsSync(srcDir)) {
      cpSync(srcDir, resolve(target.outputDir, dir), { recursive: true });
    }
  }

  // Copy target-specific manifest as manifest.json
  const manifestSrcPath = resolve(pkgRoot, target.manifestSrc);
  if (!existsSync(manifestSrcPath)) {
    throw new Error(`Missing manifest for ${target.name}: ${target.manifestSrc}`);
  }
  const manifestContent = readFileSync(manifestSrcPath, "utf8");
  writeFileSync(resolve(target.outputDir, "manifest.json"), manifestContent, "utf8");

  // Verify valid JSON
  const parsedManifest = JSON.parse(manifestContent);
  console.log(`  ✓ Manifest V${parsedManifest.manifest_version} injected: "${parsedManifest.name}"`);

  // Package zip archive if zip utility is available
  const zipPath = resolve(distRoot, target.zipName);
  try {
    execSync(`cd "${target.outputDir}" && zip -qr "${zipPath}" .`);
    console.log(`  ✓ Packaged store zip: ${target.zipName}`);
  } catch (err) {
    console.warn(`  ℹ️ zip CLI not available or failed: ${err.message}`);
  }

  results.push({
    target: target.name,
    browser: target.browser,
    manifestVersion: parsedManifest.manifest_version,
    distDir: target.outputDir,
    zipFile: existsSync(zipPath) ? zipPath : null
  });
}

// Write build manifest
const buildManifest = {
  engine: "SPE Universal Cross-Browser Compiler",
  version: "1.0.0",
  compiledAt: new Date().toISOString(),
  supportedBrowsers: ["Chrome", "Safari (macOS/iOS)", "Firefox", "Edge", "Brave", "Arc", "Opera"],
  targets: results
};

writeFileSync(resolve(distRoot, "build-manifest.json"), JSON.stringify(buildManifest, null, 2), "utf8");

console.log("\n==================================================================");
console.log(`🎉 SUCCESS: Compiled ${results.length} browser extension distributions!`);
console.log("==================================================================");
for (const r of results) {
  console.log(`  • ${r.browser.padEnd(32)} -> dist/${r.target}`);
}
console.log("==================================================================\n");
