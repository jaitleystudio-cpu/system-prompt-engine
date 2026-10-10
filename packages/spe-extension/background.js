// SPE Extension Background Service Worker / Background Script
// Universal compatibility for Chrome, Safari, Firefox & Edge
// 100% Offline, Zero Cloud Egress, Local Storage Only

const api = typeof globalThis.browser !== "undefined" && typeof globalThis.browser.runtime !== "undefined"
  ? globalThis.browser
  : globalThis.chrome;

if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      api.storage.local.set({
        selectedModel: "auto",
        shieldActive: true,
        customPrompts: [],
        spe_subscription_tier: "FREE",
        favoriteIds: ["seo-outrank-competitor", "copy-high-converting-landing-page", "write-100-percent-humanizer"]
      });
      console.log("SPE Universal Browser Companion initialized successfully.");
    }
  });
}

if (api && api.runtime && api.runtime.onMessage) {
  api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_CONFIG") {
      api.storage.local.get(["selectedModel", "shieldActive", "favoriteIds", "spe_subscription_tier"], (data) => {
        sendResponse({ status: "OK", data: data || {} });
      });
      return true;
    }
    
    if (request.type === "SET_CONFIG") {
      api.storage.local.set(request.payload, () => {
        sendResponse({ status: "OK" });
      });
      return true;
    }

    if (request.type === "GET_ENTITLEMENT") {
      api.storage.sync.get(["spe_license_data", "spe_subscription_tier"], (data) => {
        sendResponse({ status: "OK", entitlement: data || {} });
      });
      return true;
    }
  });
}
