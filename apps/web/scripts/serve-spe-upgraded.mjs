#!/usr/bin/env node
/**
 * Upgraded SPE local launcher.
 * Serves:
 * 1. SPE Web App (dist) on http://127.0.0.1:4177
 * 2. SPE Free 3D Website Studio v1.1 on http://127.0.0.1:4180 (and http://127.0.0.1:4177/website-studio)
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const dist = join(webRoot, "dist");
const distStudio = join(webRoot, "dist-studio");

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

function sendFile(res, file) {
  const body = readFileSync(file);
  res.writeHead(200, {
    "Content-Type": MIME[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
  });
  res.end(body);
}

// 1. Studio Server on port 4180
const studioServer = createServer((req, res) => {
  const rawUrl = req.url || "/";
  let reqPath = decodeURIComponent(rawUrl.split("?")[0] || "/");
  if (reqPath === "/") reqPath = "/index.html";
  const file = join(distStudio, reqPath.replace(/^\//, ""));
  if (file.startsWith(distStudio) && existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file);
    return;
  }
  sendFile(res, join(distStudio, "index.html"));
});

studioServer.listen(4180, "127.0.0.1", () => {
  console.log("🎮 SPE Free 3D Website Studio v1.1 running at: http://localhost:4180");
});

// 2. Main App Server on port 4177
const mainServer = createServer((req, res) => {
  const rawUrl = req.url || "/";
  let reqPath = decodeURIComponent(rawUrl.split("?")[0] || "/");

  // Route /website-studio or /studio directly to the upgraded 3D Studio
  if (reqPath === "/website-studio" || reqPath === "/studio" || reqPath.startsWith("/website-studio/")) {
    sendFile(res, join(distStudio, "index.html"));
    return;
  }
  if (reqPath === "/studio.js") {
    sendFile(res, join(distStudio, "studio.js"));
    return;
  }

  if (reqPath === "/") reqPath = "/index.html";
  const file = join(dist, reqPath.replace(/^\//, ""));
  if (file.startsWith(dist) && existsSync(file) && statSync(file).isFile()) {
    sendFile(res, file);
    return;
  }
  sendFile(res, join(dist, "index.html"));
});

mainServer.listen(4177, "127.0.0.1", () => {
  console.log("🌐 SPE Main Web App running at: http://localhost:4177");
  console.log("🚀 Upgraded 3D Studio also accessible at: http://localhost:4177/website-studio");

  // Open default browser on macOS
  exec("open http://localhost:4180 http://localhost:4177", (err) => {
    if (err) console.error("Could not auto-open browser:", err.message);
    else console.log("✨ Successfully opened in your default browser!");
  });
});
