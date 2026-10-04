#!/usr/bin/env node
/**
 * Production static server for the built web app.
 * Serves apps/web/dist and starts the same canonical local media host
 * (createLocalMediaHost → spe_runtime.media_product.route_host).
 * Vite is not involved. Fail-closed when the relative media-pack does not verify.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalMediaHost } from "./local-media-host.mjs";
import { createLocalOcrHost } from "./local-ocr-host.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "../..");
const dist = join(webRoot, "dist");
const port = Number(process.env.SPE_PRODUCT_PORT || process.argv[2] || "4177");
const hostBind = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
};

if (!existsSync(join(dist, "index.html"))) {
  console.error("serve-local-product: apps/web/dist/index.html missing; build first");
  process.exit(1);
}

const mediaHost = createLocalMediaHost({ repoRoot });
const ocrHost = createLocalOcrHost({ repoRoot });

function sendFile(res, file) {
  const body = readFileSync(file);
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = createServer((req, res) => {
  const rawUrl = req.url || "/";
  if (mediaHost.isApi(rawUrl)) {
    void mediaHost.handleApi(req, res);
    return;
  }
  if (ocrHost.isApi(rawUrl)) {
    void ocrHost.handleApi(req, res);
    return;
  }
  let reqPath = decodeURIComponent(rawUrl.split("?")[0] || "/");
  if (reqPath === "/") reqPath = "/index.html";
  const file = join(dist, reqPath.replace(/^\//, ""));
  if (file.startsWith(dist) && existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file);
    return;
  }
  // SPA fallback for /media and other client routes.
  sendFile(res, join(dist, "index.html"));
});

function shutdown() {
  mediaHost.stop();
  ocrHost.stop();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(port, hostBind, () => {
  console.log(`PRODUCT_STATIC http://${hostBind}:${port}`);
  console.log(`MEDIA_OWNER createLocalMediaHost -> spe_runtime.media_product.route_host`);
});
