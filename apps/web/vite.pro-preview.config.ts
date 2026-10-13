// PREVIEW-ONLY: serves the merged Pro output (dist-pro-all) so /pro/, /pro/studio/ and the other /pro/* pages share one origin.
// Build it with: node scripts/build-pro-all.mjs
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  build: { outDir: fileURLToPath(new URL("./dist-pro-all", import.meta.url)) },
  preview: { host: "127.0.0.1", port: 4199, headers: { "X-Robots-Tag": "noindex, nofollow" } },
});
