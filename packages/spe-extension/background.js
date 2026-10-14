// SPE Extension Background Service Worker / Background Script
// Universal compatibility for Chrome, Safari, Firefox & Edge
// 100% Offline, Zero Cloud Egress, Local Storage Only

const api = typeof globalThis.browser !== "undefined" && typeof globalThis.browser.runtime !== "undefined"
  ? globalThis.browser
  : globalThis.chrome;

function injectIntoAllOpenTabs() {
  if (!api || !api.tabs || !api.scripting) return;
  api.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
    if (!tabs) return;
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        api.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] }).catch(() => {});
        api.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
      } catch (e) {
        // Ignore restricted tab errors
      }
    }
  });
}

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
    }
    injectIntoAllOpenTabs();
    console.log("SPE × Awesome Codex Pet initialized and injected into open tabs.");
  });
}

if (api && api.runtime && api.runtime.onStartup) {
  api.runtime.onStartup.addListener(() => {
    injectIntoAllOpenTabs();
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

if (api && api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener((command) => {
    if (command === "spe_quick_action") {
      api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          api.tabs.sendMessage(tabs[0].id, { type: "TRIGGER_SPE_QUICK_ACTION" });
        }
      });
    }
  });
}

