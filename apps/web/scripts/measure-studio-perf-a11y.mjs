#!/usr/bin/env node
/**
 * SPE-R9-H — Measure Studio surfaces in local Chromium.
 * Records lab frame timings + a11y DOM checks. Field Core Web Vitals stay UNKNOWN
 * (do not fake CWV). Writes evidence under evidence/r9-h-studio-perf-a11y/.
 * COST ₹0. network_mode=NONE. not_a_release=true.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "../..");
const evidenceDir = join(repoRoot, "evidence/r9-h-studio-perf-a11y");
mkdirSync(evidenceDir, { recursive: true });

const sha = execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
const studioCss = readFileSync(join(webRoot, "src/website-studio/studio.css"), "utf8");

const {
  measureSceneStatic,
  attachVerifiedBrowserTelemetry,
} = await import("../src/website-studio/performance/measureScene.ts");
const { createEmptySceneIR } = await import("../src/website-studio/model/sceneIR.ts");

const entryPath = join(here, "tmp-r9h-entry.tsx");
writeFileSync(
  entryPath,
  `import React from "react";
import { createRoot } from "react-dom/client";
import { Studio } from "../src/website-studio/Studio.tsx";
const root = createRoot(document.getElementById("root"));
root.render(React.createElement(Studio));
window.__studioReady = true;
`,
);

const bundleOut = join(evidenceDir, "studio-harness.js");
let esbuild;
try {
  esbuild = await import("esbuild");
} catch {
  execSync("npm install --no-save esbuild@0.24.2", { cwd: webRoot, stdio: "inherit" });
  esbuild = await import("esbuild");
}

await esbuild.build({
  absWorkingDir: webRoot,
  entryPoints: [entryPath],
  bundle: true,
  format: "iife",
  outfile: bundleOut,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  loader: { ".css": "empty", ".ts": "ts", ".tsx": "tsx" },
});

const htmlPath = join(evidenceDir, "studio-harness.html");
writeFileSync(
  htmlPath,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>SPE Studio R9-H measure</title>
<style>${studioCss}</style>
</head>
<body>
<main id="main" tabindex="-1"><div id="root"></div></main>
<script src="./studio-harness.js"></script>
</body>
</html>`,
);

const chromeCandidates = [
  process.env.SPE_CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

let executablePath;
for (const c of chromeCandidates) {
  if (existsSync(c)) {
    executablePath = c;
    break;
  }
}

const launchOpts = { headless: true, args: ["--no-sandbox"] };
if (executablePath) launchOpts.executablePath = executablePath;

const browser = await chromium.launch(launchOpts);
const results = {
  sha,
  command: "node --experimental-strip-types apps/web/scripts/measure-studio-perf-a11y.mjs",
  not_a_release: true,
  network_mode: "NONE",
  field_cwv: {
    lcp: "UNKNOWN",
    cls: "UNKNOWN",
    inp: "UNKNOWN",
    status: "UNKNOWN",
    pass: false,
  },
  note: "Lab frame timings only. Field Core Web Vitals are UNKNOWN — not faked.",
  a11y: {},
  budgets: {},
  frames: {},
};

async function collectA11y(page) {
  return page.evaluate(() => {
    const mains = document.querySelectorAll("main");
    const studioRoot = document.querySelector('[data-testid="website-studio"]');
    const stage = document.querySelector('[aria-label="LIVE WEBSITE Stage"]');
    const fallbackBtn = document.querySelector('[data-testid="studio-reduced-motion"]');
    const mobileBtn = document.querySelector('[data-testid="viewport-mobile"]');
    const focusables = studioRoot
      ? [...studioRoot.querySelectorAll("button, a[href], input, select, textarea")]
      : [];
    const smallTargets = focusables
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
      })
      .map((el) => ({
        name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 48),
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
      }));
    return {
      mainCount: mains.length,
      hasStudio: !!studioRoot,
      stageTag: stage?.tagName || null,
      stageRole: stage?.getAttribute("role"),
      hasReducedMotionToggle: !!fallbackBtn,
      hasMobileViewport: !!mobileBtn,
      smallTargets,
    };
  });
}

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__studioReady === true, { timeout: 30000 });

  const critical = await collectA11y(page);
  assert.equal(critical.mainCount, 1, "critical nested <main>");
  assert.ok(critical.hasStudio);
  assert.equal(critical.stageRole, "region");
  assert.ok(critical.hasReducedMotionToggle);
  assert.ok(critical.hasMobileViewport);
  assert.equal(
    critical.smallTargets.length,
    0,
    `touch targets <44px: ${JSON.stringify(critical.smallTargets)}`,
  );

  await page.click('[data-testid="studio-reduced-motion"]');
  await page.locator('[data-testid="accessible-2d-fallback"]').waitFor({ timeout: 5000 });

  await page.click('[data-testid="viewport-mobile"]');
  assert.equal(await page.getAttribute('[data-testid="website-renderer"]', "data-view-mode"), "mobile");

  const frameSample = await page.evaluate(async () => {
    const warmup = 15;
    const samples = 90;
    const timings = [];
    let prev = performance.now();
    await new Promise((resolve) => {
      let i = 0;
      function tick(now) {
        const dt = now - prev;
        prev = now;
        if (i >= warmup) timings.push(dt);
        i += 1;
        if (i < warmup + samples) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    const sorted = [...timings].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
    return {
      sampleCount: timings.length,
      warmupDiscarded: warmup,
      frameTimingsMs: timings,
      frameP50: Number(pct(50).toFixed(3)),
      frameP95: Number(pct(95).toFixed(3)),
      frameP99: Number(pct(99).toFixed(3)),
    };
  });

  const ua = await page.evaluate(() => navigator.userAgent);
  const scene = createEmptySceneIR();
  const staticReceipt = measureSceneStatic(scene);
  const measured = attachVerifiedBrowserTelemetry(staticReceipt, {
    environment: "BROWSER_HARNESS",
    browser: ua.slice(0, 120),
    viewport: { width: 1280, height: 800 },
    dpr: 1,
    sampleCount: frameSample.sampleCount,
    warmupDiscarded: frameSample.warmupDiscarded,
    frameTimingsMs: frameSample.frameTimingsMs,
    frameP50: frameSample.frameP50,
    frameP95: frameSample.frameP95,
    frameP99: frameSample.frameP99,
    drawCalls: staticReceipt.drawCalls,
    triangles: staticReceipt.triangles,
    textureBytes: 0,
    timestamp: Date.now(),
  });

  results.a11y = {
    critical_blockers: 0,
    main_landmark_count: critical.mainCount,
    stage_role: critical.stageRole,
    reduced_motion_fallback: true,
    mobile_viewport_control: true,
    touch_targets_below_44px: critical.smallTargets.length,
    status: "PASS_NO_CRITICAL",
  };
  results.budgets = {
    scene_triangles: staticReceipt.triangles,
    scene_draw_calls: staticReceipt.drawCalls,
    max_triangles: scene.performanceBudget.maxTriangles,
    max_draw_calls: scene.performanceBudget.maxDrawCalls,
    within_static_budget:
      staticReceipt.triangles <= scene.performanceBudget.maxTriangles &&
      staticReceipt.drawCalls <= scene.performanceBudget.maxDrawCalls,
    findings: staticReceipt.findings,
  };
  results.frames = {
    state: measured.frameMeasurementState,
    desktopFrameP95: measured.desktopFrameP95,
    mobileFrameP95: measured.mobileFrameP95,
    sampleCount: frameSample.sampleCount,
    receiptHash: measured.telemetryEvidence?.receiptHash,
    lab_only: true,
  };

  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await mobilePage.goto(pathToFileURL(htmlPath).href, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForFunction(() => window.__studioReady === true, { timeout: 30000 });
  const mobileA11y = await collectA11y(mobilePage);
  assert.equal(mobileA11y.mainCount, 1);
  assert.equal(
    mobileA11y.smallTargets.length,
    0,
    `mobile touch <44px: ${JSON.stringify(mobileA11y.smallTargets)}`,
  );
  results.a11y.mobile_390x844 = {
    touch_targets_below_44px: mobileA11y.smallTargets.length,
    main_landmark_count: mobileA11y.mainCount,
  };

  await mobilePage.close();
  await page.close();
} finally {
  await browser.close();
  try {
    unlinkSync(entryPath);
  } catch {
    /* ignore */
  }
}

writeFileSync(join(evidenceDir, "measure.json"), JSON.stringify(results, null, 2));
writeFileSync(
  join(evidenceDir, "README.md"),
  `# SPE-R9-H Studio perf + a11y evidence

- subject SHA: \`${sha}\`
- command: \`npm run measure:studio-perf-a11y\` (in \`apps/web\`)
- field CWV: **UNKNOWN** (not measured in field; not faked; \`pass: false\`)
- lab frames: \`measure.json\` → \`frames\` (\`BROWSER_HARNESS\` MEASURED rAF intervals only)
- a11y: no critical blockers (single \`#main\`, stage \`role=region\`, reduced-motion 2D fallback, ≥44px targets desktop+390×844)

Honesty: this is a local lab harness, not a field Core Web Vitals claim.
`,
);

console.log(JSON.stringify(results, null, 2));
console.log("\nPASS: SPE-R9-H measurements written to evidence/r9-h-studio-perf-a11y/");
