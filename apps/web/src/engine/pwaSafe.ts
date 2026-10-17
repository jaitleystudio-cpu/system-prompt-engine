export function getServiceWorkerSafe(): ServiceWorkerContainer | null {
  try {
    if (typeof window === "undefined" || !window.isSecureContext) return null;
    if (
      window.location.origin === "null" ||
      window.location.protocol === "file:" ||
      window.location.protocol === "data:"
    ) {
      return null;
    }
    if (!("serviceWorker" in navigator)) return null;
    return navigator.serviceWorker ?? null;
  } catch {
    return null;
  }
}
