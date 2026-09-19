import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
      },
    },
  },
  preview: { host: "127.0.0.1", port: 4173 },
  server: { host: "127.0.0.1", port: 5173 },
});
