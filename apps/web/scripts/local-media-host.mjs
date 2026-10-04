/**
 * Canonical local media process owner.
 *
 * One implementation starts and stops spe_runtime.media_product.route_host and
 * proxies same-origin /api/media. Production static serve, Vite configureServer,
 * and Vite configurePreviewServer all call this owner. Do not spawn a second
 * ASR engine here.
 */
import http from "node:http";
import { spawn } from "node:child_process";

const UNAVAILABLE = JSON.stringify({
  status: "ERROR",
  text: "",
  mode: "UNAVAILABLE",
  errorCode: "NOT_MOUNTED",
  neuralSessionRan: false,
  timestampsProven: false,
  segments: [],
  progressPercent: null,
  egressAttempts: 0,
});

/**
 * @param {{ repoRoot: string, env?: NodeJS.ProcessEnv }} opts
 */
export function createLocalMediaHost(opts) {
  const repoRoot = opts.repoRoot;
  const env = opts.env ?? process.env;
  let child = null;
  let ready = null;

  function stop() {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
    child = null;
    ready = null;
  }

  function ensure() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      child = spawn("python3", ["-m", "spe_runtime.media_product.route_host"], {
        cwd: repoRoot,
        env: { ...env, PYTHONPATH: repoRoot, PYTHONUNBUFFERED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        reject(new Error(`local media host did not bind: ${err.slice(-800)}`));
      }, 20000);
      child.stdout.on("data", (buf) => {
        out += buf.toString();
        process.stdout.write(buf);
        const match = out.match(/MEDIA_HOST (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.stderr.on("data", (buf) => {
        err += buf.toString();
        process.stderr.write(buf);
      });
      child.on("exit", (code) => {
        ready = null;
        child = null;
        if (code !== 0 && code !== null) {
          clearTimeout(timer);
          reject(new Error(`local media host exited ${code}: ${err.slice(-800)}`));
        }
      });
    });
    ready.catch(() => {
      ready = null;
    });
    return ready;
  }

  function fireCancel(port, jobId) {
    if (!jobId || typeof jobId !== "string") return;
    const payload = JSON.stringify({ jobId });
    const cancel = http.request({
      hostname: "127.0.0.1",
      port,
      path: "/cancel",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      },
    });
    cancel.on("error", () => {});
    cancel.end(payload);
  }

  async function proxy(req, res) {
    const port = await ensure();
    const url = req.url || "";
    const path = url.slice("/api/media".length).split("?")[0] || "/";
    const headers = {};
    for (const name of ["content-type", "content-length", "x-spe-job-id", "x-spe-file-name"]) {
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
      proxyReq.setTimeout(600000, () => {
        proxyReq.destroy();
      });
      proxyReq.on("error", () => {
        if (!res.headersSent) {
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          res.end(UNAVAILABLE);
        }
        resolve();
      });
      req.on("aborted", () => fireCancel(port, req.headers["x-spe-job-id"]));
      req.pipe(proxyReq);
    });
  }

  async function handleApi(req, res) {
    try {
      await proxy(req, res);
    } catch {
      if (!res.headersSent) {
        res.statusCode = 503;
        res.setHeader("content-type", "application/json");
        res.end(UNAVAILABLE);
      }
    }
  }

  function attach(middlewares) {
    middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api/media/")) return next();
      void handleApi(req, res);
    });
  }

  return {
    name: "spe-local-media-host",
    ensure,
    stop,
    attach,
    handleApi,
    isApi(url) {
      return typeof url === "string" && url.startsWith("/api/media/");
    },
  };
}
