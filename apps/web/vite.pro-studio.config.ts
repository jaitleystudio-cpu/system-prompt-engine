// PRO PREVIEW build for /pro/studio/ (SPE Pro Prompt Studio). Isolated from public-site pages and configs.
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("./pro-studio", import.meta.url));
export default defineConfig({
  root,
  base: "/",
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist-pro-studio", import.meta.url)),
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: { input: { studio: root + "/pro/studio/index.html" } },
  },
  preview: { host: "127.0.0.1", port: 4197, headers: { "X-Robots-Tag": "noindex, nofollow" } },
});
