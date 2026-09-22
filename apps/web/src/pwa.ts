/** Register once even when React mounts after the document load event. */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      /* A failed install never substitutes a remote compiler. */
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
