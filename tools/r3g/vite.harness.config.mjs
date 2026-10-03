/**
 * Dev server for the R3-G harness page only.
 * Does not replace apps/web/vite.config.ts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "../../apps/web/node_modules/vite/dist/node/index.js";
import base from "../../apps/web/vite.config.ts";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "harness.html"), "utf8");

export default mergeConfig(base, {
  root: join(here, "../../apps/web"),
  server: {
    host: "127.0.0.1",
    port: 5199,
    strictPort: true,
  },
  plugins: [
    {
      name: "r3g-harness-page",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = (req.url || "/").split("?")[0];
          if (path !== "/__r3g/harness.html") return next();
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(html);
        });
      },
    },
  ],
});
