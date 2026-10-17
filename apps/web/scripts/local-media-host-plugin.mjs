/**
 * Vite hook into the canonical local media host owner.
 * Dev and preview call the same createLocalMediaHost used by the
 * production static server (serve-local-product.mjs). No second engine.
 */
import { createLocalMediaHost } from "./local-media-host.mjs";

export function localMediaHostPlugin(repoRoot) {
  const host = createLocalMediaHost({ repoRoot });
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
