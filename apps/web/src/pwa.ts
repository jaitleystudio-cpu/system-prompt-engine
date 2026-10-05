import { getServiceWorkerSafe } from "./engine/pwaSafe";

/** Register once even when React mounts after the document load event. */
export function registerServiceWorker(): void {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const sw = getServiceWorkerSafe();
    if (!sw) return;
    const register = () => {
      try {
        void sw.register("/sw.js", { updateViaCache: "none" }).catch(() => {
          /* A failed install never substitutes a remote compiler. */
        });
      } catch {
        /* Sandboxed or restricted environment */
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  } catch {
    /* Guard against SecurityError in opaque/sandboxed origins */
  }
}

