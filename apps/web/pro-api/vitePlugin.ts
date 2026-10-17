// Mounts the Pro API at /api/pro on the Vite dev and preview servers (local development and tests only).
import type { Plugin, ViteDevServer, PreviewServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
type Handler = (req: Request, env: Record<string, string | undefined>) => Promise<Response>;
async function bridge(h: Handler, req: IncomingMessage, res: ServerResponse) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 2 * 1024 * 1024 + 1024) { res.statusCode = 413; res.end('{"error":"TOO_LARGE"}'); return; } chunks.push(c as Buffer); }
  const url = `http://${req.headers.host ?? "localhost"}${req.url}`;
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined;
  const r = await h(new Request(url, { method: req.method, headers, body }), process.env);
  res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer()));
}
export function proApiPlugin(): Plugin {
  const entry = fileURLToPath(new URL("./handler.ts", import.meta.url));
  return {
    name: "spe-pro-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/pro")) return next();
        try { const mod = await server.ssrLoadModule(entry); await bridge(mod.handleProRequest, req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: "SERVER_ERROR", message: (e as Error).message })); }
      });
    },
    async configurePreviewServer(server: PreviewServer) {
      const { build } = await import("esbuild"); const out = fileURLToPath(new URL("../node_modules/.cache/spe-pro-api.mjs", import.meta.url));
      await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "silent" });
      const mod = await import(out + `?t=${Date.now()}`);
      server.middlewares.use(async (req, res, next) => { if (!req.url?.startsWith("/api/pro")) return next(); try { await bridge(mod.handleProRequest, req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: "SERVER_ERROR", message: (e as Error).message })); } });
    },
  };
}
