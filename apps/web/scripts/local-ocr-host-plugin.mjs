/**
 * Vite hook into the canonical local OCR host. No second engine.
 */
import { createLocalOcrHost } from "./local-ocr-host.mjs";

export function localOcrHostPlugin(repoRoot) {
  const host = createLocalOcrHost({ repoRoot });
  return {
    name: host.name,
    configureServer(server) {
      host.attach(server.middlewares);
      server.httpServer?.on("close", () => host.stop());
    },
    configurePreviewServer(server) {
      host.attach(server.middlewares);
      server.httpServer?.on("close", () => host.stop());
    },
  };
}
