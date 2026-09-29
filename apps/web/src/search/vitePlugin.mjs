/**
 * Emits per-route HTML at vite build and a real HTTP 404 in dev.
 * Does not deploy or contact a host.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  classifyRequestPath,
  injectDocument,
  NOT_FOUND_VIEW,
  renderDevNotFoundDocument,
  routes,
} from "./foundation.mjs";

function routeIdForHtmlRequest(raw) {
  const pathOnly = String(raw).split("?")[0];
  const stripped = pathOnly.endsWith("/index.html")
    ? pathOnly.slice(0, -"/index.html".length) || "/"
    : pathOnly;
  const classified = classifyRequestPath(stripped);
  if (classified.kind === "route" && classified.route) return classified.route.id;
  if (stripped === "/" || pathOnly === "/index.html") return "home";
  return null;
}

export function writeDistRoutes(indexHtml, distDir) {
  for (const route of routes) {
    if (route.path === "/") continue;
    const dest = path.join(distDir, route.path.slice(1), "index.html");
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, injectDocument(indexHtml, route.id));
  }
  writeFileSync(path.join(distDir, "404.html"), injectDocument(indexHtml, NOT_FOUND_VIEW));
}

export function searchFoundationPlugin() {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "spe-search-foundation",
    configResolved(config) {
      outDir = config.build.outDir;
      root = config.root;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const raw = (ctx && (ctx.originalUrl || ctx.path)) || "/index.html";
        const id = routeIdForHtmlRequest(String(raw));
        if (!id) return html;
        return injectDocument(html, id);
      },
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const classified = classifyRequestPath(req.url || "/");
        if (classified.kind !== NOT_FOUND_VIEW) {
          next();
          return;
        }
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("X-Robots-Tag", "noindex, follow");
        res.end(renderDevNotFoundDocument());
      });
    },
    closeBundle() {
      const dist = path.resolve(root, outDir);
      const indexPath = path.join(dist, "index.html");
      let html = "";
      try {
        html = readFileSync(indexPath, "utf8");
      } catch {
        return;
      }
      writeDistRoutes(html, dist);
    },
  };
}
