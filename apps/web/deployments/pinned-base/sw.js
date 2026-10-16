/* SPE Web/PWA service worker.
 * Precache app-shell + WASM bytes only.
 * Never cache private prompts or request bodies.
 * Skip POST (and any non-GET). Do not cache user compile payloads.
 * No Python in the browser path. not_a_release. NEW_IMPLEMENTATION.
 */
const CACHE = "spe-web03-94bdff6f4b11";
const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/art/intent-core.webp",
  "/spe_wasm.wasm",
  "/spe_wasm.sha256.json",
  "/assets/AiIncidentWire-DYLVeop3.js",
  "/assets/ChallengeResultPage-SRsoNXrK.js",
  "/assets/DailyLab-C0Fy5J08.js",
  "/assets/EvalStudio-5zIleFgX.js",
  "/assets/EvalStudio-DG0VnmaU.css",
  "/assets/HeadToHeadCompare-CHYa18zi.js",
  "/assets/LabStage-rGcXyx5e.js",
  "/assets/MediaProductPanel-CFEDPV7w.css",
  "/assets/MediaRoute-CwsXJPV3.js",
  "/assets/OcrRoute-uq_qyppC.js",
  "/assets/PossibilityEnginePage-CQA9vHN7.js",
  "/assets/Pricing-CJMKiY0Q.css",
  "/assets/Pricing-DtVA5tvY.js",
  "/assets/PromptArsenalPage-CthIo_Lt.js",
  "/assets/PromptArsenalPage-DliF61D-.css",
  "/assets/RealityFrontierPage-CQICnmoG.js",
  "/assets/ResearchRoute-Bje75skk.js",
  "/assets/SemanticRevocationPage-BgJ33jaA.js",
  "/assets/SkillBuilderStudio-B4WcSXh3.js",
  "/assets/UiDropPage---CLlO56.js",
  "/assets/WebsiteProduct-C0RyLVK9.js",
  "/assets/WebsiteProduct-DMrnGom4.css",
  "/assets/WorkflowsCatalog-DU9lmD5s.js",
  "/assets/__vite-browser-external-BIHI7g3E.js",
  "/assets/engine.worker-DW3jy6WS.js",
  "/assets/feedoughComparison-DeXEhnZl.js",
  "/assets/index-CALYsIRn.js",
  "/assets/index-CqBZghax.css",
  "/assets/ort-wasm-juE7TTNY.js",
  "/assets/ort-wasm-simd-threaded-BQQNiIPt.wasm",
  "/assets/r3f-xIa7EeOl.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("spe-web") && k !== CACHE).map((k) => caches.delete(k)))
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
  // Prefer fresh documents; use only the installed public shell when offline.
  // Never persist arbitrary navigation responses (which may contain private data).
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => {
      const cache = await caches.open(CACHE);
      const shell = await cache.match("/index.html");
      return shell || Response.error();
    }));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (!res || !res.ok) return res;
        const dest = req.destination;
        const cacheable =
          dest === "script" ||
          dest === "style" ||
          dest === "worker" ||
          dest === "manifest" ||
          url.pathname.endsWith(".wasm") ||
          (url.pathname.endsWith(".json") && url.pathname.includes("spe_wasm"));
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.open(CACHE).then((cache) => cache.match(req)))
  );
});
