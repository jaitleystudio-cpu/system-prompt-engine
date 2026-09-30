#!/usr/bin/env node
/**
 * Local lab measurement for crawl documents.
 * Binds to 127.0.0.1 only. No beacons, no Search Console, no remote host.
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  publicIndexRoutes,
  renderStandaloneDocument,
} from "../src/search/foundation.mjs";

const LCP_MS = 2500;
const CLS_MAX = 0.1;
const INP_MS = 200;

function missingLabVital(raw) {
  return raw === null || raw === "";
}

export function assessLabVitals(sample) {
  const lcpMs = Number(sample.lcpMs);
  const cls = Number(sample.cls);
  const inpMs = Number(sample.inpMs);
  const scored = {
    lcp: Number.isFinite(lcpMs) && lcpMs <= LCP_MS,
    cls: Number.isFinite(cls) && cls <= CLS_MAX,
    inp: Number.isFinite(inpMs) && inpMs <= INP_MS,
    thresholds: { lcpMs: LCP_MS, cls: CLS_MAX, inpMs: INP_MS },
  };
  if (missingLabVital(sample.lcpMs)) scored.lcp = "UNKNOWN";
  if (missingLabVital(sample.cls)) scored.cls = "UNKNOWN";
  if (missingLabVital(sample.inpMs)) scored.inp = "UNKNOWN";
  return scored;
}

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
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

async function measureWithPlaywright(origin, pages) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const pageInfo of pages) {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        const marks = { lcpMs: null, cls: 0, inpMs: null };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            marks.lcpMs = entry.startTime;
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) marks.cls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.interactionId) {
              marks.inpMs =
                marks.inpMs == null ? entry.duration : Math.max(marks.inpMs, entry.duration);
            }
          }
        }).observe({ type: "event", buffered: true, durationThreshold: 0 });
        window.__speVitals = marks;
      });
      await page.goto(`${origin}${pageInfo.path}`, { waitUntil: "load" });
      await page.locator("h1").waitFor();
      await page.locator("h1").click();
      await page.waitForTimeout(50);
      const vitals = await page.evaluate(() => window.__speVitals);
      const sample = {
        id: pageInfo.id,
        lcpMs: vitals.lcpMs,
        cls: vitals.cls,
        inpMs: vitals.inpMs,
      };
      results.push({ ...sample, pass: assessLabVitals(sample) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function main() {
  const pages = documents();
  const distArg = process.argv.includes("--dist");
  const report = {
    host: "127.0.0.1",
    remote: false,
    beacons: false,
    distMeasured: false,
    pages: pages.map((page) => page.id),
    results: [],
    blocker: null,
  };
  if (distArg) {
    report.distMeasured = false;
    report.distNote =
      "dist/index.html was not required. This harness measures standalone crawl documents.";
  }
  const { server, origin } = await listen(pages);
  try {
    report.results = await measureWithPlaywright(origin, pages);
  } catch (error) {
    report.blocker =
      error instanceof Error
        ? `Playwright Chromium is unavailable: ${error.message}`
        : "Playwright Chromium is unavailable.";
  } finally {
    server.close();
  }
  const outDir = "/opt/cursor/artifacts";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "cwv-report.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.blocker) {
    console.log(`BLOCKER ${report.blocker}`);
  }
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  await main();
}
