#!/usr/bin/env node
/**
 * Lab measurement for lane perf-truth.
 * Serves the existing search crawl documents on 127.0.0.1 and reads Chrome
 * performance entries. Does not edit the web shell. Does not claim PASS.
 * Product-shell CWV stays UNKNOWN: this lane does not own that shell.
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import {
  publicIndexRoutes,
  renderStandaloneDocument,
} from "../../apps/web/src/search/foundation.mjs";
import { assessPublishedCwv } from "./cwv_truth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const START_SHA = "e55fd369f1e5412b5ce7f665a3f354e879ad0779";
const command = "SPE_PLAYWRIGHT_MODULE=/tmp/spe-perf-pw/node_modules/playwright/index.js node tools/perf/measure_lane_cwv.mjs";

function documents() {
  const pages = publicIndexRoutes().map((route) => ({
    id: route.id,
    path: route.path === "/" ? "/home.html" : `/${route.id}.html`,
    html: renderStandaloneDocument(route.id),
  }));
  pages.push({
    id: "not-found",
    path: "/not-found.html",
    html: renderStandaloneDocument("not-found"),
  });
  return pages;
}

function listen(pages) {
  const byPath = new Map(pages.map((page) => [page.path, page.html]));
  const server = createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    const html = byPath.get(path);
    if (!html) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("missing crawl document");
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  });
  return new Promise((resolveListen) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolveListen({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

async function measureWithChrome(origin, pages) {
  const playwrightModule = process.env.SPE_PLAYWRIGHT_MODULE
    || "/tmp/spe-perf-pw/node_modules/playwright/index.js";
  const playwright = await import(pathToFileURL(playwrightModule).href);
  const { chromium } = playwright.default ?? playwright;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  try {
    for (const pageInfo of pages) {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        const marks = { lcpMs: null, cls: 0, inpMs: null };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) marks.lcpMs = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) marks.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.interactionId) {
              marks.inpMs = marks.inpMs == null ? entry.duration : Math.max(marks.inpMs, entry.duration);
            }
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 0 });
        window.__speVitals = marks;
      });
      await page.goto(`${origin}${pageInfo.path}`, { waitUntil: "load", timeout: 15000 });
      await page.locator("h1").waitFor({ timeout: 5000 });
      await page.locator("h1").click({ timeout: 5000 });
      await page.waitForTimeout(50);
      const vitals = await page.evaluate(() => window.__speVitals);
      const sample = {
        id: pageInfo.id,
        path: pageInfo.path,
        lcpMs: vitals.lcpMs,
        cls: vitals.cls,
        inpMs: vitals.inpMs,
      };
      results.push(sample);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

function headSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const head = headSha();
  const report = {
    subject_sha: START_SHA,
    git_head_at_run: head,
    command,
    browser: "Google Chrome via Playwright channel=chrome",
    host: "127.0.0.1",
    remote: false,
    product_shell_measured: false,
    pixel_pass: false,
    pass: false,
    cwv: "UNKNOWN",
    lcpMs: null,
    clsRaw: null,
    inpMs: null,
    pages: [],
    blocker: null,
    note: "Top-level product CWV stays UNKNOWN. Page entries are lab samples of standalone crawl documents only, and only if this command observed them. Identical inpMs values are raw Chrome event durations from one click, not field INP. CLS is the layout-shift observer sum. No vitals PASS and no pixel PASS.",
  };
  const pages = documents();
  const { server, origin } = await listen(pages);
  try {
    report.pages = await measureWithChrome(origin, pages);
  } catch (error) {
    report.blocker = error instanceof Error ? error.message : "browser measurement failed";
    report.pages = [];
  } finally {
    server.close();
  }
  const scored = assessPublishedCwv({
    lcpMs: report.lcpMs,
    cls: report.cls,
    inpMs: report.inpMs,
    command: report.command,
    sha: report.subject_sha,
    status: "PASS",
  });
  report.lcp = scored.lcp;
  report.cls = scored.cls;
  report.inp = scored.inp;
  report.status = scored.status;
  report.pass = false;
  report.cwv = "UNKNOWN";
  const outDir = join(repoRoot, "evidence/lane-perf");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "cwv.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  await main();
}
