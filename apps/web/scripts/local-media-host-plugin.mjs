/**
 * App server hook. Starts the pinned LocalMediaSession route host.
 * The test does not spawn this. A normal /media visit on this server
 * reaches the host on the same origin, which keeps connect-src 'self'.
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

export function localMediaHostPlugin(repoRoot) {
  let child = null;
  let ready = null;

  function stop() {
    if (child && !child.killed) child.kill("SIGTERM");
  }

  function ensure() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      child = spawn("python3", ["-m", "spe_runtime.media_product.route_host"], {
        cwd: repoRoot,
        env: { ...process.env, PYTHONPATH: repoRoot, PYTHONUNBUFFERED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        reject(new Error(`local media host did not bind: ${err.slice(-800)}`));
      }, 20000);
      child.stdout.on("data", (buf) => {
        out += buf.toString();
        const match = out.match(/MEDIA_HOST (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.stderr.on("data", (buf) => {
        err += buf.toString();
      });
      child.on("exit", (code) => {
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
      proxyReq.setTimeout(180000, () => {
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

  function attach(middlewares) {
    middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api/media/")) return next();
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
    name: "spe-local-media-host",
    configureServer(server) {
      attach(server.middlewares);
      server.httpServer?.on("close", stop);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
      server.httpServer?.on("close", stop);
    },
  };
}
