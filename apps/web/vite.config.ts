import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const buildSha =
  process.env.SPE_BUILD_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

export default defineConfig({
  plugins: [react()],
  define: {
    __SPE_BUILD_SHA__: JSON.stringify(buildSha),
  },
  resolve: {
    alias: {
      "@spe/human-perspective": fileURLToPath(new URL("../../packages/human-perspective/src/index.ts", import.meta.url)),
      "@spe/web-runtime": fileURLToPath(
        new URL("../../packages/web-runtime/src/index.ts", import.meta.url),
      ),
      "@spe/design-system": fileURLToPath(
        new URL("../../packages/design-system/src/tokens.css", import.meta.url),
      ),
    },
  },
  worker: { format: "es" },
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("onnxruntime-web")) return "ort-wasm";
          if (id.includes("react-three-fiber") || id.includes("/three/"))
            return "r3f";
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  preview: { host: "127.0.0.1", port: 4173 },
  server: { host: "127.0.0.1", port: 5173 },
});
