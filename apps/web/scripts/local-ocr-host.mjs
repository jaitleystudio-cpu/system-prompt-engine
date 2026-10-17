/**
 * Canonical local OCR process owner.
 * Starts spe_runtime.ocr_product.route_host and proxies same-origin /api/ocr.
 * Does not spawn a second OCR engine.
 */
import http from "node:http";
import { spawn } from "node:child_process";

const UNAVAILABLE = JSON.stringify({
  status: "ERROR",
  text: "",
  mode: "UNAVAILABLE",
  errorCode: "NOT_MOUNTED",
  regions: [],
  egressAttempts: 0,
  networkHosts: [],
});

export function createLocalOcrHost(opts) {
  const repoRoot = opts.repoRoot;
  const env = opts.env ?? process.env;
  let child = null;
  let ready = null;

  function stop() {
    if (child && !child.killed) child.kill("SIGTERM");
    child = null;
    ready = null;
  }

  function ensure() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      child = spawn("python3", ["-m", "spe_runtime.ocr_product.route_host"], {
        cwd: repoRoot,
        env: { ...env, PYTHONPATH: repoRoot, PYTHONUNBUFFERED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        reject(new Error(`local ocr host did not bind: ${err.slice(-800)}`));
      }, 20000);
      child.stdout.on("data", (buf) => {
        out += buf.toString();
        const match = out.match(/OCR_HOST (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.stderr.on("data", (buf) => {
        err += buf.toString();
      });
      child.on("exit", (code) => {
        ready = null;
        child = null;
        if (code !== 0 && code !== null) {
          clearTimeout(timer);
          reject(new Error(`local ocr host exited ${code}: ${err.slice(-800)}`));
        }
      });
    });
    ready.catch(() => {
      ready = null;
    });
    return ready;
  }

  async function proxy(req, res) {
    const port = await ensure();
    const url = req.url || "";
    const path = url.slice("/api/ocr".length).split("?")[0] || "/";
    const headers = {};
    for (const name of ["content-type", "content-length"]) {
      const value = req.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    await new Promise((resolve) => {
      const proxyReq = http.request(
        { hostname: "127.0.0.1", port, path, method: req.method, headers },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
          proxyRes.on("end", () => resolve());
        },
      );
      proxyReq.setTimeout(120000, () => proxyReq.destroy());
      proxyReq.on("error", () => {
        if (!res.headersSent) {
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          res.end(UNAVAILABLE);
        }
        resolve();
      });
      req.pipe(proxyReq);
    });
  }

  function attach(middlewares) {
    middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api/ocr/")) return next();
      void proxy(req, res).catch(() => {
        if (!res.headersSent) {
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          res.end(UNAVAILABLE);
        }
      });
    });
  }

  return {
    name: "spe-local-ocr-host",
    ensure,
    stop,
    attach,
    isApi(url) {
      return typeof url === "string" && url.startsWith("/api/ocr/");
    },
    async handleApi(req, res) {
      try {
        await proxy(req, res);
      } catch {
        if (!res.headersSent) {
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          res.end(UNAVAILABLE);
        }
      }
    },
  };
}
