/**
 * SPE Browser Compatibility Layer (Universal WebExtensions Polyfill)
 * Normalized abstraction for Google Chrome, Apple Safari, Mozilla Firefox, and Microsoft Edge.
 * Zero external dependencies. 100% offline safe.
 */

export const speBrowser = (function () {
  // Determine available browser API namespace
  const hasBrowser = typeof globalThis.browser !== "undefined" && typeof globalThis.browser.runtime !== "undefined";
  const hasChrome = typeof globalThis.chrome !== "undefined" && typeof globalThis.chrome.runtime !== "undefined";
  const rawApi = hasBrowser ? globalThis.browser : (hasChrome ? globalThis.chrome : null);

  // Runtime platform detection
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isFirefox = /Firefox\/\d+/i.test(ua);
  const isEdge = /Edg\/\d+/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua) && !/Chromium/i.test(ua);
  const isChrome = /Chrome\/\d+/i.test(ua) && !isEdge;
  const isOpera = /OPR\/\d+/i.test(ua);
  const isBrave = typeof navigator !== "undefined" && (navigator.brave !== undefined);

  function getBrowserName() {
    if (isSafari) return "Safari";
    if (isFirefox) return "Firefox";
    if (isEdge) return "Edge";
    if (isBrave) return "Brave";
    if (isOpera) return "Opera";
    if (isChrome) return "Chrome";
    return "Universal WebExtension";
  }

  // Promise-based wrapper around chrome / browser storage
  const storage = {
    local: {
      get: (keys) => {
        return new Promise((resolve, reject) => {
          if (!rawApi || !rawApi.storage || !rawApi.storage.local) {
            // Memory fallback if storage API is absent (e.g. testing)
            return resolve({});
          }
          if (hasBrowser && typeof globalThis.browser.storage.local.get(keys)?.then === "function") {
            return globalThis.browser.storage.local.get(keys).then(resolve, reject);
          }
          try {
            rawApi.storage.local.get(keys, (result) => {
              if (rawApi.runtime?.lastError) {
                return reject(rawApi.runtime.lastError);
              }
              resolve(result || {});
            });
          } catch (err) {
            resolve({});
          }
        });
      },
      set: (items) => {
        return new Promise((resolve, reject) => {
          if (!rawApi || !rawApi.storage || !rawApi.storage.local) {
            return resolve();
          }
          if (hasBrowser && typeof globalThis.browser.storage.local.set(items)?.then === "function") {
            return globalThis.browser.storage.local.set(items).then(resolve, reject);
          }
          try {
            rawApi.storage.local.set(items, () => {
              if (rawApi.runtime?.lastError) {
                return reject(rawApi.runtime.lastError);
              }
              resolve();
            });
          } catch (err) {
            resolve();
          }
        });
      }
    },
    sync: {
      get: (keys) => {
        return new Promise((resolve) => {
          const syncStore = rawApi?.storage?.sync || rawApi?.storage?.local;
          if (!syncStore) return resolve({});
          try {
            syncStore.get(keys, (res) => resolve(res || {}));
          } catch {
            resolve({});
          }
        });
      },
      set: (items) => {
        return new Promise((resolve) => {
          const syncStore = rawApi?.storage?.sync || rawApi?.storage?.local;
          if (!syncStore) return resolve();
          try {
            syncStore.set(items, () => resolve());
          } catch {
            resolve();
          }
        });
      }
    }
  };

  // Tabs helper
  const tabs = {
    create: (createProperties) => {
      return new Promise((resolve) => {
        if (!rawApi?.tabs?.create) {
          if (typeof window !== "undefined") {
            window.open(createProperties.url, "_blank");
          }
          return resolve(null);
        }
        try {
          rawApi.tabs.create(createProperties, (tab) => resolve(tab));
        } catch {
          resolve(null);
        }
      });
    },
    query: (queryInfo) => {
      return new Promise((resolve) => {
        if (!rawApi?.tabs?.query) return resolve([]);
        try {
          rawApi.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
        } catch {
          resolve([]);
        }
      });
    }
  };

  // Runtime messaging helper
  const runtime = {
    getURL: (path) => {
      if (rawApi?.runtime?.getURL) return rawApi.runtime.getURL(path);
      return path;
    },
    sendMessage: (msg) => {
      return new Promise((resolve) => {
        if (!rawApi?.runtime?.sendMessage) return resolve({ status: "NO_RUNTIME" });
        try {
          rawApi.runtime.sendMessage(msg, (response) => {
            if (rawApi.runtime?.lastError) {
              return resolve({ status: "ERROR", error: rawApi.runtime.lastError.message });
            }
            resolve(response || { status: "OK" });
          });
        } catch (e) {
          resolve({ status: "ERROR", error: e.message });
        }
      });
    }
  };

  return {
    raw: rawApi,
    name: getBrowserName(),
    isSafari,
    isFirefox,
    isEdge,
    isChrome,
    isOpera,
    isBrave,
    storage,
    tabs,
    runtime
  };
})();
