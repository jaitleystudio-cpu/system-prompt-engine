/* SPE Web/PWA service worker.
 * Precache app-shell + WASM bytes only.
 * Never cache private prompts or request bodies.
 * Skip POST (and any non-GET). Do not cache user compile payloads.
 * No Python in the browser path. not_a_release. NEW_IMPLEMENTATION.
 */
const CACHE = "spe-web-shell-v1";
const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/spe_wasm.wasm",
  "/spe_wasm.sha256.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    // Never cache POST / compile bodies / private prompts.
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // No third-party fetches in the product path.
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (!res || !res.ok) return res;
        const dest = req.destination;
        const cacheable =
          dest === "script" ||
          dest === "style" ||
          dest === "worker" ||
          dest === "document" ||
          dest === "manifest" ||
          url.pathname.endsWith(".wasm") ||
          url.pathname.endsWith(".json") && url.pathname.includes("spe_wasm");
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
