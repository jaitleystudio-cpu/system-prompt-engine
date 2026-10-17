/**
 * Vite plugin to handle /api/extract-design during local dev and preview.
 * Allows client fetch('/api/extract-design') to succeed with 200 JSON responses.
 */

import { extractDesignOffline } from "../src/engine/uidrop/extractorCore.ts";

export function localExtractDesignPlugin() {
  return {
    name: "vite-plugin-local-extract-design",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/extract-design")) {
          return next();
        }

        res.setHeader("Content-Type", "application/json");

        if (req.method === "GET") {
          const urlObj = new URL(req.url, "http://127.0.0.1:5173");
          const targetUrl = urlObj.searchParams.get("url") || "https://uidrop.studiocms.dev";
          const snap = extractDesignOffline(targetUrl);
          res.statusCode = 200;
          return res.end(JSON.stringify(snap));
        }

        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const parsed = body ? JSON.parse(body) : {};
              const targetUrl = parsed.url || "https://uidrop.studiocms.dev";
              const snap = extractDesignOffline(targetUrl);
              res.statusCode = 200;
              res.end(JSON.stringify(snap));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/extract-design")) {
          return next();
        }

        res.setHeader("Content-Type", "application/json");
        const urlObj = new URL(req.url, "http://127.0.0.1:4173");
        const targetUrl = urlObj.searchParams.get("url") || "https://uidrop.studiocms.dev";
        const snap = extractDesignOffline(targetUrl);
        res.statusCode = 200;
        res.end(JSON.stringify(snap));
      });
    },
  };
}
