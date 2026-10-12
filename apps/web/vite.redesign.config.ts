// PREVIEW-ONLY build for /redesign/ and /pro/* (Pro previews). Isolated from the production app bundle.
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("./redesign-site", import.meta.url));
export default defineConfig({
  root,
  base: "/",
  build: {
    outDir: fileURLToPath(new URL("./dist-redesign", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: { input: { redesign: root + "/redesign/index.html", regression: root + "/pro/regression-lab/index.html", releases: root + "/pro/releases/index.html", blueprint: root + "/pro/blueprint/index.html" } },
  },
  preview: { host: "127.0.0.1", port: 4180, headers: { "X-Robots-Tag": "noindex, nofollow" } },
});
